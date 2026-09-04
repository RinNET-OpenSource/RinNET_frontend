import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import {
  maimai2ClassNames,
  maimai2CourseRanks,
  type DisplayMaimai2Profile,
} from './models';
import './Maimai2ProfilePage.css';

function rankName(names: readonly string[], rank: number): string {
  return names[rank] ?? String(rank);
}

/** Equivalent to the legacy maimai2-profile component. */
export function Maimai2ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<DisplayMaimai2Profile | null>(null);

  useEffect(() => {
    void loadUser()
      .then(() => {
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        return api.get('api/game/maimai2/profile', { aimeId });
      })
      .then((data) => setProfile(data as DisplayMaimai2Profile))
      .catch((error) => notice(String(error)));
  }, []);

  return (
    <>
      <h1 className="page-heading">{t('Maimai2.ProfilePage.Title')}</h1>
      <div className="card">
        <div className="card-body">
          <div className="card-header">{t('Maimai2.ProfilePage.Overview')}</div>
          {profile && (
            <div className="maimai2-profile-table table table-striped table-borderless">
              <ul className="list-group list-group-flush profile-list">
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.UserName')}</span>
                  <span className="profile-value">{profile.userName}</span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.Rating')}</span>
                  <span className="profile-value">
                    {profile.playerRating} (max {profile.highestRating})
                  </span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.AwakenedCharacter')}</span>
                  <span className="profile-value">{profile.totalAwake}</span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.PlayCount')}</span>
                  <span className="profile-value">{profile.playCount}</span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.LastPay')}</span>
                  <span className="profile-value">{profile.lastPlayDate}</span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.OTOMODACHI')}</span>
                  <span className="profile-value">{rankName(maimai2ClassNames, profile.classRank)}</span>
                </li>
                <li className="list-group-item">
                  <span className="profile-label">{t('Maimai2.ProfilePage.DANININTEI')}</span>
                  <span className="profile-value">{rankName(maimai2CourseRanks, profile.courseRank)}</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
