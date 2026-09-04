import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { dbGetAll } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { assetsHost, enableImages } from '@/lib/utils';
import { padDigits } from '@/lib/format';
import { ChuniV2Pagination } from './ChuniV2Pagination';
import { ChuniV2SongScoreRanking } from './ChuniV2SongScoreRanking';
import type { ChuniV2Song, ChuniV2SongLevelInfo } from './song-models';
import './ChuniV2SongListPage.css';

const PAGE_SIZE = 15;

const RELEASES = [
  ['v1 1.00.00', 'ORIGIN'],
  ['v1 1.05.00', 'ORIGIN PLUS'],
  ['v1 1.10.00', 'AIR'],
  ['v1 1.15.00', 'AIR PLUS'],
  ['v1 1.20.00', 'STAR'],
  ['v1 1.25.00', 'STAR PLUS'],
  ['v1 1.30.00', 'AMAZON'],
  ['v1 1.35.00', 'AMAZON PLUS'],
  ['v1 1.40.00', 'CRYSTAL'],
  ['v1 1.45.00', 'CRYSTAL PLUS'],
  ['v1 1.50.00', 'PARADISE'],
  ['v1 1.55.00', 'PARADISE LOST'],
  ['v2 2.00.00', 'NEW'],
  ['v2 2.05.00', 'NEW PLUS'],
  ['v2 2.10.00', 'SUN'],
  ['v2 2.15.00', 'SUN PLUS'],
  ['v2 2.20.00', 'LUMINOUS'],
  ['v2 2.25.00', 'LUMINOUS PLUS'],
  ['v2 2.30.00', 'VERSE'],
] as const;

const GENRES = [
  ['POPS_ANIME', 'POPS & ANIME'],
  ['NICONICO', 'niconico'],
  ['TOUHOU', '東方Project'],
  ['VARIETY', 'VARIETY'],
  ['IRODORI', 'イロドリミドリ'],
  ['GEKICHUMA', 'ゲキマイ'],
  ['ORIGINAL', 'ORIGINAL'],
] as const;

const DIFFICULTY_CLASSES = [
  'difficulty-basic',
  'difficulty-advanced',
  'difficulty-expert',
  'difficulty-master',
  'difficulty-ultima',
] as const;

function songLevel(song: ChuniV2Song, difficulty: number): ChuniV2SongLevelInfo | undefined {
  return song.levels[difficulty];
}

function levelString(level: ChuniV2SongLevelInfo): string {
  return `${level.level}.${String(level.levelDecimal).charAt(0)}`;
}

function DifficultyBadge({ song, difficulty }: { song: ChuniV2Song; difficulty: number }) {
  const info = songLevel(song, difficulty);
  if (!info?.enable) return null;

  if (difficulty === 5) {
    return (
      <span className="col-auto difficulty difficulty-we badge rounded-pill">
        <span className="color-we">World&apos;s End</span>
      </span>
    );
  }

  return (
    <span className={`col-auto difficulty ${DIFFICULTY_CLASSES[difficulty]} badge rounded-pill`}>
      {levelString(info)}
    </span>
  );
}

/** Equivalent to the legacy Chunithm v2 song-list component. */
export function ChuniV2SongListPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [searchParams, setSearchParams] = useSearchParams();
  const [songs, setSongs] = useState<ChuniV2Song[]>([]);
  const [releaseChecked, setReleaseChecked] = useState<boolean[]>(RELEASES.map(() => false));
  const [genreChecked, setGenreChecked] = useState<boolean[]>(GENRES.map(() => false));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [detailMusic, setDetailMusic] = useState<ChuniV2Song | null>(null);

  const catalogReady = catalogStates.chusanMusic === 'OK';
  const currentPage = Math.max(1, Number(searchParams.get('page') ?? 1) || 1);

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    void dbGetAll<ChuniV2Song>('chusanMusic')
      .then((items) => active && setSongs(items))
      .catch((error) => active && notice(`数据加载失败: ${String(error)}`));
    return () => {
      active = false;
    };
  }, [catalogReady]);

  const filteredSongs = useMemo(() => {
    const selectedReleases: string[] = RELEASES.filter((_, index) => releaseChecked[index]).map(
      ([release]) => release,
    );
    const selectedGenres: string[] = GENRES.filter((_, index) => genreChecked[index]).map(
      ([genre]) => genre,
    );
    const query = searchTerm.toLowerCase();

    return songs.filter((song) => {
      if (selectedReleases.length > 0 && !selectedReleases.includes(song.releaseVersion)) {
        return false;
      }
      if (selectedGenres.length > 0 && !selectedGenres.includes(song.genre)) return false;
      return (
        song.musicId === Number(searchTerm) ||
        song.name.toLowerCase().includes(query) ||
        song.artistName.toLowerCase().includes(query)
      );
    });
  }, [genreChecked, releaseChecked, searchTerm, songs]);

  const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) setSearchParams({ page: String(totalPages) }, { replace: true });
  }, [currentPage, setSearchParams, totalPages]);

  const pageSongs = filteredSongs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const defaultFilter =
    searchTerm === '' && releaseChecked.every((value) => !value) && genreChecked.every((value) => !value);

  function changePage(page: number) {
    setSearchParams({ page: String(page) });
  }

  function resetFilter() {
    setReleaseChecked(RELEASES.map(() => false));
    setGenreChecked(GENRES.map(() => false));
    setSearchTerm('');
  }

  return (
    <div className="chuni-v2-song-list-page">
      <h1 className="page-heading">{t('ChuniV2.MusicListPage.Title')}</h1>

      <div className={`collapse${filterOpen ? ' show' : ''}`} id="filterCollapse">
        <div className="row mb-2 g-1">
          <div className="col-12 col-sm-auto pt-1 me-3">
            {t('ChuniV2.MusicListPage.ReleaseVersion')}
          </div>
          <div className="col-12 col-sm">
            <div className="row justify-content-start align-items-center g-1">
              {RELEASES.map(([release, label], index) => (
                <div className="col-auto" key={release}>
                  <input
                    type="checkbox"
                    className="form-check-input checkbox-btn"
                    value={release}
                    id={`version${index}`}
                    checked={releaseChecked[index]}
                    onChange={(event) =>
                      setReleaseChecked((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.checked : value,
                        ),
                      )
                    }
                  />
                  <label className="checkbox-label" htmlFor={`version${index}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row mb-2 g-1">
          <div className="col-12 col-sm-auto pt-1 me-3">{t('ChuniV2.MusicListPage.Genre')}</div>
          <div className="col-12 col-sm">
            <div className="row justify-content-start align-items-center g-1">
              {GENRES.map(([genre, label], index) => (
                <div className="col-auto" key={genre}>
                  <input
                    type="checkbox"
                    className="form-check-input checkbox-btn"
                    value={genre}
                    id={`genre${index}`}
                    checked={genreChecked[index]}
                    onChange={(event) =>
                      setGenreChecked((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? event.target.checked : value,
                        ),
                      )
                    }
                  />
                  <label className="checkbox-label" htmlFor={`genre${index}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="row mb-2 g-1">
          <div className="col-12 p-0">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder={t('ChuniV2.MusicListPage.FilterPlaceholder')}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="mb-2">
        <span>{t('ChuniV2.MusicListPage.TotalSongNum', { num: filteredSongs.length })}</span>
        <a className="link-btn ms-3" onClick={() => setFilterOpen((value) => !value)}>
          {t(
            filterOpen
              ? 'ChuniV2.MusicListPage.HideFilter'
              : 'ChuniV2.MusicListPage.ShowFilter',
          )}
        </a>
        {!defaultFilter && (
          <a className="link-btn ms-3" onClick={resetFilter}>
            {t('ChuniV2.MusicListPage.ResetFilter')}
          </a>
        )}
      </div>

      <ChuniV2Pagination
        current={currentPage}
        listClassName="pagination pagination-sm justify-content-center mb-2 chuni-song-pagination"
        pageSize={PAGE_SIZE}
        totalItems={filteredSongs.length}
        onPageChange={changePage}
      />

      {pageSongs.map((song) => (
        <div
          className="card-btn card mb-2 text-start user-select-none"
          key={song.musicId}
          onClick={() => setDetailMusic(song)}
        >
          <div className="song-info card-body hstack gap-2 p-0">
            <div className="jacket-container ratio ratio-1x1">
              {enableImages && (
                <img
                  className="position-absolute rounded-start"
                  src={`${assetsHost}assets/chuni/jacket/CHU_UI_Jacket_${padDigits(song.musicId, 4)}.webp`}
                  alt=""
                />
              )}
            </div>
            <div className="overflow-hidden">
              <div className="song-info-title text-truncate fw-bold">
                <span>
                  {song.musicId}.「{song.name}」
                </span>
              </div>
              <div className="song-info-artist text-truncate mb-1">
                <span>{song.artistName}</span>
              </div>
              <div className="row m-0 align-items-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((difficulty) => (
                  <DifficultyBadge song={song} difficulty={difficulty} key={difficulty} />
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      <ChuniV2Pagination
        current={currentPage}
        listClassName="pagination pagination-sm justify-content-center mb-2 chuni-song-pagination"
        pageSize={PAGE_SIZE}
        totalItems={filteredSongs.length}
        onPageChange={changePage}
      />

      <ChuniV2SongScoreRanking
        music={detailMusic}
        open={detailMusic !== null}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
