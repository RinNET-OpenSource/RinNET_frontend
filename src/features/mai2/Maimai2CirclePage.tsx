import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import type { Maimai2Music } from './models';
import type {
  ApiResponse,
  Maimai2Circle,
  Maimai2CircleMemberInfo,
  Maimai2RequestJoinCircleUser,
  Maimai2UserCircleInfo,
  PageResponse,
} from './circle-festa-models';
import './Maimai2CirclePage.css';

const PAGE_SIZE = 10;
const emptyCircle = (): Maimai2Circle => ({
  circleId: 0,
  circleClass: 0,
  circleName: '',
  isPlace: false,
  placeId: 0,
  isPublic: false,
  aggrDate: '',
  circleCode: '',
  comment: '',
  isAllowAnyoneJoin: false,
});

function responseOk(response: ApiResponse<unknown>): boolean {
  return response?.status?.code === 92001;
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${assetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

function jacketId(input: number): string {
  return String(input ?? 0).slice(-4).padStart(6, '0');
}

function CirclePager({ page, total, onChange }: { page: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.ceil(total / PAGE_SIZE) || 1;
  return (
    <ul className="pagination justify-content-center d-flex align-items-center">
      <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
        <a className="page-link" onClick={() => page > 0 && onChange(page - 1)}>&nbsp;&lt;&nbsp;</a>
      </li>
      <li className="page-item disabled"><span className="page-link">{page + 1} / {pages}</span></li>
      <li className={`page-item${(page + 1) * PAGE_SIZE >= total ? ' disabled' : ''}`}>
        <a className="page-link" onClick={() => (page + 1) * PAGE_SIZE < total && onChange(page + 1)}>&nbsp;&gt;&nbsp;</a>
      </li>
    </ul>
  );
}

function CircleEditor({
  circle,
  modify,
  onChange,
  onClose,
  onSubmit,
}: {
  circle: Maimai2Circle | null;
  modify: boolean;
  onChange: (circle: Maimai2Circle) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={circle !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="maimai2-circle-dialog d-block modal fade show"
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="maimai2-circle-dialog-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
        unstyled
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <DialogTitle asChild unstyled>
                <h4 className="modal-title" id="modal-basic-title">
                  {t(modify ? 'Maimai2.CirclePage.EditCircle' : 'Maimai2.CirclePage.CreateCircle')}
                </h4>
              </DialogTitle>
              <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
            </div>
            {circle && (
              <div className="modal-body">
                <label htmlFor="circleNameInput" className="form-label">{t('Maimai2.CirclePage.CircleName')}</label>
                <input
                  id="circleNameInput"
                  type="text"
                  className="form-control"
                  value={circle.circleName}
                  onChange={(event) => onChange({ ...circle, circleName: event.target.value })}
                />
                <label htmlFor="circleCommentInput" className="form-label mt-2">{t('Maimai2.CirclePage.Comment')}</label>
                <textarea
                  id="circleCommentInput"
                  rows={5}
                  className="form-control multi-line-ellipsis"
                  value={circle.comment}
                  onChange={(event) => onChange({ ...circle, comment: event.target.value })}
                />
                <div className="form-check mt-2">
                  <input
                    id="circlePublicInput"
                    className="form-check-input"
                    type="checkbox"
                    checked={circle.isPublic}
                    onChange={(event) => onChange({ ...circle, isPublic: event.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="circlePublicInput">{t('Maimai2.CirclePage.Public')}</label>
                </div>
                <div className="form-check mt-2">
                  <input
                    id="circleJoinInput"
                    className="form-check-input"
                    type="checkbox"
                    checked={circle.isAllowAnyoneJoin}
                    onChange={(event) => onChange({ ...circle, isAllowAnyoneJoin: event.target.checked })}
                  />
                  <label className="form-check-label" htmlFor="circleJoinInput">{t('Maimai2.CirclePage.AllowAnyoneJoin')}</label>
                </div>
              </div>
            )}
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>{t('Maimai2.CirclePage.Cancel')}</button>
              <button type="button" className="btn btn-success" onClick={onSubmit}>{t('Maimai2.CirclePage.Submit')}</button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Equivalent to the legacy Maimai2 circle component. */
export function Maimai2CirclePage() {
  const { t } = useTranslation();
  const [aimeId, setAimeId] = useState('');
  const [userCircleInfo, setUserCircleInfo] = useState<Maimai2UserCircleInfo | null>(null);
  const [challengeMusic, setChallengeMusic] = useState<Maimai2Music | null>(null);
  const [publicCircles, setPublicCircles] = useState<Maimai2Circle[]>([]);
  const [publicTotal, setPublicTotal] = useState(0);
  const [publicPage, setPublicPage] = useState(0);
  const [members, setMembers] = useState<Maimai2CircleMemberInfo[]>([]);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberPage, setMemberPage] = useState(0);
  const [requests, setRequests] = useState<Maimai2RequestJoinCircleUser[]>([]);
  const [requestTotal, setRequestTotal] = useState(0);
  const [requestPage, setRequestPage] = useState(0);
  const [editorCircle, setEditorCircle] = useState<Maimai2Circle | null>(null);
  const [isModify, setIsModify] = useState(false);

  async function loadPublic(id: string, page: number) {
    const data = (await api.get('api/game/maimai2/circle', { aimeId: id, page })) as PageResponse<Maimai2Circle>;
    setPublicCircles(data.content ?? []);
    setPublicPage(page);
    setPublicTotal(data.totalElements ?? 0);
  }

  async function loadMembers(id: string, page: number) {
    const data = (await api.get('api/game/maimai2/circleMemberUser', { aimeId: id, page })) as PageResponse<Maimai2CircleMemberInfo>;
    setMembers(data.content ?? []);
    setMemberPage(page);
    setMemberTotal(data.totalElements ?? 0);
  }

  async function loadRequests(id: string, page: number) {
    const data = (await api.get('api/game/maimai2/requestJoinCircleList', { aimeId: id, page })) as PageResponse<Maimai2RequestJoinCircleUser>;
    setRequests(data.content ?? []);
    setRequestPage(page);
    setRequestTotal(data.totalElements ?? 0);
  }

  async function loadCircleInfo(id: string) {
    const response = (await api.get('api/game/maimai2/userCircleInfo', { aimeId: id })) as ApiResponse<Maimai2UserCircleInfo>;
    if (!responseOk(response)) {
      notice(`${t('Maimai2.CirclePage.LoadUserCircleInfoFailed')}: [${response?.status?.code}] ${response?.status?.message}`);
      return;
    }
    const info = response.data ?? (response as unknown as Maimai2UserCircleInfo);
    setUserCircleInfo(info);
    const musicId = info?.circleChallenge?.musicId ?? info?.userCircleChallenge?.musicId ?? 0;
    if (!musicId) {
      setChallengeMusic(null);
      return;
    }
    try {
      const musicResponse = await api.get('api/game/maimai2/data/music', { id: musicId });
      const music = musicResponse?.data ?? musicResponse;
      setChallengeMusic(music && typeof music === 'object' ? {
        ...music,
        name: typeof music.name === 'string' ? music.name : '',
        artistName: typeof music.artistName === 'string' ? music.artistName : '',
        details: Array.isArray(music.details) ? music.details : [],
      } as Maimai2Music : null);
    } catch {
      setChallengeMusic(null);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await Promise.all([loadPublic(id, 0), loadCircleInfo(id), loadRequests(id, 0), loadMembers(id, 0)]);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => { active = false; };
  }, []);

  const mutate = async (path: string, successKey: string, failureKey: string, params?: Record<string, string | number>, body?: object) => {
    try {
      const response = (await api.post(path, body, { aimeId, ...params })) as ApiResponse<boolean>;
      if (responseOk(response)) {
        notice(t(`Maimai2.CirclePage.${successKey}`), 'success');
        return true;
      }
      notice(`${t(`Maimai2.CirclePage.${failureKey}`)}: [${response?.status?.code}] ${response?.status?.message}`);
    } catch (error) {
      notice(String(error));
    }
    return false;
  };

  const copyCircleCode = async (circle: Maimai2Circle) => {
    try {
      await navigator.clipboard.writeText(circle.circleCode);
      notice(t('Maimai2.CirclePage.CopyCircleCodeSuccess'), 'success');
    } catch (error) {
      notice(String(error));
    }
  };

  const formatBoolean = (value: boolean | null | undefined) => value == null
    ? t('Maimai2.CirclePage.Dash')
    : t(value ? 'Maimai2.CirclePage.Yes' : 'Maimai2.CirclePage.No');
  const formatAchievement = (value: number | null | undefined) => value == null
    ? t('Maimai2.CirclePage.Dash')
    : `${(value / 10_000).toFixed(4)}%`;
  const rewardStatus = (value: boolean | null | undefined) => value == null
    ? t('Maimai2.CirclePage.Dash')
    : t(value ? 'Maimai2.CirclePage.Claimed' : 'Maimai2.CirclePage.Pending');

  const challengeId = userCircleInfo?.circleChallenge?.musicId ?? userCircleInfo?.userCircleChallenge?.musicId ?? 0;
  const levelSummary = challengeMusic?.details
    ?.filter((detail): detail is NonNullable<typeof detail> => Boolean(detail))
    .sort((left, right) => left.diff - right.diff)
    .map((detail) => {
      const labels = ['Basic', 'Advanced', 'Expert', 'Master', 'ReMaster', 'Utage'];
      const label = labels[detail.diff]
        ? t(`Maimai2.CirclePage.${labels[detail.diff]}`)
        : `${t('Maimai2.CirclePage.Diff')} ${detail.diff}`;
      return `${label} ${(detail.levelDecimal / 10).toFixed(1)}`;
    })
    .join(' / ') ?? '';

  async function submitEditor() {
    if (!editorCircle) return;
    const path = isModify ? 'api/game/maimai2/updateCircle' : 'api/game/maimai2/createCircle';
    const ok = await mutate(
      path,
      isModify ? 'UpdateCircleSuccess' : 'CreateCircleSuccess',
      isModify ? 'UpdateCircleFailed' : 'CreateCircleFailed',
      undefined,
      editorCircle,
    );
    setEditorCircle(null);
    if (ok) await loadCircleInfo(aimeId);
  }

  async function kick(member: Maimai2CircleMemberInfo) {
    if (!window.confirm(t('Maimai2.CirclePage.KickUserConfirm', { userName: member.userProfile.userName }))) return;
    if (await mutate('api/game/maimai2/deleteUserToCircle', 'KickUserSuccess', 'KickUserFailed', { userCode: member.userCode })) {
      await loadMembers(aimeId, memberPage);
    }
  }

  async function leaveOrDissolve(dissolve: boolean) {
    const circleName = userCircleInfo?.joinedCircle?.circleName ?? '';
    const confirmKey = dissolve ? 'DissolveCircleConfirm' : 'ExitCircleConfirm';
    if (!window.confirm(t(`Maimai2.CirclePage.${confirmKey}`, { circleName }))) return;
    const ok = await mutate(
      dissolve ? 'api/game/maimai2/dissolveCircle' : 'api/game/maimai2/exitCircle',
      dissolve ? 'DissolveCircleSuccess' : 'ExitCircleSuccess',
      dissolve ? 'DissolveCircleFailed' : 'ExitCircleFailed',
    );
    if (ok) await loadCircleInfo(aimeId);
  }

  return (
    <div className="maimai2-circle-page">
      <h1 className="page-heading">{t('Maimai2.CirclePage.Title')}</h1>

      <h3 className="page-heading">{t('Maimai2.CirclePage.JoinedCircle')}</h3>
      {!userCircleInfo?.joinedCircle && <div className="alert alert-info">{t('Maimai2.CirclePage.JoinedCircleEmpty')}</div>}

      {userCircleInfo?.joinedCircle && (
        <div>
          <div className="card mb-4">
            <div className="card-body">
              <div className="overflow-hidden" style={{ textOverflow: 'ellipsis' }}>
                <h3 className="text-nowrap mb-2 fw-bold m-0">{userCircleInfo.joinedCircle.circleName}</h3>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.PlaceCircle')}:</span><span>{formatBoolean(userCircleInfo.joinedCircle.isPlace)}</span></div>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.CircleClass')}:</span><span>{userCircleInfo.joinedCircle.circleClass}</span></div>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.Public')}:</span><span>{formatBoolean(userCircleInfo.joinedCircle.isPublic)}</span></div>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.AllowAnyoneJoin')}:</span><span>{formatBoolean(userCircleInfo.joinedCircle.isAllowAnyoneJoin)}</span></div>
                <div className="d-flex mb-3 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.PlaceId')}:</span><span>{userCircleInfo.joinedCircle.placeId}</span></div>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.PointUpdateDate')}:</span><span>{userCircleInfo.userCirclePointData?.aggrDate}</span></div>
                <div className="d-flex mb-1 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.Point')}:</span><span>{userCircleInfo.userCirclePointData?.point ?? 0}pt ({userCircleInfo.userCirclePointRankingResult?.lastMonthPoint ?? 0}pt {t('Maimai2.CirclePage.LastMonth')})</span></div>
                <div className="d-flex mb-3 align-items-baseline"><span className="fw-bold fs-8 me-2">{t('Maimai2.CirclePage.LastMonthRank')}:</span><span>{userCircleInfo.userCirclePointRankingResult?.lastMonthCircleRank}</span></div>
                {userCircleInfo.joinedCircle.comment && <div className="card d-flex"><div className="card-body"><span className="comment-text">{userCircleInfo.joinedCircle.comment}</span></div></div>}
              </div>
            </div>
            <div className="card-footer">
              <div className="d-flex justify-content-between">
                <div className="align-items-center d-flex">{userCircleInfo.userCircleData?.lastLoginDate}</div>
                <div>
                  <button className="btn btn-primary btn-sm horizon-margin" onClick={() => void copyCircleCode(userCircleInfo.joinedCircle!)}>{t('Maimai2.CirclePage.CopyCircleCode')}</button>
                  {!userCircleInfo.isCircleOwner && <button className="btn btn-danger btn-sm horizon-margin" onClick={() => void leaveOrDissolve(false)}>{t('Maimai2.CirclePage.ExitCircle')}</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {(userCircleInfo?.circleChallenge || userCircleInfo?.userCircleChallenge) && (
        <div>
          <h3 className="page-heading">{t('Maimai2.CirclePage.ChallengeSection')}</h3>
          <div className="card mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-start">
                {enableImages && challengeId !== 0 && (
                  <div className="col-12 col-md-auto">
                    <img className="challenge-jacket rounded" src={`${assetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(challengeId)}.webp`} onError={imageFallback} alt="" />
                  </div>
                )}
                <div className="col">
                  {challengeMusic && (
                    <div className="mb-3">
                      <div className="small text-body-secondary">{t('Maimai2.CirclePage.ChallengeSong')}</div>
                      <h4 className="mb-1">{challengeMusic.name}</h4>
                      <div className="text-body-secondary">{challengeMusic.artistName}</div>
                      <div className="challenge-meta mt-2">
                        <div><span className="fw-bold me-2">{t('Maimai2.CirclePage.MusicId')}:</span><span>{challengeMusic.musicId}</span></div>
                        {levelSummary && <div><span className="fw-bold me-2">{t('Maimai2.CirclePage.Levels')}:</span><span>{levelSummary}</span></div>}
                      </div>
                    </div>
                  )}
                  <div className="row g-3">
                    {userCircleInfo.circleChallenge && (
                      <div className="col-12 col-xl-6">
                        <div className="challenge-panel h-100">
                          <div className="challenge-meta">
                            <div><span className="fw-bold me-2">{t('Maimai2.CirclePage.UpdateDate')}:</span><span>{userCircleInfo.circleChallenge.updateDate || t('Maimai2.CirclePage.Dash')}</span></div>
                            <div><span className="fw-bold me-2">{t('Maimai2.CirclePage.RewardStatus')}:</span><span>{rewardStatus(userCircleInfo.circleChallenge.rewardStatus)}</span></div>
                          </div>
                          <div className="challenge-progress mt-auto">
                            <div className="d-flex justify-content-between align-items-center mb-2"><span className="fw-bold">{t('Maimai2.CirclePage.TotalAchievement')}</span><span>{formatAchievement(userCircleInfo.circleChallenge.achievement)}</span></div>
                            <div className="progress challenge-progress-bar" role="progressbar" aria-valuenow={Math.max(0, Math.min((userCircleInfo.circleChallenge.achievement / 10_000_000) * 100, 100))} aria-valuemin={0} aria-valuemax={100}>
                              <div className="progress-bar" style={{ width: `${Math.max(0, Math.min((userCircleInfo.circleChallenge.achievement / 10_000_000) * 100, 100))}%` }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {userCircleInfo?.isCircleOwner && (
        <div>
          <h3 className="page-heading">{t('Maimai2.CirclePage.ManageYourCircle')}</h3>
          <div className="card mb-4">
            <div className="card-body">
              <div className="d-flex mb-2"><div className="align-items-center d-flex">
                <button className="btn-sm btn btn-primary" onClick={() => { setIsModify(true); setEditorCircle({ ...userCircleInfo.joinedCircle! }); }}>{t('Maimai2.CirclePage.EditCircle')}</button>
                <button className="btn btn-danger btn-sm horizon-margin" onClick={() => void leaveOrDissolve(true)}>{t('Maimai2.CirclePage.DissolveCircle')}</button>
              </div></div>
              {userCircleInfo.joinedCircle && (
                <div>
                  <h5 className="page-heading mt-5">{t('Maimai2.CirclePage.CircleMembers')}</h5>
                  <div className="table-responsive">
                    <table className="table table-striped align-middle">
                      <thead><tr><th>{t('Maimai2.CirclePage.Name')}</th><th>{t('Maimai2.CirclePage.Rating')}</th><th>{t('Maimai2.CirclePage.Point')}</th><th>{t('Maimai2.CirclePage.Achievement')}</th><th>{t('Maimai2.CirclePage.LastLogin')}</th><th>{t('Maimai2.CirclePage.Action')}</th></tr></thead>
                      <tbody>{members.map((member) => (
                        <tr key={member.userCode}>
                          <td>{member.userProfile.userName}</td><td>{member.userProfile.playerRating}</td>
                          <td>{member.userCirclePointData?.point ? `${member.userCirclePointData.point}pt` : null}</td>
                          <td>{member.userCircleChallenge ? <div className="challenge-meta challenge-cell"><div>{formatAchievement(member.userCircleChallenge.achievement)}</div></div> : t('Maimai2.CirclePage.Dash')}</td>
                          <td>{member.userCircleData?.lastLoginDate}</td>
                          <td><button className="btn btn-outline-danger btn-sm horizon-margin" onClick={() => void kick(member)}>{t('Maimai2.CirclePage.Kick')}</button></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  <CirclePager page={memberPage} total={memberTotal} onChange={(page) => void loadMembers(aimeId, page)} />
                  <h5 className="page-heading mt-5">{t('Maimai2.CirclePage.JoinRequests')}</h5>
                  {requestTotal > 0 ? (
                    <div>
                      <table className="user-table">
                        <thead><tr><th>{t('Maimai2.CirclePage.Name')}</th><th>{t('Maimai2.CirclePage.ClassGrade')}</th><th>{t('Maimai2.CirclePage.Rating')}</th><th>{t('Maimai2.CirclePage.LastPlay')}</th><th>{t('Maimai2.CirclePage.RequestTime')}</th><th>{t('Maimai2.CirclePage.Action')}</th></tr></thead>
                        <tbody>{requests.map((request) => (
                          <tr key={request.userCode}>
                            <td>{request.userProfile.userName}</td><td>{request.userProfile.classRank} / {request.userProfile.gradeRank}</td><td>{request.userProfile.playerRating}</td><td>{request.userProfile.lastPlayDate}</td><td>{request.requestTime}</td>
                            <td>
                              <button className="btn btn-outline-success btn-sm horizon-margin" onClick={async () => { if (await mutate('api/game/maimai2/approveUserJoinCircle', 'ApproveJoinSuccess', 'ApproveJoinFailed', { userCode: request.userCode })) { await Promise.all([loadRequests(aimeId, requestPage), loadMembers(aimeId, memberPage)]); } }}>{t('Maimai2.CirclePage.Approve')}</button>
                              <button className="btn btn-outline-danger btn-sm horizon-margin" onClick={async () => { if (await mutate('api/game/maimai2/rejectUserJoinCircle', 'RejectJoinSuccess', 'RejectJoinFailed', { userCode: request.userCode })) await loadRequests(aimeId, requestPage); }}>{t('Maimai2.CirclePage.Reject')}</button>
                            </td>
                          </tr>
                        ))}</tbody>
                      </table>
                      <CirclePager page={requestPage} total={requestTotal} onChange={(page) => void loadRequests(aimeId, page)} />
                    </div>
                  ) : <div className="alert alert-info">{t('Maimai2.CirclePage.NoJoinRequests')}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <h3 className="page-heading mt-4">{t('Maimai2.CirclePage.PublicCircles')}</h3>
      <button className="btn-sm btn btn-primary mb-4" onClick={() => { setIsModify(false); setEditorCircle(emptyCircle()); }}>{t('Maimai2.CirclePage.CreateCircle')}</button>
      {publicTotal > 0 ? (
        <div className="mb-4">
          <div className="row">
            {publicCircles.map((circle) => (
              <div className="col-md-6 mb-3" key={circle.circleId}>
                <div className="card position-relative h-100">
                  {!userCircleInfo?.joinedCircle && <button className="btn btn-primary btn-sm position-absolute top-0 end-0 m-2" onClick={() => void mutate('api/game/maimai2/requestJoinCircle', 'JoinCircleSuccess', 'JoinCircleFailed', { circleId: circle.circleId })}>{t('Maimai2.CirclePage.Join')}</button>}
                  <div className="card-body">
                    <h5 className="card-title">{circle.circleName}</h5>
                    <h6 className="card-subtitle mb-2 text-muted">{t('Maimai2.CirclePage.PlaceId')}: {circle.placeId}</h6>
                    <h6 className="card-subtitle mb-2 text-muted">{t('Maimai2.CirclePage.Class')}: {circle.circleClass}</h6>
                    {circle.comment && <div className="card"><div className="card-body"><span className="comment-text">{circle.comment}</span></div></div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <CirclePager page={publicPage} total={publicTotal} onChange={(page) => void loadPublic(aimeId, page)} />
        </div>
      ) : <div className="alert alert-info">{t('Maimai2.CirclePage.NoPublicCircles')}</div>}

      <CircleEditor circle={editorCircle} modify={isModify} onChange={setEditorCircle} onClose={() => setEditorCircle(null)} onSubmit={() => void submitEditor()} />
    </div>
  );
}
