import {createRequire} from 'node:module';
import {PHYSICS,PINS,WALLS,DIVIDERS,pinOptions,wallOptions,dividerOptions,ballOptions,spawn,landingSlot,watchMotion,unstuckVelocity} from '../src/plinkoPhysics.ts';
import {MULTIPLIERS} from '../src/catalog.ts';
const require=createRequire(import.meta.url);
const M=require('phaser/src/physics/matter-js/CustomMain.js');
const n=Number(process.argv[2]??10000);let seed=Number(process.argv[3]??31222);
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const e=M.Engine.create({enableSleeping:false});e.gravity.y=PHYSICS.gravity;
for(const pin of PINS)M.Composite.add(e.world,M.Bodies.circle(pin.x,pin.y,PHYSICS.pinRadius,pinOptions()));
for(const w of WALLS)M.Composite.add(e.world,M.Bodies.rectangle(w.x,w.y,w.width,w.height,wallOptions()));
for(const d of DIVIDERS)M.Composite.add(e.world,M.Bodies.rectangle(d.x,d.y,d.width,d.height,dividerOptions()));
const counts=Array(11).fill(0);let refunded=0,nudges=0,totalMs=0,maxMs=0;
for(let i=0;i<n;i++){
 const start=spawn(random(),random()),b=M.Bodies.circle(start.x,start.y,PHYSICS.ballRadius,ballOptions());M.Body.setVelocity(b,{x:start.vx,y:start.vy});M.Composite.add(e.world,b);const watch=watchMotion(start.x,start.y);let elapsed=0,landed=false;
 while(elapsed<PHYSICS.timeout){
  M.Engine.update(e,PHYSICS.step);elapsed+=PHYSICS.step;
  if(b.position.y>PHYSICS.landingY){counts[landingSlot(b.position.x)]++;landed=true;break;}
  const velocity=unstuckVelocity(watch,b.position,b.velocity,random);if(velocity)M.Body.setVelocity(b,velocity);
 }
 if(!landed)refunded++;nudges+=watch.nudges;totalMs+=elapsed;maxMs=Math.max(maxMs,elapsed);M.Composite.remove(e.world,b);
}
console.log(JSON.stringify({samples:n,counts,multipliers:MULTIPLIERS,refunded,nudges,lowMultiplierPercent:counts.reduce((s,c,i)=>s+(MULTIPLIERS[i]<=.5?c:0),0)/n*100,centerPercent:counts[5]/n*100,averageReturn:counts.reduce((s,c,i)=>s+c*MULTIPLIERS[i],refunded)/n,meanSeconds:totalMs/n/1000,maxSeconds:maxMs/1000},null,2));
