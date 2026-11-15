import { chromium } from 'playwright';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';

const [url, output, mode = 'pointer'] = process.argv.slice(2);
if (!url || !output) throw new Error('Usage: record-board.mjs <deployed URL> <private output directory> [pointer|stable]');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'chromium'});
const context = await browser.newContext({
  locale:'en-GB', timezoneId:'Europe/Berlin', viewport:{width:1440,height:1000},
  recordVideo:{dir:output,size:{width:1440,height:1000}},
});
const page = await context.newPage();
const started=Date.now();
const proof={url,mode,startedAt:new Date(started).toISOString(),events:[],network:[],acks:[]};
const seconds=()=>Number(((Date.now()-started)/1000).toFixed(3));
page.on('response',async response=>{
  if (!response.url().includes('/show-me-when/api/')) return;
  try {
    const requestURL=new URL(response.url());
    requestURL.searchParams.set('t','[MASKED]');
    const body=await response.json();
    proof.network.push({at:seconds(),url:requestURL.toString(),status:response.status(),body});
    if(response.url().includes('/api/ack?')) proof.acks.push({at:seconds(),...body});
  } catch(error) {proof.events.push({at:seconds(),error:String(error)});}
});
try {
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.getByTestId('incident-row').first().waitFor();
  proof.sha=await page.locator('meta[name="build"]').getAttribute('content');
  proof.events.push({at:seconds(),event:'board-loaded',sha:proof.sha,first:await page.getByTestId('incident-row').first().getAttribute('data-id')});
  await page.screenshot({path:`${output}/opened.png`});
  await page.waitForTimeout(2500);
  const intended=page.getByTestId('incident-row').first();
  proof.intendedId=await intended.getAttribute('data-id');
  const button=intended.getByTestId('ack');
  const box=await button.boundingBox();
  proof.pointer={x:box.x+box.width/2,y:box.y+box.height/2};
  await page.mouse.move(proof.pointer.x,proof.pointer.y);
  proof.events.push({at:seconds(),event:'pointer-over-ack',id:proof.intendedId});
  await page.waitForFunction(id=>document.querySelector('[data-testid="incident-row"]')?.dataset.id!==id,proof.intendedId,{timeout:25000});
  proof.events.push({at:seconds(),event:'new-top-row',id:await page.getByTestId('incident-row').first().getAttribute('data-id')});
  if(mode==='pointer') {
    await page.mouse.click(proof.pointer.x,proof.pointer.y);
  } else {
    await page.locator(`[data-testid="incident-row"][data-id="${proof.intendedId}"]`).getByTestId('ack').click();
  }
  await page.getByTestId('acked').first().waitFor();
  await page.waitForTimeout(2500);
  proof.actualId=proof.acks.at(-1)?.id;
  proof.events.push({at:seconds(),event:'ack-visible',actualId:proof.actualId,intendedId:proof.intendedId});
  await page.screenshot({path:`${output}/acked.png`});
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.waitForTimeout(1500);
  proof.duration=seconds();
} finally {
  const video=page.video();
  await context.close();
  await browser.close();
  await copyFile(await video.path(),`${output}/board.webm`);
  await writeFile(`${output}/proof-private.json`,JSON.stringify(proof,null,2));
  console.log(JSON.stringify({sha:proof.sha,intendedId:proof.intendedId,actualId:proof.actualId,events:proof.events,duration:proof.duration,video:`${output}/board.webm`}));
}
