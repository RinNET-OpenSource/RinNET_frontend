import { useEffect, useState } from 'react';
import { StopFill } from 'react-bootstrap-icons';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import type {
  Maimai2Music,
  Maimai2SongRanking,
  Maimai2SongRecord,
} from './models';
import './Maimai2SongDetail.css';

const DIFFICULTIES: Record<number, { color: string; name: string }> = {
  0: { color: 'color-basic', name: 'Basic' },
  1: { color: 'color-advanced', name: 'Advanced' },
  2: { color: 'color-expert', name: 'Expert' },
  3: { color: 'color-master', name: 'Master' },
  4: { color: 'color-remaster', name: 'Re:Master' },
  5: { color: 'color-utage', name: 'UTAGE' },
};

function jacketId(input: number): string {
  return input.toString().slice(-4).padStart(6, '0');
}

function achievement(value: number): string {
  return (value / 10_000).toFixed(4);
}

function totalCombo(detail: Maimai2Music['details'][number]): number {
  if (!detail) return 0;
  return detail.tapCount + detail.holdCount + detail.slideCount + detail.breakCount + detail.touchCount;
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${assetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

/** Read-only counterpart of the legacy maimai2-song-detail offcanvas. */
export function Maimai2SongDetail({
  music,
  open,
  onClose,
}: {
  music: Maimai2Music | null;
  open: boolean;
  onClose: () => void;
}) {
  const [songData, setSongData] = useState<Record<number, Maimai2SongRecord>>({});
  const [ranking, setRanking] = useState<Maimai2SongRanking[]>([]);
  const [currentDiffTab, setCurrentDiffTab] = useState(3);

  useEffect(() => {
    if (!music || !open) return;
    let active = true;
    const isUtage = music.musicId > 100_000;
    const initialLevel = isUtage ? 0 : 3;
    setCurrentDiffTab(initialLevel);
    setSongData({});
    setRanking([]);

    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
    void api
      .get(`api/game/maimai2/song/${music.musicId}`, { aimeId })
      .then((response) => {
        if (!active) return;
        const records: Record<number, Maimai2SongRecord> = {};
        for (const raw of (response ?? []) as Maimai2SongRecord[]) {
          const detail = music.details[raw.level];
          const record = {
            ...raw,
            musicDetail: detail ?? undefined,
            totalCombo: totalCombo(detail),
          };
          records[raw.level] = record;
          if (isUtage && raw.level === 0) records[5] = record;
        }
        setSongData(records);
      })
      .catch((error) => active && notice(String(error)));

    void api
      .get('api/game/maimai2/musicScoreRanking', { musicId: music.musicId, level: 3 })
      .then(async (response) => {
        if (!active) return;
        let rows = (response ?? []) as Maimai2SongRanking[];
        if (rows.length === 0) {
          rows = (await api.get('api/game/maimai2/musicScoreRanking', {
            musicId: music.musicId,
            level: 0,
          })) as Maimai2SongRanking[];
        }
        if (active) setRanking(rows ?? []);
      })
      .catch((error) => active && notice(String(error)));

    return () => {
      active = false;
    };
  }, [music, open]);

  if (!music) return null;

  const isUtage = music.musicId > 100_000;
  const displayDifficulties = isUtage
    ? [5]
    : music.details[4]
      ? [0, 1, 2, 3, 4]
      : [0, 1, 2, 3];
  const tabs = isUtage
    ? [{ label: 'UTAGE', level: 0 }]
    : [
        { label: 'BA', level: 0 },
        { label: 'AD', level: 1 },
        { label: 'EX', level: 2 },
        { label: 'MA', level: 3 },
        ...(music.details[4] ? [{ label: 'Re:M', level: 4 }] : []),
      ];
  const selectedDetail = music.details[currentDiffTab];
  const jacket = `${assetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(music.musicId)}.webp`;

  function selectDifficulty(level: number) {
    setCurrentDiffTab(level);
    void api
      .get('api/game/maimai2/musicScoreRanking', { musicId: music!.musicId, level })
      .then((response) => setRanking((response ?? []) as Maimai2SongRanking[]))
      .catch((error) => notice(String(error)));
  }

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="maimai2-song-detail w-[400px] max-w-full gap-0 overflow-y-auto bg-[var(--bs-body-bg)] p-0 sm:max-w-[400px]"
      >
        <SheetTitle className="visually-hidden">{music.name}</SheetTitle>
        <div
          className="offcanvas-body"
          style={{ maxHeight: '100vh', overflowY: 'scroll', boxSizing: 'border-box', margin: 0, padding: 0 }}
        >
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 1000 }}
            onClick={onClose}
          />

          <div
            className="music-info-container position-relative"
            style={{ '--jacket-img': `url(${jacket})` } as React.CSSProperties}
          >
            {enableImages && (
              <img
                className="card-img mb-3 music-img sm ms-4 mt-4 rounded"
                src={jacket}
                onError={imageFallback}
                alt=""
              />
            )}
            <div className="position-relative">
              <h5 className="card-title mb-1 fw-bold ms-4">{music.name}</h5>
              <span className="card-subtitle music-artistName ms-4" style={{ fontSize: 12 }}>
                {music.artistName}
              </span>
              <hr className="mb-0" />
            </div>
          </div>

          <div className="mx-3">
            <section>
              {displayDifficulties.map((difficulty) => {
                const meta = DIFFICULTIES[difficulty];
                const sourceLevel = isUtage ? 0 : difficulty;
                const detail = music.details[sourceLevel];
                const record = songData[difficulty];
                return (
                  <div className="card my-2" key={difficulty}>
                    <div className="card-header py-1 px-2 text-truncate">
                      <div className="hstack">
                        {difficulty === 5 ? (
                          <div className="p-0 align-middle ps-1 small fw-bold color-utage">
                            {meta.name} {detail ? detail.levelDecimal / 10 : 0}
                          </div>
                        ) : (
                          <>
                            <StopFill className={`${meta.color} h-100 d-flex align-items-center`} />
                            <div className="p-0 align-middle ps-1 small">
                              {meta.name} {detail ? detail.levelDecimal / 10 : 0}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="card-body py-1 px-3">
                      <div className="difficulty-detail-body d-flex align-items-center justify-content-between">
                        <div className="float-start small">
                          {record ? (
                            <div className="d-flex flex-column">
                              <div className="achievement-main fs-6 small fw-bold">
                                {achievement(record.achievement)}%
                              </div>
                              <div className="dx-score text-muted">
                                <span className="me-1">DXScore:</span>
                                <span>
                                  {record.deluxscoreMax} / {record.totalCombo * 3}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="fw-bold">No Record</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {record && (
                      <div className="card-footer text-truncate py-1">
                        <div className="d-flex justify-content-between small">
                          <div>
                            <span className="text-muted small">Playcount</span>
                            <span> {record.playCount}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <nav>
              <div className="nav nav-tabs" role="tablist">
                {tabs.map((tab) => (
                  <button
                    className={`nav-link${currentDiffTab === tab.level ? ' active' : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={currentDiffTab === tab.level}
                    key={tab.level}
                    onClick={() => selectDifficulty(tab.level)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </nav>

            <div className="tab-content">
              <div className="tab-pane fade show active" role="tabpanel">
                {selectedDetail && (
                  <div className="card mt-2 mb-2 small">
                    <div className="card-header py-1">
                      {selectedDetail.noteDesigner && (
                        <>
                          <span>Notes Designer:</span>
                          <span className="fw-normal">{selectedDetail.noteDesigner}</span>
                        </>
                      )}
                      {selectedDetail.utageComment && (
                        <>
                          <span>Comment:</span>
                          <span className="fw-normal">{selectedDetail.utageComment}</span>
                        </>
                      )}
                    </div>
                    <div className="card-body p-0">
                      <div
                        className="table detail-table table-striped-columns table-bordered table-fixed table-sm w-100 mb-0"
                        style={{ width: '100%', display: 'flex', flexDirection: 'column' }}
                      >
                        <thead>
                          <tr style={{ display: 'flex' }}>
                            <th style={{ flex: 1 }}>Tap</th>
                            <th style={{ flex: 1 }}>Hold</th>
                            <th style={{ flex: 1 }}>Slide</th>
                            {selectedDetail.touchCount !== 0 && <th style={{ flex: 1 }}>Touch</th>}
                            <th style={{ flex: 1 }}>Break</th>
                          </tr>
                        </thead>
                        <tbody className="small">
                          <tr style={{ display: 'flex' }}>
                            <td style={{ flex: 1 }}>{selectedDetail.tapCount}</td>
                            <td style={{ flex: 1 }}>{selectedDetail.holdCount}</td>
                            <td style={{ flex: 1 }}>{selectedDetail.slideCount}</td>
                            {selectedDetail.touchCount !== 0 && (
                              <td style={{ flex: 1 }}>{selectedDetail.touchCount}</td>
                            )}
                            <td style={{ flex: 1 }}>{selectedDetail.breakCount}</td>
                          </tr>
                        </tbody>
                      </div>
                    </div>
                  </div>
                )}

                <br />
                {ranking.length > 0 && (
                  <table className="table table-striped table-borderless">
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Username</th>
                        <th>Achievement</th>
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
                          <td>{achievement(item.score)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
