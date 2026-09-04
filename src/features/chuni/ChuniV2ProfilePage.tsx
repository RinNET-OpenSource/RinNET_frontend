import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api/client';
import { notice } from '@/lib/message';
import { getCurrentUser, loadUser } from '@/lib/user';
import type { ChuniV2Profile } from './models';

/** Equivalent to the legacy Chunithm v2 profile component. */
export function ChuniV2ProfilePage() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<ChuniV2Profile | null>(null);

  useEffect(() => {
    void loadUser()
      .then(() => {
        const aimeId = String(getCurrentUser()?.defaultCard?.extId ?? '');
        return api.get('api/game/chuni/v2/profile', { aimeId });
      })
      .then((data) => setProfile(data as ChuniV2Profile))
      .catch((error) => notice(String(error)));
  }, []);

  return (
    <>
      <h1 className="page-heading">{t('ChuniV2.ProfilePage.Title')}</h1>
      <div className="card">
        <div className="card-body">
          <h5 className="card-title mb-3">{t('ChuniV2.ProfilePage.Overview')}</h5>
          {profile && <div className="card-subtitle mb-3">{profile.userName}</div>}
          {profile && (
            <table className="table table-striped table-borderless">
              <tbody>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.Level')}</th>
                  <td>{profile.reincarnationNum * 100 + profile.level}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.Rating')}</th>
                  <td>
                    {profile.playerRating / 100} ({t('ChuniV2.ProfilePage.Max')} {profile.highestRating / 100})
                  </td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.OverPower')}</th>
                  <td>
                    {profile.overPowerPoint / 100} ({profile.overPowerRate / 100}%)
                  </td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.PlayCount')}</th>
                  <td>{profile.playCount}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.LastPlay')}</th>
                  <td>{profile.lastPlayDate}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.CurrentPoints')}</th>
                  <td>{profile.point}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.AcquiredPoints')}</th>
                  <td>{profile.totalPoint}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p>{t('ChuniV2.ProfilePage.MoreInfo')}</p>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body">
          <h5 className="card-title mb-3">{t('ChuniV2.ProfilePage.ScoreStatistics')}</h5>
          {profile && (
            <table className="table table-striped table-borderless">
              <tbody>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalHighScore')}</th>
                  <td>{profile.totalHiScore}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalBasicHighScore')}</th>
                  <td>{profile.totalBasicHighScore}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalAdvancedHighScore')}</th>
                  <td>{profile.totalAdvancedHighScore}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalExpertHighScore')}</th>
                  <td>{profile.totalExpertHighScore}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalMasterHighScore')}</th>
                  <td>{profile.totalMasterHighScore}</td>
                </tr>
                <tr>
                  <th>{t('ChuniV2.ProfilePage.TotalUltimaHighScore')}</th>
                  <td>{profile.totalUltimaHighScore}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}

