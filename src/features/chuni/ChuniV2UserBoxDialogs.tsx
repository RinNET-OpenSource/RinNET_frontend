import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api/client';
import { padDigits } from '@/lib/format';
import { notice } from '@/lib/message';
import { assetsHost, enableImages } from '@/lib/utils';
import { ChuniV2Pagination } from './ChuniV2Pagination';
import type {
  ChuniV2MasterItem,
  ChuniV2MasterSymbolChat,
  ChuniV2UserBoxCatalogs,
  ChuniV2UserBoxSelection,
  ChuniV2UserSymbolChat,
} from './userbox-models';

const PAGE_SIZE = 12;

function itemImage(itemKind: number, itemId: number): string | null {
  if (itemKind === 1) {
    return `${assetsHost}assets/chuni/namePlate/CHU_UI_NamePlate_${padDigits(itemId, 8)}.webp`;
  }
  if (itemKind === 8) {
    return `${assetsHost}assets/chuni/mapIcon/CHU_UI_MapIcon_${padDigits(itemId, 8)}.webp`;
  }
  if (itemKind === 9) {
    return `${assetsHost}assets/chuni/systemVoice/CHU_UI_SystemVoice_${padDigits(itemId, 8)}.webp`;
  }
  if (itemKind === 11) {
    return `${assetsHost}assets/chuni/avatar/CHU_UI_Avatar_Icon_${padDigits(itemId, 8)}.webp`;
  }
  if (itemKind === 13) {
    return `${assetsHost}assets/chuni/stage/CHU_UI_Stage_${padDigits(itemId, 5)}.webp`;
  }
  return null;
}

function itemColumnClass(itemKind: number): string {
  if (itemKind === 1 || itemKind === 13) return 'col-12 col-sm-6 col-lg-4';
  if ([8, 9, 11].includes(itemKind)) return 'col-6 col-sm-4 col-lg-3';
  return 'col-12';
}

export function ChuniV2UserBoxItemDialog({
  aimeId,
  catalogs,
  selection,
  onClose,
  onEquip,
  onFavoriteSave,
}: {
  aimeId: string;
  catalogs: ChuniV2UserBoxCatalogs;
  selection: ChuniV2UserBoxSelection | null;
  onClose: () => void;
  onEquip: (selection: ChuniV2UserBoxSelection, itemId: number) => Promise<void>;
  onFavoriteSave: (kind: number, itemIds: number[]) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ChuniV2MasterItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selection) return;
    let active = true;
    setItems([]);
    setSelectedItem(selection.itemId);
    setFavoriteIds([...(selection.favoriteIds ?? [])]);

    const source =
      selection.itemKind === 11
        ? (catalogs[11] ?? []).filter((item) => item.category === selection.category)
        : (catalogs[selection.itemKind] ?? []);

    void (async () => {
      let nextItems = source;
      if (selection.itemKind !== 11 && !selection.showAllItems) {
        const owned = (await api.get(`api/game/chuni/v2/item/${selection.itemKind}`, {
          aimeId,
        })) as Array<{ itemId: number }>;
        const ownedIds = new Set((owned ?? []).map((item) => item.itemId));
        nextItems = source.filter((item) => ownedIds.has(item.id));
      }
      if (!active) return;
      setItems(nextItems);
      const currentId = selection.mode === 'favorite' ? selection.favoriteIds?.[0] : selection.itemId;
      const currentIndex = nextItems.findIndex((item) => item.id === currentId);
      setCurrentPage(currentIndex < 0 ? 1 : Math.floor(currentIndex / PAGE_SIZE) + 1);
    })().catch((error) => active && notice(String(error)));

    return () => {
      active = false;
    };
  }, [aimeId, catalogs, selection]);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [currentPage, items],
  );

  if (!selection) return null;
  const favoriteMode = selection.mode === 'favorite';

  function toggle(itemId: number) {
    if (!favoriteMode) {
      setSelectedItem(itemId);
      return;
    }
    setFavoriteIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  async function apply() {
    setSaving(true);
    try {
      if (favoriteMode) {
        await api.put(`api/game/chuni/v2/favorite-collection/${selection!.itemKind}`, favoriteIds, {
          aimeId,
        });
        onFavoriteSave(selection!.itemKind, favoriteIds);
      } else {
        await onEquip(selection!, selectedItem);
      }
      onClose();
    } catch (error) {
      notice(String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="modal-content chuni-v2-userbox-dialog chuni-v2-userbox-item-dialog border-[1px] shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="visually-hidden">
          {t(favoriteMode ? 'ChuniV2.UserBoxPage.SelectFavorites' : 'ChuniV2.UserBoxPage.SelectItem')}
        </DialogTitle>
        <div className="modal-body">
          <div className="p-2 mb-2">
            <button type="button" className="btn-close shadow-none float-end" aria-label="Close" onClick={onClose} />
            <h3 className="modal-title">
              {t(favoriteMode ? 'ChuniV2.UserBoxPage.SelectFavorites' : 'ChuniV2.UserBoxPage.SelectItem')}
            </h3>
          </div>
          {favoriteMode && (
            <p className="small text-secondary px-2 mb-1">
              {t('ChuniV2.UserBoxPage.FavoriteTip')}
            </p>
          )}
          <ChuniV2Pagination
            current={currentPage}
            listClassName="pagination pagination-sm justify-content-center mb-1"
            pageSize={PAGE_SIZE}
            totalItems={items.length}
            onPageChange={setCurrentPage}
          />
          <div className="row p-2">
            {pageItems.map((item) => {
              const selected = favoriteMode ? favoriteIds.includes(item.id) : selectedItem === item.id;
              const image = itemImage(selection.itemKind, item.id);
              return (
                <div
                  className={`item-card ${itemColumnClass(selection.itemKind)} text-center my-1${selected ? ' selected' : ''}`}
                  key={item.id}
                  onClick={() => toggle(item.id)}
                >
                  <p className="card-subtitle text-truncate">{item.name}</p>
                  {image && (
                    <div className="item-body">
                      {enableImages && <img src={image} alt="" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <ChuniV2Pagination
            current={currentPage}
            listClassName="pagination pagination-sm justify-content-center mb-1"
            pageSize={PAGE_SIZE}
            totalItems={items.length}
            onPageChange={setCurrentPage}
          />
          <button
            type="button"
            className={`btn btn-sm btn-primary w-100 mt-2${saving ? ' disabled' : ''}`}
            disabled={saving}
            onClick={() => void apply()}
          >
            {t('Common.OK')}{favoriteMode && <span> ({favoriteIds.length})</span>}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ChuniV2SymbolChatDialog({
  aimeId,
  allSymbolChats,
  selection,
  onClose,
  onSaved,
}: {
  aimeId: string;
  allSymbolChats: ChuniV2MasterSymbolChat[];
  selection: ChuniV2UserSymbolChat | null;
  onClose: () => void;
  onSaved: (item: ChuniV2UserSymbolChat) => void;
}) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState(selection?.symbolChatId ?? 1);

  useEffect(() => {
    if (!selection) return;
    setSelectedItem(selection.symbolChatId);
    setCurrentPage(1);
  }, [selection]);

  if (!selection) return null;
  const items = allSymbolChats.filter((item) => item.sceneIds.includes(selection.sceneId));
  const pageItems = items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function apply() {
    try {
      const result = await api.put('api/game/chuni/v2/profile/symbolChatInfo', {
        aimeId,
        sceneId: String(selection!.sceneId),
        orderId: String(selection!.orderId),
        symbolChatId: String(selectedItem),
      });
      if (Number(result?.symbolChatId) === selectedItem) {
        onSaved({ ...selection!, symbolChatId: selectedItem });
        notice(t('ChuniV2.UserBoxPage.MessageSuccess'), 'success');
        onClose();
      } else {
        notice(t('ChuniV2.UserBoxPage.MessageFailed'), 'warning');
      }
    } catch (error) {
      notice(String(error), 'warning');
    }
  }

  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="modal-content chuni-v2-userbox-dialog chuni-v2-userbox-symbol-dialog border-[1px] shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="visually-hidden">{t('ChuniV2.UserBoxPage.SelectItem')}</DialogTitle>
        <div className="modal-body">
          <div className="p-2 mb-2">
            <button type="button" className="btn-close shadow-none float-end" aria-label="Close" onClick={onClose} />
            <h3 className="modal-title">{t('ChuniV2.UserBoxPage.SelectItem')}</h3>
          </div>
          <ChuniV2Pagination
            current={currentPage}
            listClassName="pagination pagination-sm justify-content-center mb-1"
            pageSize={PAGE_SIZE}
            totalItems={items.length}
            onPageChange={setCurrentPage}
          />
          <div className="row p-2">
            {pageItems.map((item) => (
              <div
                className={`item-card col-6 col-sm-4 col-lg-3 text-center my-1${selectedItem === item.id ? ' selected' : ''}`}
                key={item.id}
                onClick={() => setSelectedItem(item.id)}
              >
                <div className="item-container">
                  <div className="item-body">
                    {enableImages && (
                      <img src={`${assetsHost}assets/chuni/symbolChat/${item.balloonId}.webp`} alt="" />
                    )}
                    <div className="item-text">{item.text}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <ChuniV2Pagination
            current={currentPage}
            listClassName="pagination pagination-sm justify-content-center mb-1"
            pageSize={PAGE_SIZE}
            totalItems={items.length}
            onPageChange={setCurrentPage}
          />
          <button type="button" className="btn btn-sm btn-primary w-100 mt-2" onClick={() => void apply()}>
            {t('Common.OK')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
