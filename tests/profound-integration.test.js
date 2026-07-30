"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const test=require("node:test");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=rel=>fs.readFileSync(path.join(root,rel),"utf8");

test("guided question bank contains at least 120 unique questions",()=>{
  const store=new Map();
  const document={readyState:"loading",addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
  const ctx={console,Date,Math,JSON,document,localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},addEventListener(){},dispatchEvent(){},CustomEvent:function(){},FormData:function(){},confirm(){return false},setTimeout(){}};
  ctx.globalThis=ctx;ctx.window=ctx;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-question-quests.js"),ctx);
  const bank=ctx.LivingTimeQuestionQuests.BANK;
  assert.ok(bank.length>=120);
  assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
  assert.equal(new Set(bank.map(q=>q.text.toLowerCase())).size,bank.length);
});

test("large multi-year archives use lossless-count density clustering",()=>{
  const ctx={console,Date,Math,Map,Set};ctx.globalThis=ctx;ctx.window=ctx;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-multiyear-map.js"),ctx);
  const api=ctx.LivingTimeMultiYearMap;
  const records=Array.from({length:25000},(_,i)=>({recordId:`r${i}`,instant:`${1000+(i%1001)}-06-01T00:00:00Z`,pattern:{patternYear:1000+(i%1001),dayOf364:1+(i%364),moon:1+(i%13),day:1+(i%28)},witness:{tags:[`t${i%20}`]},entities:{},environment:{seasonal:{season:"Summer"}}}));
  const range=api.ranges(records,{endYear:2000,span:1000});
  const result=api.buildRenderablePoints(records,range,y=>y,d=>d);
  assert.equal(result.aggregated,true);
  assert.equal(result.sourceCount,25000);
  assert.ok(result.points.length<=api.MAX_VISIBLE_NODES);
  assert.equal(result.points.reduce((sum,p)=>sum+p.count,0),25000);
});

test("local witness constellation renders stored records without witness text",()=>{
  class BufferGeometry{setAttribute(k,v){this[k]=v;}}
  class BufferAttribute{constructor(array,size){this.array=array;this.itemSize=size;}}
  class PointsMaterial{constructor(opts){Object.assign(this,opts);}}
  class Points{constructor(geometry,material){this.geometry=geometry;this.material=material;this.userData={};}}
  const records=[{recordId:"r1",instant:"2026-07-30T00:00:00Z",pattern:{patternYear:2026,dayOf364:100},claim:{type:"observed"},witness:{observation:"private words"}}];
  const ctx={console,Date,Math,JSON,document:{createElement(){return {getContext(){return null}}}},localStorage:{getItem(){return JSON.stringify({records})}}};ctx.globalThis=ctx;ctx.window=ctx;
  vm.runInNewContext(read("docs/assets/js/sphere/living-time-sphere-effects.js"),ctx);
  const THREE={BufferGeometry,BufferAttribute,PointsMaterial,Points,AdditiveBlending:1};
  const field=ctx.LivingTimeSphereEffects.buildWitnessField(THREE);
  assert.equal(field.userData.recordCount,1);
  assert.equal(field.geometry.position.array.length,3);
  assert.doesNotMatch(JSON.stringify(field.userData),/private words/);
});

test("mission controls expose operational event actions",()=>{
  const html=read("docs/living-time-sphere.html");
  for(const id of ["mission-load-event","mission-copy-event","mission-export-year","mission-copy-link","sphere-layer-witness"]) assert.match(html,new RegExp(`id=["']${id}["']`));
  const js=read("docs/assets/js/sphere/observatory-mission-control.js");
  assert.match(js,/loadDeepTimeEvent/);
  assert.match(js,/exportYear/);
});

test("deployment permits only same-origin opt-in geolocation",()=>{
  const netlify=read("netlify.toml");
  assert.match(netlify,/Permissions-Policy = "geolocation=\(self\), microphone=\(\), camera=\(\)"/);
});
