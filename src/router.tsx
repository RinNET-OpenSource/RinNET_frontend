import { useEffect, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/shell/AppShell';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
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
import { PlaceholderPage } from '@/pages/PlaceholderPage';
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
      { path: '/announcements/edit', element: auth(<PlaceholderPage title="EditAnnouncements" />), handle: { title: 'EditAnnouncements' } },
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
          { path: 'card/gallery', element: <PlaceholderPage title="Ongeki Card Gallery" />, handle: { title: 'CardGallery' } },
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
          { path: 'profile', element: <PlaceholderPage title="Mai2 Profile" />, handle: { title: 'Profile' } },
          { path: 'setting', element: <PlaceholderPage title="Mai2 Setting" />, handle: { title: 'Setting' } },
          { path: 'recent', element: <PlaceholderPage title="Mai2 Recent" />, handle: { title: 'PlayRecord' } },
          { path: 'rating', element: <PlaceholderPage title="Mai2 Rating" />, handle: { title: 'Rating' } },
          { path: 'photos', element: <PlaceholderPage title="Mai2 Photos" />, handle: { title: 'Photos' } },
          { path: 'dxpass', element: <PlaceholderPage title="Mai2 DxPass" />, handle: { title: 'Dxpass' } },
          { path: 'servermissions', element: <PlaceholderPage title="Mai2 Server Missions" />, handle: { title: 'ServerMissions' } },
          { path: 'pointexchanges', element: <PlaceholderPage title="Mai2 Point Exchanges" />, handle: { title: 'PointExchanges' } },
          { path: 'circle', element: <PlaceholderPage title="Mai2 Circle" />, handle: { title: 'Circle' } },
          { path: 'festa', element: <PlaceholderPage title="Mai2 Festa" />, handle: { title: 'Festa' } },
          { path: 'songlist', element: <PlaceholderPage title="Mai2 Songlist" />, handle: { title: 'MusicList' } },
          { path: 'rival', element: <PlaceholderPage title="Mai2 Rival" />, handle: { title: 'Rival' } },
        ],
      },

      // chunithm v2
      {
        path: '/chuni/v2',
        element: auth(<Outlet />),
        handle: { title: 'ChuniV2' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <PlaceholderPage title="Chuni Profile" />, handle: { title: 'Profile' } },
          { path: 'rating', element: <PlaceholderPage title="Chuni Rating" />, handle: { title: 'Rating' } },
          { path: 'recent', element: <PlaceholderPage title="Chuni Recent" />, handle: { title: 'PlayRecord' } },
          { path: 'song', element: <PlaceholderPage title="Chuni Song" />, handle: { title: 'MusicList' } },
          { path: 'song/ranking/:id/:level', element: <PlaceholderPage title="Chuni Song Ranking" />, handle: { title: 'SongRanking' } },
          { path: 'character', element: <PlaceholderPage title="Chuni Character" />, handle: { title: 'Character' } },
          { path: 'rival', element: <PlaceholderPage title="Chuni Rival" />, handle: { title: 'Rival' } },
          { path: 'userRanking', element: <PlaceholderPage title="Chuni User Ranking" />, handle: { title: 'UserRanking' } },
          { path: 'setting', element: <PlaceholderPage title="Chuni Setting" />, handle: { title: 'Setting' } },
          { path: 'userbox', element: <PlaceholderPage title="Chuni UserBox" />, handle: { title: 'UserBox' } },
        ],
      },

      { path: '/oauth-callback/:type', element: <OauthCallbackPage />, handle: { title: 'OAuthCallback', disableSidebar: true } },
      { path: '/sign-in', element: <RequireGuest><SignInPage /></RequireGuest>, handle: { title: 'SignIn', disableSidebar: true } },
      { path: '/sign-up', element: <RequireGuest><SignUpPage /></RequireGuest>, handle: { title: 'SignUp', disableSidebar: true } },
      { path: '/password-reset', element: <RequireGuest><PasswordResetPage /></RequireGuest>, handle: { title: 'ResetPassword', disableSidebar: true } },
      { path: '/eula', element: <EulaPage />, handle: { title: 'EULA', disableSidebar: true } },
      { path: '/banned', element: <BannedPage />, handle: { title: 'Account Banned', disableSidebar: true } },
      { path: '/admin', element: auth(<PlaceholderPage title="Admin" />), handle: { title: 'Admin' } },
      { path: '/not-found', element: <NotFoundPage />, handle: { title: 'NotFound', disableSidebar: true } },
      { path: '*', element: <Navigate to="/not-found" replace /> },
    ],
  },
]);
