import { expect, test, type Page } from '@playwright/test';

const fixtureAccount = {
  tokenType: 'Bearer',
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
};

const fixtureCard = {
  id: 1,
  extId: 12345678,
  luid: '00000000000000000000',
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-01-01T00:00:00+08:00',
  cardExternalList: [],
  default: true,
};

const fixtureUser = {
  id: 999,
  username: 'kop-fixture',
  name: 'KOP Fixture',
  email: 'kop-fixture@example.invalid',
  roles: [{ id: 4, name: 'ROLE_USER' }],
  cards: [fixtureCard],
  defaultCard: fixtureCard,
  keychips: [],
  userTrustKeychips: [],
  games: ['maimai2'],
  oauth2s: [],
};

const currentTournament = {
  tournamentId: 20006,
  kopNo: 8,
  shortName: 'KOP8th',
  name: 'KING of Performai The 8th',
  musicIds: [11810, 11745, 12025],
  requiredLevel: 3,
  startDate: '2026-10-19T22:00:00Z',
  endDate: '2026-11-23T14:59:59Z',
  isEnabled: true,
  isOpen: true,
};

const previousTournament = {
  ...currentTournament,
  tournamentId: 20004,
  kopNo: 6,
  shortName: 'KOP6th',
  name: 'KING of Performai The 6th',
  isEnabled: false,
  isOpen: false,
};

const rankings = [
  { rank: 1, userId: 1001, userName: 'Player A', score: 3015007, deluxScore: 15000, tournamentId: 20006, kopNo: 8, rankingDate: '2026-10-30T10:05:00Z' },
  { rank: 2, userId: 1002, userName: 'Player B', score: 3014007, deluxScore: 14900, tournamentId: 20006, kopNo: 8, rankingDate: '2026-10-30T10:15:00Z' },
  { rank: 2, userId: 1003, userName: 'Player C', score: 3014007, deluxScore: 14900, tournamentId: 20006, kopNo: 8, rankingDate: '2026-10-30T10:16:00Z' },
  { rank: 4, userId: 1004, userName: 'Player D', score: 3000000, deluxScore: 14000, tournamentId: 20006, kopNo: 8, rankingDate: '2026-10-30T10:35:00Z' },
  { rank: 5, userId: 1005, userName: 'Player E', score: 2990000, deluxScore: 13000, tournamentId: 20006, kopNo: 8, rankingDate: '2026-10-30T10:45:00Z' },
];

async function prepare(page: Page): Promise<{ rankingTournamentIds: number[] }> {
  const rankingTournamentIds: number[] = [];
  await page.addInitScript(({ account, user }) => {
    localStorage.setItem('currentAccount', JSON.stringify(account));
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('lang', 'zh');
    localStorage.setItem('colorTheme', 'light');
    localStorage.setItem('themeFamily', 'legacy');
    localStorage.setItem('dbVersion', '6');
  }, { account: fixtureAccount, user: fixtureUser });

  await page.route('**/api/account/status', (route) => route.fulfill({
    json: {
      status: { code: 92001 },
      data: { banned: false, eulaRequired: false, currentEulaVersion: 1, acceptedEulaVersion: 1, appeal: '' },
    },
  }));
  await page.route('**/api/user/me', (route) => route.fulfill({
    json: { status: { code: 92001 }, data: fixtureUser },
  }));
  await page.route('**/api/static/dbVersion', (route) => route.fulfill({
    json: { state: 'Success', version: { major: 6 } },
  }));
  // The app shell preloads static game catalogs on every page. They are unrelated
  // to this page, and an empty list is enough to keep the authenticated shell stable.
  await page.route(/\/api\/game\/.*\/data\//, (route) => route.fulfill({ json: [] }));
  await page.route('**/api/game/maimai2/kop/tournaments', (route) => route.fulfill({
    json: [currentTournament, previousTournament],
  }));
  await page.route('**/api/game/maimai2/kop/current', (route) => route.fulfill({
    json: currentTournament,
  }));
  await page.route('**/api/game/maimai2/kop/ranking*', async (route) => {
    const tournamentId = Number(new URL(route.request().url()).searchParams.get('tournamentId'));
    rankingTournamentIds.push(tournamentId);
    await route.fulfill({ json: tournamentId === previousTournament.tournamentId ? [] : rankings });
  });
  return { rankingTournamentIds };
}

test('renders the KOP leaderboard and switches editions', async ({ page }) => {
  const { rankingTournamentIds } = await prepare(page);
  await page.goto('/mai2/kop');

  await expect(page.locator('.kop-ranking-page h1')).toHaveText('KOP8th');
  await expect(page.locator('.kop-ranking-page tbody tr')).toHaveCount(5);
  await expect(page.locator('.kop-ranking-page')).toContainText('KING of Performai The 8th');
  await expect(page.locator('.kop-ranking-page tbody tr').first()).toContainText('301.5007%');
  await expect(page.locator('.kop-ranking-page tbody tr').nth(3).locator('.kop-rank')).toHaveText('4');
  await expect(page.locator('.kop-ranking-page tbody tr').nth(4).locator('.kop-rank')).toHaveText('5');

  const medals = page.locator('.kop-ranking-page img.medal');
  await expect(medals).toHaveCount(3);
  for (let index = 0; index < 3; index++) {
    await expect(medals.nth(index)).toHaveAttribute('src', new RegExp(['gold', 'silver', 'bronze'][index] + '-medal\\.svg$'));
    await expect.poll(() => medals.nth(index).evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }

  await expect(page.locator('#kop-tournament-select')).toBeVisible();
  await expect(page.locator('#kop-tournament-select option')).toHaveCount(2);
  await page.selectOption('#kop-tournament-select', String(previousTournament.tournamentId));
  await expect(page.locator('.kop-ranking-page .card')).toContainText('没有正在进行的排名。');
  expect(rankingTournamentIds).toContain(previousTournament.tournamentId);
});

test('KOP page fits the mobile viewport', async ({ page }) => {
  await prepare(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mai2/kop');
  await expect(page.locator('.kop-ranking-page tbody tr')).toHaveCount(5);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.innerWidth + 1);
  await expect(page.locator('.kop-ranking-page table')).toBeVisible();
});

test('KOP page shows the empty-edition state', async ({ page }) => {
  await prepare(page);
  await page.route('**/api/game/maimai2/kop/tournaments', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/game/maimai2/kop/current', (route) => route.fulfill({ json: null }));
  await page.goto('/mai2/kop');

  await expect(page.locator('.kop-ranking-page .card')).toContainText('当前没有配置 KOP 届次。');
});
