import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const root=process.cwd();
const vite=spawn(process.execPath,[resolve(root,"node_modules/vite/bin/vite.js"),"--config","scripts/phase-two-11-visual/vite.config.ts"],{cwd:root,stdio:["ignore","pipe","pipe"]});
let output="";
vite.stdout.on("data",chunk=>output+=chunk.toString());
vite.stderr.on("data",chunk=>output+=chunk.toString());
const base="http://127.0.0.1:4179/";
const ready=async()=>{
  for(let i=0;i<80;i++){
    try{const response=await fetch(base);if(response.ok)return;}
    catch{}
    if(vite.exitCode!==null)throw new Error("Visual harness server exited early:\n"+output);
    await delay(500);
  }
  throw new Error("Visual harness server did not start:\n"+output);
};
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true});
  mkdirSync(resolve(root,"test-results/phase-two-11"),{recursive:true});
  const viewports=[{name:"phone",width:390,height:844},{name:"tablet-portrait",width:768,height:1024},{name:"tablet-landscape",width:1024,height:768},{name:"laptop",width:1280,height:800},{name:"desktop",width:1440,height:900}];
  for(const viewport of viewports){
    const page=await browser.newPage({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:1});
    const pageErrors=[];
    page.on("pageerror",error=>pageErrors.push(error.message));
    await page.goto(base+"?role=owner",{waitUntil:"networkidle"});
    await page.locator(".canonical-session-row").first().waitFor({state:"visible"});
    await page.locator(".canonical-session-row").first().click();
    await page.locator(".canonical-detail-title h2").getByText("Weekly Scrim · Week 47").waitFor({state:"visible"});
    await page.locator(".canonical-participant-list").waitFor({state:"visible"});
    const metrics=await page.evaluate(()=>({
      width:window.innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      bodyWidth:document.body.scrollWidth,
      shortButtons:[...document.querySelectorAll(".canonical-workspace button")].filter(el=>getComputedStyle(el).display!=="none").map(el=>Math.round(el.getBoundingClientRect().height)).filter(height=>height<44),
      shortFields:[...document.querySelectorAll(".canonical-workspace input:not([type=checkbox]),.canonical-workspace select,.canonical-workspace textarea")].filter(el=>getComputedStyle(el).display!=="none").map(el=>Math.round(el.getBoundingClientRect().height)).filter(height=>height<44)
    }));
    assert.ok(metrics.documentWidth<=metrics.width+1,viewport.name+" horizontal document overflow: "+JSON.stringify(metrics));
    assert.ok(metrics.bodyWidth<=metrics.width+1,viewport.name+" horizontal body overflow: "+JSON.stringify(metrics));
    assert.equal(metrics.shortButtons.length,0,viewport.name+" has undersized button hitboxes: "+JSON.stringify(metrics.shortButtons));
    assert.equal(metrics.shortFields.length,0,viewport.name+" has undersized fields: "+JSON.stringify(metrics.shortFields));
    await page.keyboard.press("Tab");
    const focus=await page.evaluate(()=>({outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth}));
    assert.notEqual(focus.outline,"none",viewport.name+" keyboard focus outline missing");
    await page.screenshot({path:resolve(root,"test-results/phase-two-11/"+viewport.name+".png"),fullPage:true});
    assert.deepEqual(pageErrors,[],viewport.name+" runtime errors");
    await page.close();
  }

  const owner=await browser.newPage({viewport:{width:1280,height:800}});
  await owner.goto(base+"?role=owner",{waitUntil:"networkidle"});
  await owner.getByRole("button",{name:/New training session/}).click();
  await owner.getByLabel("Session title").fill("Visual QA training");
  await owner.getByRole("button",{name:"Create session"}).click();
  await owner.getByRole("status").filter({hasText:"Training session created."}).waitFor({state:"visible"});
  const createCalls=await owner.evaluate(()=>window.__qaCalls.filter(call=>call.name==="create_canonical_session").length);
  assert.equal(createCalls,1,"create flow should call the canonical create RPC exactly once");
  await owner.close();

  const player=await browser.newPage({viewport:{width:1024,height:768}});
  await player.goto(base+"?role=player",{waitUntil:"networkidle"});
  assert.equal(await player.getByRole("button",{name:/New training session/}).count(),0,"members must not see staff create controls");
  assert.equal(await player.getByRole("button",{name:"Link existing"}).count(),0,"members must not see source-link controls");
  await player.locator(".canonical-session-row").first().click();
  await player.getByText("Read-only. Only active Owners and Coaches can change session status.").waitFor({state:"visible"});
  await player.close();

  const offline=await browser.newPage({viewport:{width:1280,height:800}});
  await offline.goto(base+"?role=owner",{waitUntil:"networkidle"});
  await offline.locator(".canonical-session-row").first().click();
  await offline.context().setOffline(true);
  await offline.getByText("Session data is read-only until the connection returns.",{exact:false}).waitFor({state:"visible"});
  await offline.getByRole("button",{name:"Save draft"}).click();
  await offline.getByRole("alert").filter({hasText:"Offline — reconnect before changing session records."}).waitFor({state:"visible"});
  const offlineCalls=await offline.evaluate(()=>window.__qaCalls.length);
  assert.equal(offlineCalls,0,"offline write must not call any RPC");
  await offline.close();
  console.log("Phase 2.11 responsive browser acceptance PASS: 390, 768, 1024, 1280, 1440; create, staff/member permissions, keyboard focus and offline write guard.");
}finally{
  if(browser)await browser.close();
  vite.kill("SIGTERM");
}
