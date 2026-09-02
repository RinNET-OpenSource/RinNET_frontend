import { useEffect } from 'react';
import { BrowserRouter, useLocation, useNavigate, useMatches } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { AppRoutes } from '@/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initTheme } from '@/lib/theme';
import { setNavigator, navigate } from '@/lib/nav';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
import { loadUser } from '@/lib/user';
import { checkDbUpdate } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { t } from 'i18next';
import supportedBrowsers from '@/lib/supportedBrowsers';
import '@/lib/i18n';

const queryClient = new QueryClient();

/** 等价旧版 AppComponent 的启动逻辑（initializeApp / SW 更新 / 浏览器提示 / 标题） */
function BootEffects() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const matches = useMatches() as Array<{ handle?: { title?: string } }>;

  // 把 react-router 的 navigate 注入给非 React 模块（api client 等）
  useEffect(() => {
    setNavigator(routerNavigate);
  }, [routerNavigate]);

  // 等价：路由到 '/' 时 initializeApp
  useEffect(() => {
    void initializeApp();
  }, [location.pathname === '/' ? 'home' : 'other']);

  // 等价：标题拼接 "child - parent | RinNET"
  useEffect(() => {
    const titles = matches
      .map((m) => m.handle?.title)
      .filter((t): t is string => Boolean(t))
      .reverse();
    if (titles.length > 0) {
      document.title = titles.join(' - ') + ' | RinNET';
    }
  }, [location.pathname]);

  return null;
}

async function initializeApp() {
  if (getAccount()) {
    const status = await restoreAccess();
    if (status?.banned) {
      navigate('/banned');
      return;
    }
    if (status?.eulaRequired) {
      navigate('/eula');
      return;
    }
    void checkDbUpdate();
    await loadUser();
  }
}

export default function App() {
  useEffect(() => {
    initTheme();
    // SW 静默自动更新（等价旧版 VERSION_READY → activateUpdate → reload）
    registerSW();
    void initializeApp();
    if (!supportedBrowsers.test(navigator.userAgent)) {
      notice(t('App.Messages.BrowserNotSupported'), 'warning');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <BootEffects />
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
