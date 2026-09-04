import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
import { isAdmin, loadUser, userStore } from '@/lib/user';
import { useStore } from '@/lib/store';
import { HomePage } from '@/pages/HomePage';
import { SignInPage } from '@/pages/auth/SignInPage';
import { SignUpPage } from '@/pages/auth/SignUpPage';
import { PasswordResetPage } from '@/pages/auth/PasswordResetPage';
import { OauthCallbackPage } from '@/pages/auth/OauthCallbackPage';
import { EulaPage } from '@/pages/EulaPage';
import { BannedPage } from '@/pages/BannedPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { ContributorsPage } from '@/pages/ContributorsPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CardsPage } from '@/pages/CardsPage';
import { KeychipPage } from '@/pages/KeychipPage';
import { ImporterPage } from '@/pages/ImporterPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { AnnouncementEditPage } from '@/pages/AnnouncementEditPage';
import { AdminPage } from '@/pages/AdminPage';
import { OngekiProfilePage } from '@/features/ongeki/OngekiProfilePage';
import { OngekiBattlePage } from '@/features/ongeki/OngekiBattlePage';
import { OngekiRivalPage } from '@/features/ongeki/OngekiRivalPage';
import { OngekiMusicRankingPage } from '@/features/ongeki/OngekiMusicRankingPage';
import { OngekiUserRankingPage } from '@/features/ongeki/OngekiUserRankingPage';
import { OngekiRecentPage } from '@/features/ongeki/OngekiRecentPage';
import { OngekiSettingPage } from '@/features/ongeki/OngekiSettingPage';
import { OngekiRatingPage } from '@/features/ongeki/OngekiRatingPage';
import { OngekiSongListPage } from '@/features/ongeki/OngekiSongListPage';
import { OngekiCardPage } from '@/features/ongeki/OngekiCardPage';
import { OngekiCardGalleryPage } from '@/features/ongeki/OngekiCardGalleryPage';
import { Maimai2ProfilePage } from '@/features/mai2/Maimai2ProfilePage';
import { Maimai2PhotosPage } from '@/features/mai2/Maimai2PhotosPage';
import { Maimai2DxPassPage } from '@/features/mai2/Maimai2DxPassPage';
import { Maimai2RivalPage } from '@/features/mai2/Maimai2RivalPage';
import { Maimai2SettingPage } from '@/features/mai2/Maimai2SettingPage';
import { Maimai2SongListPage } from '@/features/mai2/Maimai2SongListPage';
import { Maimai2RecentPage } from '@/features/mai2/Maimai2RecentPage';
import { Maimai2RatingPage } from '@/features/mai2/Maimai2RatingPage';
import { Maimai2ServerMissionsPage } from '@/features/mai2/Maimai2ServerMissionsPage';
import { Maimai2PointExchangesPage } from '@/features/mai2/Maimai2PointExchangesPage';
import { Maimai2CirclePage } from '@/features/mai2/Maimai2CirclePage';
import { Maimai2FestaPage } from '@/features/mai2/Maimai2FestaPage';
import { ChuniV2ProfilePage } from '@/features/chuni/ChuniV2ProfilePage';
import { ChuniV2UserRankingPage } from '@/features/chuni/ChuniV2UserRankingPage';
import { ChuniV2RatingPage } from '@/features/chuni/ChuniV2RatingPage';
import { ChuniV2RecentPage } from '@/features/chuni/ChuniV2RecentPage';
import { ChuniV2SettingPage } from '@/features/chuni/ChuniV2SettingPage';
import { ChuniV2SongListPage } from '@/features/chuni/ChuniV2SongListPage';
import { ChuniV2SongRankingPage } from '@/features/chuni/ChuniV2SongRankingPage';
import { ChuniV2CharacterPage } from '@/features/chuni/ChuniV2CharacterPage';
import { ChuniV2RivalPage } from '@/features/chuni/ChuniV2RivalPage';
import { ChuniV2UserBoxPage } from '@/features/chuni/ChuniV2UserBoxPage';

/** Auth guards (equivalent to legacy auth-guard/login-guard services) */
function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = getAccount();

  useEffect(() => {
    if (!account) return;
    void restoreAccess().then((status) => {
      if (status?.banned) window.location.assign('/banned');
      else if (status?.eulaRequired) window.location.assign('/eula');
    });
  }, [account]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  return <>{children}</>;
}

function RequireGuest({ children }: { children: ReactNode }) {
  const account = getAccount();
  if (account) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const auth = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

/** Admin routes must not mount (and therefore must not issue admin API calls)
 * until the cached/current user has been checked for ROLE_ADMIN. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const location = useLocation();
  const account = getAccount();
  const user = useStore(userStore);
  const [loadingUser, setLoadingUser] = useState(() => Boolean(account && !user));

  useEffect(() => {
    if (!account || user) {
      setLoadingUser(false);
      return;
    }
    let active = true;
    setLoadingUser(true);
    void loadUser()
      .catch(() => null)
      .finally(() => {
        if (active) setLoadingUser(false);
      });
    return () => {
      active = false;
    };
  }, [account, user]);

  if (!account) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }
  if (loadingUser || !user) return null;
  if (!isAdmin()) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage />, handle: { title: 'Home', disableSidebar: true } },
      { path: '/profile', element: auth(<ProfilePage />), handle: { title: 'Profile' } },
      { path: '/cards', element: auth(<CardsPage />), handle: { title: 'Cards' } },
      { path: '/keychip', element: auth(<KeychipPage />), handle: { title: 'Keychip' } },
      { path: '/dashboard', element: auth(<DashboardPage />), handle: { title: 'Dashboard' } },
      { path: '/import', element: auth(<ImporterPage />), handle: { title: 'Import' } },
      { path: '/announcements', element: auth(<AnnouncementsPage />), handle: { title: 'Announcements' } },
      { path: '/announcements/edit', element: auth(<AnnouncementEditPage />), handle: { title: 'EditAnnouncements' } },
      { path: '/contributors', element: <ContributorsPage />, handle: { title: 'Contributors', disableSidebar: true } },

      // ongeki (canMatch: AuthGuard)
      {
        path: '/ongeki',
        element: auth(<Outlet />),
        handle: { title: 'Ongeki' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <OngekiProfilePage />, handle: { title: 'Profile' } },
          { path: 'recent', element: <OngekiRecentPage />, handle: { title: 'PlayRecord' } },
          { path: 'song', element: <OngekiSongListPage />, handle: { title: 'MusicList' } },
          { path: 'battle', element: <OngekiBattlePage />, handle: { title: 'BattlePoint' } },
          { path: 'rating', element: <OngekiRatingPage />, handle: { title: 'Rating' } },
          { path: 'card/gallery', element: <OngekiCardGalleryPage />, handle: { title: 'CardGallery' } },
          { path: 'card', element: <OngekiCardPage />, handle: { title: 'Card' } },
          { path: 'rival', element: <OngekiRivalPage />, handle: { title: 'Rival' } },
          { path: 'musicRanking', element: <OngekiMusicRankingPage />, handle: { title: 'MusicRanking' } },
          { path: 'userRanking', element: <OngekiUserRankingPage />, handle: { title: 'UserRanking' } },
          { path: 'settings', element: <OngekiSettingPage />, handle: { title: 'Setting' } },
        ],
      },

      // maimai2
      {
        path: '/mai2',
        element: auth(<Outlet />),
        handle: { title: 'Mai2' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <Maimai2ProfilePage />, handle: { title: 'Profile' } },
          { path: 'setting', element: <Maimai2SettingPage />, handle: { title: 'Setting' } },
          { path: 'recent', element: <Maimai2RecentPage />, handle: { title: 'PlayRecord' } },
          { path: 'rating', element: <Maimai2RatingPage />, handle: { title: 'Rating' } },
          { path: 'photos', element: <Maimai2PhotosPage />, handle: { title: 'Photos' } },
          { path: 'dxpass', element: <Maimai2DxPassPage />, handle: { title: 'Dxpass' } },
          { path: 'servermissions', element: <Maimai2ServerMissionsPage />, handle: { title: 'ServerMissions' } },
          { path: 'pointexchanges', element: <Maimai2PointExchangesPage />, handle: { title: 'PointExchanges' } },
          { path: 'circle', element: <Maimai2CirclePage />, handle: { title: 'Circle' } },
          { path: 'festa', element: <Maimai2FestaPage />, handle: { title: 'Festa' } },
          { path: 'songlist', element: <Maimai2SongListPage />, handle: { title: 'MusicList' } },
          { path: 'rival', element: <Maimai2RivalPage />, handle: { title: 'Rival' } },
        ],
      },

      // chunithm v2
      {
        path: '/chuni/v2',
        element: auth(<Outlet />),
        handle: { title: 'ChuniV2' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <ChuniV2ProfilePage />, handle: { title: 'Profile' } },
          { path: 'rating', element: <ChuniV2RatingPage />, handle: { title: 'Rating' } },
          { path: 'recent', element: <ChuniV2RecentPage />, handle: { title: 'PlayRecord' } },
          { path: 'song', element: <ChuniV2SongListPage />, handle: { title: 'MusicList' } },
          { path: 'song/ranking/:id/:level', element: <ChuniV2SongRankingPage />, handle: { title: 'SongRanking' } },
          { path: 'character', element: <ChuniV2CharacterPage />, handle: { title: 'Character' } },
          { path: 'rival', element: <ChuniV2RivalPage />, handle: { title: 'Rival' } },
          { path: 'userRanking', element: <ChuniV2UserRankingPage />, handle: { title: 'UserRanking' } },
          { path: 'setting', element: <ChuniV2SettingPage />, handle: { title: 'Setting' } },
          { path: 'userbox', element: <ChuniV2UserBoxPage />, handle: { title: 'UserBox' } },
        ],
      },

      { path: '/oauth-callback/:type', element: <OauthCallbackPage />, handle: { title: 'OAuthCallback', disableSidebar: true } },
      { path: '/sign-in', element: <RequireGuest><SignInPage /></RequireGuest>, handle: { title: 'SignIn', disableSidebar: true } },
      { path: '/sign-up', element: <RequireGuest><SignUpPage /></RequireGuest>, handle: { title: 'SignUp', disableSidebar: true } },
      { path: '/password-reset', element: <RequireGuest><PasswordResetPage /></RequireGuest>, handle: { title: 'ResetPassword', disableSidebar: true } },
      { path: '/eula', element: <EulaPage />, handle: { title: 'EULA', disableSidebar: true } },
      { path: '/banned', element: <BannedPage />, handle: { title: 'Account Banned', disableSidebar: true } },
      { path: '/admin', element: <RequireAdmin><AdminPage /></RequireAdmin>, handle: { title: 'Admin' } },
      { path: '/not-found', element: <NotFoundPage />, handle: { title: 'NotFound', disableSidebar: true } },
      { path: '*', element: <Navigate to="/not-found" replace /> },
    ],
  },
]);
