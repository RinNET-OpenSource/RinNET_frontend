import { useEffect, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell, type RouteHandle } from '@/components/shell/AppShell';
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

/** 等价旧版 auth-guard.service.ts / login-guard.service.ts */
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

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} handle={{ title: 'Home', disableSidebar: true }} />
        <Route
          path="/profile"
          element={<RequireAuth><PlaceholderPage title="Profile" /></RequireAuth>}
          handle={{ title: 'Profile' }}
        />
        <Route
          path="/cards"
          element={<RequireAuth><PlaceholderPage title="Cards" /></RequireAuth>}
          handle={{ title: 'Cards' }}
        />
        <Route
          path="/keychip"
          element={<RequireAuth><PlaceholderPage title="Keychip" /></RequireAuth>}
          handle={{ title: 'Keychip' }}
        />
        <Route
          path="/dashboard"
          element={<RequireAuth><PlaceholderPage title="Dashboard" /></RequireAuth>}
          handle={{ title: 'Dashboard' }}
        />
        <Route
          path="/import"
          element={<RequireAuth><PlaceholderPage title="Import" /></RequireAuth>}
          handle={{ title: 'Import' }}
        />
        <Route
          path="/announcements"
          element={<RequireAuth><PlaceholderPage title="Announcements" /></RequireAuth>}
          handle={{ title: 'Announcements' }}
        />
        <Route
          path="/announcements/edit"
          element={<RequireAuth><PlaceholderPage title="EditAnnouncements" /></RequireAuth>}
          handle={{ title: 'EditAnnouncements' }}
        />
        <Route
          path="/contributors"
          element={<ContributorsPage />}
          handle={{ title: 'Contributors', disableSidebar: true }}
        />

        {/* ongeki（canMatch: AuthGuard） */}
        <Route
          path="/ongeki"
          element={<RequireAuth><PlaceholderPage title="Ongeki" /></RequireAuth>}
          handle={{ title: 'Ongeki' }}
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<PlaceholderPage title="Ongeki Profile" />} handle={{ title: 'Profile' }} />
          <Route path="recent" element={<PlaceholderPage title="Ongeki Recent" />} handle={{ title: 'PlayRecord' }} />
          <Route path="song" element={<PlaceholderPage title="Ongeki Song" />} handle={{ title: 'MusicList' }} />
          <Route path="battle" element={<PlaceholderPage title="Ongeki Battle" />} handle={{ title: 'BattlePoint' }} />
          <Route path="rating" element={<PlaceholderPage title="Ongeki Rating" />} handle={{ title: 'Rating' }} />
          <Route path="card/gallery" element={<PlaceholderPage title="Ongeki Card Gallery" />} handle={{ title: 'CardGallery' }} />
          <Route path="card" element={<PlaceholderPage title="Ongeki Card" />} handle={{ title: 'Card' }} />
          <Route path="rival" element={<PlaceholderPage title="Ongeki Rival" />} handle={{ title: 'Rival' }} />
          <Route path="musicRanking" element={<PlaceholderPage title="Ongeki Music Ranking" />} handle={{ title: 'MusicRanking' }} />
          <Route path="userRanking" element={<PlaceholderPage title="Ongeki User Ranking" />} handle={{ title: 'UserRanking' }} />
          <Route path="settings" element={<PlaceholderPage title="Ongeki Settings" />} handle={{ title: 'Setting' }} />
        </Route>

        {/* maimai2 */}
        <Route
          path="/mai2"
          element={<RequireAuth><PlaceholderPage title="Mai2" /></RequireAuth>}
          handle={{ title: 'Mai2' }}
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<PlaceholderPage title="Mai2 Profile" />} handle={{ title: 'Profile' }} />
          <Route path="setting" element={<PlaceholderPage title="Mai2 Setting" />} handle={{ title: 'Setting' }} />
          <Route path="recent" element={<PlaceholderPage title="Mai2 Recent" />} handle={{ title: 'PlayRecord' }} />
          <Route path="rating" element={<PlaceholderPage title="Mai2 Rating" />} handle={{ title: 'Rating' }} />
          <Route path="photos" element={<PlaceholderPage title="Mai2 Photos" />} handle={{ title: 'Photos' }} />
          <Route path="dxpass" element={<PlaceholderPage title="Mai2 DxPass" />} handle={{ title: 'Dxpass' }} />
          <Route path="servermissions" element={<PlaceholderPage title="Mai2 Server Missions" />} handle={{ title: 'ServerMissions' }} />
          <Route path="pointexchanges" element={<PlaceholderPage title="Mai2 Point Exchanges" />} handle={{ title: 'PointExchanges' }} />
          <Route path="circle" element={<PlaceholderPage title="Mai2 Circle" />} handle={{ title: 'Circle' }} />
          <Route path="festa" element={<PlaceholderPage title="Mai2 Festa" />} handle={{ title: 'Festa' }} />
          <Route path="songlist" element={<PlaceholderPage title="Mai2 Songlist" />} handle={{ title: 'MusicList' }} />
          <Route path="rival" element={<PlaceholderPage title="Mai2 Rival" />} handle={{ title: 'Rival' }} />
        </Route>

        {/* chunithm v2 */}
        <Route
          path="/chuni/v2"
          element={<RequireAuth><PlaceholderPage title="ChuniV2" /></RequireAuth>}
          handle={{ title: 'ChuniV2' }}
        >
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<PlaceholderPage title="Chuni Profile" />} handle={{ title: 'Profile' }} />
          <Route path="rating" element={<PlaceholderPage title="Chuni Rating" />} handle={{ title: 'Rating' }} />
          <Route path="recent" element={<PlaceholderPage title="Chuni Recent" />} handle={{ title: 'PlayRecord' }} />
          <Route path="song" element={<PlaceholderPage title="Chuni Song" />} handle={{ title: 'MusicList' }} />
          <Route path="song/ranking/:id/:level" element={<PlaceholderPage title="Chuni Song Ranking" />} handle={{ title: 'SongRanking' }} />
          <Route path="character" element={<PlaceholderPage title="Chuni Character" />} handle={{ title: 'Character' }} />
          <Route path="rival" element={<PlaceholderPage title="Chuni Rival" />} handle={{ title: 'Rival' }} />
          <Route path="userRanking" element={<PlaceholderPage title="Chuni User Ranking" />} handle={{ title: 'UserRanking' }} />
          <Route path="setting" element={<PlaceholderPage title="Chuni Setting" />} handle={{ title: 'Setting' }} />
          <Route path="userbox" element={<PlaceholderPage title="Chuni UserBox" />} handle={{ title: 'UserBox' }} />
        </Route>

        <Route
          path="/oauth-callback/:type"
          element={<OauthCallbackPage />}
          handle={{ title: 'OAuthCallback', disableSidebar: true }}
        />
        <Route
          path="/sign-in"
          element={<RequireGuest><SignInPage /></RequireGuest>}
          handle={{ title: 'SignIn', disableSidebar: true }}
        />
        <Route
          path="/sign-up"
          element={<RequireGuest><SignUpPage /></RequireGuest>}
          handle={{ title: 'SignUp', disableSidebar: true }}
        />
        <Route
          path="/password-reset"
          element={<RequireGuest><PasswordResetPage /></RequireGuest>}
          handle={{ title: 'ResetPassword', disableSidebar: true }}
        />
        <Route path="/eula" element={<EulaPage />} handle={{ title: 'EULA', disableSidebar: true }} />
        <Route path="/banned" element={<BannedPage />} handle={{ title: 'Account Banned', disableSidebar: true }} />
        <Route
          path="/admin"
          element={<RequireAuth><PlaceholderPage title="Admin" /></RequireAuth>}
          handle={{ title: 'Admin' }}
        />
        <Route path="/not-found" element={<NotFoundPage />} handle={{ title: 'NotFound', disableSidebar: true }} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Route>
    </Routes>
  );
}

export type { RouteHandle };
