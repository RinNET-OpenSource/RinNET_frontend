import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { StopFill } from 'react-bootstrap-icons';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { fullWidth, ordinal, padDigits } from '@/lib/format';
import { toLevelDecimal, toTechHonorSprite } from './pipes';
import { OngekiCardLevel } from './OngekiCardLevel';
import type { OngekiCard, OngekiMusic } from './models';
import './song-score-ranking.css';

interface Ranking {
  level?: number;
  username: string;
  score: number;
}

interface ISongData {
  musicId: number;
  level: number;
  playCount: number;
  techScoreMax: number;
  techScoreRank: number;
  battleScoreMax: number;
  battleScoreRank: number;
  platinumScoreMax: number;
  maxComboCount: number;
  maxOverKill: number;
  maxTeamOverKill: number;
  clearStatus: number;
  storyWatched: boolean;
  isFullBell: boolean;
  isFullCombo: boolean;
  isAllBreake: boolean;
  isLock: boolean;
  ranking?: { rank: number; playedCount: number };
}

function isLunatic(song: OngekiMusic): boolean {
  return (
    song.level0 === '0,0' && song.level1 === '0,0' && song.level2 === '0,0' && song.level3 === '0,0'
  );
}

function getLevelString(song: OngekiMusic, level: number): string {
  if (!song) return '0';
  if (level === 0) return song.level0;
  else if (level === 1) return song.level1;
  else if (level === 2) return song.level2;
  else if (level === 3) return song.level3;
  else if (level === 10) return song.level4;
  return '0';
}

const DIFF_META: Record<number, { name: string; color: string; lunatic?: boolean }> = {
  0: { name: 'Basic', color: 'color-basic' },
  1: { name: 'Advanced', color: 'color-advanced' },
  2: { name: 'Expert', color: 'color-expert' },
  3: { name: 'Master', color: 'color-master' },
  10: { name: 'Lunatic', color: '', lunatic: true },
};

/** 等价旧版 ongeki-song-score-ranking.component（成绩排名 offcanvas） */
export function OngekiSongScoreRanking({
  music,
  open,
  onClose,
}: {
  music: OngekiMusic | null;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [ranking, setRanking] = useState<Ranking[]>([]);
  const [songData, setSongData] = useState<Record<number, ISongData> | null>(null);
  const [loadingSongData, setLoadingSongData] = useState(true);
  const [bossCard, setBossCard] = useState<OngekiCard | null>(null);
  const [activeTab, setActiveTab] = useState<number>(3);

  useEffect(() => {
    if (!music || !open) return;
    setSongData(null);
    setLoadingSongData(true);
    setActiveTab(isLunatic(music) ? 10 : 3);

    void dbGetByKey<OngekiCard>('ongekiCard', music.bossCardId).then((x) => x && setBossCard(x));

    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
    void api
      .get(`api/game/ongeki/song/${music.id}`, { aimeId })
      .then((res) => {
        const data: Record<number, ISongData> = {};
        for (const d of res ?? []) {
          data[d.level] = d;
        }
        setSongData(data);
        setLoadingSongData(false);
      })
      .catch(() => {
        notice(t('Common.FailedToLoad'), 'danger');
        setLoadingSongData(false);
      });

    void api
      .get('api/game/ongeki/musicScoreRanking', {
        musicId: music.id,
        level: isLunatic(music) ? 10 : 3,
      })
      .then((res) => setRanking(res ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [music, open]);

  function handleTabButtonClick(level: number) {
    if (!music) return;
    setActiveTab(level);
    void api
      .get('api/game/ongeki/musicScoreRanking', { musicId: music.id, level })
      .then((res) => setRanking(res ?? []));
  }

  if (!music) return null;
  const lunatic = isLunatic(music);

  const difficultyDetail = (difficulty: number) => {
    const meta = DIFF_META[difficulty];
    const data = songData?.[difficulty];
    return (
      <div className="card my-2" key={difficulty}>
        <div
          className={
            'card-header py-1 px-2 text-truncate' +
            (meta.lunatic ? ' border border-danger bg-lunatic text-danger' : '')
          }
        >
          <div className="hstack">
            <StopFill className={(meta.lunatic ? '' : meta.color) + ' h-100 d-flex align-items-center'} />
            <div className="p-0 align-middle ps-1 small">
              {meta.name} {toLevelDecimal(getLevelString(music, difficulty))}
            </div>
          </div>
        </div>
        <div className="card-body py-1 px-3">
          <div className="difficulty-detail-body d-flex align-items-center justify-content-between">
            <div className="float-start small fw-bold">
              {data ? (
                <>
                  <div>{data.techScoreMax}</div>
                  <div className="small text-secondary">
                    {t('Ongeki.MusicList.SongScoreRanking.PlayCount')}
                    {t('Common.Colon')}
                    {data.playCount}
                  </div>
                </>
              ) : (
                <div>No Record</div>
              )}
            </div>
            {data && (
              <div className="honor float-end">
                <img
                  className="honor-badge"
                  src={assetsHost + `assets/ongeki/gameUi/${toTechHonorSprite(data.techScoreRank)}`}
                  alt=""
                />
                {data.isAllBreake ? (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_AB.webp'}
                    alt=""
                  />
                ) : data.isFullCombo ? (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_FC.webp'}
                    alt=""
                  />
                ) : (
                  <img
                    className="honor-badge"
                    src={assetsHost + 'assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_None.webp'}
                    alt=""
                  />
                )}
                <img
                  className="honor-badge"
                  src={
                    assetsHost +
                    `assets/ongeki/gameUi/UI_SLC_MusicSelect_HornorBadge_${data.isFullBell ? 'FB' : 'None'}.webp`
                  }
                  alt=""
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const rankingTable = (playerRanking?: { rank: number; playedCount: number }) => (
    <>
      {playerRanking && (
        <div className="callout callout-info mt-2 mb-1">
          {t('Ongeki.MusicList.SongScoreRanking.RankingInfo', {
            ranking: ordinal(playerRanking.rank),
            total: playerRanking.playedCount,
          })}
        </div>
      )}
      <table className="table table-striped table-borderless mb-0">
        <thead>
          <tr>
            <th>No.</th>
            <th>Username</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((item, i) => (
            <tr key={i}>
              <td>
                {i === 0 && <img className="medal" src={assetsHost + 'assets/gold-medal.svg'} alt="" />}
                {i === 1 && <img className="medal" src={assetsHost + 'assets/silver-medal.svg'} alt="" />}
                {i === 2 && <img className="medal" src={assetsHost + 'assets/bronze-medal.svg'} alt="" />}
                {i > 2 && <span>{i + 1}</span>}
              </td>
              <td>{fullWidth(item.username)}</td>
              <td>{item.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );

  const tabs = lunatic ? [10] : [0, 1, 2, 3];
  const tabName: Record<number, string> = { 0: 'BA', 1: 'AD', 2: 'EX', 3: 'MA', 10: 'LUNATIC' };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="ongeki-song-score-ranking ongeki-song-score-ranking-sheet w-[35vw] max-w-full sm:max-w-[35vw] p-0 bg-[var(--bs-body-bg)] overflow-y-auto"
      >
        <div className="offcanvas-body pt-0 px-0 ongeki-song-score-ranking-sheet">
          <div
            className="music-info-container row pb-3 pt-3 gap-3 px-3 m-0"
            style={
              {
                '--jacket-img': `url(${assetsHost}assets/ongeki/jacket/UI_Jacket_${padDigits(music.id, 4)}.webp)`,
              } as React.CSSProperties
            }
          >
            <div className="col-12 p-0">
              {enableImages && (
                <img
                  className="music-img"
                  src={assetsHost + `assets/ongeki/jacket/UI_Jacket_${padDigits(music.id, 4)}.webp`}
                  alt=""
                />
              )}
            </div>
            <div className="col-12 music-info">
              <h4 className="music-title">{music.name}</h4>
              <div className="mb-1">{music.artistName}</div>
              <div className="text-secondary">{music.genre}</div>
            </div>
          </div>

          {bossCard && (
            <>
              <hr className="mt-0" />
              <div className="mx-3">
                <section className="mb-2">
                  <h3 className="mb-3">{t('Ongeki.MusicList.SongScoreRanking.Boss')}</h3>
                  <div className="d-flex align-items-end">
                    <img
                      className="boss-img"
                      src={
                        assetsHost +
                        `assets/ongeki/card-icon/UI_Card_Icon_${padDigits(bossCard.id, 6)}_S.webp`
                      }
                      alt=""
                    />
                    <OngekiCardLevel
                      className="boss-level"
                      level={music.bossLevel}
                      attribute={bossCard.attribute ?? ''}
                    />
                  </div>
                </section>
              </div>
            </>
          )}

          {loadingSongData && (
            <>
              <hr />
              <div className="text-center">
                <div className="spinner-border" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              </div>
            </>
          )}
          {!loadingSongData && !songData && (
            <>
              <hr />
              <div className="mx-3">
                <section className="mb-3">
                  <h3 className="mb-3">{t('Ongeki.MusicList.SongScoreRanking.Details')}</h3>
                  <div className="alert alert-danger" role="alert">
                    {t('Common.FailedToLoad')}
                  </div>
                </section>
              </div>
            </>
          )}
          {songData && (
            <>
              <hr />
              <div className="mx-3">
                <section className="mb-3">
                  <h3 className="mb-3">{t('Ongeki.MusicList.SongScoreRanking.Details')}</h3>
                  {(lunatic ? [10] : [0, 1, 2, 3]).map((d) => difficultyDetail(d))}
                </section>
              </div>
              <hr />
              <div className="mx-3">
                <h3>{t('Ongeki.MusicList.SongScoreRanking.Ranking')}</h3>
                <nav>
                  <div className="nav nav-tabs" id="nav-tab" role="tablist">
                    {tabs.map((level) => (
                      <button
                        key={level}
                        className={'nav-link' + (activeTab === level ? ' active' : '')}
                        type="button"
                        role="tab"
                        onClick={() => handleTabButtonClick(level)}
                      >
                        {tabName[level]}
                      </button>
                    ))}
                  </div>
                </nav>
                <div className="tab-content">
                  <div className="tab-pane fade show active">
                    {rankingTable(songData[activeTab]?.ranking)}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
