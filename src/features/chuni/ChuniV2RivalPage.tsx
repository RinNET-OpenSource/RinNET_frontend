import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BModal } from '@/components/shared/BModal';
import { api } from '@/lib/api/client';
import { characterImage, fullWidth, padDigits } from '@/lib/format';
import { StatusCode } from '@/lib/models';
import { notice } from '@/lib/message';
import { getCurrentUser } from '@/lib/user';
import { assetsHost, enableImages } from '@/lib/utils';
import type { ChuniV2Rival, ChuniV2RivalProfile } from './rival-models';
import './ChuniV2RivalPage.css';

/** Equivalent to the legacy Chunithm v2 friend/rival page. */
export function ChuniV2RivalPage() {
  const { t } = useTranslation();
  const [friendList, setFriendList] = useState<ChuniV2Rival[]>([]);
  const [profile, setProfile] = useState<ChuniV2RivalProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingRival, setLoadingRival] = useState(true);
  const [inputAddRivalUserId, setInputAddRivalUserId] = useState('');
  const [removing, setRemoving] = useState<ChuniV2Rival | null>(null);
  const favoriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentUser = getCurrentUser();
  const aimeId = String(currentUser?.defaultCard?.extId ?? '');
  const displayedSelfId = 10_000_000 + (currentUser?.defaultCard?.id ?? 0);

  const refreshFriends = useCallback(() => {
    setLoadingRival(true);
    void api
      .get('api/game/chuni/v2/friend', { aimeId })
      .then((data) => setFriendList((data ?? []) as ChuniV2Rival[]))
      .catch((error) => notice(`get friend list failed: ${String(error)}`))
      .finally(() => setLoadingRival(false));
  }, [aimeId]);

  useEffect(() => {
    refreshFriends();
    void api
      .get('api/user/profiles')
      .then((response) => {
        if (response?.status?.code === StatusCode.OK && response.data?.chusan) {
          setProfile(response.data.chusan as ChuniV2RivalProfile);
        } else if (response?.status?.message) {
          notice(response.status.message);
        }
      })
      .catch((error) => notice(String(error)))
      .finally(() => setLoadingProfile(false));

    return () => {
      if (favoriteTimer.current) clearTimeout(favoriteTimer.current);
    };
  }, [refreshFriends]);

  function addFriend() {
    const friendId = Number.parseInt(inputAddRivalUserId, 10);
    if (!Number.isFinite(friendId)) return;
    void api
      .post('api/game/chuni/v2/friend', undefined, { friendId, aimeId })
      .then((data) => {
        if (data) {
          notice(`(id:${inputAddRivalUserId}) addition successfully`);
          refreshFriends();
        }
      })
      .catch((error) => notice(`add rival failed: ${String(error)}`));
  }

  function removeFriend(friendId: string) {
    void api
      .delete('api/game/chuni/v2/friend', { friendId: Number.parseInt(friendId, 10), aimeId })
      .then(() => {
        setFriendList((items) => items.filter((item) => item.rivalId !== friendId));
        notice(`(id:${friendId}) delete successfully.`);
      })
      .catch((error) => notice(`remove rival failed: ${String(error)}`));
  }

  function toggleFavorite(item: ChuniV2Rival) {
    const favoriteCount = friendList.filter((friend) => friend.isFavorite).length;
    if (!item.isFavorite && favoriteCount >= 3) {
      notice(`(id:${item.rivalId}) You can't add more than 3 favorites.`, 'danger');
      refreshFriends();
      return;
    }

    setFriendList((items) =>
      items.map((friend) =>
        friend.rivalId === item.rivalId ? { ...friend, isFavorite: !friend.isFavorite } : friend,
      ),
    );
    if (favoriteTimer.current) clearTimeout(favoriteTimer.current);
    favoriteTimer.current = setTimeout(() => {
      void api
        .get('api/game/chuni/v2/toggleFavorite', {
          friendId: Number.parseInt(item.rivalId, 10),
          aimeId,
        })
        .then(() => {
          notice(`(id:${item.rivalId}) toggle Favorite Over!`);
          refreshFriends();
        })
        .catch((error) => notice(String(error)));
    }, 1_000);
  }

  const placeholder = (
    <div className="card mb-3 placeholder-wave">
      <div className="card-header">
        <span className="placeholder" style={{ width: '6em' }} />
      </div>
      <div className="card-body p-2">
        <div className="hstack gap-2">
          <img className="placeholder profile-icon" alt="" />
          <table className="profile-table">
            <tbody>
              {[['1em', '5em'], ['3em', '2em'], ['3em', '3em'], ['4em', '4em']].map(
                ([labelWidth, valueWidth], index) => (
                  <tr key={index}>
                    <th><span className="placeholder" style={{ width: labelWidth }} /></th>
                    <td><span className="placeholder" style={{ width: valueWidth }} /></td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card-footer">
        <div className="float-end fw-bold small">
          <span className="placeholder" style={{ width: '14em' }} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="content chuni-v2-rival-page">
      <h1 className="page-heading">{t('ChuniV2.RivalPage.Title')}</h1>

      <div className="input-group">
        <input
          type="text"
          className="form-control form-control mb-3"
          placeholder={t('ChuniV2.RivalPage.IDInputPlaceholder')}
          value={inputAddRivalUserId}
          onChange={(event) => setInputAddRivalUserId(event.target.value)}
        />
        <button className="btn btn-primary mb-3" type="button" onClick={addFriend}>
          {t('ChuniV2.RivalPage.AddRival')}
        </button>
      </div>

      {loadingProfile && placeholder}
      {profile && (
        <div className="card mb-3 chuni-v2-rival-card">
          <div className="card-header fw-bold">{fullWidth(profile.userName)}</div>
          <div className="card-body p-2">
            <div className="profile-container hstack gap-2">
              {enableImages && (
                <img
                  className="profile-icon"
                  src={`${assetsHost}assets/chuni/chara/CHU_UI_Character_${padDigits(Math.floor(profile.characterId / 10), 4)}_00_02.webp`}
                  alt=""
                />
              )}
              <table className="profile-table">
                <tbody>
                  <tr><th>{t('ChuniV2.RivalPage.ID')}</th><td>{displayedSelfId}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.Level')}</th><td>{profile.reincarnationNum * 100 + profile.level}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.Rating')}</th><td>{(profile.playerRating / 100).toFixed(2)}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.OverPower')}</th><td>{profile.overPowerRate / 100}%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <div className="float-end fw-bold small">
              {t('ChuniV2.RivalPage.LastPlay')}{t('Common.Colon')}
              {new Date(profile.lastPlayDate).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      <h3 className="mb-3">{t('ChuniV2.RivalPage.RivalList')}</h3>
      {loadingRival && placeholder}
      {!loadingRival && friendList.length === 0 && (
        <div><span className="text-secondary ms-2">{t('ChuniV2.RivalPage.Empty')}</span></div>
      )}

      {friendList.map((item) => (
        <div className="card mb-3 chuni-v2-rival-card friend-card" key={item.rivalId}>
          <div className="friend-header card-header fw-bold">
            <span>{fullWidth(item.rivalName)}</span>
            <div className="form-check form-switch">
              <input
                className="form-check-input"
                type="checkbox"
                role="switch"
                id={`favorite-${item.rivalId}`}
                checked={item.isFavorite}
                onChange={() => toggleFavorite(item)}
              />
              <label className="form-check-label" htmlFor={`favorite-${item.rivalId}`}>
                {t('ChuniV2.RivalPage.AddLove')}
              </label>
            </div>
          </div>
          <div className="card-body p-2">
            <div className="profile-container hstack gap-2">
              {enableImages && (
                <img
                  className="profile-icon"
                  src={`${assetsHost}assets/chuni/chara/CHU_UI_Character_${characterImage(item.characterId)}_02.webp`}
                  alt=""
                />
              )}
              <table className="profile-table">
                <tbody>
                  <tr><th>{t('ChuniV2.RivalPage.ID')}</th><td>{item.rivalId}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.Level')}</th><td>{item.reincarnationNum * 100 + item.level}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.Rating')}</th><td>{item.playerRating / 100}</td></tr>
                  <tr><th>{t('ChuniV2.RivalPage.OverPower')}</th><td>{item.overPowerRate / 100}%</td></tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="card-footer">
            <a
              className="float-start cursor-pointer text-danger fw-bold small"
              onClick={() => setRemoving(item)}
            >
              {t('ChuniV2.RivalPage.Remove')}
            </a>
            <div className="float-end fw-bold small" />
          </div>
        </div>
      ))}

      <BModal
        className="chuni-v2-rival-remove-dialog"
        open={removing !== null}
        onClose={() => setRemoving(null)}
        overlayClassName="chuni-v2-rival-remove-overlay"
        title={t('ChuniV2.RivalPage.Remove')}
      >
        <form className="chuni-v2-rival-remove-modal" onSubmit={(event) => event.preventDefault()}>
          <div className="d-grid">
            <p className="mb-3 ms-1">{t('ChuniV2.RivalPage.RemoveTip')}</p>
            <button
              className="btn btn-danger btn-sm"
              type="button"
              onClick={() => {
                if (removing) removeFriend(removing.rivalId);
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
