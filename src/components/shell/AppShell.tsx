import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, Link, useMatches } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { List, Person, Translate } from 'react-bootstrap-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Toasts } from '@/components/shell/Toasts';
import { LoadingBar } from '@/components/shell/LoadingBar';
import { ThemeMenu } from '@/components/theme/ThemeMenu';
import { accountStore } from '@/lib/auth/account';
import { userStore } from '@/lib/user';
import { logout } from '@/lib/auth/auth';
import { useStore } from '@/lib/store';
import { menu, showItem, showMenu } from '@/lib/menu';
import { languages, languageKeys, langStore, setLang } from '@/lib/i18n';
import { assetsHost } from '@/lib/utils';
import { setNavigator } from '@/lib/nav';

export interface RouteHandle {
  title?: string;
  disableSidebar?: boolean;
  accessLayout?: boolean;
}

function useIsActive(): (url: string) => boolean {
  const location = useLocation();
  return (url: string) => {
    const path = '/' + url.replace(/^\//, '');
    const current = location.pathname;
    return current === path || current.startsWith(path + '/');
  };
}

function doLogout() {
  void logout().then(() => location.assign(''));
}

/** 等价旧版 AppComponent 的路由桥接与标题拼接。 */
function BootEffects() {
  const routerNavigate = useNavigate();
  const matches = useMatches() as Array<{ handle?: { title?: string } }>;

  // 把 react-router 的 navigate 注入给非 React 模块（api client 等）
  useEffect(() => {
    setNavigator(routerNavigate);
  }, [routerNavigate]);

  // 等价：标题拼接 "child - parent | RinNET"
  useEffect(() => {
    const titles = matches
      .map((m) => m.handle?.title)
      .filter((t): t is string => Boolean(t))
      .reverse();
    if (titles.length > 0) {
      document.title = titles.join(' - ') + ' | RinNET';
    }
  }, [matches]);

  return null;
}

/** 导航主体（桌面侧栏与移动抽屉共用），结构等价旧版 app.component.html 侧栏 */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  const user = useStore(userStore);
  const isActive = useIsActive();
  const navigate = useNavigate();

  const go = (url: string) => {
    navigate('/' + url);
    onNavigate?.();
  };

  const admin = user?.roles?.some((r) => r.name === 'ROLE_ADMIN') ?? false;

  const section = (game: string, icon: string, label: string, extra?: ReactNode): ReactNode =>
    showMenu(game, user) && (
      <li key={game}>
        <div className="d-flex mb-2 ps-1 gap-2">
          <div>
            <svg width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024">
              <use href={`/assets/${icon}.svg#icon`} />
            </svg>
          </div>
          <strong className="w-100 fw-semibold">{t(label)}</strong>
        </div>
        <ul className="list-unstyled pb-2 ps-3 small">
          {menu.get(game)!.map((item) =>
            showItem(game, item, user) ? (
              <li key={item.id} className="pb-2">
                <a
                  className={'link-btn rounded' + (isActive(item.url) ? ' active' : '')}
                  onClick={() => go(item.url)}
                >
                  {t('App.Sidebar.' + item.name)}
                </a>
              </li>
            ) : null,
          )}
          {extra}
        </ul>
      </li>
    );

  return (
    <nav className="shell-sidebar-nav user-select-none">
      <ul className="list-unstyled mt-2">
        <li>
          <ul className="list-unstyled pb-2 ps-3 small">
            <li className="pb-2">
              <a className={'link-btn rounded' + (isActive('dashboard') ? ' active' : '')} onClick={() => go('dashboard')}>
                {t('App.Sidebar.Dashboard')}
              </a>
            </li>
            <li className="pb-2">
              <a
                className={'link-btn rounded' + (isActive('announcements') ? ' active' : '')}
                onClick={() => go('announcements')}
              >
                {t('App.Sidebar.Announcements')}
              </a>
            </li>
            <li className="pb-2">
              <a className={'link-btn rounded' + (isActive('import') ? ' active' : '')} onClick={() => go('import')}>
                {t('App.Sidebar.Import')}
              </a>
            </li>
            {admin && (
              <li className="pb-2">
                <a className={'link-btn rounded' + (isActive('admin') ? ' active' : '')} onClick={() => go('admin')}>
                  {t('App.Sidebar.Admin')}
                </a>
              </li>
            )}
          </ul>
        </li>
        {section('ongeki', 'ongeki', 'Common.Ongeki')}
        {section('chusan', 'chunithm', 'Common.ChuniV2', (
          <li className="pb-2">
            <a className="link-btn rounded" href="https://chu3-match.sega.ink/rooms" target="_blank" rel="noreferrer">
              {t('App.Sidebar.OnlineBattle')}
            </a>
          </li>
        ))}
        {section('maimai2', 'mai2', 'Common.Mai2')}
      </ul>
    </nav>
  );
}

function UserPopover() {
  const { t } = useTranslation();
  const user = useStore(userStore);
  const isActive = useIsActive();
  if (!user) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="btn btn-icon d-flex align-items-center" type="button">
          <Person size="1.4rem" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={0} className="shell-user-popover">
        <div className="vstack user-popover">
          <label className="text-start mx-2 h5">{user.name}</label>
          <hr className="my-2 border" />
          <Link to="/profile" className={'link-btn rounded mb-2' + (isActive('profile') ? ' active' : '')}>
            {t('App.UserPopup.Profile')}
          </Link>
          <Link to="/cards" className={'link-btn rounded mb-2' + (isActive('cards') ? ' active' : '')}>
            {t('App.UserPopup.MyCards')}
          </Link>
          <Link to="/keychip" className={'link-btn rounded mb-2' + (isActive('keychip') ? ' active' : '')}>
            {t('App.UserPopup.Keychip')}
          </Link>
          <a className="link-btn link-btn-danger rounded" onClick={doLogout}>
            {t('App.UserPopup.SignOut')}
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Footer() {
  const { t } = useTranslation();
  const currentLang = useStore(langStore);

  return (
    <footer className="footer container-xxl mb-2">
      <hr className="m-0 pt-2" />
      <div className="d-flex justify-content-between flex-wrap px-2 px-lg-3 py-3 column-gap-3">
        <div className="row fw-bold my-2">
          <div className="col-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <a className="dropdown-toggle d-flex align-items-center cursor-pointer">
                  <Translate />
                  <span className="ms-1">{languages.get(currentLang)}</span>
                </a>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={2} className="shell-legacy-dropdown">
                {languageKeys.map((key) => (
                  <DropdownMenuItem
                    key={key}
                    className={
                      'shell-dropdown-item small my-1' +
                      (currentLang === key ? ' active bg-[var(--bs-tertiary-bg)] font-bold' : '')
                    }
                    onClick={() => setLang(key)}
                  >
                    {languages.get(key)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="col-auto">
            <ThemeMenu />
          </div>
        </div>
        <div className="row my-2">
          <div className="col-auto">
            <a target="_blank" rel="noreferrer" href="https://status.naominet.live/status/aquaserver">
              {t('App.Footer.Status')}
            </a>
            <a className="ms-4" target="_blank" rel="noreferrer" href="https://github.com/RinNET-OpenSource/aqua_viewer">
              Github
            </a>
          </div>
          <div className="col-auto" dangerouslySetInnerHTML={{ __html: t('App.Footer.Licence') }} />
          <div className="col-auto">
            <Link to="/contributors">{t('App.Footer.Contributors')}</Link>
          </div>
          <div className="col-auto">{t('App.Footer.Copyright')}</div>
        </div>
      </div>
    </footer>
  );
}

/** 应用外壳：结构等价旧版 app.component.html */
export function AppShell() {
  const account = useStore(accountStore);
  const location = useLocation();
  const matches = useMatches() as Array<{ handle?: RouteHandle }>;
  const { t } = useTranslation();

  const deepest = [...matches].reverse().find((m) => m.handle)?.handle ?? {};
  const accessLayout = deepest.accessLayout === true;
  const disableSidebar = deepest.disableSidebar === true;

  const isRouterHome = location.pathname === '/';
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => setSheetOpen(false), [location.pathname]);

  const togglerHidden = isRouterHome && account ? 'v-hidden' : '';
  const togglerNotLogin = disableSidebar && !account ? 'v-not-login' : '';

  return (
    <div className="app-container">
      <BootEffects />
      <div className="flex-grow-1">
        {!accessLayout && (
          <nav className="app-navbar navbar navbar-expand-lg position-fixed shadow w-100">
            <div className="container-xxl">
              <button
                className={`navbar-toggler btn btn-icon d-lg-none ${togglerHidden} ${togglerNotLogin}`}
                type="button"
                onClick={() => setSheetOpen(true)}
              >
                <div className="d-flex align-items-center">
                  <List size="1.4rem" />
                </div>
              </button>
              <Link to="/" className="navbar-brand sm-center">
                <img
                  src={assetsHost + 'assets/turtle.svg'}
                  alt="turtle"
                  width="30"
                  height="24"
                  className="d-inline-block align-text-top"
                />
                RinNET
              </Link>
              <div className="hstack gap-1 ms-auto">
                {account && <UserPopover />}
              </div>
            </div>
          </nav>
        )}
        <div className="position-relative">
          <LoadingBar />
          <div
            className={'d-lg-grid' + (accessLayout ? '' : ' container-xxl')}
            style={{ gridTemplateAreas: "'sidebar main'", gridTemplateColumns: 'auto 1fr' }}
          >
            <aside
              className={
                'sidebar d-block overflow-y-auto position-sticky' +
                (disableSidebar || !account ? ' d-none' : '')
              }
            >
              <div className="d-none d-lg-block">
                <SidebarNav />
              </div>
            </aside>
            {account && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent
                  side="left"
                  className="shell-mobile-sheet"
                  overlayClassName="shell-mobile-sheet-overlay"
                >
                  <SheetHeader className="shell-mobile-sheet-header">
                    <SheetTitle className="shell-mobile-sheet-title">
                      {t('App.Sidebar.Navigation')}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="shell-mobile-sheet-body">
                    <SidebarNav onNavigate={() => setSheetOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
            )}
            <main
              className={'order-1 ms-0' + (accessLayout ? '' : ' ms-lg-3 me-lg-2')}
              style={{ marginTop: accessLayout ? '0' : '4.6rem', gridArea: 'main' }}
            >
              <div>
                <Outlet />
              </div>
            </main>
          </div>
          <Toasts />
        </div>
      </div>
      {!accessLayout && <Footer />}
    </div>
  );
}
