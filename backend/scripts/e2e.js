// Browser end-to-end test: node scripts/e2e.js (server must be running on $BASE)
const { chromium } = require('playwright');
const os = require('os');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:5000';
const ADMIN = { username: process.env.ADMIN_USERNAME || 'superadmin', password: process.env.ADMIN_PASSWORD || 'StrayCareAdmin$2026' };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async () => { const p = await (await browser.newContext()).newPage(); p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => m.type() === 'error' && !/Failed to load resource|fonts|qrserver/.test(m.text()) && errors.push('console: ' + m.text())); return p; };
  const login = async (p, role, u, pw) => { await p.goto(`${BASE}/pages/login.html?role=${role}`); await p.fill('#auth-username', u); await p.fill('#auth-password', pw); await p.click('#login-btn'); await p.waitForURL(/dashboard/); };
  const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };

  const home = await newPage(); await home.goto(BASE + '/'); await home.waitForSelector('#hero-total');
  await home.waitForFunction(() => document.getElementById('hero-rescued').textContent !== '0'); ok(true, 'home loads with live stats');

  // user files a report
  const u = await newPage(); await login(u, 'user', 'user1', 'user123');
  await u.selectOption('#ani-type', 'Dog'); await u.click('.sev-opt[data-sev=critical]');
  await u.fill('#ani-desc', 'E2E injured dog <img src=x onerror=alert(1)>'); await u.fill('#loc-inp', 'E2E Street');
  await u.click('text=Submit Rescue Report'); await u.waitForSelector('#my-reports-list .rcard');
  ok((await u.textContent('#my-reports-list')).includes('E2E injured dog'), 'user report appears in My Reports (XSS payload shown as text)');
  ok(await u.locator('#my-reports-list img[src="x"]').count() === 0, 'no injected <img> element');
  const timelineButton = u.locator('#my-reports-list button').first();
  await timelineButton.click();
  ok(await u.locator('#modal-ov[role="dialog"][aria-modal="true"]').isVisible(), 'report timeline opens as an accessible dialog');
  ok(await u.evaluate(() => document.activeElement.id === 'modal-box'), 'dialog receives focus when opened');
  const modalClose = u.locator('.modal-close');
  await modalClose.focus();
  await u.keyboard.press('Tab');
  ok(await u.evaluate(() => document.activeElement.matches('.modal-close')), 'dialog traps keyboard focus');
  await u.keyboard.press('Escape');
  ok(await u.locator('#modal-ov').getAttribute('aria-hidden') === 'true', 'Escape closes the dialog');
  ok(await u.evaluate(() => document.activeElement.matches('#my-reports-list button')), 'closing dialog restores focus to its opener');

  // radius expands server-side
  await u.waitForTimeout(8500); await u.reload(); await u.click('text=My Reports');
  await u.waitForSelector('.rbar-lbl'); ok(!/radius5 km/.test(await u.textContent('.rbar-lbl')), 'radius expanded by scheduler: ' + (await u.textContent('.rbar-lbl')));

  // responder accepts, progresses
  const r = await newPage(); await login(r, 'responder', 'vet1', 'vet123');
  await r.waitForSelector('#resp-requests .req-card'); await r.locator('#resp-requests .req-card', { hasText: 'E2E injured dog' }).first().locator('text=Accept').click();
  await r.waitForSelector('#resp-active >> text=On the Way'); await r.click('#resp-active >> text=On the Way');
  await r.click('#resp-active >> text=Mark Rescued'); await r.waitForSelector('#resp-active >> text=Completed');
  ok(true, 'responder accept -> onway -> rescued');

  // points awarded
  await u.reload(); await u.click('text=Rewards'); await u.waitForTimeout(600);
  ok(Number(await u.textContent('#pts-display')) >= 150, 'reporter points awarded: ' + await u.textContent('#pts-display'));

  // donation
  await u.click('#user-tabs >> text=Donate'); await u.fill('#donate-amt', '250'); await u.click('text=Donate Now');
  await u.click('.upi-confirm-btn >> text=Submit payment claim for review'); await u.waitForSelector('#donate-hist >> text=Pending verification');
  ok((await u.textContent('#donate-hist')).includes('Pending verification'), 'payment claim recorded pending admin review');

  // role guard
  const g = await newPage(); await login(g, 'user', 'user1', 'user123'); await g.goto(BASE + '/pages/admin-dashboard.html'); await g.waitForURL(/user-dashboard/); ok(true, 'user redirected away from admin page');

  // admin
  const a = await newPage(); await login(a, 'admin', ADMIN.username, ADMIN.password);
  await a.waitForSelector('#adm-all .adm-case-row'); ok(Number(await a.textContent('#adm-total')) > 100, 'admin live feed loads');
  for (const t of ['Dispatch Center', 'Access Control', 'Weekly', 'Monthly', 'Data', 'Export']) { await a.click(`.tab-row >> text=${t}`); await a.waitForTimeout(700); }
  ok(await a.locator('#wk-kpis .adm-kpi').count() === 4 && await a.locator('#mo-kpis .adm-kpi').count() === 4 && await a.locator('#bd-top > div').count() === 5, 'weekly/monthly/breakdown render from API');
  await a.click('#cat-weekly'); await a.waitForSelector('#exp-format-grid button');
  const [dl] = await Promise.all([a.waitForEvent('download'), a.click('#exp-format-grid >> text=Download CSV')]); ok(dl.suggestedFilename().endsWith('.csv'), 'CSV export downloads');
  await a.click('.tab-row >> text=Dispatch Center'); await a.waitForSelector('#adm-donation-verify >> text=Mark verified');
  a.on('dialog', dialog => dialog.accept());
  await a.click('#adm-donation-verify >> text=Mark verified');
  await u.click('#user-tabs >> text=Donate'); await u.waitForSelector('#donate-hist >> text=Admin reviewed');
  ok(true, 'admin marks claim verified after confirming external evidence');
  await a.screenshot({ path: process.env.SHOT || path.join(os.tmpdir(), 'straycare-admin.png'), fullPage: false });

  ok(errors.length === 0, 'no browser errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
