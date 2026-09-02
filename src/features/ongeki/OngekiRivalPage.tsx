import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronUp, ChevronDown, DashLg } from 'react-bootstrap-icons';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import { fullWidth } from '@/lib/format';
import { StatusCode } from '@/lib/models';
import type { OngekiRival } from './models';
import './ongeki-common.css';

/** 等价旧版 ongeki-rival-list.component */
export function OngekiRivalPage() {
  const { t } = useTranslation();
  const [rivalList, setRivalList] = useState<OngekiRival[]>([]);
  const [myProfile, setMyProfile] = useState<OngekiRival | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingRival, setLoadingRival] = useState(true);
  const [inputAddRivalUserId, setInputAddRivalUserId] = useState('');
  const [removing, setRemoving] = useState<OngekiRival | null>(null);

  const myId = 10000000 + (getCurrentUser()?.defaultCard?.id ?? 0);

  useEffect(() => {
    void api
      .get('api/game/ongeki/rival')
      .then((rivalList: OngekiRival[]) => {
        setRivalList(rivalList ?? []);
        setLoadingRival(false);
      })
      .catch((error) => {
        notice(`get rival list failed : ${error}`);
        setLoadingRival(false);
      });

    void api
      .get(`api/game/ongeki/rival/${myId}`)
      .then((data: OngekiRival) => {
        setMyProfile(data);
        setLoadingProfile(false);
      })
      .catch((error) => {
        notice(String(error));
        setLoadingProfile(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeRival(rivalUserId: number) {
    void api
      .delete('api/game/ongeki/rival', { rivalUserId })
      .then(() => {
        notice(`(id:${rivalUserId}) delete successfully.`);
        setRivalList((list) => list.filter((item) => item.rivalUserId !== rivalUserId));
      })
      .catch((error) => notice(`remove rival failed : ${error}`));
  }

  function addRival() {
    void api
      .post('api/game/ongeki/rival', undefined, { rivalUserId: Number.parseInt(inputAddRivalUserId) })
      .then((data) => {
        if (data?.status) {
          const statusCode: number = data.status.code;
          if (statusCode === StatusCode.OK && data.data) {
            setRivalList((list) => [...list, data.data]);
            notice(`Add rival (id:${data.data.rivalUserId}) successfully.`);
          } else if (statusCode === StatusCode.RIVAL_SELF) {
            notice(`Can't add your self as an rival`, 'danger');
          } else if (statusCode === StatusCode.RIVAL_ALREADY_ADDED) {
            notice(`Rival already added`, 'danger');
          } else if (statusCode === StatusCode.RIVAL_NOTFOUND) {
            notice(`Rival not found`, 'danger');
          } else {
            notice(data.status.message, 'danger');
          }
        }
      })
      .catch((error) => notice(`add rival failed : ${error}`));
  }

  const rivalCard = (item: OngekiRival, isMe: boolean) => (
    <div className="card mb-3">
      <div className="card-header fw-bold">{fullWidth(item.rivalUserName)}</div>
      <div className="card-body p-2">
        <div className="profile-container hstack gap-2">
          {enableImages && (
            <img
              className="profile-icon"
              src={assetsHost + `/assets/ongeki/card-icon/UI_Card_Icon_${item.rivalCardId}.webp`}
              alt=""
            />
          )}
          <table className="profile-table">
            <tbody>
              <tr>
                <th>{t('Ongeki.RivalPage.ID')}</th>
                <td>{isMe ? myId : item.rivalUserId}</td>
              </tr>
              <tr>
                <th>{t('Ongeki.RivalPage.Level')}</th>
                <td>{item.reincarnationNum * 100 + item.level}</td>
              </tr>
              <tr>
                <th>{t('Ongeki.RivalPage.Rating')}</th>
                <td>{(item.rivalNowRating / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <th>{t('Ongeki.RivalPage.BattlePoint')}</th>
                <td>{item.rivalBattleScore}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div className="card-footer">
        {!isMe && (
          <a className="float-start cursor-pointer text-danger fw-bold small" onClick={() => setRemoving(item)}>
            {t('Ongeki.RivalPage.Remove')}
          </a>
        )}
        <div className="float-end fw-bold small">
          {t('Ongeki.RivalPage.LastPlay')}
          {t('Common.Colon')}
          {new Date(item.lastPlayDate).toLocaleDateString()}
        </div>
      </div>
    </div>
  );

  const loadingPlaceholder = (
    <div className="card mb-3 placeholder-wave">
      <div className="card-header">
        <span className="placeholder" style={{ width: '6em' }} />
      </div>
      <div className="card-body p-2">
        <div className="hstack gap-2">
          <img className="placeholder profile-icon" alt="" />
          <table className="profile-table">
            <tbody>
              <tr>
                <th>
                  <span className="placeholder" style={{ width: '1em' }} />
                </th>
                <td>
                  <span className="placeholder" style={{ width: '5em' }} />
                </td>
              </tr>
              <tr>
                <th>
                  <span className="placeholder" style={{ width: '3em' }} />
                </th>
                <td>
                  <span className="placeholder" style={{ width: '2em' }} />
                </td>
              </tr>
              <tr>
                <th>
                  <span className="placeholder" style={{ width: '3em' }} />
                </th>
                <td>
                  <span className="placeholder" style={{ width: '3em' }} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="content">
      <h1 className="page-heading">{t('Ongeki.RivalPage.Title')}</h1>

      <div className="input-group">
        <input
          type="text"
          className="form-control form-control mb-3"
          placeholder={t('Ongeki.RivalPage.IDInputPlaceholder')}
          value={inputAddRivalUserId}
          onChange={(e) => setInputAddRivalUserId(e.target.value)}
        />
        <button className="btn btn-primary mb-3" type="button" onClick={addRival}>
          {t('Ongeki.RivalPage.AddRival')}
        </button>
      </div>

      {loadingProfile && loadingPlaceholder}
      {myProfile && rivalCard(myProfile, true)}

      <h3 className="mb-3">{t('Ongeki.RivalPage.RivalList')}</h3>
      {loadingRival && loadingPlaceholder}
      {!loadingRival && rivalList.length === 0 && (
        <div>
          <span className="text-secondary ms-2">{t('Ongeki.RivalPage.Empty')}</span>
        </div>
      )}
      {rivalList.map((item) => rivalCard(item, false))}

      <BModal open={!!removing} onClose={() => setRemoving(null)} title={t('Ongeki.RivalPage.Remove')}>
        <form>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('Ongeki.RivalPage.RemoveTip')}</p>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                if (removing) removeRival(removing.rivalUserId);
                setRemoving(null);
              }}
            >
              {t('Common.OK')}
            </button>
          </div>
        </form>
      </BModal>
    </div>
  );
}

export const __ongekiRankingIcons = { ChevronUp, ChevronDown, DashLg };
