import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { Pagination } from '@/components/shared/Pagination';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { dbGetByKey } from '@/lib/db/db';
import { StatusCode } from '@/lib/models';
import { OngekiCardItem } from './OngekiCardItem';
import type { OngekiCard as OngekiCardModel, OngekiSkill, PlayerCard } from './models';
import './ongeki-common.css';

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

const PAGE_SIZE = 24;

/** 等价旧版 ongeki-card.component（卡组/皮肤编辑） */
export function OngekiCardPage() {
  const { t } = useTranslation();
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
  // 选卡弹窗（简化版画廊：搜索 + 分页；完整筛选面板随 gallery 页补齐）
  const [galleryCards, setGalleryCards] = useState<PlayerCard[]>([]);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryPage, setGalleryPage] = useState(1);

  const deckIDs = [1, 2, 3, 4, 5];

  useEffect(() => {
    setCardIDs([]);
    if (type === CardType.SKILL) {
      void getUserDeck();
    } else {
      void getUserSkin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function getUserDeck() {
    try {
      const resp = await api.get('api/game/ongeki/userDeckList');
      if (resp?.status) {
        if (resp.status.code === StatusCode.OK) {
          const deckList: UserDeck[] = resp.data ?? [];
          setCardIDs(deckList.flatMap((deck) => [deck.cardId1, deck.cardId2, deck.cardId3]));
        } else {
          notice(resp.status.message);
          return;
        }
      }
    } catch (error) {
      notice(String(error));
      return;
    }
    await getCardInfo();
  }

  async function getUserSkin() {
    try {
      const skinList: UserSkin[] = await api.get('api/game/ongeki/skin');
      const ids: number[] = [];
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
    await getCardInfo();
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

  // 打开选卡弹窗时加载卡牌列表
  useEffect(() => {
    if (!selecting) return;
    setGallerySearch('');
    setGalleryPage(1);
    void (async () => {
      try {
        const cards: PlayerCard[] = await api.get('api/game/ongeki/cardInfos', { page: 0, size: 500 });
        const list = cards ?? [];
        for (const card of list) {
          const c = await dbGetByKey<OngekiCardModel>('ongekiCard', card.cardId);
          if (c) card.cardInfo = c;
        }
        setGalleryCards(list);
      } catch (error) {
        notice(String(error));
      }
    })();
  }, [selecting]);

  const galleryFiltered = galleryCards.filter((c) => {
    if (!gallerySearch) return true;
    const lower = gallerySearch.toLowerCase();
    return (
      String(c.cardId).includes(lower) ||
      c.cardInfo?.name?.toLowerCase().includes(lower) ||
      c.cardInfo?.nickName?.toLowerCase().includes(lower)
    );
  });
  const galleryPageItems = galleryFiltered.slice((galleryPage - 1) * PAGE_SIZE, galleryPage * PAGE_SIZE);

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
                <div className="cards-col cursor-pointer" onClick={() => setSelecting({ deckIndex: i })}>
                  <OngekiCardItem item={getCard(item)} showHolo={false} showElements />
                </div>
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

      <BModal open={!!selecting} onClose={() => setSelecting(null)} title={t('Ongeki.Card.SelectCard')} wide scrollable>
        <input
          className="form-control mb-2"
          placeholder={t('Ongeki.MusicList.Filter')}
          value={gallerySearch}
          onChange={(e) => {
            setGallerySearch(e.target.value);
            setGalleryPage(1);
          }}
        />
        <div className="row row-cols-3 row-cols-md-4 row-cols-lg-6 g-2 mb-2">
          {galleryPageItems.map((card) => (
            <div className="col" key={card.cardId}>
              <div
                className="cursor-pointer"
                onClick={() => {
                  if (selecting) changeCard(currentDeckID, selecting.deckIndex, card.cardId);
                  setSelecting(null);
                }}
              >
                <OngekiCardItem item={card} showHolo showElements />
              </div>
            </div>
          ))}
        </div>
        <Pagination
          current={galleryPage}
          pageSize={PAGE_SIZE}
          totalItems={galleryFiltered.length}
          onPageChange={setGalleryPage}
        />
      </BModal>
    </div>
  );
}
