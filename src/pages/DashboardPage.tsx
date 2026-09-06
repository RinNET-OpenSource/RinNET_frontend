import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import {
  ExclamationTriangleFill,
  CheckLg,
  XLg,
  QuestionLg,
} from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import { getCurrentLang, langStore } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { assetsHost, enableImages } from '@/lib/utils';
import { characterImage, compareVersion, formatNumber, fullWidth, padDigits } from '@/lib/format';
import { preloadStates, checkingUpdate, dbVersionStore, reload } from '@/lib/db/preload';
import { Announcement } from '@/features/announcements/announcement';
import '@/features/announcements/AnnouncementDialog.css';

interface GameProfile {
  accessCode?: string;
  userName?: string;
  cardId?: number;
  characterId?: number;
  iconId?: number;
  level?: number;
  reincarnationNum?: number;
  playerRating?: number;
  newPlayerRating?: number;
  battlePoint?: number;
  overPowerRate?: number;
  totalAwake?: number;
  playCount?: number;
  lastRomVersion?: string;
  lastPlayDate?: string;
}

const MASK = '11001111000000000000';
function maskedLuid(full: string): string {
  let result = '';
  for (let i = 0; i < MASK.length; i++) {
    const char = MASK.at(i);
    if (char === '0') result += '*';
    else if (char === '1') result += full?.at(i) ?? '';
    else result += char as string;
  }
  return result;
}

/** 等价旧版 dashboard.component */
export function DashboardPage() {
  const { t } = useTranslation();
  const lang = useStore(langStore);
  const states = useStore(preloadStates);
  const checking = useStore(checkingUpdate);
  const dbVersion = useStore(dbVersionStore);

  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loadingAnnouncement, setLoadingAnnouncement] = useState(true);
  const [recentUpdate, setRecentUpdate] = useState<Announcement | null>(null);
  const [loadingUpdate, setLoadingUpdate] = useState(true);
  const [detail, setDetail] = useState<Announcement | null>(null);

  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState(false);
  const [noCard, setNoCard] = useState(false);
  const [currentCard, setCurrentCard] = useState<string | undefined>();
  const [ongekiProfile, setOngekiProfile] = useState<GameProfile | null>(null);
  const [chusanProfile, setChusanProfile] = useState<GameProfile | null>(null);
  const [mai2Profile, setMai2Profile] = useState<GameProfile | null>(null);

  const [loadingKeychip, setLoadingKeychip] = useState(true);
  const [loadingTrustedKeychip, setLoadingTrustedKeychip] = useState(true);
  const [hasKeychip, setHasKeychip] = useState(false);
  const [hasTrustedKeychip, setHasTrustedKeychip] = useState(false);

  useEffect(() => {
    setLoadingAnnouncement(true);
    setLoadingUpdate(true);
    void api
      .get('api/user/announcement/recent', { lang: getCurrentLang() })
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setAnnouncement(Announcement.fromJSON(resp.data));
          } else {
            notice(resp.status.message);
          }
          setLoadingAnnouncement(false);
        }
      })
      .catch((error) => {
        notice(String(error));
        setLoadingAnnouncement(false);
      });
    void api
      .get('api/user/announcement/recent', { lang: getCurrentLang(), type: 'UPDATE' })
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setRecentUpdate(Announcement.fromJSON(resp.data));
          } else {
            notice(resp.status.message);
          }
          setLoadingUpdate(false);
        }
      })
      .catch((error) => {
        notice(String(error));
        setLoadingUpdate(false);
      });
  }, [lang]);

  useEffect(() => {
    void api
      .get('api/user/profiles')
      .then((resp) => {
        if (resp?.status) {
          const statusCode: number = resp.status.code;
          if (statusCode === StatusCode.OK && resp.data) {
            setChusanProfile(resp.data.chusan ?? null);
            setOngekiProfile(resp.data.ongeki ?? null);
            setMai2Profile(resp.data.maimai2 ?? null);
            const accessCode =
              resp.data.chusan?.accessCode || resp.data.ongeki?.accessCode || resp.data.maimai2?.accessCode;
            if (accessCode) {
              setCurrentCard(maskedLuid(accessCode));
            }
          } else if (statusCode === StatusCode.NOT_FOUND) {
            setNoCard(true);
          } else {
            notice(resp.status.message);
            setProfilesError(true);
          }
        }
        setLoadingProfiles(false);
      })
      .catch((error) => {
        notice(String(error));
        setLoadingProfiles(false);
        setProfilesError(true);
      });

    void api
      .get('api/user/keychip')
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setHasKeychip(resp.data.length > 0);
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Load keychips failed.');
        }
        setLoadingKeychip(false);
      })
      .catch((error) => notice(String(error)));

    void api
      .get('api/user/keychip/trustKeychip')
      .then((resp) => {
        if (resp?.status) {
          if (resp.status.code === StatusCode.OK && resp.data) {
            setHasTrustedKeychip(resp.data.length > 0);
          } else {
            notice(resp.status.message);
          }
        } else {
          notice('Load trusted keychips failed.');
        }
        setLoadingTrustedKeychip(false);
      })
      .catch((error) => notice(String(error)));
  }, []);

  // 预载任务统计（16 项）
  const preloadStats = useMemo(() => {
    const values = Object.values(states);
    const total = 16;
    const downloading = values.filter((s) => s === 'Downloading').length;
    const completed = values.filter((s) => s === 'OK').length;
    const error = values.filter((s) => s === 'Error').length;
    const loadingDatabase = completed + error < total;
    return { total, downloading, completed, error, loadingDatabase };
  }, [states]);

  const announcementItem = (a: Announcement) => (
    <li className="list-group-item card-btn" key={a.id} onClick={() => setDetail(a)}>
      <div className="d-flex align-items-center gap-1 mb-1">
        <div className="fw-light small text-secondary">{a.updatedAt.toLocaleDateString()}</div>
        <span className={typeBadgeClass[a.type] + ' badge rounded-pill'}>
          {t('AnnouncementsPage.' + typeLabel(a.type))}
        </span>
        {a.priority > 0 && (
          <span className="bg-danger-subtle text-danger badge rounded-pill border-danger-subtle border-1 border-solid">
            {t('AnnouncementsPage.Pinned')}
          </span>
        )}
      </div>
      <h4 className="mb-1">{a.title}</h4>
    </li>
  );

  const announcementPlaceholder = (
    <li className="list-group-item placeholder-glow">
      <div className="d-flex align-items-center gap-1 mb-1">
        <div className="placeholder fw-light small text-secondary" style={{ width: '8em' }} />
      </div>
      <h4 className="placeholder mb-1" style={{ width: '12em' }} />
    </li>
  );

  const announcementError = (
    <li className="list-group-item">
      <div className="d-flex align-items-center gap-1 mb-1">
        <div className="fw-light small text-secondary" style={{ width: '8em' }} />
      </div>
      <h4 className="my-2">{t('App.Messages.LoadingFailed')}</h4>
    </li>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('DashboardPage.Title')}</h1>
      <div className="row">
        <div className="col-12 col-lg-8">
          <div className="mb-4">
            <div className="mb-3 d-flex justify-content-between align-items-end">
              <h3 className="m-0">{t('DashboardPage.LatestAnnouncement')}</h3>
              <Link className="more-announcements" to="/announcements">
                {t('DashboardPage.More')}
              </Link>
            </div>
            <div className="card user-select-none mb-2">
              <ul className="list-group list-group-flush">
                {loadingAnnouncement && announcementPlaceholder}
                {!loadingAnnouncement && !announcement && announcementError}
                {!loadingAnnouncement && announcement && announcementItem(announcement)}
                {loadingUpdate && announcementPlaceholder}
                {!loadingUpdate && !recentUpdate && announcementError}
                {!loadingUpdate && recentUpdate && announcementItem(recentUpdate)}
              </ul>
            </div>
            {!loadingKeychip && !loadingTrustedKeychip && !hasKeychip && !hasTrustedKeychip && (
              <div className="hstack alert alert-danger" role="alert">
                <ExclamationTriangleFill className="me-2" size="1em" />
                <div>
                  {t('DashboardPage.NoKeychipMessage')}
                  <Link to="/keychip">{t('DashboardPage.GoToKeychipPage')}</Link>
                </div>
              </div>
            )}
            {hasTrustedKeychip && (
              <div className="hstack alert alert-warning" role="alert">
                <ExclamationTriangleFill className="me-2" />
                <div>
                  {t('DashboardPage.HasTrustedKeychipMessage')}
                  <Link to="/keychip">{t('DashboardPage.GoToKeychipPage')}</Link>
                </div>
              </div>
            )}
          </div>

          <div className="mb-4">
            <div className="mb-3 d-flex justify-content-between align-items-end">
              <div className="d-flex align-items-center">
                <h3 className="m-0">{t('DashboardPage.Profiles')}</h3>
                {!loadingProfiles && !profilesError && (
                  <code className="small">({currentCard ?? t('DashboardPage.NoBind')})</code>
                )}
              </div>
              {!loadingProfiles && !profilesError && (
                <Link className="more-announcements" to="/cards">
                  {t('DashboardPage.Switch')}
                </Link>
              )}
            </div>

            {noCard && (
              <div className="hstack alert alert-warning" role="alert">
                <ExclamationTriangleFill className="me-2" />
                <div>
                  {t('DashboardPage.NoCardMessage')}
                  <Link to="/cards">{t('DashboardPage.GoToCardPage')}</Link>
                </div>
              </div>
            )}
            {!loadingProfiles && !profilesError && !noCard && !ongekiProfile && !chusanProfile && !mai2Profile && (
              <div className="alert alert-warning" role="alert">
                {t('DashboardPage.NoProfileMessage')}
              </div>
            )}
            {!loadingProfiles && profilesError && (
              <div className="alert alert-danger" role="alert">
                {t('App.Messages.LoadingFailed')}
              </div>
            )}

            {ongekiProfile && (
              <div className="card mb-2">
                <div className="card-header fw-bold d-flex align-items-center gap-2">
                  <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
                    <use href="assets/ongeki.svg#icon" />
                  </svg>
                  {fullWidth(ongekiProfile.userName ?? '')}
                </div>
                <div className="card-body p-2">
                  <div className="hstack gap-2">
                    {enableImages && (
                      <img
                        className="profile-icon"
                        src={assetsHost + `/assets/ongeki/card-icon/UI_Card_Icon_${ongekiProfile.cardId}.webp`}
                        alt=""
                      />
                    )}
                    <table className="profile-table">
                      <tbody>
                        <tr>
                          <th>{t('DashboardPage.Level')}</th>
                          <td>{(ongekiProfile.reincarnationNum ?? 0) * 100 + (ongekiProfile.level ?? 0)}</td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.Rating')}</th>
                          <td>
                            {compareVersion(ongekiProfile.lastRomVersion ?? '0.00.00', '1.50.00', '>=')
                              ? formatNumber((ongekiProfile.newPlayerRating ?? 0) / 1000, 0, 2)
                              : formatNumber((ongekiProfile.playerRating ?? 0) / 100, 1, 2)}
                          </td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.BattlePoint')}</th>
                          <td>{ongekiProfile.battlePoint}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="float-end fw-bold small">
                    {t('DashboardPage.LastPlay')}
                    {t('Common.Colon')}
                    {new Date(ongekiProfile.lastPlayDate ?? '').toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {chusanProfile && (
              <div className="card mb-2">
                <div className="card-header fw-bold d-flex align-items-center gap-2">
                  <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
                    <use href="assets/chunithm.svg#icon" />
                  </svg>
                  {fullWidth(chusanProfile.userName ?? '')}
                </div>
                <div className="card-body p-2">
                  <div className="hstack gap-2">
                    {enableImages && (
                      <img
                        className="profile-icon"
                        src={
                          assetsHost +
                          `/assets/chuni/chara/CHU_UI_Character_${characterImage(chusanProfile.characterId ?? 0)}_02.webp`
                        }
                        alt=""
                      />
                    )}
                    <table className="profile-table">
                      <tbody>
                        <tr>
                          <th>{t('DashboardPage.Level')}</th>
                          <td>{(chusanProfile.reincarnationNum ?? 0) * 100 + (chusanProfile.level ?? 0)}</td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.Rating')}</th>
                          <td>{formatNumber((chusanProfile.playerRating ?? 0) / 100, 1, 2)}</td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.OverPower')}</th>
                          <td>{(chusanProfile.overPowerRate ?? 0) / 100}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="float-end fw-bold small">
                    {t('DashboardPage.LastPlay')}
                    {t('Common.Colon')}
                    {new Date(chusanProfile.lastPlayDate ?? '').toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {mai2Profile && (
              <div className="card mb-2">
                <div className="card-header fw-bold d-flex align-items-center gap-2">
                  <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
                    <use href="assets/mai2.svg#icon" />
                  </svg>
                  {fullWidth(mai2Profile.userName ?? '')}
                </div>
                <div className="card-body p-2">
                  <div className="hstack gap-2">
                    {enableImages && (
                      <img
                        className="profile-icon"
                        src={assetsHost + `assets/mai2/icon/UI_Icon_${padDigits(mai2Profile.iconId ?? 0, 6)}.webp`}
                        alt=""
                      />
                    )}
                    <table className="profile-table">
                      <tbody>
                        <tr>
                          <th>{t('DashboardPage.AwakenLevel')}</th>
                          <td>{mai2Profile.totalAwake}</td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.Rating')}</th>
                          <td>{mai2Profile.playerRating}</td>
                        </tr>
                        <tr>
                          <th>{t('DashboardPage.PlayCount')}</th>
                          <td>{mai2Profile.playCount}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="card-footer">
                  <div className="float-end fw-bold small">
                    {t('DashboardPage.LastPlay')}
                    {t('Common.Colon')}
                    {new Date(mai2Profile.lastPlayDate ?? '').toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <h3 className="mb-3">{t('DashboardPage.GameData')}</h3>
          <div className="card mb-3">
            <div className="card-body">
              {(checking === 'checking' || (preloadStats.loadingDatabase && preloadStats.downloading === 0)) && (
                <div className="mb-2">
                  <span className="pe-2">{t('DashboardPage.CheckingUpdate')}</span>
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                </div>
              )}
              {checking !== 'checking' && preloadStats.loadingDatabase && preloadStats.downloading > 0 && (
                <div className="d-flex align-items-center mb-2">
                  <span className="pe-2">
                    {t('DashboardPage.Downloading')}
                    {t('Common.Colon')}
                    {preloadStats.completed}/{preloadStats.total}
                  </span>
                  <span className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </span>
                </div>
              )}
              {checking === 'completed' && !preloadStats.loadingDatabase && preloadStats.error === 0 && (
                <div className="d-flex align-items-center mb-2">
                  <CheckLg className="d-flex align-items-center me-2 text-success" />
                  <span className="pe-2">
                    {t('DashboardPage.Version')}
                    {t('Common.Colon')}
                    {dbVersion}
                  </span>
                </div>
              )}
              {checking === 'error' && !preloadStats.loadingDatabase && preloadStats.error === 0 && (
                <div className="d-flex align-items-center mb-2">
                  <QuestionLg className="d-flex align-items-center me-2 text-warning" />
                  <span className="pe-2">
                    {t('DashboardPage.Version')}
                    {t('Common.Colon')}
                    {dbVersion}
                  </span>
                </div>
              )}
              {checking !== 'checking' && !preloadStats.loadingDatabase && preloadStats.error > 0 && (
                <div className="d-flex align-items-center mb-2">
                  <XLg className="d-flex align-items-center me-2 text-danger" />
                  <span className="pe-2">
                    {t('DashboardPage.DownloadFailed')}
                    {t('Common.Colon')}
                    {preloadStats.completed}/{preloadStats.total}
                  </span>
                </div>
              )}
              <button
                className={
                  'btn btn-danger btn-sm mt-1' + (checking === 'checking' || preloadStats.loadingDatabase ? ' disabled' : '')
                }
                onClick={() => void reload()}
              >
                {t('DashboardPage.Reload')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <BModal
        className="announcement-detail-dialog"
        open={!!detail}
        onClose={() => setDetail(null)}
        scrollable
      >
        {detail && (
          <div
            className="announcement-content"
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(marked.parse(detail.getLocalContent(getCurrentLang())) as string),
            }}
          />
        )}
      </BModal>
    </div>
  );
}

const typeBadgeClass: Record<string, string> = {
  GENERAL: 'bg-primary',
  MAINTENANCE: 'bg-warning',
  UPDATE: 'bg-info',
  EVENT: 'bg-orange',
  TUTORIAL: 'bg-teal',
  OTHER: 'bg-gray',
};

function typeLabel(type: string): string {
  switch (type) {
    case 'GENERAL':
      return 'General';
    case 'MAINTENANCE':
      return 'Maintenance';
    case 'UPDATE':
      return 'Update';
    case 'EVENT':
      return 'Event';
    case 'TUTORIAL':
      return 'Tutorial';
    default:
      return 'Other';
  }
}
