import { useEffect, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { LiquefyProvider } from '@liquefy-ui/react';
import { router } from '@/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { navigate } from '@/lib/nav';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
import { loadUser } from '@/lib/user';
import { checkDbUpdate } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { t } from 'i18next';
import supportedBrowsers from '@/lib/supportedBrowsers';
import { useTheme } from '@/lib/theme';
import '@/lib/i18n';

const queryClient = new QueryClient();
let initializationPromise: Promise<void> | null = null;

/** 等价旧版 AppComponent 构造器/ngOnInit 的一次性启动逻辑 */
function initializeApp(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      if (!getAccount()) return;

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
    })();
  }
  return initializationPromise;
}

function ThemeRuntime({ children }: { children: ReactNode }) {
  const theme = useTheme();

  if (theme.family !== 'liquefy') return children;

  const tint = theme.resolvedColorTheme === 'dark' ? '#7abcf3' : '#087f8c';

  return (
    <LiquefyProvider
      className="liquefy-app"
      theme={theme.resolvedColorTheme}
      tint={tint}
      intensity={0.76}
      lens
      motion
      transparency
      webgl={false}
      wobbliness={0.24}
    >
      {children}
    </LiquefyProvider>
  );
}

export default function App() {
  useEffect(() => {
    // SW 静默自动更新（等价旧版 VERSION_READY → activateUpdate → reload）
    registerSW();
    void initializeApp();
    if (!supportedBrowsers.test(navigator.userAgent)) {
      notice(t('App.Messages.BrowserNotSupported'), 'warning');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeRuntime>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ThemeRuntime>
    </QueryClientProvider>
  );
}
