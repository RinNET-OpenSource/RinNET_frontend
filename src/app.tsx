import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
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
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
