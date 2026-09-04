import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { fullWidth, padDigits } from '@/lib/format';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import type { Maimai2Rival } from './models';
import './Maimai2RivalPage.css';

/** Equivalent to the legacy Maimai DX rival component. */
export function Maimai2RivalPage() {
  const { t } = useTranslation();
  const [rivals, setRivals] = useState<Maimai2Rival[]>([]);
  const [aimeId, setAimeId] = useState('');
  const [ownRivalId, setOwnRivalId] = useState(10_000_000);
  const [rivalInput, setRivalInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadRivals = async (id: string) => {
    setLoading(true);
    try {
      setRivals((await api.get('api/game/maimai2/rival', { aimeId: id })) as Maimai2Rival[]);
    } catch (error) {
      notice(`Cannot get rival list: ${String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      try {
        await loadUser();
        const card = getCurrentUser()?.defaultCard;
        const id = String(card?.extId ?? '');
        setAimeId(id);
        setOwnRivalId(10_000_000 + Number(card?.id ?? 0));
        await loadRivals(id);
      } catch (error) {
        setLoading(false);
        notice(`Cannot get rival list: ${String(error)}`);
      }
    })();
  }, []);

  const addRival = async () => {
    if (!rivalInput || rivals.length > 2) return;
    setAdding(true);
    try {
      const result = await api.post('api/game/maimai2/rival', { rivalId: rivalInput, aimeId });
      if (result) {
        notice('Add rival success!');
        await loadRivals(aimeId);
      }
    } catch (error) {
      notice(`add rival failed: ${String(error)}`);
    } finally {
      setAdding(false);
    }
  };

  const removeRival = async (rivalId: string) => {
    try {
      await api.delete('api/game/maimai2/rival', { rivalId: Number.parseInt(rivalId, 10), aimeId });
      setRivals((items) => items.filter((item) => item.rivalId !== rivalId));
      notice(`(id:${rivalId}) delete successfully.`);
    } catch (error) {
      notice(`remove rival failed: ${String(error)}`);
    }
  };

  return (
    <div className="content maimai2-rival-page">
      <h1 className="page-heading">{t('Maimai2.RivalPage.Title')}</h1>
      <div className="card rival-id-card mb-3 p-1">
        <div className="d-flex align-items-center">
          <i className="bi bi-person-vcard me-2" />
          <div>
            <div className="text-muted small">{t('Maimai2.RivalPage.YourRivalID')}</div>
            <div className="h5 mb-0">{ownRivalId}</div>
          </div>
        </div>
      </div>
      <div className="input-group my-1">
        <input
          value={rivalInput}
          onChange={(event) => setRivalInput(event.target.value)}
          type="text"
          className="form-control form-control mb-3"
          placeholder={t(rivals.length > 2 ? 'Maimai2.RivalPage.InputPlaceholder2' : 'Maimai2.RivalPage.InputPlaceholder')}
        />
        <button
          className="btn btn-primary mb-3"
          type="button"
          disabled={loading || adding || rivals.length > 2}
          onClick={() => void addRival()}
        >
          {t('Maimai2.RivalPage.AddButton')}
        </button>
      </div>

      {!loading && rivals.length === 0 && (
        <div className="text-center py-3">
          <span className="text-muted">{t('Maimai2.RivalPage.NoRivals')}</span>
        </div>
      )}

      {rivals.map((item) => (
        <div key={item.rivalId}>
          <div className="card mb-2">
            <div className="card-header fw-bold d-flex align-items-center gap-2">
              <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
                <use href="/assets/mai2.svg#icon" />
              </svg>
              {fullWidth(item.rivalName)}
            </div>
            <div className="card-body p-2">
              <div className="hstack gap-2">
                {enableImages && (
                  <img
                    className="profile-icon"
                    src={`${assetsHost}assets/mai2/icon/UI_Icon_${padDigits(item.iconId, 6)}.webp`}
                    alt=""
                  />
                )}
                <table className="profile-table">
                  <tbody>
                    <tr><th>{t('Maimai2.RivalPage.AwakenLevel')}</th><td>{item.awakenCount}</td></tr>
                    <tr><th>{t('Maimai2.RivalPage.Rating')}</th><td>{item.playerRating}</td></tr>
                    <tr><th>{t('Maimai2.RivalPage.PlayCount')}</th><td>{item.playCount}</td></tr>
                    <tr><th>{t('Maimai2.RivalPage.RivalId')}</th><td>{item.rivalId}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-footer d-flex justify-content-between align-items-center">
              <button className="btn btn-danger btn-sm" onClick={() => void removeRival(item.rivalId)}>
                {t('Maimai2.RivalPage.RemoveButton')}
              </button>
              <div className="fw-bold small">
                {t('Maimai2.RivalPage.LastPlay')}{new Date(item.lastPlayDate).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
