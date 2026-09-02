import { useEffect, type ReactNode } from 'react';
import { Navigate, createBrowserRouter, useLocation } from 'react-router-dom';
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
import { PlaceholderPage } from '@/pages/PlaceholderPage';

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
      { path: '/profile', element: auth(<PlaceholderPage title="Profile" />), handle: { title: 'Profile' } },
      { path: '/cards', element: auth(<PlaceholderPage title="Cards" />), handle: { title: 'Cards' } },
      { path: '/keychip', element: auth(<PlaceholderPage title="Keychip" />), handle: { title: 'Keychip' } },
      { path: '/dashboard', element: auth(<PlaceholderPage title="Dashboard" />), handle: { title: 'Dashboard' } },
      { path: '/import', element: auth(<PlaceholderPage title="Import" />), handle: { title: 'Import' } },
      { path: '/announcements', element: auth(<PlaceholderPage title="Announcements" />), handle: { title: 'Announcements' } },
      { path: '/announcements/edit', element: auth(<PlaceholderPage title="EditAnnouncements" />), handle: { title: 'EditAnnouncements' } },
      { path: '/contributors', element: <ContributorsPage />, handle: { title: 'Contributors', disableSidebar: true } },

      // ongeki (canMatch: AuthGuard)
      {
        path: '/ongeki',
        element: auth(<PlaceholderPage title="Ongeki" />),
        handle: { title: 'Ongeki' },
        children: [
          { index: true, element: <Navigate to="profile" replace /> },
          { path: 'profile', element: <PlaceholderPage title="Ongeki Profile" />, handle: { title: 'Profile' } },
          { path: 'recent', element: <PlaceholderPage title="Ongeki Recent" />, handle: { title: 'PlayRecord' } },
          { path: 'song', element: <PlaceholderPage title="Ongeki Song" />, handle: { title: 'MusicList' } },
          { path: 'battle', element: <PlaceholderPage title="Ongeki Battle" />, handle: { title: 'BattlePoint' } },
          { path: 'rating', element: <PlaceholderPage title="Ongeki Rating" />, handle: { title: 'Rating' } },
          { path: 'card/gallery', element: <PlaceholderPage title="Ongeki Card Gallery" />, handle: { title: 'CardGallery' } },
          { path: 'card', element: <PlaceholderPage title="Ongeki Card" />, handle: { title: 'Card' } },
          { path: 'rival', element: <PlaceholderPage title="Ongeki Rival" />, handle: { title: 'Rival' } },
          { path: 'musicRanking', element: <PlaceholderPage title="Ongeki Music Ranking" />, handle: { title: 'MusicRanking' } },
          { path: 'userRanking', element: <PlaceholderPage title="Ongeki User Ranking" />, handle: { title: 'UserRanking' } },
          { path: 'settings', element: <PlaceholderPage title="Ongeki Settings" />, handle: { title: 'Setting' } },
        ],
      },

      // maimai2
      {
        path: '/mai2',
        element: auth(<PlaceholderPage title="Mai2" />),
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
        element: auth(<PlaceholderPage title="ChuniV2" />),
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
