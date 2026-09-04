import { useEffect, useMemo, useRef, useState } from 'react';
import type { TransitionEvent as ReactTransitionEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetAll, dbGetByKey } from '@/lib/db/db';
import { getCurrentUser } from '@/lib/user';
import { assetsHost } from '@/lib/utils';
import { OngekiCardItem } from './OngekiCardItem';
import { OngekiInteractiveCard, resetOngekiInteractiveCardTilt } from './OngekiInteractiveCard';
import type { OngekiCard, OngekiCharacter, OngekiSkill, PlayerCard } from './models';
import './card-gallery.css';
import './ongeki-common.css';

const ATTRS = ['Fire', 'Leaf', 'Aqua'];
const RARITIES = ['SSR', 'SRPlus', 'SR', 'R', 'N'];
const SKILL_CATEGORIES = [
  'Attack',
  'Boost',
  'Guard',
  'Support',
  'DangerAttack',
  'DangerBoost',
  'DangerGuard',
  'DangerSupport',
];
const PAGE_SIZE = 12;
const CARD_PICK_ANIMATION_MS = 1_000;

function parseSearchTerms(searchTerm: string): string[] {
  const terms: string[] = [];
  let buffer = '';
  let inQuotes = false;
  let escapeNext = false;
  for (const char of searchTerm) {
    if (escapeNext) {
      buffer += char;
      escapeNext = false;
    } else if (char === '\\') {
      escapeNext = true;
    } else if (char === '"') {
      if (!inQuotes && buffer.length > 0) {
        terms.push(buffer.trim());
        buffer = '';
      }
      inQuotes = !inQuotes;
    } else if (char === ' ' && !inQuotes) {
      if (buffer.length > 0) {
        terms.push(buffer);
        buffer = '';
      }
    } else {
      buffer += char;
    }
  }
  if (buffer.length > 0) terms.push(buffer.trim());
  return terms;
}

function calculateAtk(level: number, levelParams: number[] | null, isChokaika: boolean): number | null {
  if (levelParams === null) return null;
  if (isChokaika) return levelParams[levelParams.length - 1];
  const levels = [1, 50, 55, 60, 65, 70, 80, 90, 100];
  if (level < levels[0]) level = 1;
  else if (level > levels[levels.length - 4]) level = levels[levels.length - 4];
  for (let i = 0; i < levels.length - 1; i++) {
    if (level >= levels[i] && level < levels[i + 1]) {
      const diff = levels[i + 1] - levels[i];
      const ratio = (level - levels[i]) / diff;
      const atkDiff = levelParams[i + 1] - levelParams[i];
      return Math.floor(levelParams[i] + ratio * atkDiff);
    }
  }
  return null;
}

function getCardName(str: string, rarity: string, nickName: string): string {
  if (!str) return '';
  return str.replace('【SR+】', '【SRPlus】').replace(`【${rarity}】`, '').replace(`[${nickName}]`, '');
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function holoSheetStyle(index: string): React.CSSProperties {
  return {
    ['--holo-sheet-bottom' as any]: `url("${assetsHost}assets/holo-sheet/${index}/bottom.webp")`,
    ['--holo-sheet-middle' as any]: `url("${assetsHost}assets/holo-sheet/${index}/middle.webp")`,
    ['--holo-sheet-top' as any]: `url("${assetsHost}assets/holo-sheet/${index}/top.webp")`,
  } as React.CSSProperties;
}

function createLegacyPageArray(currentPage: number, totalPages: number, paginationRange = 7) {
  const pages: Array<{ label: number | string; value: number }> = [];
  const halfWay = Math.ceil(paginationRange / 2);
  const isStart = currentPage <= halfWay;
  const isEnd = totalPages - halfWay < currentPage;
  const isMiddle = !isStart && !isEnd;
  const ellipsesNeeded = paginationRange < totalPages;

  for (let i = 1; i <= totalPages && i <= paginationRange; i++) {
    let pageNumber: number;
    if (i === paginationRange) pageNumber = totalPages;
    else if (i === 1) pageNumber = 1;
    else if (paginationRange < totalPages && totalPages - halfWay < currentPage) {
      pageNumber = totalPages - paginationRange + i;
    } else if (paginationRange < totalPages && halfWay < currentPage) {
      pageNumber = currentPage - halfWay + i;
    } else {
      pageNumber = i;
    }

    const openingEllipsesNeeded = i === 2 && (isMiddle || isEnd);
    const closingEllipsesNeeded = i === paginationRange - 1 && (isMiddle || isStart);
    pages.push({
      label: ellipsesNeeded && (openingEllipsesNeeded || closingEllipsesNeeded) ? '...' : pageNumber,
      value: pageNumber,
    });
  }

  return pages;
}

function GalleryPagination({
  current,
  pageSize,
  totalItems,
  onPageChange,
}: {
  current: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / pageSize), 1);
  const pages = useMemo(
    () => createLegacyPageArray(current, totalPages),
    [current, totalPages],
  );

  return (
    <div className="ongeki-card-gallery-pagination user-select-none">
      <ul className="pagination pagination-sm justify-content-center my-2">
        <li className={'page-item' + (current <= 1 ? ' disabled' : '')}>
          <a className="page-link" onClick={() => current > 1 && onPageChange(current - 1)}>
            &nbsp;&lt;&nbsp;
          </a>
        </li>
        {pages.map((page, index) => (
          <li
            key={`${page.label}-${page.value}-${index}`}
            className={'page-item' + (current === page.value ? ' active' : '')}
          >
            <a className="page-link" onClick={() => current !== page.value && onPageChange(page.value)}>
              {page.label}
            </a>
          </li>
        ))}
        <li className={'page-item' + (current >= totalPages ? ' disabled' : '')}>
          <a className="page-link" onClick={() => current < totalPages && onPageChange(current + 1)}>
            &nbsp;&gt;&nbsp;
          </a>
        </li>
      </ul>
    </div>
  );
}

/** 等价旧版 ongeki-card-gallery.component（卡牌收集画廊） */
export function OngekiCardGalleryPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Number(searchParams.get('page') ?? 1) || 1;

  const [allCards, setAllCards] = useState<OngekiCard[]>([]);
  const [allSkills, setAllSkills] = useState<OngekiSkill[]>([]);
  const [cardIds, setCardIds] = useState<number[]>([]);
  const [cardList, setCardList] = useState<PlayerCard[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [showHolo, setShowHolo] = useState(false);
  const [showElements, setShowElements] = useState(true);
  const [showAll, setShowAll] = useState(true);
  const [sort, setSort] = useState('0');
  const [rarityChecked, setRarityChecked] = useState<boolean[]>(RARITIES.map(() => false));
  const [attrChecked, setAttrChecked] = useState<boolean[]>(ATTRS.map(() => false));
  const [skillChecked, setSkillChecked] = useState<boolean[]>(SKILL_CATEGORIES.map(() => false));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCollapsed, setFilterCollapsed] = useState(true);
  const [detailsCard, setDetailsCard] = useState<PlayerCard | null>(null);

  const [pickedCardId, setPickedCardId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const pickedCardIdRef = useRef<number | null>(null);
  const pickingTimerRef = useRef<number | null>(null);
  const pickedOriginalStyleRef = useRef<string | null>(null);
  const pickParams = useRef({ left: 0, top: 0, width: 0, height: 0, expandedWidth: 0, expandedHeight: 0 });
  const pickedParentRef = useRef<HTMLElement | null>(null);
  const pickedElRef = useRef<HTMLElement | null>(null);

  function clearPickingTimer() {
    if (pickingTimerRef.current !== null) {
      window.clearTimeout(pickingTimerRef.current);
      pickingTimerRef.current = null;
    }
  }

  function restorePickedElement() {
    const el = pickedElRef.current;
    if (el) {
      const originalStyle = pickedOriginalStyleRef.current;
      if (originalStyle === null) el.removeAttribute('style');
      else el.setAttribute('style', originalStyle);
    }
    pickedElRef.current = null;
    pickedParentRef.current = null;
    pickedOriginalStyleRef.current = null;
    document.body.classList.remove('overflow-hidden');
  }

  function finishPickAnimation(expectedElement?: HTMLElement) {
    const currentElement = pickedElRef.current;
    if (expectedElement && currentElement !== expectedElement) return;
    clearPickingTimer();
    currentElement?.style.removeProperty('--rotator-transition');
    setPicking(false);
    if (pickedCardIdRef.current === null) restorePickedElement();
  }

  useEffect(() => {
    return () => {
      clearPickingTimer();
      restorePickedElement();
    };
    // These helpers intentionally read refs at unmount rather than state from
    // the render that installed this cleanup callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSafari = useMemo(() => {
    const ua = window.navigator.userAgent;
    return ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1;
  }, []);

  useEffect(() => {
    if (isSafari) {
      notice(t('Ongeki.CardGallery.SafariWarning'), 'warning');
    }
  }, [isSafari, t]);

  useEffect(() => {
    void (async () => {
      const dummyCard: any = { id: 0 };
      const cards = [dummyCard, ...((await dbGetAll<OngekiCard>('ongekiCard')) as any[])];
      setAllCards(cards);
      setAllSkills(await dbGetAll<OngekiSkill>('ongekiSkill'));
      setCardIds((await api.get('api/game/ongeki/cardIds')) ?? []);
    })();
  }, []);

  const filteredIds = useMemo(() => {
    if (allCards.length === 0) return [];
    const selectedRarities = RARITIES.filter((_, i) => rarityChecked[i]);
    const selectedAttrs = ATTRS.filter((_, i) => attrChecked[i]);
    const selectedSkillCategories = SKILL_CATEGORIES.filter((_, i) => skillChecked[i]);

    let ids: number[];
    if (showAll && sort === '0') {
      const unAcquired = allCards.filter((c) => c.id !== 0 && !cardIds.includes(c.id)).map((c) => c.id);
      ids = [...cardIds, ...unAcquired];
    } else if (showAll && sort === '1') {
      ids = allCards.map((c) => c.id);
    } else if (!showAll && sort === '1') {
      ids = allCards.filter((c) => cardIds.includes(c.id)).map((c) => c.id);
    } else {
      ids = [...cardIds];
    }

    if (selectedRarities.length > 0 && selectedRarities.length < RARITIES.length) {
      const allowed = allCards.filter((c) => selectedRarities.includes(c.rarity)).map((c) => c.id);
      ids = ids.filter((id) => allowed.includes(id));
    }
    if (selectedAttrs.length > 0 && selectedAttrs.length < ATTRS.length) {
      const allowed = allCards.filter((c) => selectedAttrs.includes(c.attribute)).map((c) => c.id);
      ids = ids.filter((id) => allowed.includes(id));
    }
    if (selectedSkillCategories.length > 0 && selectedSkillCategories.length < SKILL_CATEGORIES.length) {
      const skillIds = allSkills
        .filter((s) => selectedSkillCategories.includes(s.category))
        .map((s) => s.id);
      const allowed = allCards
        .filter((c) => skillIds.includes(c.skillId) || skillIds.includes(c.choKaikaSkillId))
        .map((c) => c.id);
      ids = ids.filter((id) => allowed.includes(id));
    }

    const terms = parseSearchTerms(searchTerm.toLowerCase());
    const filteredSkillIds = allSkills
      .filter((s) => terms.some((term) => s.name.toLowerCase().includes(term) || s.info.toLowerCase().includes(term)))
      .map((s) => s.id);
    ids = ids.filter((id) => {
      const card = allCards.find((c) => c.id === id);
      if (!card || card.id === 0) return false;
      const nickName = card.nickName.toLowerCase();
      const cardNumber = card.cardNumber?.toLowerCase() ?? '';
      const charaName = getCardName(card.name, card.rarity, card.nickName).toLowerCase();
      return terms.every((term) => {
        if (id === Number(term)) return true;
        if (nickName.includes(term)) return true;
        if (cardNumber === term) return true;
        if (charaName.includes(term)) return true;
        if (filteredSkillIds.includes(card.skillId) || filteredSkillIds.includes(card.choKaikaSkillId)) return true;
        return false;
      });
    });
    return ids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCards, allSkills, cardIds, showAll, sort, rarityChecked, attrChecked, skillChecked, searchTerm]);

  const holoStyles = useMemo(() => {
    const styles = Array.from({ length: 12 }, (_, i) => holoSheetStyle(String(i).padStart(2, '0')));
    return { forward: shuffle(styles), reversed: [...shuffle(styles)].reverse() };
  }, [cardList]);

  const totalPages = Math.max(Math.ceil(filteredIds.length / PAGE_SIZE), 1);
  const normalizedCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);

  useEffect(() => {
    if (currentPage !== normalizedCurrentPage) {
      pageChanged(normalizedCurrentPage);
      return;
    }
    if (filteredIds.length === 0 && allCards.length === 0) return;
    void loadPage(normalizedCurrentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIds, currentPage, normalizedCurrentPage]);

  async function loadPage(page: number) {
    const start = Math.min((page - 1) * PAGE_SIZE, filteredIds.length);
    const end = Math.min(start + PAGE_SIZE, filteredIds.length);
    const pageIds = filteredIds.slice(start, end);
    const acquiredPageIds = pageIds.filter((id) => cardIds.includes(id));
    try {
      const content: PlayerCard[] = acquiredPageIds.length
        ? ((await api.get('api/game/ongeki/cardInfos', { cardIds: acquiredPageIds.join(',') })) ?? [])
        : [];
      const cards: PlayerCard[] = [];
      for (const id of pageIds) {
        let playerCard = content.find((card) => card.cardId === id);
        if (!playerCard) {
          const card = allCards.find((c) => c.id === id);
          const maxLevel = card?.rarity === 'N' ? 100 : 70;
          playerCard = {
            cardId: id,
            digitalStock: 0,
            analogStock: 0,
            level: maxLevel,
            maxLevel,
            exp: 0,
            printCount: 0,
            useCount: 0,
            kaikaDate: '2000-00-00 00:00:00.0',
            choKaikaDate: '2000-00-00 00:00:00.0',
            skillId: card?.choKaikaSkillId ?? 0,
            created: '0000-00-00 00:00:00.0',
            isNew: false,
            isAcquired: false,
          };
        }
        if (playerCard.cardId !== 0) {
          const y = await dbGetByKey<OngekiCard>('ongekiCard', playerCard.cardId);
          if (y) {
            playerCard.cardInfo = y;
            playerCard.characterInfo =
              (await dbGetByKey<OngekiCharacter>('ongekiCharacter', y.charaId)) ?? undefined;
            const skillId = playerCard.choKaikaDate !== '0000-00-00 00:00:00.0' ? y.choKaikaSkillId : y.skillId;
            playerCard.skillInfo = (await dbGetByKey<OngekiSkill>('ongekiSkill', skillId)) ?? undefined;
          }
        }
        cards.push(playerCard);
      }
      setCardList(cards);
    } catch (error) {
      notice(String(error));
    }
    setLoading(false);
  }

  function pageChanged(page: number) {
    const pageCount = Math.max(Math.ceil(filteredIds.length / PAGE_SIZE), 1);
    const nextPage = Math.min(Math.max(page, 1), pageCount);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set('page', String(nextPage));
      return p;
    });
  }

  function kaika(cardId: number, type: string) {
    const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
    void api
      .post(`api/game/ongeki/card/${cardId}/${type}`, undefined, { aimeId })
      .then(() => {
        notice('Kaika success');
        void loadPage(currentPage);
      })
      .catch((error) => notice(String(error)));
  }

  function insertCard(cardId: number) {
    const aimeId = getCurrentUser()?.defaultCard?.extId;
    void api
      .post('api/game/ongeki/card', { aimeId, cardId })
      .then(() => {
        notice('Successful, go to check your card list');
        setCardIds((ids) => [cardId, ...ids]);
        void loadPage(currentPage);
      })
      .catch((error) => notice(String(error)));
  }

  function pickCard(cardId: number, cardCol: HTMLElement) {
    if (picking || isSafari) return;
    if (!cardIds.includes(cardId)) return;
    if (pickedCardIdRef.current !== null) {
      setPicking(true);
      resetOngekiInteractiveCardTilt(pickedElRef.current ?? cardCol);
      unpickCard();
      return;
    }
    clearPickingTimer();
    pickedOriginalStyleRef.current = cardCol.getAttribute('style');
    const rect = cardCol.getBoundingClientRect();
    pickParams.current.width = rect.width;
    pickParams.current.height = rect.height;
    pickParams.current.left = (rect.right + rect.left) / 2;
    pickParams.current.top = (rect.bottom + rect.top) / 2;
    let maxWidth = Math.min(window.innerHeight * 0.730038022813688, window.innerWidth);
    maxWidth *= 0.9;
    maxWidth = Math.min(maxWidth, 768);
    pickParams.current.expandedWidth = maxWidth;
    pickParams.current.expandedHeight = maxWidth / 0.730038022813688;
    resetOngekiInteractiveCardTilt(cardCol);

    pickedElRef.current = cardCol;
    pickedParentRef.current = cardCol.parentElement;
    pickedCardIdRef.current = cardId;
    setPicking(true);
    setPickedCardId(cardId);
    document.body.classList.add('overflow-hidden');

    // 两阶段动画：先把元素钉在原位（无过渡），再过渡到放大位置（等价旧版 Angular 动画）
    const s = cardCol.style;
    s.transition = 'none';
    s.position = 'fixed';
    s.top = `${pickParams.current.top}px`;
    s.left = `${pickParams.current.left}px`;
    s.width = `${pickParams.current.width}px`;
    s.height = `${pickParams.current.height}px`;
    s.transform = 'translate(-50%, -50%)';
    s.zIndex = '1100';
    void cardCol.offsetWidth; // 强制 reflow，使起始样式生效

    s.transition = 'all 1s ease-in-out';
    s.setProperty('--rotator-transition', 'all 1s ease-out');
    // 等价旧版 Angular 动画：从原位滑移到屏幕中央并同时放大
    s.top = '50%';
    s.left = '50%';
    s.width = `${pickParams.current.expandedWidth}px`;
    s.height = `${pickParams.current.expandedHeight}px`;
    s.transform = 'translate(-50%, -50%) translateZ(10000px)';
    pickingTimerRef.current = window.setTimeout(() => finishPickAnimation(cardCol), CARD_PICK_ANIMATION_MS + 50);
  }

  function unpickCard() {
    const el = pickedElRef.current;
    const parent = pickedParentRef.current;
    if (!el) {
      pickedCardIdRef.current = null;
      setPickedCardId(null);
      setPicking(false);
      restorePickedElement();
      return;
    }
    clearPickingTimer();
    setPicking(true);
    pickedCardIdRef.current = null;
    if (parent) {
      const parentRect = parent.getBoundingClientRect();
      const width = parentRect.width > 0 ? parentRect.width : pickParams.current.width;
      const height = parentRect.height > 0 ? parentRect.height : pickParams.current.height;
      const left = parentRect.width > 0 ? (parentRect.left + parentRect.right) / 2 : pickParams.current.left;
      const top = parentRect.height > 0 ? (parentRect.top + parentRect.bottom) / 2 : pickParams.current.top;
      const s = el.style;
      s.transition = 'all 1s ease-in-out';
      s.setProperty('--rotator-transition', 'all 1s ease-out');
      s.top = `${top}px`;
      s.left = `${left}px`;
      s.width = `${width}px`;
      s.height = `${height}px`;
      s.transform = 'translate(-50%, -50%)';
    } else {
      restorePickedElement();
    }
    setPickedCardId(null);
    pickingTimerRef.current = window.setTimeout(() => finishPickAnimation(el), CARD_PICK_ANIMATION_MS + 50);
  }

  function onPickTransitionEnd(event: ReactTransitionEvent<HTMLDivElement>) {
    // The card surface has its own transitions and bubbles transitionend to
    // this wrapper. Only the wrapper's transform marks the pick animation.
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    finishPickAnimation(event.currentTarget);
  }

  const isDefaultFilter =
    showAll === true &&
    attrChecked.every((v) => !v) &&
    skillChecked.every((v) => !v) &&
    sort === '0' &&
    rarityChecked.every((v) => !v) &&
    searchTerm === '';

  function resetFilter() {
    setShowAll(true);
    setAttrChecked(ATTRS.map(() => false));
    setSkillChecked(SKILL_CATEGORIES.map(() => false));
    setSort('0');
    setRarityChecked(RARITIES.map(() => false));
    setSearchTerm('');
  }

  const toDisplayRarity = (r: string) => (r === 'SRPlus' ? 'SR+' : r);
  const toDisplaySkillCategory = (s: string) =>
    s === 'Support' ? 'Assist' : s === 'DangerSupport' ? 'DangerAssist' : s;

  const detailsTable = (item: PlayerCard) => (
    <table className="card-details-table table table-borderless table-sm table-striped align-middle text-center small">
      <tbody>
        <tr>
          <td>ID</td>
          <td>{item.cardId}</td>
        </tr>
        {item.cardInfo && (
          <tr>
            <td>{t('Ongeki.CardGallery.Character')}</td>
            <td>{getCardName(item.cardInfo.name, item.cardInfo.rarity, item.cardInfo.nickName)}</td>
          </tr>
        )}
        {item.cardInfo && (
          <tr>
            <td>{t('Ongeki.CardGallery.NickName')}</td>
            <td>{item.cardInfo.nickName}</td>
          </tr>
        )}
        {item.digitalStock >= 1 && (
          <tr>
            <td>{t('Ongeki.CardGallery.Level')}</td>
            <td>
              {item.level}/{item.maxLevel}
            </td>
          </tr>
        )}
        {item.cardInfo && (
          <tr>
            <td>{t('Ongeki.CardGallery.Attack')}</td>
            <td>
              {calculateAtk(
                item.level,
                item.cardInfo.levelParam
                  ? item.cardInfo.levelParam.split(',').map((s) => parseFloat(s.trim()))
                  : null,
                item.digitalStock >= 1 ? item.choKaikaDate !== '0000-00-00 00:00:00.0' : true,
              )}
            </td>
          </tr>
        )}
        <tr>
          <td>{t('Ongeki.CardGallery.Skill')}</td>
          <td>{item.skillInfo ? item.skillInfo.name : item.skillId}</td>
        </tr>
        {item.skillInfo && (
          <tr>
            <td>{t('Ongeki.CardGallery.Info')}</td>
            <td>{item.skillInfo.info}</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.CardGallery.Title')}</h1>

      <div className="row mb-2 g-1">
        <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.CardGallery.Display')}</div>
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            <div className="col-auto">
              <input
                className="checkbox checkbox-btn"
                type="checkbox"
                role="switch"
                id="holoSwitch"
                checked={showHolo}
                onChange={() => setShowHolo((v) => !v)}
              />
              <label className="checkbox-label" htmlFor="holoSwitch">
                {t('Ongeki.CardGallery.Holo')}
              </label>
            </div>
            <div className="col-auto">
              <input
                className="checkbox checkbox-btn"
                type="checkbox"
                role="switch"
                id="elementsSwitch"
                checked={showElements}
                onChange={() => setShowElements((v) => !v)}
              />
              <label className="checkbox-label" htmlFor="elementsSwitch">
                {t('Ongeki.CardGallery.Elements')}
              </label>
            </div>
          </div>
        </div>
      </div>

      <div
        id="filterCollapse"
        className={`collapse ongeki-card-gallery-filter-collapse${filterCollapsed ? '' : ' show'}`}
        aria-hidden={filterCollapsed}
      >
        <div className="ongeki-card-gallery-filter-collapse-inner">
          <div className="row mb-2 g-1">
            <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.CardGallery.IsAcquired')}</div>
            <div className="col-12 col-sm">
              <div className="row justify-content-start align-items-center g-1">
                <div className="col-auto">
                  <input
                    className="checkbox checkbox-btn"
                    type="checkbox"
                    role="switch"
                    id="showUnacquired"
                    checked={showAll}
                    onChange={() => setShowAll((v) => !v)}
                  />
                  <label className="checkbox-label" htmlFor="showUnacquired">
                    {t('Ongeki.CardGallery.Unacquired')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {[
            {
              label: t('Ongeki.CardGallery.Rarity'),
              items: RARITIES,
              checked: rarityChecked,
              set: setRarityChecked,
              display: toDisplayRarity,
            },
            {
              label: t('Ongeki.CardGallery.Attribute'),
              items: ATTRS,
              checked: attrChecked,
              set: setAttrChecked,
              display: (s: string) => s,
            },
            {
              label: t('Ongeki.CardGallery.SkillCategory'),
              items: SKILL_CATEGORIES,
              checked: skillChecked,
              set: setSkillChecked,
              display: toDisplaySkillCategory,
            },
          ].map((group) => (
            <div className="row mb-2 g-1" key={group.label}>
              <div className="col-12 col-sm-auto pt-1 me-3">{group.label}</div>
              <div className="col-12 col-sm">
                <div className="row justify-content-start align-items-center g-1">
                  {group.items.map((item, i) => (
                    <div className="col-auto" key={item}>
                      <input
                        className="checkbox checkbox-btn"
                        type="checkbox"
                        role="switch"
                        id={`chk-${group.label}-${item}`}
                        checked={group.checked[i]}
                        onChange={() => group.set((s) => s.map((v, idx) => (idx === i ? !v : v)))}
                      />
                      <label className="checkbox-label" htmlFor={`chk-${group.label}-${item}`}>
                        {group.display(item)}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}

          <div className="row mb-2 g-1">
            <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.CardGallery.SortBy')}</div>
            <div className="col-12 col-sm">
              <div className="row justify-content-start align-items-center g-1">
                <div className="col-12 p-0">
                  <select
                    className="form-select form-select-sm"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="0">{t('Ongeki.CardGallery.Acquisition')}</option>
                    <option value="1">{t('Ongeki.CardGallery.CardID')}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="row mb-2 g-1">
            <div className="col-12 p-0">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder={t('Ongeki.CardGallery.FilterPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {cardList && (
        <div className="mb-2">
          <span>{t('Ongeki.CardGallery.TotalCardNum', { num: filteredIds.length })}</span>
          <a className="link-btn ms-3" onClick={() => setFilterCollapsed((v) => !v)}>
            {filterCollapsed ? t('Ongeki.CardGallery.ShowFilter') : t('Ongeki.CardGallery.HideFilter')}
          </a>
          {!isDefaultFilter && (
            <a className="link-btn ms-3" onClick={resetFilter}>
              {t('Ongeki.CardGallery.ResetFilter')}
            </a>
          )}
        </div>
      )}

      <div className="callout callout-info mt-0 mb-1">
        <div>{t('Ongeki.CardGallery.Info1')}</div>
      </div>

      {!loading && (
        <GalleryPagination
          current={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={filteredIds.length}
          onPageChange={pageChanged}
        />
      )}

      {cardList && (
        <div className="text-center px-1">
          <div className="row row-cols-2 row-cols-sm-3 row-cols-md-4">
            {cardList.map((item, i) => (
              <div className="col p-2" key={`${item.cardId}-${i}`}>
                <div className="w-100">
                  <OngekiInteractiveCard
                    className={
                      (pickedCardId === item.cardId ? ' card-picking' : '') +
                      (item.digitalStock < 1 ? ' grayscale' : '')
                    }
                    interactive={!isSafari && !picking}
                    onTransitionEnd={onPickTransitionEnd}
                    onClick={(e) => {
                      if (isSafari) {
                        if (!pickedCardId) setDetailsCard(item);
                      } else {
                        pickCard(item.cardId, e.currentTarget);
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!pickedCardId) setDetailsCard(item);
                    }}
                  >
                    <OngekiCardItem
                      item={item}
                      showHolo={showHolo}
                      showElements={showElements}
                      holoSheetStyle1={holoStyles.forward[i % 12]}
                      holoSheetStyle2={holoStyles.reversed[i % 12]}
                    />
                  </OngekiInteractiveCard>
                </div>
              </div>
            ))}
          </div>
          <div
            className={'card-backdrop' + (pickedCardId ? '' : ' card-backdrop-hidden')}
            onClick={unpickCard}
          />
        </div>
      )}

      {!loading && (
        <GalleryPagination
          current={currentPage}
          pageSize={PAGE_SIZE}
          totalItems={filteredIds.length}
          onPageChange={pageChanged}
        />
      )}
      <div className="mb-2" />

      <BModal
        open={!!detailsCard}
        onClose={() => setDetailsCard(null)}
        title={t('Ongeki.CardGallery.Details')}
      >
        {detailsCard && detailsCard.digitalStock >= 1 && (
          <div className="modal-body">
            {detailsTable(detailsCard)}
            <div className="hstack gap-1 float-end">
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={detailsCard.kaikaDate !== '0000-00-00 00:00:00.0'}
                onClick={() => {
                  kaika(detailsCard.cardId, 'kaika');
                  setDetailsCard(null);
                }}
              >
                {t('Ongeki.CardGallery.Kaika')}
              </button>
              <button
                className="btn btn-sm btn-outline-secondary"
                disabled={detailsCard.choKaikaDate !== '0000-00-00 00:00:00.0'}
                onClick={() => {
                  kaika(detailsCard.cardId, 'choKaika');
                  setDetailsCard(null);
                }}
              >
                {t('Ongeki.CardGallery.ChoKaika')}
              </button>
            </div>
          </div>
        )}
        {detailsCard && detailsCard.digitalStock < 1 && (
          <div className="modal-body">
            {detailsTable(detailsCard)}
            <div className="hstack gap-1 float-end">
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  insertCard(detailsCard.cardId);
                  setDetailsCard(null);
                }}
              >
                I want it
              </button>
            </div>
          </div>
        )}
      </BModal>
    </div>
  );
}
