import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import {
  MAIMAI2_EXCHANGE_TYPES,
  exchangeTypeKey,
  exchangeTypeLabel,
  type ApiResponse,
  type Maimai2ExchangeItem,
  type Maimai2ExchangeItemList,
  type Maimai2ServerMissionPointData,
  type Maimai2ServerMissionPointInfo,
  type Maimai2UserExchangeInfo,
  type Maimai2UserExchangeItem,
} from './server-mission-models';
import './Maimai2PointExchangesPage.css';

const PAGE_SIZE = 20;
const EMPTY_POINTS: Maimai2ServerMissionPointData = { totalPoints: 0, availablePoints: 0 };

function responseData<T>(response: ApiResponse<T>, failurePrefix: string): T | null {
  if (response?.status?.code === 92001 && response.data) return response.data;
  notice(`${failurePrefix}: [${response?.status?.code}] ${response?.status?.message}`);
  return null;
}

function itemTypeClass(item: Maimai2ExchangeItem): string {
  const key = exchangeTypeKey(item.itemType);
  return key ? `bg-${key === 'KaleidxScopeKey' ? 'kaleidxScopeKey' : key.toLowerCase()}` : 'bg-unknown';
}

function cardSizeClass(item: Maimai2ExchangeItem): string {
  const value = MAIMAI2_EXCHANGE_TYPES.find((entry) => entry.key === exchangeTypeKey(item.itemType))?.value;
  return value ? `col-type-${value}` : 'card-size-default';
}

function exchangeImage(item: Maimai2ExchangeItem): string {
  const key = exchangeTypeKey(item.itemType);
  let prefix = 'UI_Icon_';
  let directory = 'icon';
  let specialPath: string | null = null;

  switch (key) {
    case 'Plate':
      prefix = 'UI_Plate_';
      directory = 'nameplate';
      break;
    case 'Title':
      specialPath = 'assets/mai2/common/UI_CLC_Base_GetUserTitle.webp';
      break;
    case 'Icon':
      break;
    case 'Present':
      specialPath = 'assets/mai2/common/UI_CHR_Icon_Present.webp';
      break;
    case 'Character':
      prefix = 'UI_Chara_';
      directory = 'chara';
      break;
    case 'Partner':
      prefix = 'UI_Partner_';
      directory = 'partner';
      break;
    case 'Frame':
      prefix = 'UI_Frame_';
      directory = 'frame';
      break;
    case 'Ticket':
      specialPath = 'assets/mai2/common/UI_CMN_Tix_LinkTix_L.webp';
      break;
    case 'Mile':
      specialPath = 'assets/mai2/common/UI_CLC_Maimile.webp';
      break;
    case 'KaleidxScopeKey':
      specialPath = `assets/mai2/common/UI_KLD_DiscoverCourseKey_0${item.itemId}.webp`;
      break;
    case 'DXPass':
      specialPath = `assets/mai2/common/dxpass_${item.itemId}.webp`;
      break;
  }

  if (specialPath) return `${assetsHost}${specialPath}`;
  return `${assetsHost}assets/mai2/${directory}/${prefix}${String(item.itemId).padStart(6, '0')}.webp`;
}

function ExchangeConfirmDialog({
  item,
  points,
  onCancel,
  onConfirm,
}: {
  item: Maimai2ExchangeItem | null;
  points: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        aria-describedby={undefined}
        className="maimai2-point-exchange-confirm-dialog d-block modal fade show"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="maimai2-point-exchange-confirm-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
        unstyled
      >
        <div className="modal-dialog modal-lg modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header bg-dark text-light border-secondary">
              <DialogTitle asChild unstyled>
                <h5 className="modal-title">确认兑换</h5>
              </DialogTitle>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onCancel}
              />
            </div>
            <div className="modal-body bg-dark text-light">
              {item && (
                <div className="exchange-confirm">
                  <div className="d-flex align-items-center mb-4">
                    <div className="flex-shrink-0 me-3">
                      <div className="placeholder-image d-flex justify-content-center align-items-center bg-dark border-secondary rounded">
                        <i className="bi bi-box-seam fs-2 text-secondary" />
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <h5 className="mb-1">{item.name}</h5>
                      <p className="small text-secondary mb-0">
                        {item.description.split('\n').map((line, index, lines) => (
                          <span key={`${line}-${index}`}>
                            {line}
                            {index < lines.length - 1 && <br />}
                          </span>
                        ))}
                      </p>
                    </div>
                  </div>
                  <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                    <span>兑换数量:</span>
                    <span className="fw-bold">{item.itemCount} 个</span>
                  </div>
                  <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                    <span>需要点数:</span>
                    <span className="fw-bold text-warning">{item.costPoints} 点</span>
                  </div>
                  {item.stockCount >= 0 && (
                    <div className="info-row d-flex justify-content-between mb-2 p-2 bg-dark border-secondary rounded">
                      <span>库存:</span>
                      <span className="fw-bold">{item.exchangedCount} / {item.stockCount}</span>
                    </div>
                  )}
                  <div className="info-row d-flex justify-content-between p-2 bg-dark border-secondary rounded">
                    <span>兑换后剩余:</span>
                    <span className="fw-bold text-danger">{points - item.costPoints} 点</span>
                  </div>
                  <div className="alert alert-warning mt-3 mb-0" role="alert">
                    <i className="bi bi-exclamation-triangle-fill me-2" />
                    确认使用 {item.costPoints} 任务点数兑换此物品吗？
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer bg-dark border-secondary">
              <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>
                取消
              </button>
              {item && (
                <button type="button" className="btn btn-success" onClick={onConfirm}>
                  确认兑换
                </button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Maimai2PointExchangesPanel({ onClose }: { onClose?: () => void }) {
  const [aimeId, setAimeId] = useState('');
  const [items, setItems] = useState<Maimai2ExchangeItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [filterItemType, setFilterItemType] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [onlyEnable, setOnlyEnable] = useState(true);
  const [points, setPoints] = useState<Maimai2ServerMissionPointData>(EMPTY_POINTS);
  const [userExchangeInfo, setUserExchangeInfo] = useState<Map<number, Maimai2UserExchangeItem>>(new Map());
  const [selectedItem, setSelectedItem] = useState<Maimai2ExchangeItem | null>(null);

  async function loadPoints(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userServerMissionPointInfo', {
        aimeId: id,
        page: 0,
        size: 1,
      })) as ApiResponse<Maimai2ServerMissionPointInfo>;
      const data = responseData(response, '获取玩家任务点数信息失败');
      if (data) setPoints(data.userPointData);
    } catch (error) {
      notice(String(error));
    }
  }

  async function loadUserExchangeInfo(id: string) {
    try {
      const response = (await api.get('api/game/maimai2/userExchangeItemDataInfo', {
        aimeId: id,
      })) as ApiResponse<Maimai2UserExchangeInfo>;
      const data = responseData(response, '获取玩家兑换物品信息失败');
      if (data) {
        setUserExchangeInfo(new Map(data.exchangeItemDataList.map((entry) => [entry.exchangedItemDataId, entry])));
      }
    } catch (error) {
      notice(String(error));
    }
  }

  async function loadItems(
    id: string,
    requestedPage: number,
    options: { type?: number | null; search?: string; enabled?: boolean } = {},
  ) {
    const type = options.type === undefined ? filterItemType : options.type;
    const search = options.search === undefined ? searchKeyword : options.search;
    const enabled = options.enabled === undefined ? onlyEnable : options.enabled;
    try {
      const response = (await api.get('api/game/maimai2/exchangeItemDataList', {
        aimeId: id,
        page: requestedPage,
        size: PAGE_SIZE,
        onlyEnable: enabled,
        filterItemType: type ?? 0,
        searchPattern: search,
      })) as ApiResponse<Maimai2ExchangeItemList>;
      const data = responseData(response, '获取兑换物品列表失败');
      if (data) {
        setItems(data.filterExchangeItemDataList);
        setPage(requestedPage);
        setTotalCount(data.filterListTotalCount);
      }
    } catch (error) {
      notice(String(error));
    }
  }

  async function loadAll(id: string, requestedPage: number) {
    await Promise.all([
      loadItems(id, requestedPage),
      loadUserExchangeInfo(id),
      loadPoints(id),
    ]);
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await loadUser();
        if (!active) return;
        const id = String(getCurrentUser()?.defaultCard?.extId ?? '');
        setAimeId(id);
        await loadAll(id, 0);
      } catch (error) {
        if (active) notice(String(error));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const userExchangeCount = (itemId: number) => userExchangeInfo.get(itemId)?.exchangedTotalCount ?? 0;

  function canExchange(item: Maimai2ExchangeItem): boolean {
    if (!item.enable) return false;
    if (item.limitCount >= 0 && userExchangeCount(item.id) >= item.limitCount) return false;
    if (item.stockCount >= 0 && item.exchangedCount >= item.stockCount) return false;
    return points.availablePoints >= item.costPoints;
  }

  function cannotExchangeReason(item: Maimai2ExchangeItem): string {
    if (!item.enable) return '暂未开放';
    if (item.limitCount >= 0 && userExchangeCount(item.id) >= item.limitCount) return '已达兑换上限';
    if (item.stockCount >= 0 && item.exchangedCount >= item.stockCount) return '库存不足';
    if (points.availablePoints < item.costPoints) return '点数不足';
    return '无法兑换';
  }

  const maxPage = Math.ceil(totalCount / PAGE_SIZE) - 1;
  const pageNumbers = useMemo(() => {
    const numbers: number[] = [];
    const start = Math.max(0, page - 2);
    const end = Math.min(maxPage, page + 2);
    for (let value = start; value <= end; value += 1) numbers.push(value);
    return numbers;
  }, [maxPage, page]);

  function applyFilter() {
    void loadItems(aimeId, 0);
  }

  function handleSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') applyFilter();
  }

  async function confirmExchange() {
    if (!selectedItem) return;
    const exchanged = selectedItem;
    setSelectedItem(null);
    try {
      const response = (await api.post('api/game/maimai2/exchangeItem', {
        aimeId,
        exchangeId: exchanged.id,
      })) as ApiResponse<boolean>;
      if (response?.status?.code === 92001) {
        notice(`兑换 ${exchanged.name} 成功！`, 'success');
        await loadAll(aimeId, page);
      } else {
        responseData(response, '获取玩家兑换物品信息失败');
      }
    } catch (error) {
      notice(String(error));
    }
  }

  return (
    <div className="maimai2-point-exchanges-page container-fluid mt-3">
      <div className="row mb-3">
        <div className="col-12">
          <div className="card bg-dark border-secondary">
            <div className="card-header bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
              <h4 className="mb-0">任务点数兑换 - 舞萌DX</h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger btn-outline-secondary"
                onClick={() => onClose?.()}
              >
                <i className="bi bi-x-lg" /> 关闭
              </button>
            </div>
            <div className="card-body">
              <div className="row align-items-end">
                <div className="col-md-6">
                  <label className="form-label text-light fw-bold">物品类型筛选</label>
                  <select
                    className="form-select bg-dark text-light border-secondary"
                    value={filterItemType ?? ''}
                    onChange={(event) => {
                      const type = event.target.value === '' ? null : Number(event.target.value);
                      setFilterItemType(type);
                      void loadItems(aimeId, 0, { type });
                    }}
                  >
                    <option value="">全部类型</option>
                    {MAIMAI2_EXCHANGE_TYPES.map((type) => (
                      <option value={type.value} key={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 text-end text-light">
                  <span className="me-3">我的可用任务点数: <span>{points.availablePoints}</span></span>
                </div>
              </div>
              <div className="row align-items-end mt-2">
                <div className="col-md-8">
                  <label className="form-label text-light fw-bold">物品名称/描述搜索</label>
                  <div className="input-group">
                    <span className="input-group-text bg-dark text-light border-secondary"><i className="bi bi-search" /></span>
                    <input
                      type="text"
                      className="form-control bg-dark text-light border-secondary"
                      placeholder="输入物品名称或描述关键字..."
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                      onKeyUp={handleSearchKey}
                    />
                  </div>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <div className="form-check form-switch hide-completed-toggle">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="onlyEnable"
                      checked={onlyEnable}
                      onChange={(event) => setOnlyEnable(event.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="onlyEnable">只显示允许兑换的</label>
                  </div>
                  <button className="btn btn-outline-primary w-50" onClick={applyFilter}>
                    <i className="bi bi-filter" /> 应用筛选
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 row-cols-xl-5 g-4 mb-3">
        {items.map((item) => (
          <div className={`col ${cardSizeClass(item)}`} key={item.id}>
            <div className="card h-100 bg-dark text-light border-secondary exchange-card">
              <div
                className="card-img-top d-flex justify-content-center align-items-center p-3 bg-dark"
                style={{ minHeight: 120, height: 140 }}
              >
                {enableImages ? (
                  <img
                    src={exchangeImage(item)}
                    className="img-fluid exchange-item-img"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain' }}
                    alt={item.name}
                  />
                ) : (
                  <div
                    className="placeholder-image d-flex justify-content-center align-items-center"
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 80, height: 80 }}
                  >
                    <i className="bi bi-box-seam fs-1 text-secondary" />
                  </div>
                )}
              </div>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h5 className="card-title text-truncate mb-0" title={item.name}>{item.name}</h5>
                  <span className={`badge ${itemTypeClass(item)}`}>{exchangeTypeLabel(item.itemType)}</span>
                </div>
                <p className="card-text small text-secondary-emphasis text-truncate-2 mb-2" title={item.description}>
                  {item.description || '暂无描述'}
                </p>
                <div className="item-details small">
                  <div className="d-flex justify-content-between mb-1"><span>兑换获得:</span><span className="fw-bold">{item.itemCount} 个</span></div>
                  <div className="d-flex justify-content-between mb-1"><span>所需点数:</span><span className="fw-bold text-warning">{item.costPoints} 点</span></div>
                  {item.limitCount >= 0 && (
                    <div className="d-flex justify-content-between mb-1">
                      <span>个人已换:</span>
                      <span className="fw-bold">{userExchangeCount(item.id)} / {item.limitCount === -1 ? '∞' : item.limitCount}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="card-footer bg-transparent border-secondary">
                {canExchange(item) ? (
                  <button className="btn btn-outline-success w-100 fw-bold" onClick={() => setSelectedItem(item)}>兑换</button>
                ) : (
                  <button className="btn btn-secondary w-100" disabled>
                    <i className="bi bi-lock-fill me-2" />{cannotExchangeReason(item)}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="row mt-5">
          <div className="col-12 text-center text-light py-5">
            <i className="bi bi-inbox fs-1 d-block mb-3" />
            <h5>暂无兑换物品</h5>
            <p className="text-secondary">当前筛选条件下没有可兑换的物品</p>
          </div>
        </div>
      )}

      {totalCount > PAGE_SIZE && (
        <div className="row mt-4">
          <div className="col-12">
            <nav aria-label="兑换物品分页">
              <ul className="pagination justify-content-center">
                <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
                  <a className="page-link bg-dark text-light border-secondary" onClick={() => page > 0 && void loadItems(aimeId, page - 1)}>
                    <span aria-hidden="true">«</span>
                  </a>
                </li>
                {pageNumbers.map((number) => (
                  <li className={`page-item${number === page ? ' active' : ''}`} key={number}>
                    <a
                      className={`page-link ${number === page ? 'bg-primary text-white' : 'bg-dark text-light border-secondary'}`}
                      onClick={() => void loadItems(aimeId, number)}
                    >
                      {number + 1}
                    </a>
                  </li>
                ))}
                <li className={`page-item${page >= maxPage ? ' disabled' : ''}`}>
                  <a className="page-link bg-dark text-light border-secondary" onClick={() => page < maxPage && void loadItems(aimeId, page + 1)}>
                    <span aria-hidden="true">»</span>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      )}

      <ExchangeConfirmDialog
        item={selectedItem}
        points={points.availablePoints}
        onCancel={() => setSelectedItem(null)}
        onConfirm={() => void confirmExchange()}
      />
    </div>
  );
}

export function Maimai2PointExchangesDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="maimai2-point-exchange-outer-dialog d-block modal fade show"
        onInteractOutside={(event) => event.preventDefault()}
        overlayClassName="maimai2-point-exchange-outer-overlay modal-backdrop fade show"
        overlayUnstyled
        showCloseButton={false}
        unstyled
      >
        <DialogTitle className="visually-hidden">任务点数兑换 - 舞萌DX</DialogTitle>
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content">
            <Maimai2PointExchangesPanel onClose={onClose} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Maimai2PointExchangesPage() {
  return <Maimai2PointExchangesPanel />;
}
