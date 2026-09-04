import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { dbGetAll } from '@/lib/db/db';
import { toLevelDecimal } from './pipes';
import { OngekiSongScoreRanking } from './OngekiSongScoreRanking';
import type { OngekiCard, OngekiCharacter, OngekiMusic } from './models';
import { OngekiPagination } from './OngekiPagination';
import './song-list.css';
import './ongeki-common.css';

const GENRES = ['POPS＆ANIME', 'niconico', '東方Project', 'VARIETY', 'チュウマイ', 'オンゲキ'];
const PAGE_SIZE = 15;

class SearchPattern {
  constructor(
    public type: string,
    public value: any,
  ) {}
}

function isLunatic(song: OngekiMusic): boolean {
  return (
    song.level0 === '0,0' && song.level1 === '0,0' && song.level2 === '0,0' && song.level3 === '0,0'
  );
}

/** 等价旧版 ongeki-song-list.component（乐曲浏览器） */
export function OngekiSongListPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') ?? 1) || 1;

  const [songList, setSongList] = useState<OngekiMusic[]>([]);
  const [allCards, setAllCards] = useState<OngekiCard[]>([]);
  const [characters, setCharacters] = useState<OngekiCharacter[]>([]);
  const [genreChecked, setGenreChecked] = useState<boolean[]>(GENRES.map(() => false));
  const [lunaticChecked, setLunaticChecked] = useState(false);
  const [patterns, setPatterns] = useState<SearchPattern[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<SearchPattern[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [detailMusic, setDetailMusic] = useState<OngekiMusic | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      const all = await dbGetAll<OngekiMusic>('ongekiMusic');
      setSongList(all.filter((item) => (item.id > 1 && item.id < 2800) || item.id > 7000));
      setAllCards(await dbGetAll<OngekiCard>('ongekiCard'));
      setCharacters(await dbGetAll<OngekiCharacter>('ongekiCharacter'));
    })();
  }, []);

  // 搜索建议（等价旧版 searchTypehead）
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 1 || !showSuggestions) {
      setSuggestions([]);
      return;
    }
    const lower = term.toLowerCase();
    const res: SearchPattern[] = [];
    const num = Number(term.endsWith('+') ? term.slice(0, -1) : term);
    if (!Number.isNaN(num) && Number.isFinite(num) && !term.endsWith('.')) {
      if (Number.isInteger(num) && !term.includes('.')) {
        if (num < 10000 && num >= 0 && !term.endsWith('+')) {
          res.push(new SearchPattern('ID', num));
        }
        if (num <= 15 && num >= 0 && (num >= 7 || !term.endsWith('+'))) {
          res.push(new SearchPattern('Level', term));
        }
      } else {
        if (num < 15.8 && num >= 0 && /^\d{1,2}\.\d$/.test(term)) {
          res.push(new SearchPattern('Const', num.toFixed(1)));
        }
      }
    }
    const rangePattern = /^(\d{1,2}(\.\d)?)[\s\-~](\d{1,2}(\.\d)?)$/;
    const match = term.match(rangePattern);
    if (match) {
      let const1 = Number(match[1]);
      let const2 = Number(match[3]);
      if (
        !Number.isNaN(const1) &&
        Number.isFinite(const1) &&
        !Number.isNaN(const2) &&
        Number.isFinite(const2) &&
        const1 !== const2
      ) {
        if (const2 < const1) {
          const tmp = const1;
          const1 = const2;
          const2 = tmp;
        }
        if (const1 >= 0 && const2 < 15.8) {
          res.push(new SearchPattern('Range', `${const1.toFixed(1)}~${const2.toFixed(1)}`));
        }
      }
    }
    res.push(new SearchPattern('String', term));
    for (const song of songList) {
      if (
        song.artistName.toLowerCase().includes(lower) &&
        !res.some((p) => p.type === 'Artist' && p.value === song.artistName)
      ) {
        res.push(new SearchPattern('Artist', song.artistName));
      }
      if (
        (song.name.toLowerCase().includes(lower) || song.sortName.toLowerCase().includes(lower)) &&
        !res.some((p) => p.type === 'Title' && p.value === song.name)
      ) {
        res.push(new SearchPattern('Title', song.name));
      }
    }
    for (const character of characters) {
      if (character.name.toLowerCase().includes(lower)) {
        res.push(new SearchPattern('Boss', character.name));
      }
    }
    setSuggestions(res);
  }, [searchTerm, showSuggestions, songList, characters]);

  function filterByPattern(song: OngekiMusic, pattern: SearchPattern, cardList: OngekiCard[], charList: OngekiCharacter[]): boolean {
    if (pattern.type === 'ID') {
      return song.id === pattern.value;
    }
    const levels: number[] = [];
    if (isLunatic(song)) {
      levels.push(Number(toLevelDecimal(song.level4)));
    } else {
      levels.push(Number(toLevelDecimal(song.level3)));
      levels.push(Number(toLevelDecimal(song.level2)));
      levels.push(Number(toLevelDecimal(song.level1)));
      levels.push(Number(toLevelDecimal(song.level0)));
    }
    if (pattern.type === 'Level') {
      const num = Number(pattern.value.endsWith('+') ? pattern.value.slice(0, -1) : pattern.value);
      let max: number;
      let min: number;
      if (num < 7) {
        min = num;
        max = num + 1;
      } else {
        if (pattern.value.endsWith('+')) {
          min = num + 0.7;
          max = num + 1;
        } else {
          min = num;
          max = num + 0.7;
        }
      }
      return levels.some((level) => level >= min && level < max);
    }
    if (pattern.type === 'Const') {
      return levels.some((level) => level === Number(pattern.value));
    }
    if (pattern.type === 'Range') {
      const values = pattern.value.split('~').map((v: string) => Number(v));
      return levels.some((level) => level >= values[0] && level < values[1]);
    }

    let bossName = '';
    const bossCard = cardList.find((c) => c.id === song.bossCardId);
    if (bossCard) {
      const boss = charList.find((c) => c.id === bossCard.charaId);
      if (boss) bossName = boss.name;
    }
    const lower = pattern.value.toLowerCase();
    if (pattern.type === 'String') {
      return (
        song.name.toLowerCase().includes(lower) ||
        song.sortName.toLowerCase().includes(lower) ||
        song.artistName.toLowerCase().includes(lower) ||
        bossName.toLowerCase().includes(lower)
      );
    }
    if (pattern.type === 'Artist') {
      return song.artistName.toLowerCase().includes(lower);
    }
    if (pattern.type === 'Title') {
      return song.name.toLowerCase().includes(lower) || song.sortName.toLowerCase().includes(lower);
    }
    if (pattern.type === 'Boss') {
      return bossName.toLowerCase().includes(lower);
    }
    return true;
  }

  const filteredSongList = useMemo(() => {
    let selectedGenres = GENRES.filter((_, index) => genreChecked[index]);
    if (selectedGenres.length === 0 && !lunaticChecked) {
      selectedGenres = GENRES;
    }
    let filtered = songList;
    if (selectedGenres.length !== GENRES.length) {
      filtered = filtered.filter(
        (song) => selectedGenres.includes(song.genre) || (lunaticChecked && isLunatic(song)),
      );
    }
    for (const pattern of patterns) {
      filtered = filtered.filter((song) => filterByPattern(song, pattern, allCards, characters));
    }
    return filtered;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songList, genreChecked, lunaticChecked, patterns, allCards, characters]);

  function pageChanged(page: number) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('page', String(page));
      return p;
    });
  }

  function onKeydown(e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && searchTerm === '') {
      e.preventDefault();
      setPatterns((list) => list.slice(0, -1));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        addPattern(suggestions[0]);
      }
    }
  }

  function addPattern(pattern: SearchPattern) {
    setPatterns((list) => [...list, pattern]);
    setSearchTerm('');
    setSuggestions([]);
  }

  function onPatternClick(pattern: SearchPattern) {
    setPatterns((list) => list.filter((p) => p !== pattern));
    setSearchTerm(String(pattern.value));
    setShowSuggestions(true);
    searchInputRef.current?.focus();
  }

  const pageItems = filteredSongList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const diffBadge = (levelData: string | null, cls: string, key: string, fallback?: string) => {
    const dec = levelData ? toLevelDecimal(levelData) : null;
    if (!dec || Number.parseFloat(dec) === 0) {
      if (fallback) {
        return (
          <span key={key} className={'col-auto difficulty ' + cls + ' badge rounded-pill'}>
            {fallback}
          </span>
        );
      }
      return null;
    }
    return (
      <span key={key} className={'col-auto difficulty ' + cls + ' badge rounded-pill'}>
        {dec}
      </span>
    );
  };

  return (
    <div className="content ongeki-song-list-page">
      <h1 className="page-heading">{t('Ongeki.MusicList.Title')}</h1>

      <OngekiPagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredSongList.length}
        onPageChange={pageChanged}
      />

      <div className="row justify-content-start mb-2 g-2">
        {GENRES.map((genre, i) => (
          <div className="col-auto" key={genre}>
            <input
              type="checkbox"
              className="form-check-input checkbox-btn"
              id={'genre' + i}
              checked={genreChecked[i]}
              onChange={() =>
                setGenreChecked((s) => s.map((v, idx) => (idx === i ? !v : v)))
              }
            />
            <label className="checkbox-label" htmlFor={'genre' + i}>
              {genre}
            </label>
          </div>
        ))}
        <div className="col-auto">
          <input
            type="checkbox"
            className="form-check-input checkbox-btn"
            id="lunatic"
            checked={lunaticChecked}
            onChange={() => setLunaticChecked((v) => !v)}
          />
          <label className="checkbox-label" htmlFor="lunatic">
            Lunatic
          </label>
        </div>
      </div>

      <div className="form-control input-container mb-2 position-relative">
        <div className="row g-2">
          {patterns.map((pattern, i) => (
            <div className="col-auto" key={i}>
              <span
                className="badge rounded-pill bg-primary cursor-pointer"
                onClick={() => onPatternClick(pattern)}
              >
                {t('Ongeki.MusicList.PatternTypes.' + pattern.type)}
                {t('Common.Colon')}
                {String(pattern.value)}
              </span>
            </div>
          ))}
          <div className="col" style={{ minWidth: 100 }}>
            <input
              ref={searchInputRef}
              className="form-control-plaintext p-0"
              placeholder={t('Ongeki.MusicList.Filter')}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={onKeydown}
            />
          </div>
        </div>
        {showSuggestions && suggestions.length > 0 && (
          <div
            className="position-absolute top-100 start-0 end-0 z-3 bg-[var(--bs-body-bg)] border border-[var(--bs-border-color)] rounded shadow"
            style={{ marginTop: 2 }}
          >
            {suggestions.map((s, i) => (
              <a
                key={i}
                className="d-block px-3 py-1 cursor-pointer text-decoration-none"
                style={{ color: 'var(--bs-body-color)' }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addPattern(s);
                }}
              >
                {t('Ongeki.MusicList.PatternTypes.' + s.type)}
                {t('Common.Colon')}
                {String(s.value)}
              </a>
            ))}
          </div>
        )}
      </div>

      {pageItems.map((item) => (
        <div
          className="card-btn card mb-2 text-start user-select-none"
          key={item.id}
          onClick={() => setDetailMusic(item)}
        >
          <div className="song-info card-body hstack gap-2 p-0">
            <div className="jacket-container ratio ratio-1x1">
              <img
                className="position-absolute rounded-start"
                src={
                  (import.meta.env.VITE_ASSETS_HOST ?? 'https://rinnet.stehp.cn/') +
                  `assets/ongeki/jacket/UI_Jacket_${String(item.id).padStart(4, '0')}.webp`
                }
                alt=""
              />
            </div>
            <div className="overflow-hidden">
              <div className="song-info-title text-truncate fw-bold">
                <span>
                  {item.id}.「{item.name}」
                </span>
              </div>
              <div className="song-info-artist text-truncate mb-1">
                <span>{item.artistName}</span>
              </div>
              <div className="row m-0 align-items-center gap-2">
                {diffBadge(item.level0, 'difficulty-basic', 'l0')}
                {diffBadge(item.level1, 'difficulty-advanced', 'l1')}
                {diffBadge(item.level2, 'difficulty-expert', 'l2')}
                {diffBadge(item.level3, 'difficulty-master', 'l3')}
                {Number.parseFloat(toLevelDecimal(item.level3) ?? '0') === 0 &&
                  diffBadge(item.level4, 'difficulty-lunatic', 'l4')}
              </div>
            </div>
          </div>
        </div>
      ))}

      <OngekiPagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={filteredSongList.length}
        onPageChange={pageChanged}
      />
      <div className="mb-2" />

      <OngekiSongScoreRanking
        music={detailMusic}
        open={!!detailMusic}
        onClose={() => setDetailMusic(null)}
      />
    </div>
  );
}
