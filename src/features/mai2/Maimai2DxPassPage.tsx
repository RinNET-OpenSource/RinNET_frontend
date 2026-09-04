import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import type { Page } from '@/lib/models';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost } from '@/lib/utils';
import type { Maimai2DxPass } from './models';
import { Maimai2Pagination } from './Maimai2Pagination';
import './Maimai2DxPassPage.css';

const PAGE_SIZE = 10;

function sixDigits(input: number): string {
  return input.toString().padStart(6, '0');
}

function formatDate(input: string): string {
  const date = new Date(input);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
}

function remainingTime(endDate: string): { expired: boolean; value: string } {
  const difference = new Date(endDate).getTime() - Date.now();
  if (difference <= 0) return { expired: true, value: '' };
  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference % 86_400_000) / 3_600_000);
  return { expired: false, value: `${days}天 ${hours}小时` };
}

function passName(type: number): string {
  return ['None', 'Unown', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Freedom'][type] ?? 'Unknown type';
}

function passBadge(type: number): { className: string; label: string } {
  switch (type) {
    case 2:
      return { className: 'maimai2-dxpass-normal', label: 'Bronze Pass' };
    case 3:
      return { className: 'maimai2-dxpass-silver', label: 'Silver Pass' };
    case 4:
      return { className: 'maimai2-dxpass-gold', label: 'Gold Pass' };
    case 5:
      return { className: 'maimai2-dxpass-gold', label: 'Platinum Pass' };
    case 6:
      return { className: 'maimai2-dxpass-freedom', label: 'Freedom Pass' };
    default:
      return { className: 'maimai2-dxpass-expired', label: 'Expired' };
  }
}

/** Equivalent to the legacy maimai2-dxpass component. */
export function Maimai2DxPassPage() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [passes, setPasses] = useState<Maimai2DxPass[]>([]);
  const [defaultCardType, setDefaultCardType] = useState(0);
  const [details, setDetails] = useState<Record<number, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async (page: number) => {
    try {
      await loadUser();
      const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
      const [pageData, cardTypeData] = await Promise.all([
        api.get('api/game/maimai2/dxpass', { aimeId, page: page - 1 }) as Promise<Page<Maimai2DxPass>>,
        api.get('api/game/maimai2/getCardType', { aimeId }),
      ]);
      setPasses(pageData.content ?? []);
      setTotalElements(pageData.totalElements ?? 0);
      setDefaultCardType(Number(cardTypeData?.data ?? 0));
      setCurrentPage(page);
      setDetails({});
    } catch (error) {
      notice(String(error));
      setPasses([]);
      setTotalElements(0);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const chooseDefault = async (cardType: number) => {
    try {
      const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
      const data = await api.get('api/game/maimai2/setCardType', { aimeId, cardType });
      setDefaultCardType(Number(data?.data ?? cardType));
      if (data?.status?.code === 92001) notice('Success');
    } catch (error) {
      notice(String(error));
    }
  };

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.DxpassPage.Title')}</h1>

      <Maimai2Pagination
        current={currentPage}
        pageSize={PAGE_SIZE}
        totalItems={totalElements}
        onPageChange={(page) => void load(page)}
      />

      {loaded && passes.length === 0 && (
        <div className="alert alert-info">{t('Maimai2.DxpassPage.NotOwned')}</div>
      )}
      {passes.length > 0 && (
        <div className="alert alert-info">
          {t('Maimai2.DxpassPage.DefaultInfo')} : {passName(defaultCardType)}
        </div>
      )}

      <div className="container">
        <div className="row mb-4 g-2">
          {passes.map((item, index) => {
            const remaining = remainingTime(item.endDate);
            const badge = passBadge(item.cardTypeId);
            return (
              <div className="col-12 col-xl-3 col-md-4 col-sm-6" key={item.cardId}>
                <div className="card position-relative">
                  <img
                    src={`${assetsHost}assets/mai2/dxpass/base/UI_CardBase_000000${item.cardTypeId}_${sixDigits(item.mapId)}_S.webp`}
                    className="card-img-top img-fluid"
                    alt=""
                    onClick={() => setDetails((value) => ({ ...value, [index]: !value[index] }))}
                  />
                  <img
                    src={`${assetsHost}assets/mai2/dxpass/chara/UI_CardChara_${sixDigits(item.charaId)}_S.webp`}
                    className="card-img-top img-fluid maimai2-dxpass-overlay"
                    alt=""
                    onClick={() => setDetails((value) => ({ ...value, [index]: !value[index] }))}
                  />
                  <img
                    src={`${assetsHost}assets/mai2/dxpass/frame/UI_CardFrame_000000${item.cardTypeId}_S.webp`}
                    className="card-img-top img-fluid maimai2-dxpass-overlay"
                    alt=""
                    onClick={() => setDetails((value) => ({ ...value, [index]: !value[index] }))}
                  />
                  <div className="card-body overflow-hidden py-0 px-2 mt-2 mb-2">
                    <div className="d-flex justify-content-between">
                      <span className={`${badge.className} badge rounded-pill`}>{badge.label}</span>
                      <span className="maimai2-dxpass-expired badge rounded-pill">
                        {remaining.expired
                          ? t('Maimai2.DxpassPage.Expired')
                          : `${t('Maimai2.DxpassPage.Remaining')}${remaining.value}`}
                      </span>
                    </div>
                  </div>
                  <div className={'card-footer p-2 small collapse' + (details[index] ? ' show' : '')}>
                    <ul className="list-group profile-list">
                      <li className="list-group-item">
                        <strong className="me-2">{t('Maimai2.DxpassPage.BuyDate')}:</strong>
                        <span>{formatDate(item.startDate)}</span>
                      </li>
                      <li className="list-group-item">
                        <strong className="me-2">{t('Maimai2.DxpassPage.ExpireDate')}:</strong>
                        <span className="text-danger">{formatDate(item.endDate)}</span>
                      </li>
                    </ul>
                    {(item.cardTypeId === 4 || item.cardTypeId === 6) && (
                      <button
                        type="button"
                        onClick={() => void chooseDefault(item.cardTypeId)}
                        className="btn btn-primary btn-sm mt-2"
                      >
                        {t('Maimai2.DxpassPage.SetDefault')}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
