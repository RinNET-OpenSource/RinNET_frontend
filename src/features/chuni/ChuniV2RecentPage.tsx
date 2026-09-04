import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api/client';
import { dbGetByKey } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import { ChuniV2Pagination } from './ChuniV2Pagination';
import { ChuniV2SongScoreRanking } from './ChuniV2SongScoreRanking';
import type { ChuniV2Music, ChuniV2PlayLog } from './models';
import './ChuniV2RecentPage.css';

interface PageResponse<T> {
  content?: T[];
  totalElements?: number;
}

const PAGE_SIZE = 10;
const DIFFICULTIES = ['BASIC', 'ADVANCED', 'EXPERT', 'MASTER', 'ULTIMA', "WORLD'S END"];

function rankName(value: number): string {
  if (value === 0) return 'D';
  if (value === 1) return 'C';
  if (value === 2) return 'B';
  if (value === 3) return 'BB';
  if (value === 4) return 'BBB';
  if (value === 5) return 'A';
  if (value === 6) return 'AA';
  if (value === 7) return 'AAA';
  if (value === 8) return 'S';
  if (value === 9) return 'S+';
  if (value === 10) return 'SS';
  if (value === 11) return 'SS+';
  if (value === 12) return 'SSS';
  return 'SSS+';
}

function techRating(score: number, chartConstant: number): number {
  const constant = chartConstant;
  let result: number;
  if (score >= 1_009_000) result = constant + 215;
  else if (score >= 1_007_500) result = Math.floor(((score - 1_007_500) * 15) / 1_500 + constant + 200);
  else if (score >= 1_005_000) result = Math.floor(((score - 1_005_000) * 50) / 2_500 + constant + 150);
  else if (score >= 1_000_000) result = Math.floor(((score - 1_000_000) * 50) / 5_000 + constant + 100);
  else if (score >= 975_000) result = Math.floor(((score - 975_000) * 100) / 25_000 + constant);
  else if (score >= 925_000) result = Math.floor(((score - 925_000) * 300) / 50_000 + constant - 300);
  else if (score >= 900_000) result = Math.floor(((score - 900_000) * 200) / 25_000 + constant - 500);
  else if (score >= 800_000) {
    const delta = Math.floor((constant - 500) / 2);
    result = Math.floor(((score - 800_000) * delta) / 100_000 + delta);
  } else if (score >= 500_000) {
    const delta = Math.floor((constant - 500) / 2);
    result = Math.floor(((score - 500_000) * delta) / 300_000);
  } else result = 0;
  return Math.max(result, 0);
}

function fullComboSprite(item: ChuniV2PlayLog): string {
  if (item.score === 1_010_000) return 'AJC';
  if (item.isAllJustice) return 'AJ';
  if (item.isFullCombo) return 'FC';
  return 'FC_Base';
}

function FilterBadge({ level }: { level: number }) {
  const labels = ['Basic', 'Advanced', 'Expert', 'Master', 'Ultima'];
  if (level === 5) {
    return (
      <span className="col-auto filter-text difficulty-we badge rounded-pill">
        <span className="color-we">World&apos;s End</span>
      </span>
    );
  }
  return (
    <span className={`col-auto filter-text difficulty-${labels[level]?.toLowerCase()} badge rounded-pill`}>
      {labels[level]}
    </span>
  );
}

/** Equivalent to the legacy Chunithm v2 recent-play component. */
export function ChuniV2RecentPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const catalogStates = useStore(preloadStates);
  const [recent, setRecent] = useState<ChuniV2PlayLog[]>([]);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailMusic, setDetailMusic] = useState<ChuniV2Music | null>(null);

  const currentPage = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);
  const idParam = searchParams.get('id');
  const levelParam = searchParams.get('level');
  const musicId = idParam === null ? null : Number(idParam);
  const level = levelParam === null ? null : Number(levelParam);
  const catalogReady = catalogStates.chusanMusic === 'OK';

  useEffect(() => {
    if (level !== null && level > 5) {
      setSearchParams({}, { replace: true });
    }
  }, [level, setSearchParams]);

  useEffect(() => {
    if (!catalogReady || (level !== null && level > 5)) return;
    let active = true;
    setLoading(true);

    void (async () => {
      try {
        await loadUser();
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        if (musicId !== null && Number.isFinite(musicId)) {
          const music = await dbGetByKey<ChuniV2Music>('chusanMusic', musicId);
          if (active) setMusicName(music?.name ?? `ID: ${musicId}`);
        } else if (active) {
          setMusicName(null);
        }

        // Preserve the legacy truthy check: BASIC (level 0) falls back to the recent endpoint.
        const filtered = Boolean(musicId && level);
        const endpoint = filtered
          ? `api/game/chuni/v2/song/${musicId}/${level}`
          : 'api/game/chuni/v2/recent';
        const data = (await api.get(endpoint, {
          aimeId,
          page: currentPage - 1,
        })) as PageResponse<ChuniV2PlayLog>;
        const rows = await Promise.all(
          (data.content ?? []).map(async (item) => ({
            ...item,
            songInfo: await dbGetByKey<ChuniV2Music>('chusanMusic', item.musicId),
            userPlayDate: new Date(item.userPlayDate),
          })),
        );
        if (!active) return;
        setRecent(rows);
        setTotalElements(data.totalElements ?? rows.length);
      } catch (error) {
        if (active) notice(String(error));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [catalogReady, currentPage, level, musicId]);

  const filterQuery = useMemo(() => {
    const query: Record<string, string> = { page: String(currentPage) };
    if (musicId !== null && Number.isFinite(musicId)) query.id = String(musicId);
    if (level !== null && Number.isFinite(level)) query.level = String(level);
    return query;
  }, [currentPage, level, musicId]);

  const changePage = (page: number) => {
    setSearchParams({ ...filterQuery, page: String(page) });
  };

  return (
    <div className="content chuni-v2-recent-page">
      <h1 className="page-heading">{t('ChuniV2.RecentPage.Title')}</h1>

      {musicName && level !== null && (
        <div className="d-flex align-items-center gap-2 mb-2">
          <FilterBadge level={level} />
          <span>{musicName}</span>
        </div>
      )}

      <div className="d-flex align-items-center gap-2 mb-3">
        <span>{t('ChuniV2.RecentPage.TotalPlayLogNum', { num: totalElements })}</span>
        {musicName && (
          <a className="link-btn" onClick={() => setSearchParams({})}>
            {t('ChuniV2.RecentPage.ResetFilter')}
          </a>
        )}
      </div>

      {!loading && (
        <ChuniV2Pagination
          current={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalElements}
          onPageChange={changePage}
        />
      )}

      <div className="d-flex flex-column gap-2 my-3 this-page">
        {recent.map((item, index) => {
          const levelInfo = item.songInfo?.levels?.[item.level];
          const rank = rankName(item.rank);
          return (
            <div className="card" key={`${item.musicId}-${String(item.userPlayDate)}-${index}`}>
              <div className="card-header p-0">
                <div className="position-relative">
                  <div className="d-flex rounded-top g-0 flex-nowrap">
                    <div>
                      {enableImages && (
                        <img
                          className="jacket"
                          src={`${assetsHost}assets/chuni/jacket/CHU_UI_Jacket_${padDigits(item.musicId, 4)}.webp`}
                          alt=""
                        />
                      )}
                    </div>
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="info-container">
                        <div className={`ps-2 py-1 user-select-none difficulty-${item.level}`}>
                          <div className="track">
                            <span className={item.level === 5 ? 'color-we' : ''}>Track.{item.track}</span>
                          </div>
                          <div className="difficulty">
                            <span className={item.level === 5 ? 'color-we' : ''}>
                              {DIFFICULTIES[item.level]}
                            </span>
                          </div>
                        </div>
                        <div className="info-second">
                          <div className="w-100">
                            <div className="title ps-2">
                              {item.songInfo?.name ?? `musicId:${item.musicId}`}
                            </div>
                            <hr className="w-100 my-1" />
                            <div className="artist ps-2">
                              {item.songInfo?.artistName ?? 'Unknown Artist'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {item.level !== 5 && levelInfo && (
                    <div className="level-container">
                      <div className="level-label">Level</div>
                      <div className="level-value">
                        {levelInfo.level}.{String(levelInfo.levelDecimal).charAt(0)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="card-body">
                <div className="row g-3 flex-column-reverse flex-sm-row">
                  <div className="col-12 col-sm-6">
                    <table className="table table-striped table-sm m-0">
                      <tbody>
                        <tr>
                          <th className="judge-justice-critical">JUSTICE C.</th>
                          <td>{item.judgeCritical + item.judgeHeaven}</td>
                          <th className="judge-tap">TAP</th>
                          <td>{item.rateTap / 100}%</td>
                        </tr>
                        <tr>
                          <th className="judge-justice">JUSTICE</th>
                          <td>{item.judgeJustice}</td>
                          <th className="judge-hold">HOLD</th>
                          <td>{item.rateHold / 100}%</td>
                        </tr>
                        <tr>
                          <th className="judge-attack">ATTACK</th>
                          <td>{item.judgeAttack}</td>
                          <th className="judge-slide">SLIDE</th>
                          <td>{item.rateSlide / 100}%</td>
                        </tr>
                        <tr>
                          <th className="judge-miss">MISS</th>
                          <td>{item.judgeGuilty}</td>
                          <th className="judge-air">AIR</th>
                          <td>{item.rateAir / 100}%</td>
                        </tr>
                        <tr>
                          <th>Combo</th>
                          <td>{item.maxCombo}</td>
                          <th className="judge-flick">FLICK</th>
                          <td>{item.rateFlick / 100}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="col-12 col-sm-6">
                    <div className="row h-100 align-items-center">
                      <div className="col-6">
                        <div className="h-100 d-flex align-items-center">
                          <div>
                            <div>
                              <div className={`new-record-badge rounded-pill badge${item.isNewRecord ? ' new-record' : ''}`}>
                                NEW RECORD
                              </div>
                              <div className="score-label">Score</div>
                              <div className="score">{item.score}</div>
                            </div>
                            {levelInfo && (
                              <div>
                                <div className="score-label">Rating</div>
                                <div className="rating">
                                  {(techRating(item.score, levelInfo.level * 100 + levelInfo.levelDecimal) / 100).toFixed(2)}
                                </div>
                              </div>
                            )}
                            <div>
                              {enableImages && (
                                <img
                                  className={`honor${item.isFullCombo ? '' : ' grayscale'}`}
                                  src={`${assetsHost}assets/chuni/gameUi/CHU_UI_Result_${fullComboSprite(item)}.webp`}
                                  alt=""
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="h-100 d-flex align-items-center justify-content-center display-4">
                          <div className="d-flex flex-nowrap align-items-start">
                            {Array.from(rank).map((char, charIndex) =>
                              char === '+' ? (
                                <img
                                  className="result-plus"
                                  src={`${assetsHost}assets/chuni/gameUi/CHU_UI_Result_Plus.webp`}
                                  alt=""
                                  key={`${char}-${charIndex}`}
                                />
                              ) : (
                                <img
                                  className="result-char"
                                  src={`${assetsHost}assets/chuni/gameUi/CHU_UI_Result_${char}.webp`}
                                  alt=""
                                  key={`${char}-${charIndex}`}
                                />
                              ),
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card-footer fw-bold">
                {item.songInfo && (
                  <div className="float-start">
                    <a
                      className="text-primary"
                      onClick={() => setDetailMusic(item.songInfo ?? null)}
                    >
                      {t('ChuniV2.RecentPage.Details')}
                    </a>
                  </div>
                )}
                <div className="float-end">{new Date(item.userPlayDate).toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && (
        <ChuniV2Pagination
          current={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={totalElements}
          onPageChange={changePage}
        />
      )}
      <div className="mb-3" />
      <ChuniV2SongScoreRanking
        music={detailMusic}
        open={detailMusic !== null}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
