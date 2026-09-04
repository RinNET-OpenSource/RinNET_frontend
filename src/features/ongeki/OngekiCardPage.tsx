import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { preloadStates } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { dbGetAll, dbGetByKey } from '@/lib/db/db';
import { StatusCode } from '@/lib/models';
import { useStore } from '@/lib/store';
import { assetsHost } from '@/lib/utils';
import { OngekiCardSurface } from './OngekiCardSurface';
import type { OngekiCard as OngekiCardModel, OngekiSkill, PlayerCard } from './models';
import './ongeki-common.css';
import './ongeki-card-picker.css';

interface UserDeck {
  deckId: number;
  cardId1: number;
  cardId2: number;
  cardId3: number;
}

interface UserSkin extends UserDeck {
  isValid: boolean;
}

enum CardType {
  SKILL = 'SKILL',
  SKIN = 'SKIN',
}

const PICKER_ATTRS = ['Fire', 'Leaf', 'Aqua'];
const PICKER_RARITIES = ['SSR', 'SRPlus', 'SR', 'R', 'N'];
const PICKER_SKILL_CATEGORIES = [
  'Attack',
  'Boost',
  'Guard',
  'Support',
  'DangerAttack',
  'DangerBoost',
  'DangerGuard',
  'DangerSupport',
];
const PICKER_PAGE_SIZE = 12;

function parsePickerSearchTerms(searchTerm: string): string[] {
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

function pickerCardName(str: string, rarity: string, nickName: string): string {
  if (!str) return '';
  return str.replace('【SR+】', '【SRPlus】').replace(`【${rarity}】`, '').replace(`[${nickName}]`, '');
}

function pickerHoloSheetStyle(index: string): React.CSSProperties {
  return {
    ['--holo-sheet-bottom' as any]: `url("${assetsHost}assets/holo-sheet/${index}/bottom.webp")`,
    ['--holo-sheet-middle' as any]: `url("${assetsHost}assets/holo-sheet/${index}/middle.webp")`,
    ['--holo-sheet-top' as any]: `url("${assetsHost}assets/holo-sheet/${index}/top.webp")`,
  } as React.CSSProperties;
}

function shufflePicker<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createPickerPageArray(currentPage: number, totalPages: number, paginationRange = 7) {
  const pages: Array<{ label: number | string; value: number }> = [];
  const halfWay = Math.ceil(paginationRange / 2);
  const isStart = currentPage <= halfWay;
  const isEnd = totalPages - halfWay < currentPage;
  const isMiddle = !isStart && !isEnd;
  const ellipsesNeeded = paginationRange < totalPages;

  for (let i = 1; i <= totalPages && i <= paginationRange; i += 1) {
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

function PickerPagination({
  current,
  totalItems,
  onPageChange,
}: {
  current: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(Math.ceil(totalItems / PICKER_PAGE_SIZE), 1);
  const pages = useMemo(
    () => createPickerPageArray(current, totalPages),
    [current, totalPages],
  );

  return (
    <div className="ongeki-card-picker-pagination user-select-none">
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

/** 等价旧版 ongeki-card.component（卡组/皮肤编辑） */
export function OngekiCardPage() {
  const { t } = useTranslation();
  const catalogStates = useStore(preloadStates);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get('type');
  const type =
    rawType && Object.values(CardType).includes(rawType.toUpperCase() as CardType)
      ? (rawType.toUpperCase() as CardType)
      : CardType.SKILL;

  const [cardIDs, setCardIDs] = useState<number[]>([]);
  const [cardInfoMap, setCardInfoMap] = useState<Map<number, PlayerCard>>(new Map());
  const [skinValid, setSkinValid] = useState<boolean[]>([false, false, false, false, false]);
  const [currentDeckID, setCurrentDeckID] = useState(1);
  const [selecting, setSelecting] = useState<{ deckIndex: number } | null>(null);
  // 选卡弹窗复用完整画廊的展示、筛选和分页契约，但 modal 模式只显示已拥有卡片。
  const [galleryCards, setGalleryCards] = useState<PlayerCard[]>([]);
  const [galleryIds, setGalleryIds] = useState<number[]>([]);
  const [galleryAllCards, setGalleryAllCards] = useState<OngekiCardModel[]>([]);
  const [galleryAllSkills, setGalleryAllSkills] = useState<OngekiSkill[]>([]);
  const [galleryShowHolo, setGalleryShowHolo] = useState(false);
  const [galleryShowElements, setGalleryShowElements] = useState(true);
  const [gallerySort, setGallerySort] = useState('0');
  const [galleryRarityChecked, setGalleryRarityChecked] = useState<boolean[]>(
    PICKER_RARITIES.map(() => false),
  );
  const [galleryAttrChecked, setGalleryAttrChecked] = useState<boolean[]>(
    PICKER_ATTRS.map(() => false),
  );
  const [gallerySkillChecked, setGallerySkillChecked] = useState<boolean[]>(
    PICKER_SKILL_CATEGORIES.map(() => false),
  );
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryPage, setGalleryPage] = useState(1);
  const [galleryFilterCollapsed, setGalleryFilterCollapsed] = useState(true);

  const deckIDs = [1, 2, 3, 4, 5];
  const cardCatalogReady =
    catalogStates.ongekiCard === 'OK' && catalogStates.ongekiSkill === 'OK';

  useEffect(() => {
    setCardIDs([]);
    if (!cardCatalogReady) return;
    if (type === CardType.SKILL) {
      void getUserDeck();
    } else {
      void getUserSkin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cardCatalogReady]);

  async function getUserDeck() {
    let ids: number[] = [];
    try {
      const resp = await api.get('api/game/ongeki/userDeckList');
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) {
          const deckList: UserDeck[] = resp.data ?? [];
          ids = deckList.flatMap((deck) => [deck.cardId1, deck.cardId2, deck.cardId3]);
          setCardIDs(ids);
        } else {
          notice(resp.status.message);
          return;
        }
      }
    } catch (error) {
      notice(String(error));
      return;
    }
    await getCardInfo(ids);
  }

  async function getUserSkin() {
    const ids: number[] = [];
    try {
      const skinList: UserSkin[] = await api.get('api/game/ongeki/skin');
      const valid = [...skinValid];
      for (const skin of skinList ?? []) {
        ids.push(skin.cardId1, skin.cardId2, skin.cardId3);
        valid[skin.deckId - 1] = skin.isValid;
      }
      setCardIDs(ids);
      setSkinValid(valid);
    } catch (error) {
      notice(String(error));
      return;
    }
    await getCardInfo(ids);
  }

  async function getCardInfo(ids?: number[]) {
    const list = ids ?? cardIDs;
    if (list.length === 0) return;
    const params = { cardIds: list.join(',') };
    try {
      const cards: PlayerCard[] = await api.get('api/game/ongeki/cardInfos', params);
      const map = new Map<number, PlayerCard>();
      for (const card of cards ?? []) {
        const c = await dbGetByKey<OngekiCardModel>('ongekiCard', card.cardId);
        if (c) {
          card.cardInfo = c;
          const skillId = card.choKaikaDate !== '0000-00-00 00:00:00.0' ? c.choKaikaSkillId : c.skillId;
          card.skillInfo = (await dbGetByKey<OngekiSkill>('ongekiSkill', skillId)) ?? undefined;
        }
        map.set(card.cardId, card);
      }
      setCardInfoMap(map);
    } catch (error) {
      notice(String(error));
    }
  }

  function getCard(id: number): PlayerCard {
    if (cardInfoMap.has(id)) return cardInfoMap.get(id)!;
    return {
      cardId: id,
      digitalStock: 0,
      analogStock: 0,
      level: 0,
      maxLevel: 0,
      exp: 0,
      printCount: 0,
      useCount: 0,
      kaikaDate: '2000-00-00 00:00:00.0',
      choKaikaDate: '2000-00-00 00:00:00.0',
      skillId: 0,
      created: '0000-00-00 00:00:00.0',
      isNew: false,
      isAcquired: false,
    };
  }

  function changeCard(deckID: number, cardIndex: number, cardId: number) {
    if (type === CardType.SKILL) {
      void changeDeck(deckID, cardIndex, cardId);
    } else {
      void changeCardSkin(deckID, cardIndex, cardId);
    }
  }

  async function changeDeck(deckID: number, cardIndex: number, cardId: number) {
    const deckIndex = deckID - 1;
    const param = {
      cardId1: cardIDs[deckIndex * 3],
      cardId2: cardIDs[deckIndex * 3 + 1],
      cardId3: cardIDs[deckIndex * 3 + 2],
    };
    if (cardIndex === 0) param.cardId1 = cardId;
    else if (cardIndex === 1) param.cardId2 = cardId;
    else if (cardIndex === 2) param.cardId3 = cardId;

    try {
      const resp = await api.put('api/game/ongeki/userDeckList/' + deckID, param);
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) {
          const deck: UserDeck = resp.data;
          setCardIDs((ids) => {
            const next = [...ids];
            next[deckIndex * 3] = deck.cardId1;
            next[deckIndex * 3 + 1] = deck.cardId2;
            next[deckIndex * 3 + 2] = deck.cardId3;
            return next;
          });
          await getCardInfo();
        } else {
          notice(resp.status.message);
        }
      }
    } catch (err) {
      notice(String(err));
    }
  }

  async function changeCardSkin(deckID: number, cardIndex: number, cardId: number) {
    const deckIndex = deckID - 1;
    const param: UserSkin = {
      deckId: deckID,
      cardId1: cardIDs[deckIndex * 3],
      cardId2: cardIDs[deckIndex * 3 + 1],
      cardId3: cardIDs[deckIndex * 3 + 2],
      isValid: skinValid[deckIndex],
    };
    if (cardIndex === 0) param.cardId1 = cardId;
    else if (cardIndex === 1) param.cardId2 = cardId;
    else if (cardIndex === 2) param.cardId3 = cardId;

    try {
      const resp: UserSkin[] = await api.post('api/game/ongeki/skin/', [param]);
      setCardIDs((ids) => {
        const next = [...ids];
        setSkinValid((valid) => {
          const v = [...valid];
          for (const skin of resp ?? []) {
            const i = skin.deckId - 1;
            next[i * 3] = skin.cardId1;
            next[i * 3 + 1] = skin.cardId2;
            next[i * 3 + 2] = skin.cardId3;
            v[i] = skin.isValid;
          }
          return v;
        });
        return next;
      });
      await getCardInfo();
    } catch (err) {
      notice(String(err));
    }
  }

  // 打开选卡弹窗时加载卡牌列表（等价旧版画廊 isModal 模式：cardIds → cardInfos）
  useEffect(() => {
    if (!selecting) return;
    let cancelled = false;

    // NgbModal destroys the embedded Angular gallery every time it closes.
    // Reset the React-owned gallery state on each open for the same fresh
    // modal semantics, and prevent a previous card/deck's data flashing while
    // this modal's catalog request is in flight.
    setGalleryIds([]);
    setGalleryAllCards([]);
    setGalleryAllSkills([]);
    setGalleryShowHolo(false);
    setGalleryShowElements(true);
    setGallerySort('0');
    setGalleryRarityChecked(PICKER_RARITIES.map(() => false));
    setGalleryAttrChecked(PICKER_ATTRS.map(() => false));
    setGallerySkillChecked(PICKER_SKILL_CATEGORIES.map(() => false));
    setGallerySearch('');
    setGalleryPage(1);
    setGalleryCards([]);
    setGalleryFilterCollapsed(true);
    void (async () => {
      try {
        const [rawIds, allCards, allSkills] = await Promise.all([
          api.get('api/game/ongeki/cardIds'),
          dbGetAll<OngekiCardModel>('ongekiCard'),
          dbGetAll<OngekiSkill>('ongekiSkill'),
        ]);
        if (cancelled) return;
        const ids = Array.isArray(rawIds) ? (rawIds as number[]) : [];
        setGalleryAllCards(allCards ?? []);
        setGalleryAllSkills(allSkills ?? []);
        // SKIN 模式旧版会插入 0 号占位卡（showDummyCard）
        const list = type === CardType.SKIN ? [0, ...ids] : ids;
        setGalleryIds(list);
        // 页面内容随 galleryFilteredIds 变化在下方 effect 中加载
      } catch (error) {
        if (!cancelled) notice(String(error));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecting, type]);

  async function loadGalleryPage(page: number, ids: number[]) {
    const start = Math.min((page - 1) * PICKER_PAGE_SIZE, ids.length);
    const end = Math.min(start + PICKER_PAGE_SIZE, ids.length);
    const pageIds = ids.slice(start, end);
    const acquired = pageIds.filter((id) => id !== 0);
    try {
      const content: PlayerCard[] = acquired.length
        ? ((await api.get('api/game/ongeki/cardInfos', { cardIds: acquired.join(',') })) ?? [])
        : [];
      const cards: PlayerCard[] = [];
      for (const id of pageIds) {
        let playerCard = content.find((c) => c.cardId === id);
        if (!playerCard) {
          const card = await dbGetByKey<OngekiCardModel>('ongekiCard', id);
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
          const c = await dbGetByKey<OngekiCardModel>('ongekiCard', playerCard.cardId);
          if (c) {
            playerCard.cardInfo = c;
            const skillId =
              playerCard.choKaikaDate !== '0000-00-00 00:00:00.0' ? c.choKaikaSkillId : c.skillId;
            playerCard.skillInfo = (await dbGetByKey<OngekiSkill>('ongekiSkill', skillId)) ?? undefined;
          }
        }
        cards.push(playerCard);
      }
      setGalleryCards(cards);
    } catch (error) {
      notice(String(error));
    }
  }

  // 选卡弹窗沿用完整画廊的筛选契约；modal 模式固定 showAll=false，数据源始终是已拥有卡。
  const galleryFilteredIds = useMemo(() => {
    if (galleryAllCards.length === 0 && galleryIds.length === 0) return [];

    const selectedRarities = PICKER_RARITIES.filter((_, i) => galleryRarityChecked[i]);
    const selectedAttrs = PICKER_ATTRS.filter((_, i) => galleryAttrChecked[i]);
    const selectedSkillCategories = PICKER_SKILL_CATEGORIES.filter((_, i) => gallerySkillChecked[i]);

    let ids = [...galleryIds].filter((id) => id !== 0);
    if (gallerySort === '1') {
      ids = galleryAllCards.filter((card) => ids.includes(card.id)).map((card) => card.id);
    }

    if (selectedRarities.length > 0 && selectedRarities.length < PICKER_RARITIES.length) {
      const allowed = new Set(
        galleryAllCards.filter((card) => selectedRarities.includes(card.rarity)).map((card) => card.id),
      );
      ids = ids.filter((id) => allowed.has(id));
    }
    if (selectedAttrs.length > 0 && selectedAttrs.length < PICKER_ATTRS.length) {
      const allowed = new Set(
        galleryAllCards.filter((card) => selectedAttrs.includes(card.attribute)).map((card) => card.id),
      );
      ids = ids.filter((id) => allowed.has(id));
    }
    if (selectedSkillCategories.length > 0 && selectedSkillCategories.length < PICKER_SKILL_CATEGORIES.length) {
      const skillIds = new Set(
        galleryAllSkills
          .filter((skill) => selectedSkillCategories.includes(skill.category))
          .map((skill) => skill.id),
      );
      const allowed = new Set(
        galleryAllCards
          .filter((card) => skillIds.has(card.skillId) || skillIds.has(card.choKaikaSkillId))
          .map((card) => card.id),
      );
      ids = ids.filter((id) => allowed.has(id));
    }

    const terms = parsePickerSearchTerms(gallerySearch.toLowerCase());
    const filteredSkillIds = new Set(
      galleryAllSkills
        .filter((skill) =>
          terms.some(
            (term) => skill.name.toLowerCase().includes(term) || skill.info.toLowerCase().includes(term),
          ),
        )
        .map((skill) => skill.id),
    );
    if (terms.length > 0) {
      ids = ids.filter((id) => {
        const card = galleryAllCards.find((item) => item.id === id);
        if (!card) return false;
        const nickName = card.nickName.toLowerCase();
        const cardNumber = card.cardNumber?.toLowerCase() ?? '';
        const charaName = pickerCardName(card.name, card.rarity, card.nickName).toLowerCase();
        return terms.every((term) => {
          if (id === Number(term)) return true;
          if (nickName.includes(term)) return true;
          if (cardNumber === term) return true;
          if (charaName.includes(term)) return true;
          if (filteredSkillIds.has(card.skillId) || filteredSkillIds.has(card.choKaikaSkillId)) return true;
          return false;
        });
      });
    }

    // SKIN modal 的 0 号“无卡”占位始终位于筛选结果首位，和旧 Angular gallery 一致。
    return type === CardType.SKIN ? [0, ...ids] : ids;
  }, [
    galleryAllCards,
    galleryAllSkills,
    galleryAttrChecked,
    galleryIds,
    galleryRarityChecked,
    gallerySearch,
    gallerySkillChecked,
    gallerySort,
    type,
  ]);

  // 弹窗打开或搜索变化时加载第一页
  useEffect(() => {
    if (!selecting) return;
    setGalleryPage(1);
    void loadGalleryPage(1, galleryFilteredIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryFilteredIds, selecting]);

  const galleryHoloStyles = useMemo(() => {
    const styles = Array.from({ length: 12 }, (_, i) => pickerHoloSheetStyle(String(i).padStart(2, '0')));
    const forward = shufflePicker(styles);
    return { forward, reversed: [...forward].reverse() };
  }, [galleryCards]);

  const galleryIsDefaultFilter =
    galleryAttrChecked.every((value) => !value) &&
    gallerySkillChecked.every((value) => !value) &&
    gallerySort === '0' &&
    galleryRarityChecked.every((value) => !value) &&
    gallerySearch === '';

  function resetGalleryFilter() {
    setGalleryAttrChecked(PICKER_ATTRS.map(() => false));
    setGallerySkillChecked(PICKER_SKILL_CATEGORIES.map(() => false));
    setGallerySort('0');
    setGalleryRarityChecked(PICKER_RARITIES.map(() => false));
    setGallerySearch('');
  }

  const pickerDisplayRarity = (rarity: string) => (rarity === 'SRPlus' ? 'SR+' : rarity);
  const pickerDisplaySkillCategory = (category: string) =>
    category === 'Support' ? 'Assist' : category === 'DangerSupport' ? 'DangerAssist' : category;

  const currentDeck = cardIDs.length > 0 ? cardIDs.slice((currentDeckID - 1) * 3, (currentDeckID - 1) * 3 + 3) : [];

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.Card.Title')}</h1>
      <div className="row mb-2 g-1">
        <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.Card.EditFor')}</div>
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            <div className="col-auto">
              <button
                className={'tab-selector' + (type === CardType.SKILL ? ' tab-selector-active' : '')}
                onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('type', 'skill'); return n; })}
              >
                {t('Ongeki.Card.Deck')}
              </button>
            </div>
            <div className="col-auto">
              <button
                className={'tab-selector' + (type === CardType.SKIN ? ' tab-selector-active' : '')}
                onClick={() => setSearchParams((p) => { const n = new URLSearchParams(p); n.set('type', 'skin'); return n; })}
              >
                {t('Ongeki.Card.Skin')}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="row mb-2 g-1">
        <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.Card.DeckID')}</div>
        <div className="col-12 col-sm">
          <div className="row justify-content-start align-items-center g-1">
            {deckIDs.map((id) => (
              <div className="col-auto" key={id}>
                <button
                  className={'tab-selector' + (currentDeckID === id ? ' tab-selector-active' : '')}
                  onClick={() => setCurrentDeckID(id)}
                >
                  {id}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mb-2">
        <Link className="btn btn-primary btn-sm" to="./gallery">
          {t('Ongeki.Card.CardGallery')}
        </Link>
      </div>
      <div className="hstack alert alert-warning mb-1" role="alert">
        <ExclamationTriangleFill className="me-2" />
        <div>{t('Ongeki.Card.Warning1')}</div>
      </div>

      {currentDeck.length > 0 && (
        <>
          <div className="deck-row row row-cols-3">
            {currentDeck.map((item, i) => (
              <div className="col" key={i}>
                <OngekiCardSurface
                  item={getCard(item)}
                  showHolo={false}
                  showElements
                  className="cursor-pointer"
                  onClick={() => setSelecting({ deckIndex: i })}
                />
              </div>
            ))}
          </div>
          {type === CardType.SKIN && (
            <div className="form-check form-check-inline form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id="showAllItemsSwitch"
                checked={skinValid[currentDeckID - 1]}
                onChange={() => {
                  const next = [...skinValid];
                  next[currentDeckID - 1] = !next[currentDeckID - 1];
                  setSkinValid(next);
                  void changeCardSkin(currentDeckID, -1, 0);
                }}
              />
              <label className="form-check-label user-select-none" htmlFor="showAllItemsSwitch">
                {t('Ongeki.Card.Valid')}
              </label>
            </div>
          )}
        </>
      )}

      <BModal
        open={!!selecting}
        onClose={() => setSelecting(null)}
        title={t('Ongeki.Card.SelectCard')}
        wide
        scrollable
      >
        <div className="row mb-2 g-1 ongeki-card-picker-display">
          <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.CardGallery.Display')}</div>
          <div className="col-12 col-sm">
            <div className="row justify-content-start align-items-center g-1">
              <div className="col-auto">
                <input
                  className="checkbox checkbox-btn"
                  type="checkbox"
                  role="switch"
                  id="ongekiPickerHoloSwitch"
                  checked={galleryShowHolo}
                  onChange={() => setGalleryShowHolo((value) => !value)}
                />
                <label className="checkbox-label" htmlFor="ongekiPickerHoloSwitch">
                  {t('Ongeki.CardGallery.Holo')}
                </label>
              </div>
              <div className="col-auto">
                <input
                  className="checkbox checkbox-btn"
                  type="checkbox"
                  role="switch"
                  id="ongekiPickerElementsSwitch"
                  checked={galleryShowElements}
                  onChange={() => setGalleryShowElements((value) => !value)}
                />
                <label className="checkbox-label" htmlFor="ongekiPickerElementsSwitch">
                  {t('Ongeki.CardGallery.Elements')}
                </label>
              </div>
            </div>
          </div>
        </div>

        <div
          id="ongekiPickerFilterCollapse"
          className={`ongeki-card-picker-filter-collapse${galleryFilterCollapsed ? '' : ' show'}`}
          aria-hidden={galleryFilterCollapsed}
        >
          <div className="ongeki-card-picker-filter-collapse-inner">
            {[
              {
                label: t('Ongeki.CardGallery.Rarity'),
                items: PICKER_RARITIES,
                checked: galleryRarityChecked,
                set: setGalleryRarityChecked,
                display: pickerDisplayRarity,
                idPrefix: 'rarity',
              },
              {
                label: t('Ongeki.CardGallery.Attribute'),
                items: PICKER_ATTRS,
                checked: galleryAttrChecked,
                set: setGalleryAttrChecked,
                display: (value: string) => value,
                idPrefix: 'attribute',
              },
              {
                label: t('Ongeki.CardGallery.SkillCategory'),
                items: PICKER_SKILL_CATEGORIES,
                checked: gallerySkillChecked,
                set: setGallerySkillChecked,
                display: pickerDisplaySkillCategory,
                idPrefix: 'skill',
              },
            ].map((group) => (
              <div className="row mb-2 g-1" key={group.label}>
                <div className="col-12 col-sm-auto pt-1 me-3">{group.label}</div>
                <div className="col-12 col-sm">
                  <div className="row justify-content-start align-items-center g-1">
                    {group.items.map((item, index) => {
                      const inputId = `ongekiPicker-${group.idPrefix}-${index}`;
                      return (
                        <div className="col-auto" key={item}>
                          <input
                            className="checkbox checkbox-btn"
                            type="checkbox"
                            role="switch"
                            id={inputId}
                            checked={group.checked[index]}
                            onChange={() =>
                              group.set((values) =>
                                values.map((value, valueIndex) => (valueIndex === index ? !value : value)),
                              )
                            }
                          />
                          <label className="checkbox-label" htmlFor={inputId}>
                            {group.display(item)}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}

            <div className="row mb-2 g-1">
              <div className="col-12 col-sm-auto pt-1 me-3">{t('Ongeki.CardGallery.SortBy')}</div>
              <div className="col-12 col-sm">
                <select
                  className="form-select form-select-sm"
                  value={gallerySort}
                  onChange={(event) => setGallerySort(event.target.value)}
                >
                  <option value="0">{t('Ongeki.CardGallery.Acquisition')}</option>
                  <option value="1">{t('Ongeki.CardGallery.CardID')}</option>
                </select>
              </div>
            </div>

            <div className="row mb-2 g-1">
              <div className="col-12 p-0">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder={t('Ongeki.CardGallery.FilterPlaceholder')}
                  value={gallerySearch}
                  onChange={(event) => setGallerySearch(event.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 ongeki-card-picker-toolbar">
          <span>{t('Ongeki.CardGallery.TotalCardNum', { num: galleryFilteredIds.length })}</span>
          <a
            className="link-btn ms-3"
            onClick={() => setGalleryFilterCollapsed((value) => !value)}
          >
            {galleryFilterCollapsed
              ? t('Ongeki.CardGallery.ShowFilter')
              : t('Ongeki.CardGallery.HideFilter')}
          </a>
          {!galleryIsDefaultFilter && (
            <a className="link-btn ms-3" onClick={resetGalleryFilter}>
              {t('Ongeki.CardGallery.ResetFilter')}
            </a>
          )}
        </div>

        <div className="callout callout-info mt-0 mb-1">
          <div>{t('Ongeki.CardGallery.Info1')}</div>
        </div>

        <PickerPagination
          current={galleryPage}
          totalItems={galleryFilteredIds.length}
          onPageChange={(page) => {
            setGalleryPage(page);
            void loadGalleryPage(page, galleryFilteredIds);
          }}
        />

        <div className="text-center px-1 ongeki-card-picker-grid-wrap">
          <div className="row row-cols-2 row-cols-sm-3 row-cols-lg-4">
            {galleryCards.map((card, index) => (
              <div className="col p-2" key={`${card.cardId}-${index}`}>
                <div className="w-100">
                  <OngekiCardSurface
                    item={card}
                    showHolo={galleryShowHolo}
                    showElements={galleryShowElements}
                    holoSheetStyle1={galleryHoloStyles.forward[index % 12]}
                    holoSheetStyle2={galleryHoloStyles.reversed[index % 12]}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selecting) changeCard(currentDeckID, selecting.deckIndex, card.cardId);
                      setSelecting(null);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <PickerPagination
          current={galleryPage}
          totalItems={galleryFilteredIds.length}
          onPageChange={(page) => {
            setGalleryPage(page);
            void loadGalleryPage(page, galleryFilteredIds);
          }}
        />
      </BModal>
    </div>
  );
}
