import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { Maimai2PointExchangesDialog } from './Maimai2PointExchangesPage';
import type {
  ApiResponse,
  Maimai2ServerMission,
  Maimai2ServerMissionInfo,
  Maimai2ServerMissionPointChangelog,
  Maimai2ServerMissionPointData,
  Maimai2ServerMissionPointInfo,
  Maimai2ServerMissionRefreshCycle,
} from './server-mission-models';
import './Maimai2ServerMissionsPage.css';

const PAGE_SIZE = 10;

function responseData<T>(response: ApiResponse<T>, failurePrefix: string): T | null {
  if (response?.status?.code === 92001 && response.data) return response.data;
  notice(`${failurePrefix}: [${response?.status?.code}] ${response?.status?.message}`);
  return null;
}

function missionCompleted(mission: Maimai2ServerMission): boolean {
  return mission.conditionProgresses.every((condition) => condition.isDone);
}

function refreshCycleOrder(cycle: Maimai2ServerMissionRefreshCycle): number {
  switch (cycle) {
    case 'EveryDay': return 1;
    case 'EveryWeek': return 2;
    case 'EveryMonth': return 3;
    default: return 99;
  }
}

function refreshCycleText(cycle: Maimai2ServerMissionRefreshCycle): string {
  switch (cycle) {
    case 'None': return '永久';
    case 'EveryDay': return '每日刷新';
    case 'EveryWeek': return '每周刷新';
    case 'EveryMonth': return '每月刷新';
    default: return cycle;
  }
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())} ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}:${twoDigits(date.getSeconds())}`;
}

/** Equivalent to the legacy Maimai DX server-missions component. */
export function Maimai2ServerMissionsPage() {
  const { t } = useTranslation();
  const [aimeId, setAimeId] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [missions, setMissions] = useState<Maimai2ServerMission[]>([]);
  const [pointLogs, setPointLogs] = useState<Maimai2ServerMissionPointChangelog[]>([]);
  const [pointLogTotal, setPointLogTotal] = useState(0);
  const [pointLogPage, setPointLogPage] = useState(0);
  const [pointData, setPointData] = useState<Maimai2ServerMissionPointData | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);

  async function loadPoints(id: string, page = 0) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionPointInfo', {
        aimeId: id,
        page,
        size: PAGE_SIZE,
      })) as ApiResponse<Maimai2ServerMissionPointInfo>;
      const data = responseData(response, '获取玩家任务点数信息失败');
      if (data) {
        setPointLogs(data.filterPointChangelogs);
        setPointLogPage(page);
        setPointLogTotal(data.changelogTotalCount);
        setPointData(data.userPointData);
      }
    } catch (error) {
      notice(String(error));
    }
  }

  async function loadMissions(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionInfo', {
        aimeId: id,
      })) as ApiResponse<Maimai2ServerMissionInfo>;
      const data = responseData(response, '获取玩家任务列表失败');
      if (data) setMissions(data.serverMissionUserInfos);
    } catch (error) {
      notice(String(error));
    }
  }

  async function load(id: string) {
    await Promise.all([loadPoints(id), loadMissions(id)]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await load(id);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const filteredMissions = useMemo(() => {
    const visible = hideCompleted ? missions.filter((mission) => !missionCompleted(mission)) : [...missions];
    return visible.sort((first, second) => {
      const cycleOrder = refreshCycleOrder(first.refreshCycle) - refreshCycleOrder(second.refreshCycle);
      return cycleOrder || first.missionTitle.localeCompare(second.missionTitle);
    });
  }, [hideCompleted, missions]);

  const totalPages = Math.ceil(pointLogTotal / PAGE_SIZE);

  return (
    <div className="maimai2-server-missions-page">
      <h1 className="page-heading">{t('Maimai2.ServerMissions.Title')}</h1>

      <div className="server-missions-container">
        <div className="points-card">
          <div className="points-info">
            <div className="points-item">
              <span className="points-label">可用点数</span>
              <span className="points-value available-points">{pointData?.availablePoints || 0}</span>
            </div>
            <div className="points-divider" />
            <div className="points-item">
              <span className="points-label">总获得点数</span>
              <span className="points-value total-points">{pointData?.totalPoints || 0}</span>
            </div>
          </div>
          <div className="points-actions">
            <button className="btn btn-primary btn-sm" onClick={() => setExchangeOpen(true)}>
              <i className="bi bi-gift" />兑换
            </button>
          </div>
        </div>

        <div className="content">
          <div className="missions-section">
            <div className="section-header">
              <h3>任务列表</h3>
              <div className="form-check form-switch hide-completed-toggle">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="hideCompleted"
                  checked={hideCompleted}
                  onChange={(event) => setHideCompleted(event.target.checked)}
                />
                <label className="form-check-label" htmlFor="hideCompleted">隐藏已完成任务</label>
              </div>
              <button className="btn btn-sm btn-outline-primary" onClick={() => void loadMissions(aimeId)}>
                <i className="bi bi-arrow-repeat" /> 刷新
              </button>
            </div>

            {missions.length > 0 ? (
              <div className="missions-grid">
                {filteredMissions.map((mission, missionIndex) => {
                  const completed = missionCompleted(mission);
                  return (
                    <div
                      className={`mission-card${completed ? ' completed-card' : ''}`}
                      key={`${mission.missionTitle}-${missionIndex}`}
                    >
                      <div className="mission-header">
                        <div className="mission-title-wrapper">
                          {completed && (
                            <span className="completed-tag"><i className="bi bi-check-circle-fill" /> 已完成</span>
                          )}
                          <h4 className="mission-title">{mission.missionTitle}</h4>
                        </div>
                        <span className={`refresh-badge refresh-${mission.refreshCycle.toLowerCase()}`}>
                          {refreshCycleText(mission.refreshCycle)}
                        </span>
                      </div>
                      <div className="mission-description">{mission.missionDescription}</div>
                      <div className="condition-progresses">
                        {mission.conditionProgresses.map((condition, conditionIndex) => (
                          <div className="condition-item" key={`${condition.description}-${conditionIndex}`}>
                            {condition.total === 1 ? (
                              <div className="checkbox-container">
                                <div className="checkbox-wrapper">
                                  <div className={`custom-checkbox${condition.isDone ? ' checked' : ''}`} />
                                </div>
                                <div className="condition-desc">{condition.description}</div>
                              </div>
                            ) : (
                              <>
                                <div className="condition-desc">{condition.description}</div>
                                <div className="progress-container">
                                  <div className="progress-wrapper">
                                    <div className="progress">
                                      <div
                                        className={`progress-bar ${condition.isDone ? 'bg-success' : 'bg-warning'}`}
                                        style={{ width: `${(condition.current / condition.total) * 100}%` }}
                                        aria-valuenow={condition.current}
                                        aria-valuemax={condition.total}
                                      />
                                    </div>
                                    <div className="progress-values">
                                      <span className="current-value">{condition.current.toLocaleString()}</span>
                                      <span className="total-value">{condition.total.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mission-footer">
                        <div className="reward-info">
                          <span className="reward-label">奖励:</span>
                          <span className="reward-description">{mission.rewardDescription}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><i className="bi bi-inbox" /><p>暂无可用任务</p></div>
            )}
          </div>

          <div className="changelog-section">
            <div className="section-header">
              <h3>任务点数变更记录</h3>
              <div className="changelog-controls">
                <span className="total-count">共 {pointLogTotal} 条记录</span>
                <button className="btn btn-sm btn-outline-primary" onClick={() => void loadPoints(aimeId, pointLogPage)}>
                  <i className="bi bi-arrow-repeat" /> 刷新
                </button>
              </div>
            </div>
            {pointLogs[0] && <div className="points-summary" />}
            {pointLogs.length > 0 ? (
              <div className="changelog-table-container">
                <table className="table table-hover">
                  <thead><tr><th>时间</th><th>原因</th><th>变更数量</th></tr></thead>
                  <tbody>
                    {pointLogs.map((log, index) => (
                      <tr key={`${log.recordDate}-${index}`}>
                        <td>{formatDateTime(log.recordDate)}</td>
                        <td>{log.reason}</td>
                        <td className={log.changedAmount > 0 ? 'text-success' : log.changedAmount < 0 ? 'text-danger' : ''}>
                          {log.changedAmount > 0 && <span>+</span>}{log.changedAmount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state"><i className="bi bi-journal-text" /><p>暂无变更记录</p></div>
            )}

            {pointLogTotal > PAGE_SIZE && (
              <div className="pagination-container">
                <nav aria-label="变更记录分页">
                  <ul className="pagination justify-content-center">
                    <li className={`page-item${pointLogPage === 0 ? ' disabled' : ''}`}>
                      <a className="page-link" onClick={() => pointLogPage > 0 && void loadPoints(aimeId, pointLogPage - 1)}>上一页</a>
                    </li>
                    <li className="page-item active">
                      <span className="page-link">第 {pointLogPage + 1} 页 / 共 {totalPages} 页</span>
                    </li>
                    <li className={`page-item${pointLogPage >= totalPages - 1 ? ' disabled' : ''}`}>
                      <a className="page-link" onClick={() => pointLogPage < totalPages - 1 && void loadPoints(aimeId, pointLogPage + 1)}>下一页</a>
                    </li>
                  </ul>
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>

      <Maimai2PointExchangesDialog
        open={exchangeOpen}
        onClose={() => {
          setExchangeOpen(false);
          void load(aimeId);
        }}
      />
    </div>
  );
}
