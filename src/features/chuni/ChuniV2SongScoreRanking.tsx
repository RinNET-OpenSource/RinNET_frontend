import { useEffect, useRef, useState } from 'react';
import { StopFill } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import type { ChuniV2Song, ChuniV2SongRankingRow, ChuniV2SongRecord } from './song-models';
import './ChuniV2SongScoreRanking.css';

const DIFFICULTIES: Record<number, { abbreviation: string; color: string; name: string }> = {
  0: { abbreviation: 'BA', color: 'color-basic', name: 'Basic' },
  1: { abbreviation: 'AD', color: 'color-advanced', name: 'Advanced' },
  2: { abbreviation: 'EX', color: 'color-expert', name: 'Expert' },
  3: { abbreviation: 'MA', color: 'color-master', name: 'Master' },
  4: { abbreviation: 'Ultima', color: 'color-ultima', name: 'Ultima' },
  5: { abbreviation: "World's End", color: 'color-we', name: "World's End" },
};

const SHEET_EXIT_DURATION_MS = 300;

function defaultLevel(music: ChuniV2Song, requested?: number): number {
  if (music.musicId >= 8_000) return 5;
  if (
    requested !== undefined &&
    requested >= 0 &&
    requested <= 4 &&
    music.levels[requested]?.enable
  ) {
    return requested;
  }
  return 3;
}

function levelString(music: ChuniV2Song, difficulty: number): string {
  const level = music.levels[difficulty];
  return level ? `${level.level}.${String(level.levelDecimal).charAt(0)}` : '0.0';
}

/** Read-only counterpart of the legacy Chunithm v2 score-ranking offcanvas. */
export function ChuniV2SongScoreRanking({
  music: selectedMusic,
  open,
  initialLevel,
  onClose,
}: {
  music: ChuniV2Song | null;
  open: boolean;
  initialLevel?: number;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [renderedMusic, setRenderedMusic] = useState<ChuniV2Song | null>(selectedMusic);
  const [sheetOpen, setSheetOpen] = useState(open);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const music = selectedMusic ?? renderedMusic;
  const [songData, setSongData] = useState<Record<number, ChuniV2SongRecord>>({});
  const [ranking, setRanking] = useState<ChuniV2SongRankingRow[]>([]);
  const [currentLevel, setCurrentLevel] = useState(3);
  const [recordsReady, setRecordsReady] = useState(false);

  useEffect(() => {
    if (selectedMusic) setRenderedMusic(selectedMusic);
  }, [selectedMusic]);

  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setSheetOpen(true);
    } else {
      setSheetOpen(false);
    }
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  function requestClose() {
    if (closeTimerRef.current) return;
    setSheetOpen(false);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      onClose();
    }, SHEET_EXIT_DURATION_MS);
  }

  useEffect(() => {
    if (!music || !open) return;
    let active = true;
    const selectedLevel = defaultLevel(music, initialLevel);
    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');

    setCurrentLevel(selectedLevel);
    setSongData({});
    setRanking([]);
    setRecordsReady(false);

    void api
      .get(`api/game/chuni/v2/song/${music.musicId}`, { aimeId })
      .then((response) => {
        if (!active) return;
        const records: Record<number, ChuniV2SongRecord> = {};
        for (const item of (response ?? []) as ChuniV2SongRecord[]) records[item.level] = item;
        setSongData(records);
        setRecordsReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setRecordsReady(true);
        notice(String(error));
      });

    void api
      .get('api/game/chuni/v2/musicScoreRanking', {
        musicId: music.musicId,
        level: selectedLevel,
      })
      .then(async (response) => {
        if (!active) return;
        let rows = (response ?? []) as ChuniV2SongRankingRow[];
        if (rows.length === 0 && initialLevel === undefined && selectedLevel === 3) {
          rows = (await api.get('api/game/chuni/v2/musicScoreRanking', {
            musicId: music.musicId,
            level: 5,
          })) as ChuniV2SongRankingRow[];
        }
        if (active) setRanking(rows ?? []);
      })
      .catch((error) => active && notice(String(error)));

    return () => {
      active = false;
    };
  }, [initialLevel, music, open]);

  if (!music) return null;

  const displayDifficulties =
    music.musicId >= 8_000 ? [5] : [0, 1, 2, 3, ...(music.levels[4]?.enable ? [4] : [])];
  const tabs = displayDifficulties.map((level) => ({
    label: DIFFICULTIES[level].abbreviation,
    level,
  }));

  function selectDifficulty(level: number) {
    setCurrentLevel(level);
    setRanking([]);
    void api
      .get('api/game/chuni/v2/musicScoreRanking', { musicId: music!.musicId, level })
      .then((response) => setRanking((response ?? []) as ChuniV2SongRankingRow[]))
      .catch((error) => notice(String(error)));
  }

  function showPlayLog(level: number) {
    if (!songData[level]) return;
    requestClose();
    navigate(`/chuni/v2/recent?id=${music!.musicId}&level=${level}`);
  }

  const currentRecord = songData[currentLevel];

  return (
    <Sheet
      open={sheetOpen}
      onOpenChange={(value) => {
        if (value) {
          if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
          }
          setSheetOpen(true);
        } else {
          requestClose();
        }
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="chuni-v2-song-score-ranking-panel chuni-v2-song-score-ranking-sheet w-[400px] max-w-full p-0 text-sm outline-none sm:max-w-[400px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="offcanvas-header position-absolute end-0 z-3">
          <SheetClose asChild>
            <button type="button" className="btn-close" aria-label="Close" />
          </SheetClose>
        </div>
        <SheetTitle className="visually-hidden">{music.name}</SheetTitle>
        <div className="offcanvas-body pt-0 px-0">
          <div
            className="music-info-container row pb-3 pt-3 gap-3 px-3 m-0"
            style={
              {
                '--jacket-img': `url(${assetsHost}assets/chuni/jacket/CHU_UI_Jacket_${padDigits(music.musicId, 4)}.webp)`,
              } as React.CSSProperties
            }
          >
            <div className="col-12 p-0">
              {enableImages && (
                <img
                  className="music-img"
                  src={`${assetsHost}assets/chuni/jacket/CHU_UI_Jacket_${padDigits(music.musicId, 4)}.webp`}
                  alt=""
                />
              )}
            </div>
            <div className="col-12 music-info">
              <h4 className="music-title">「{music.name}」</h4>
              <div className="mb-1">{music.artistName}</div>
              <div className="text-secondary">{music.genre}</div>
            </div>
          </div>

          <div className="mx-3">
            {recordsReady && (
              <section>
                {displayDifficulties.map((difficulty) => {
                  const record = songData[difficulty];
                  const metadata = DIFFICULTIES[difficulty];
                  return (
                    <div
                      className={`card my-2${record ? ' card-btn' : ''}`}
                      key={difficulty}
                      onClick={() => showPlayLog(difficulty)}
                    >
                      <div className="card-header py-1 px-2 text-truncate">
                        <div className="hstack">
                          {difficulty === 5 ? (
                            <div className="p-0 align-middle ps-1 small fw-bold color-we">
                              World&apos;s End
                            </div>
                          ) : (
                            <>
                              <StopFill
                                className={`${metadata.color} h-100 d-flex align-items-center`}
                              />
                              <div className="p-0 align-middle ps-1 small">
                                {metadata.name} {levelString(music, difficulty)}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="card-body py-1 px-3">
                        <div className="difficulty-detail-body d-flex align-items-center justify-content-between">
                          <div className="float-start small fw-bold">
                            {record ? record.scoreMax : 'No Record'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            )}

            <nav>
              <div className="nav nav-tabs" id="nav-tab" role="tablist">
                {tabs.map((tab) => (
                  <button
                    className={`nav-link${currentLevel === tab.level ? ' active' : ''}`}
                    id={`nav-${tab.level === 5 ? 'we' : ['ba', 'ad', 'ex', 'ma', 'ul'][tab.level]}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={currentLevel === tab.level}
                    key={tab.level}
                    onClick={() => selectDifficulty(tab.level)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            {recordsReady && (
              <div className="tab-content" id="nav-tabContent">
                <div
                  className="tab-pane fade show active"
                  id={`nav-${currentLevel === 5 ? 'we' : ['ba', 'ad', 'ex', 'ma', 'ul'][currentLevel]}`}
                  role="tabpanel"
                  tabIndex={0}
                >
                  <table className="table table-striped table-borderless">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Username</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.map((item, index) => (
                        <tr key={`${item.username}-${index}`}>
                          <td>
                            {index < 3 ? (
                              <img
                                className="medal"
                                src={`${assetsHost}assets/${['gold', 'silver', 'bronze'][index]}-medal.svg`}
                                alt=""
                              />
                            ) : (
                              <span>{index + 1}</span>
                            )}
                          </td>
                          <td>{item.username}</td>
                          <td>{item.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {currentRecord && (
                    <span>
                      You rank {currentRecord.ranking.rank} in {currentRecord.ranking.playedCount}{' '}
                      players.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
