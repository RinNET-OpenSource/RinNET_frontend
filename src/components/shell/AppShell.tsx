import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigate, Link, useMatches } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { List, Person, Translate } from 'react-bootstrap-icons';
import { LiquidDrawer, LiquidIconButton } from '@liquefy-ui/react';
import {
  Button as AnimalButton,
  Drawer as AnimalDrawer,
  Footer as AnimalFooter,
} from 'animal-island-ui';
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
import { useMobileLiquidFooter } from '@/components/shell/useMobileLiquidFooter';
import { ThemeMenu } from '@/components/theme/ThemeMenu';
import { accountStore } from '@/lib/auth/account';
import { userStore } from '@/lib/user';
import { logout } from '@/lib/auth/auth';
import { useStore } from '@/lib/store';
import { menu, showItem, showMenu } from '@/lib/menu';
import { languages, languageKeys, langStore, setLang } from '@/lib/i18n';
import { assetsHost } from '@/lib/utils';
import { setNavigator } from '@/lib/nav';
import { useTheme } from '@/lib/theme';

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
              <>
                <li className="pb-2">
                  <a className={'link-btn rounded' + (isActive('admin') ? ' active' : '')} onClick={() => go('admin')}>
                    {t('App.Sidebar.Admin')}
                  </a>
                </li>
                <li className="pb-2">
                  <a className={'link-btn rounded' + (isActive('admin/ongeki-events') ? ' active' : '')} onClick={() => go('admin/ongeki-events')}>
                    Ongeki Events
                  </a>
                </li>
              </>
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
  const { family } = useTheme();
  const user = useStore(userStore);
  const isActive = useIsActive();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  if (!user) return null;

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {family === 'animal-island' ? (
          <AnimalButton
            className="animal-island-user-trigger"
            type="primary"
            aria-label={t('App.UserPopup.Profile')}
            icon={<Person size="1.35rem" />}
          />
        ) : (
          <button className="btn btn-icon d-flex align-items-center" type="button">
            <Person size="1.4rem" />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" side="bottom" sideOffset={0} className="shell-user-popover">
        <div className="vstack user-popover">
          <label className="text-start mx-2 h5">{user.name}</label>
          <hr className="my-2 border" />
          <Link to="/profile" className={'link-btn rounded mb-2' + (isActive('profile') ? ' active' : '')} onClick={close}>
            {t('App.UserPopup.Profile')}
          </Link>
          <Link to="/cards" className={'link-btn rounded mb-2' + (isActive('cards') ? ' active' : '')} onClick={close}>
            {t('App.UserPopup.MyCards')}
          </Link>
          <Link to="/keychip" className={'link-btn rounded mb-2' + (isActive('keychip') ? ' active' : '')} onClick={close}>
            {t('App.UserPopup.Keychip')}
          </Link>
          <a
            className="link-btn link-btn-danger rounded"
            onClick={() => {
              close();
              doLogout();
            }}
          >
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
  const { family } = useTheme();
  const location = useLocation();
  const { footerRef, compact } = useMobileLiquidFooter(family === 'liquefy', location.pathname);

  return (
    <footer
      ref={footerRef}
      data-scroll-state={family === 'liquefy' ? (compact ? 'compact' : 'expanded') : undefined}
      className={
        'footer container-xxl' +
        (family === 'liquefy' || family === 'animal-island' ? '' : ' mb-2')
      }
    >
      {family === 'animal-island' && (
        <AnimalFooter className="animal-island-footer-decoration" />
      )}
      <hr className="m-0 pt-2" />
      <div className="shell-footer-layout d-flex justify-content-between flex-wrap px-2 px-lg-3 py-3 column-gap-3">
        <div className="shell-footer-controls row fw-bold my-2">
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
        <div className="shell-footer-details row my-2" inert={compact} aria-hidden={compact || undefined}>
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
          {family === 'animal-island' && (
            <div className="col-auto">
              <a
                href="https://github.com/guokaigdg/animal-island-ui"
                target="_blank"
                rel="noreferrer"
              >
                Animal Island UI · CC BY-NC 4.0
              </a>
            </div>
          )}
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
  const theme = useTheme();
  const isLiquefy = String(theme.family) === 'liquefy';
  const isAnimalIsland = theme.family === 'animal-island';

  const deepest = [...matches].reverse().find((m) => m.handle)?.handle ?? {};
  const accessLayout = deepest.accessLayout === true;
  const disableSidebar = deepest.disableSidebar === true;
  // Gate the navigation tree itself; responsive display classes must not expose guest menus.
  const sidebarEnabled = Boolean(account) && !disableSidebar && !accessLayout;

  const [sheetOpen, setSheetOpen] = useState(false);
  const [animalDrawerMounted, setAnimalDrawerMounted] = useState(false);
  const [animalDrawerClosing, setAnimalDrawerClosing] = useState(false);

  useEffect(() => setSheetOpen(false), [location.pathname, sidebarEnabled]);

  useEffect(() => {
    if (!isAnimalIsland || !sidebarEnabled) {
      setAnimalDrawerMounted(false);
      setAnimalDrawerClosing(false);
      return;
    }
    if (sheetOpen) {
      setAnimalDrawerMounted(true);
      setAnimalDrawerClosing(false);
      return;
    }
    if (!animalDrawerMounted) return;
    setAnimalDrawerClosing(true);
    const timer = window.setTimeout(() => {
      setAnimalDrawerMounted(false);
      setAnimalDrawerClosing(false);
    }, 360);
    return () => window.clearTimeout(timer);
  }, [animalDrawerMounted, isAnimalIsland, sheetOpen, sidebarEnabled]);

  return (
    <div className="app-container">
      <BootEffects />
      <div className="flex-grow-1">
        {!accessLayout && (
          <>
            {sidebarEnabled && isLiquefy && (
              <LiquidIconButton
                className="app-navbar-menu-trigger app-navbar-menu-trigger-detached d-lg-none"
                label={t('App.Sidebar.Navigation')}
                onClick={() => setSheetOpen(true)}
                shape="circle"
              >
                <List size="1.4rem" />
              </LiquidIconButton>
            )}
            <nav
              className={
                'app-navbar navbar navbar-expand-lg position-fixed' + (isLiquefy ? '' : ' shadow')
              }
            >
              <div className="container-xxl">
                {sidebarEnabled && !isLiquefy && (isAnimalIsland ? (
                  <AnimalButton
                    className="app-navbar-menu-trigger animal-island-navbar-trigger d-lg-none"
                    type="text"
                    aria-label={t('App.Sidebar.Navigation')}
                    icon={<List size="1.4rem" />}
                    onClick={() => setSheetOpen(true)}
                  />
                ) : (
                  <button
                    className="navbar-toggler btn btn-icon d-lg-none"
                    type="button"
                    aria-label={t('App.Sidebar.Navigation')}
                    onClick={() => setSheetOpen(true)}
                  >
                    <div className="d-flex align-items-center">
                      <List size="1.4rem" />
                    </div>
                  </button>
                ))}
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
                  {account && <LoadingBar inNavbar />}
                  {account && <UserPopover />}
                </div>
              </div>
            </nav>
          </>
        )}
        <div className="position-relative">
          <LoadingBar />
          <div
            className={'d-lg-grid' + (accessLayout ? '' : ' container-xxl')}
            style={{
              gridTemplateAreas: sidebarEnabled ? "'sidebar main'" : "'main'",
              gridTemplateColumns: sidebarEnabled ? 'auto 1fr' : 'minmax(0, 1fr)',
            }}
          >
            {sidebarEnabled && (
              <aside className="sidebar d-none d-lg-block overflow-y-auto position-sticky">
                <div className="d-none d-lg-block">
                  <SidebarNav />
                </div>
              </aside>
            )}
            {sidebarEnabled &&
              (isLiquefy ? (
                <LiquidDrawer
                  className="shell-mobile-liquid-drawer"
                  closeLabel={t('KeychipPage.GameVersions.Close')}
                  onOpenChange={setSheetOpen}
                  open={sheetOpen}
                  side="left"
                  title={t('App.Sidebar.Navigation')}
                >
                  <SidebarNav onNavigate={() => setSheetOpen(false)} />
                </LiquidDrawer>
              ) : isAnimalIsland ? (
                animalDrawerMounted ? (
                  <AnimalDrawer
                    className={`shell-mobile-animal-drawer${animalDrawerClosing ? ' is-closing' : ''}`}
                    open
                    onClose={() => setSheetOpen(false)}
                    placement="left"
                    width="min(350px, 88vw)"
                    pushBackground={false}
                    title={t('App.Sidebar.Navigation')}
                    maskStyle={{
                      animation: `${animalDrawerClosing ? 'animal-island-drawer-mask-out' : 'animal-island-drawer-mask-in'} 0.36s cubic-bezier(0.2, 0, 0.2, 1) both`,
                    }}
                  >
                    <SidebarNav onNavigate={() => setSheetOpen(false)} />
                  </AnimalDrawer>
                ) : null
              ) : (
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
              ))}
            <main
              className={'order-1 ms-0' + (accessLayout ? '' : ' ms-lg-3 me-lg-2')}
              style={{
                marginTop: accessLayout
                  ? '0'
                  : isLiquefy
                    ? '5.45rem'
                    : isAnimalIsland
                      ? '5.15rem'
                      : '4.6rem',
                gridArea: 'main',
              }}
            >
              <div
                key={location.pathname}
                className="route-view-transition"
                data-route-view={location.pathname}
              >
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
