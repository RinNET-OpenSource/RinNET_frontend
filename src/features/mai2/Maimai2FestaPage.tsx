import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import type {
  ApiResponse,
  Maimai2CircleFestaData,
  Maimai2CircleFestaRankInfo,
  Maimai2FestaSideData,
  Maimai2GameFesta,
  Maimai2GameFestaInfo,
  Maimai2UserCircleInfo,
  Maimai2UserFestaData,
  Maimai2UserFestaInfo,
  PageResponse,
} from './circle-festa-models';
import './Maimai2FestaPage.css';

const sideColors = ['#F6377A', '#3F67F0', '#34C91B'];

function sideColor(id: number): string {
  return sideColors[(id - 1) % sideColors.length] ?? sideColors[0];
}

function sideName(festa: Maimai2GameFesta, id: number): string {
  return String(festa[`festaSide${String(id).padStart(2, '0')}` as keyof Maimai2GameFesta] ?? '');
}

function eventTime(value: string): string {
  if (!value || value.length < 6) return `<unk_time:${value}>`;
  return `20${value.slice(0, 2)}-${value.slice(2, 4)}-${value.slice(4, 6)}`;
}

function eventStart(value: string): string {
  const year = Number(value.slice(0, 2));
  const month = Number(value.slice(2, 4)) - 1;
  const day = Number(value.slice(4, 6));
  const result = new Date(new Date(2000 + year, month, day).getTime() + 7 * 24 * 60 * 60 * 1000);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, '0')}-${String(result.getDate()).padStart(2, '0')}`;
}

function phaseColor(phase: string): string | undefined {
  if (phase.toLowerCase() === 'init') return 'lightgray';
  if (phase.toLowerCase() === 'voteteam') return 'orange';
  if (phase.toLowerCase() === 'started') return 'green';
  if (phase.toLowerCase() === 'finished') return 'red';
  return undefined;
}

function phaseName(phase: string): string | undefined {
  if (phase.toLowerCase() === 'init') return '未开催';
  if (phase.toLowerCase() === 'voteteam') return '投票选队中';
  if (phase.toLowerCase() === 'started') return '已开始';
  if (phase.toLowerCase() === 'finished') return '已结束';
  return undefined;
}

function formatRank(rank: number): string {
  if (rank === 0) return '--';
  return `${rank}${rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'}`;
}

function rankClass(rank: number): string {
  if (rank === 1) return ' gold';
  if (rank === 2) return ' silver';
  if (rank === 3) return ' bronze';
  return '';
}

function circleName(data: Maimai2CircleFestaData, showPlace: boolean): string {
  if (!showPlace) return data.circleName;
  const suffix = ` #${data.placeId}`;
  return data.circleName.endsWith(suffix) ? data.circleName : `${data.circleName}${suffix}`;
}

function FestaProgress({ sides }: { sides: Maimai2FestaSideData[] }) {
  return (
    <div className="progress" style={{ height: 30 }}>
      <div className="festa-progress">
        {sides.map((side) => (
          <div
            className="festa-progress-segment"
            style={{ flex: String(side.advantagePercent), backgroundColor: sideColor(side.festaSideId) }}
            key={side.festaSideId}
          >
            <span>{side.advantagePercent}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CircleRanking({
  title,
  items,
  global,
  checkboxId,
  onGlobalChange,
}: {
  title: string;
  items: Maimai2CircleFestaRankInfo[] | null;
  global: boolean;
  checkboxId: string;
  onGlobalChange: (value: boolean) => void;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="card festa-ranking-card">
      <div className="card-header d-flex align-items-center justify-content-between">
        <span>{title}</span>
        <div className="form-check align-items-center d-flex">
          <input
            className="form-check-input me-1"
            type="checkbox"
            checked={global}
            onChange={(event) => onGlobalChange(event.target.checked)}
            id={checkboxId}
          />
          <label className="form-check-label small mb-0 mt-0" htmlFor={checkboxId}>全服</label>
        </div>
      </div>
      <div className="card-body">
        {items.map((item) => (
          <div className="rank-row" key={`${item.circleFestaData.circleId}-${item.rank}`}>
            <div className={`rank${rankClass(item.rank)}`}>{formatRank(item.rank)}</div>
            <span style={{ color: sideColor(item.circleFestaData.festaSideId) }}>{circleName(item.circleFestaData, global)}</span>
            <span className={`score${rankClass(item.rank)}`}>{item.circleFestaData.totalPoint} fp</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Equivalent to the legacy Maimai2 Festa component. */
export function Maimai2FestaPage() {
  const { t } = useTranslation();
  const [aimeId, setAimeId] = useState('');
  const [userCircleInfo, setUserCircleInfo] = useState<Maimai2UserCircleInfo | null>(null);
  const [gameFestaInfo, setGameFestaInfo] = useState<Maimai2GameFestaInfo | null>(null);
  const [userFestaInfo, setUserFestaInfo] = useState<Maimai2UserFestaInfo | null>(null);
  const [userResultFestaInfo, setUserResultFestaInfo] = useState<Maimai2UserFestaInfo | null>(null);
  const [sameSideRanks, setSameSideRanks] = useState<Maimai2CircleFestaRankInfo[] | null>(null);
  const [allSideRanks, setAllSideRanks] = useState<Maimai2CircleFestaRankInfo[] | null>(null);
  const [sameGlobal, setSameGlobal] = useState(false);
  const [allGlobal, setAllGlobal] = useState(false);

  async function loadUserFesta(id: string, festa: Maimai2GameFesta) {
    const response = (await api.get('api/game/maimai2/userFestaInfo', {
      aimeId: id,
      relativeEventId: festa.openEventId,
    })) as ApiResponse<Maimai2UserFestaInfo>;
    return response.data ?? null;
  }

  async function loadRanks(id: string, data: Maimai2UserFestaData, sameSide: boolean, global: boolean) {
    const response = (await api.get('api/game/maimai2/rankFestaCircles', {
      aimeId: id,
      openEventId: data.eventId,
      filterFestaSideId: sameSide ? data.festaSideId : -1,
      placeId: global ? -1 : data.placeId,
      page: 0,
      size: 10,
    })) as PageResponse<Maimai2CircleFestaRankInfo>;
    if (sameSide) setSameSideRanks(response.content ?? []);
    else setAllSideRanks(response.content ?? []);
  }

  async function loadAll(id: string) {
    const [circleResponse, festaResponse] = await Promise.all([
      api.get('api/game/maimai2/userCircleInfo', { aimeId: id }) as Promise<ApiResponse<Maimai2UserCircleInfo>>,
      api.get('api/game/maimai2/gameFestaInfo', { aimeId: id }) as Promise<ApiResponse<Maimai2GameFestaInfo>>,
    ]);
    setUserCircleInfo(circleResponse.data ?? null);
    const info = festaResponse.data ?? null;
    setGameFestaInfo(info);
    if (info?.gameFesta) {
      const current = await loadUserFesta(id, info.gameFesta);
      setUserFestaInfo(current);
      if (current?.userFestaData) {
        await Promise.all([
          loadRanks(id, current.userFestaData, true, false),
          loadRanks(id, current.userFestaData, false, false),
        ]);
      }
    }
    if (info?.gameRsultFesta) setUserResultFestaInfo(await loadUserFesta(id, info.gameRsultFesta));
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await loadAll(id);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => { active = false; };
  }, []);

  async function vote(openEventId: string, festaSideId: number) {
    try {
      const response = (await api.get('api/game/maimai2/voteSide', { aimeId, openEventId, festaSideId })) as ApiResponse<boolean>;
      notice(response.data ? '队伍投票成功' : '队伍投票失败', response.data ? 'success' : 'danger');
      if (response.data && gameFestaInfo?.gameFesta) setUserFestaInfo(await loadUserFesta(aimeId, gameFestaInfo.gameFesta));
    } catch (error) {
      notice(String(error));
    }
  }

  const current = gameFestaInfo?.gameFesta;
  const currentData = gameFestaInfo?.gameFestaData;
  const result = gameFestaInfo?.gameRsultFesta;
  const resultData = gameFestaInfo?.gameResultFestaData;
  const votedSide = userFestaInfo?.userFestaData?.festaSideId ?? 0;

  return (
    <div className="maimai2-festa-page">
      <h1 className="page-heading">{t('Maimai2.FestaPage.Title')}</h1>

      {!userCircleInfo?.joinedCircle && <div className="alert alert-info">你目前还没有加入任何Circle, 无法查看和参与当前Festa活动</div>}

      {userCircleInfo?.joinedCircle && (
        <div>
          {current && currentData && (
            <h3 className="page-heading festa-current-section">
              <span>当前进行的Festa活动 <small style={{ color: 'gray' }}>*每天7点更新</small></span>
              <div className="card shadow mb-4 mt-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{current.name} - {current.festaTitle}</h5>
                  <span className="badge" style={{ backgroundColor: phaseColor(current.festaPhaseState) }}>{phaseName(current.festaPhaseState)}</span>
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <p><strong>版本:</strong> {current.releaseTagName}</p>
                      <p><strong>报名选队时间:</strong> {eventTime(current.openEventId)}</p>
                      <p><strong>正式开始时间:</strong> {eventStart(current.openEventId)}</p>
                      <p><strong>结束结算时间:</strong> {eventTime(current.resultEventId)}</p>
                      <p><strong>奖励边界:</strong> {current.rewardBorder} fp</p>
                    </div>
                    <div className="col-md-6">
                      <p><strong>目前是否能报名:</strong> {String(!currentData.isCircleJoinNotAllowed)}</p>
                      <p><strong>目前是否为拉力阶段:</strong> {String(currentData.isRallyPeriod)}</p>
                    </div>
                  </div>
                  <hr />

                  {current.festaPhaseState.toLowerCase() === 'voteteam' && (
                    <div>
                      <strong>队伍投票</strong>
                      <ul className="list-group mt-2">
                        {currentData.festaSideDataList.map((side) => (
                          <li className="list-group-item d-flex justify-content-between align-items-center" key={side.festaSideId}>
                            <span style={{ color: sideColor(side.festaSideId) }}>{sideName(current, side.festaSideId)}</span>
                            <button onClick={() => void vote(current.openEventId, side.festaSideId)} className="btn btn-sm btn-primary">投票</button>
                          </li>
                        ))}
                      </ul>
                      {votedSide > 0
                        ? <p className="mt-2">你已选择队伍: <span style={{ color: sideColor(votedSide) }}>{sideName(current, votedSide)}</span></p>
                        : <p style={{ color: 'red' }} className="mt-2">你目前还没投票选择队伍，请先投票，否则无法参与活动后续内容</p>}
                    </div>
                  )}

                  <div className="mt-2">
                    <h6>队伍排名</h6>
                    <FestaProgress sides={currentData.festaSideDataList} />
                    <ul className="list-group mt-2">
                      {currentData.festaSideDataList.map((side) => (
                        <li className="list-group-item d-flex justify-content-between align-items-center" key={side.festaSideId}>
                          <span>{formatRank(side.rankInPlace)} <span style={{ color: sideColor(side.festaSideId) }}>{sideName(current, side.festaSideId)}</span></span>
                          <span>{side.advantagePercent}% </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {userFestaInfo?.userFestaData && (
                    <div className="card mt-4">
                      <div className="card-header"><span>玩家与Circle情况 - {userFestaInfo.userFestaData.circleName}</span></div>
                      <div className="card-body">
                        <div className="row">
                          <div className="col-md-6">
                            <p><strong>placeId:</strong> {userFestaInfo.userFestaData.placeId}</p>
                            <p><strong>所属队伍与同队排名:</strong> <span style={{ color: sideColor(userFestaInfo.userFestaData.festaSideId) }}>{sideName(current, userFestaInfo.userFestaData.festaSideId)} {userFestaInfo.userFestaData.circleRankInFestaSide === 0 ? '' : formatRank(userFestaInfo.userFestaData.circleRankInFestaSide)}</span></p>
                            <p><strong>Circle总分数:</strong> {userFestaInfo.userFestaData.circleTotalFestaPoint} fp</p>
                          </div>
                          <div className="col-md-6">
                            <p><strong>玩家分数:</strong> {userFestaInfo.userFestaData.currentTotalFestaPoint} fp</p>
                            <p><strong>奖励还需分数:</strong> {userFestaInfo.userFestaData.receivedRewardBorder} fp</p>
                            <p><strong>已领奖励:</strong> {String(userFestaInfo.userFestaData.participationRewardGet)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="row mt-4">
                    <div className="col-md-6">
                      <CircleRanking
                        title="同队排行榜"
                        items={sameSideRanks}
                        global={sameGlobal}
                        checkboxId="checkDefault"
                        onGlobalChange={(value) => {
                          setSameGlobal(value);
                          if (userFestaInfo?.userFestaData) void loadRanks(aimeId, userFestaInfo.userFestaData, true, value);
                        }}
                      />
                    </div>
                    <div className="col-md-6">
                      <CircleRanking
                        title="总排行榜"
                        items={allSideRanks}
                        global={allGlobal}
                        checkboxId="checkDefault2"
                        onGlobalChange={(value) => {
                          setAllGlobal(value);
                          if (userFestaInfo?.userFestaData) void loadRanks(aimeId, userFestaInfo.userFestaData, false, value);
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </h3>
          )}

          {result && resultData && (
            <div className="festa-result-section">
              <h3 className="page-heading">最近结束的Festa活动</h3>
              <div className="card shadow mb-4">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">{result.name} - {result.festaTitle}</h5>
                  <span className="badge" style={{ backgroundColor: phaseColor(result.festaPhaseState) }}>{phaseName(result.festaPhaseState)}</span>
                </div>
                <div className="card-body">
                  <div className="row"><div className="col-md-6">
                    <p><strong>版本:</strong> {result.releaseTagName}</p>
                    <p><strong>报名选队时间:</strong> {eventTime(result.openEventId)}</p>
                    <p><strong>正式开始时间:</strong> {eventStart(current?.openEventId ?? result.openEventId)}</p>
                    <p><strong>结束结算时间:</strong> {eventTime(result.resultEventId)}</p>
                    <p><strong>奖励边界:</strong> {result.rewardBorder}</p>
                  </div></div>
                  <hr />
                  <div>
                    <h6>最终队伍排名</h6>
                    <FestaProgress sides={resultData.resultFestaSideDataList} />
                    <ul className="list-group mt-2">
                      {resultData.resultFestaSideDataList.map((side) => (
                        <li className="list-group-item d-flex justify-content-between align-items-center" key={side.festaSideId}>
                          {formatRank(side.rank ?? 0)} {sideName(result, side.festaSideId)}
                          <span>{side.advantagePercent}% </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <hr />
                  <div className="card">
                    <div className="card-header"><span>Circle情况 - {userResultFestaInfo?.circle?.circleName}</span></div>
                    <div className="card-body"><div className="row">
                      <div className="col-md-6">
                        <p><strong>所属队伍与排名:</strong> {userResultFestaInfo?.userResultFestaData && <span style={{ color: sideColor(userResultFestaInfo.userResultFestaData.festaSideId) }}>{sideName(result, userResultFestaInfo.userResultFestaData.festaSideId)} {userResultFestaInfo.userResultFestaData.circleRankInFestaSide === 0 ? '' : formatRank(userResultFestaInfo.userResultFestaData.circleRankInFestaSide)}</span>}</p>
                        <p><strong>队伍总分数:</strong> {userResultFestaInfo?.userResultFestaData?.circleTotalFestaPoint}</p>
                      </div>
                      <div className="col-md-6"><p><strong>玩家分数:</strong> {userResultFestaInfo?.userFestaData?.currentTotalFestaPoint}</p></div>
                    </div></div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
