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
  await page.getByTestId('confirm').waitFor();
  assert.match(await page.getByTestId('confirm').innerText(), /OLD/);
  assert.equal(ackTarget,undefined);
  await page.getByTestId('confirm-cancel').click();
  assert.equal(ackTarget,undefined);
  await old.getByTestId('ack').click();
  await page.getByTestId('confirm-ack').click();
  await old.getByTestId('acked').waitFor();
  assert.equal(ackTarget,'OLD');
  assert.equal(ackCursor,'cursor-2');
  const prior=calls;
  await page.waitForResponse(response=>response.url().includes('/api/incidents?'));
  assert.ok(calls>prior);
  assert.equal(await old.getByTestId('acked').count(),1);
  await page.close();
});

test('a row moving under a stationary pointer requires confirmation; Cancel never acks', async () => {
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  let calls=0;
  const acknowledged=[];
  await page.route('**/api/incidents?*', async route => {
    calls++;
    await route.fulfill({json:{updatedAt:'2026-11-12T23:05:00Z',incidents:calls===1?[incidents[0]]:incidents,cursor:`cursor-${calls}`}});
  });
  await page.route('**/api/ack?*', async route => {
    const id=new URL(route.request().url()).searchParams.get('id');
    acknowledged.push(id);
    await route.fulfill({json:{id,ackedAt:'2026-11-12T23:05:01Z',receipt:'test-receipt'}});
  });
  await page.goto(url);
  const old=page.locator('[data-id="OLD"]');
  const box=await old.getByTestId('ack').boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.locator('[data-id="NEW"]').waitFor();
  await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
  await page.getByTestId('confirm').waitFor();
  assert.equal(await page.getByTestId('confirm-id').innerText(),'NEW');
  assert.deepEqual(acknowledged,[]);
  await page.getByTestId('confirm-cancel').click();
  assert.deepEqual(acknowledged,[]);
  await old.getByTestId('ack').click();
  assert.equal(await page.getByTestId('confirm-id').innerText(),'OLD');
  await page.getByTestId('confirm').press('Escape');
  assert.deepEqual(acknowledged,[]);
  await old.getByTestId('ack').click();
  await page.getByTestId('confirm-ack').click();
  await old.getByTestId('acked').waitFor();
  assert.deepEqual(acknowledged,['OLD']);
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
