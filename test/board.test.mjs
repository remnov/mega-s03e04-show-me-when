import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,channel:'chromium'});
test.after(() => browser.close());
const url = 'http://127.0.0.1:4318/';
const incidents = [
  {id:'OLD',service:'booking',region:'eu',summary:'Older incident',severity:'sev2',openedAt:'2026-11-12T23:03:00.000Z'},
  {id:'NEW',service:'auth',region:'eu',summary:'Newer incident',severity:'sev1',openedAt:'2026-11-12T23:04:00.000Z'},
];

test('loader, newest-first refresh, exact Ack target and acknowledgement survive polling', async () => {
  const page = await browser.newPage({locale:'en-GB',timezoneId:'Europe/Berlin'});
  let release;
  const gate = new Promise(resolve => {release=resolve;});
  let calls=0;
  let ackTarget;
  let ackCursor;
  await page.route('**/api/incidents?*', async route => {
    calls++;
    if (calls === 1) await gate;
    await route.fulfill({json:{updatedAt:'2026-11-12T23:05:00Z',incidents:calls === 1 ? [incidents[0]] : incidents,cursor:`cursor-${calls}`}});
  });
  await page.route('**/api/ack?*', async route => {
    const params = new URL(route.request().url()).searchParams;
    ackTarget=params.get('id'); ackCursor=params.get('cursor');
    await route.fulfill({json:{id:ackTarget,ackedAt:'2026-11-12T23:05:01Z',receipt:'test-receipt'}});
  });
  await page.goto(url);
  await page.getByTestId('loader').waitFor({state:'visible'});
  release();
  await page.getByTestId('loader').waitFor({state:'hidden'});
  await page.locator('[data-id="NEW"]').waitFor();
  assert.deepEqual(await page.getByTestId('incident-row').evaluateAll(rows=>rows.map(row=>row.dataset.id)),['NEW','OLD']);
  const old=page.locator('[data-id="OLD"]');
  assert.match(await old.locator('time').innerText(),/13\/11\/2026.*00:03:00/);
  assert.equal(await old.locator('time').getAttribute('datetime'),incidents[0].openedAt);
  await old.getByTestId('ack').click();
  await old.getByTestId('acked').waitFor();
  assert.equal(ackTarget,'OLD');
  assert.equal(ackCursor,'cursor-2');
  const prior=calls;
  await page.waitForResponse(response=>response.url().includes('/api/incidents?'));
  assert.ok(calls>prior);
  assert.equal(await old.getByTestId('acked').count(),1);
  await page.close();
});

test('empty response and recoverable failure leave useful UI', async () => {
  const page = await browser.newPage();
  let calls=0;
  await page.route('**/api/incidents?*', async route => {
    calls++;
    if(calls === 1) return route.fulfill({status:503,body:'Temporary outage'});
    await route.fulfill({json:{updatedAt:'2026-11-12T23:05:00Z',incidents:[],cursor:'empty'}});
  });
  await page.goto(url);
  await page.getByTestId('status').filter({hasText:'Could not refresh'}).waitFor();
  await page.getByTestId('empty').waitFor();
  assert.equal(await page.getByTestId('loader').isVisible(),false);
  assert.equal(await page.getByTestId('status').innerText(),'');
  await page.close();
});
