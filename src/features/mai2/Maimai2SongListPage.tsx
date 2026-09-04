import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { dbGetAll } from '@/lib/db/db';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { useStore } from '@/lib/store';
import { assetsHost, enableImages } from '@/lib/utils';
import { Maimai2Pagination } from './Maimai2Pagination';
import { Maimai2SongDetail } from './Maimai2SongDetail';
import type { Maimai2Music } from './models';
import './Maimai2SongListPage.css';

const PAGE_SIZE = 20;

const GENRES = [
  { id: 101, name: 'POPS＆アニメ' },
  { id: 102, name: 'niconico＆ボーカロイド' },
  { id: 103, name: '東方Project' },
  { id: 104, name: 'ゲーム＆バラエティ' },
  { id: 105, name: 'ORIGINAL' },
  { id: 106, name: 'オンゲキ＆CHUNITHM' },
  { id: 107, name: '宴会場' },
] as const;

const VERSIONS = [
  'maimai',
  'maimai+',
  'GreeN',
  'GreeN+',
  'ORANGE',
  'ORANGE+',
  'PiNK',
  'PiNK+',
  'MURASAKi',
  'MURASAKi+',
  'MiLK',
  'MiLK+',
  'FiNALE',
  'maimai DX',
  'maimai DX+',
  'Splash',
  'Splash+',
  'UNiVERSE',
  'UNiVERSE+',
  'FESTiVAL',
  'FESTiVAL+',
  'BUDDiES',
  'BUDDiES+',
  'PRiSM',
] as const;

const SORT_OPTIONS = ['Add Version', 'Re:Master', 'Master', 'Expert', 'Advanced', 'Basic', 'ID'] as const;

function jacketId(input: number): string {
  return input.toString().slice(-4).padStart(6, '0');
}

function badgeType(musicId: number): 'sd' | 'dx' | 'utage' {
  const value = musicId.toString();
  if (value.length <= 4) return 'sd';
  if (value.length === 5 && value.startsWith('10')) return 'dx';
  return value.length === 6 ? 'utage' : 'dx';
}

function compareLevel(index: number, descending: boolean) {
  return (left: Maimai2Music, right: Maimai2Music) => {
    const result = (left.details[index]?.levelDecimal ?? 0) - (right.details[index]?.levelDecimal ?? 0);
    return descending ? -result : result;
  };
}

function imageFallback(event: React.SyntheticEvent<HTMLImageElement>) {
  const fallback = `${assetsHost}assets/mai2/jacket/UI_Jacket_000000.webp`;
  if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
}

/** Equivalent to the legacy maimai2-songlist component. */
export function Maimai2SongListPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [songs, setSongs] = useState<Maimai2Music[]>([]);
  const [genreChecked, setGenreChecked] = useState<boolean[]>(GENRES.map(() => false));
  const [versionChecked, setVersionChecked] = useState<boolean[]>(VERSIONS.map(() => false));
  const [genreOpen, setGenreOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOption, setSortOption] = useState(0);
  const [descending, setDescending] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailMusic, setDetailMusic] = useState<Maimai2Music | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const catalogReady = catalogStates.maimai2Music === 'OK';

  useEffect(() => {
    if (!catalogReady) return;
    let active = true;
    void dbGetAll<Maimai2Music>('maimai2Music')
      .then((items) => active && setSongs(items.filter((song) => song && Number.isFinite(song.musicId)).map((song) => ({
        ...song,
        name: typeof song.name === 'string' ? song.name : '',
        artistName: typeof song.artistName === 'string' ? song.artistName : '',
        details: Array.isArray(song.details) ? song.details : [],
      }))))
      .catch((error) => active && notice(`数据加载失败: ${String(error)}`));
    return () => {
      active = false;
    };
  }, [catalogReady]);

  const filteredSongs = useMemo(() => {
    const genreIds = GENRES.filter((_, index) => genreChecked[index]).map((item) => item.id);
    const versionIds = VERSIONS.map((_, index) => index).filter((index) => versionChecked[index]);
    const query = searchTerm.toLowerCase();
    const result = songs.filter(
      (song) =>
        (genreIds.length === 0 || genreIds.includes(song.genreId as (typeof GENRES)[number]['id'])) &&
        (versionIds.length === 0 || versionIds.includes(song.addVersion)) &&
        (!query || song.name.toLowerCase().includes(query) || song.artistName.toLowerCase().includes(query)),
    );

    if (sortOption >= 1 && sortOption <= 5) {
      return [...result].sort(compareLevel(5 - sortOption, descending));
    }
    if (sortOption === 6) {
      return [...result].sort((left, right) =>
        descending ? right.musicId - left.musicId : left.musicId - right.musicId,
      );
    }
    return [...result].sort((left, right) =>
      descending
        ? (right.romVersion ?? 0) - (left.romVersion ?? 0)
        : (left.romVersion ?? 0) - (right.romVersion ?? 0),
    );
  }, [descending, genreChecked, searchTerm, songs, sortOption, versionChecked]);

  useEffect(() => {
    const pages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
    setCurrentPage((page) => Math.min(page, pages));
  }, [filteredSongs.length]);

  const pageSongs = filteredSongs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function copySongName(songName: string) {
    void navigator.clipboard
      .writeText(songName)
      .then(() => notice(`已复制 ${songName}`))
      .catch(() => notice('复制失败，请手动选择文字'));
  }

  function stopCopyTimer() {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = null;
  }

  return (
    <div className="maimai2-song-list-page">
      <h1 className="page-heading">{t('Maimai2.SongList.Title')}</h1>

      <Maimai2Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredSongs.length}
        onPageChange={setCurrentPage}
      />

      <div className="accordion mb-2" id="Filter">
        <div className="accordion-item">
          <h2 className="accordion-header" id="headingOne">
            <button
              className={`accordion-button${genreOpen ? '' : ' collapsed'}`}
              type="button"
              aria-expanded={genreOpen}
              aria-controls="collapseOne"
              onClick={() => setGenreOpen((value) => !value)}
            >
              {t('Maimai2.SongList.Genre')}
            </button>
          </h2>
          <div
            id="collapseOne"
            className={`accordion-collapse collapse${genreOpen ? ' show' : ''}`}
            aria-labelledby="headingOne"
          >
            <div className="accordion-body">
              <div className="row justify-content-start mb-2 g-2">
                {GENRES.map((genre, index) => (
                  <div className="col-auto" key={genre.id}>
                    <input
                      type="checkbox"
                      className="form-check-input checkbox-btn"
                      id={`genre${index}`}
                      checked={genreChecked[index]}
                      onChange={() =>
                        setGenreChecked((values) =>
                          values.map((value, current) => (current === index ? !value : value)),
                        )
                      }
                    />
                    <label className="checkbox-label" htmlFor={`genre${index}`}>
                      {genre.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="accordion-item">
          <h2 className="accordion-header" id="headingTwo">
            <button
              className={`accordion-button${versionOpen ? '' : ' collapsed'}`}
              type="button"
              aria-expanded={versionOpen}
              aria-controls="collapseTwo"
              onClick={() => setVersionOpen((value) => !value)}
            >
              {t('Maimai2.SongList.Version')}
            </button>
          </h2>
          <div
            id="collapseTwo"
            className={`accordion-collapse collapse${versionOpen ? ' show' : ''}`}
            aria-labelledby="headingTwo"
          >
            <div className="accordion-body">
              <div className="row justify-content-start mb-2 g-2">
                {VERSIONS.map((version, index) => (
                  <div className="col-auto" key={version}>
                    <input
                      type="checkbox"
                      className="form-check-input checkbox-btn"
                      id={`version${index}`}
                      checked={versionChecked[index]}
                      onChange={() =>
                        setVersionChecked((values) =>
                          values.map((value, current) => (current === index ? !value : value)),
                        )
                      }
                    />
                    <label className="checkbox-label" htmlFor={`version${index}`}>
                      {version}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <form
        className="gy-2 gx-3 align-items-center my-2 d-grid d-sm-flex gap-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="w-100 flex-grow-1 flex-md-grow-0 mt-0">
          <div className="form-control input-container form-select-sm">
            <div className="row g-2">
              <div className="col">
                <input
                  className="form-control-plaintext p-0"
                  placeholder={t('Maimai2.SongList.Filter')}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="ms-auto flex-shrink-0 d-flex gap-2 mt-0">
          <div>
            <select
              className="form-select form-select-sm"
              value={sortOption}
              onChange={(event) => setSortOption(Number(event.target.value))}
            >
              {SORT_OPTIONS.map((option, index) => (
                <option value={index} key={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              className="btn btn-primary btn-sm"
              type="button"
              title={t('Maimai2.SongList.Sort')}
              onClick={() => setDescending((value) => !value)}
            >
              {t(descending ? 'Maimai2.SongList.SortByIDDown' : 'Maimai2.SongList.SortByIDUp')}
            </button>
          </div>
        </div>
      </form>

      <div className="my-2 justify-content-end d-flex">
        <div className="text-nowrap d-flex" style={{ fontSize: '0.9rem' }}>
          <span className="text-muted">{t('Maimai2.SongList.MatchingSongs')}：</span>
          <strong>{filteredSongs.length}</strong>
        </div>
      </div>

      {pageSongs.map((song) => {
        const type = badgeType(song.musicId);
        return (
          <div
            className="card-btn card mb-2 text-start user-select-none"
            key={song.musicId}
            onClick={() => setDetailMusic(song)}
          >
            <div className="song-info card-body hstack p-0">
              <div
                className="jacket-container ratio ratio-1x1 position-relative"
                onContextMenu={(event) => {
                  event.preventDefault();
                  copySongName(song.name);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  stopCopyTimer();
                  copyTimer.current = setTimeout(() => copySongName(song.name), 500);
                }}
                onTouchEnd={stopCopyTimer}
                onTouchCancel={stopCopyTimer}
              >
                {enableImages && (
                  <img
                    className="position-absolute rounded-start"
                    src={`${assetsHost}assets/mai2/jacket/UI_Jacket_${jacketId(song.musicId)}.webp`}
                    onError={imageFallback}
                    alt={song.name}
                  />
                )}
              </div>
              <div className="h-100 w-100 position-relative">
                <div
                  className="position-absolute h-100 d-flex align-items-center px-3 py-1"
                  style={{ left: 0, right: 0 }}
                >
                  <div className="w-100 overflow-hidden">
                    <div className="song-info-title text-truncate fw-bold">
                      <div
                        className="overflow-hidden"
                        style={{ marginRight: '0.5rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}
                      >
                        <span style={{ fontSize: '0.75rem' }}>{song.musicId}. </span>
                        <span>{song.name}</span>
                      </div>
                      <div className={`badge rounded-pill badge-${type.toUpperCase()}`}>
                        {type === 'utage' ? song.name.substring(1, 2) || '宴' : type.toUpperCase()}
                      </div>
                    </div>
                    <div className="song-info-artist text-truncate mb-1">
                      <span>{song.artistName}</span>
                    </div>
                    <div className="row m-0 align-items-center gap-2 flex-nowrap overflow-x-auto scrollbar-hidden">
                      {song.details.map((detail, index) =>
                        detail ? (
                          <span
                            className={`col-auto difficulty badge rounded-pill ${
                              index === 0 && type === 'utage'
                                ? 'difficulty-utage'
                                : [
                                    'difficulty-basic',
                                    'difficulty-advanced',
                                    'difficulty-expert',
                                    'difficulty-master',
                                    'difficulty-remaster',
                                  ][index] ?? 'difficulty-remaster'
                            }`}
                            key={index}
                          >
                            {detail.levelDecimal / 10}
                          </span>
                        ) : null,
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <Maimai2Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredSongs.length}
        onPageChange={setCurrentPage}
      />

      <Maimai2SongDetail
        music={detailMusic}
        open={detailMusic !== null}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
