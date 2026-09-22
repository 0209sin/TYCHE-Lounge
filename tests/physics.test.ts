import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {PHYSICS,PINS,WALLS,DIVIDERS,pinOptions,wallOptions,dividerOptions,ballOptions,watchMotion,unstuckVelocity} from '../src/plinkoPhysics.ts';
const require=createRequire(import.meta.url),M=require('phaser/src/physics/matter-js/CustomMain.js');
function dropAt(x:number,y:number){
 const e=M.Engine.create({enableSleeping:false});e.gravity.y=PHYSICS.gravity;
 for(const p of PINS)M.Composite.add(e.world,M.Bodies.circle(p.x,p.y,PHYSICS.pinRadius,pinOptions()));
 for(const w of WALLS)M.Composite.add(e.world,M.Bodies.rectangle(w.x,w.y,w.width,w.height,wallOptions()));
 for(const d of DIVIDERS)M.Composite.add(e.world,M.Bodies.rectangle(d.x,d.y,d.width,d.height,dividerOptions()));
 const b=M.Bodies.circle(x,y,PHYSICS.ballRadius,ballOptions());M.Composite.add(e.world,b);const watch=watchMotion(x,y);let time=0;
 while(time<PHYSICS.timeout){M.Engine.update(e,PHYSICS.step);time+=PHYSICS.step;if(b.position.y>PHYSICS.landingY)return {time,nudges:watch.nudges};const velocity=unstuckVelocity(watch,b.position,b.velocity,()=>.75);if(velocity)M.Body.setVelocity(b,velocity);}
 return null;
}
test('balls at the former right and left edge wedges reach the bins',()=>{
 for(const x of [570,90]){const result=dropAt(x,396);assert.ok(result,`stalled at x=${x}`);assert.ok(result.time<3000);}
});
test('a ball balanced on a pin or divider is nudged and eventually settles',()=>{
 for(const point of [{x:330,y:66.2},{x:309,y:439}]){const result=dropAt(point.x,point.y);assert.ok(result,`stalled at ${JSON.stringify(point)}`);assert.ok(result.time<PHYSICS.timeout);}
});
test('the anti-stall impulse is symmetric and only acts after sustained rest',()=>{
 const watch=watchMotion(330,66.2);for(let i=0;i<60;i++)assert.equal(unstuckVelocity(watch,{x:330,y:66.2},{x:0,y:0},()=>.9),null);
 let impulse=null;for(let i=0;i<40;i++){impulse=unstuckVelocity(watch,{x:330,y:66.2},{x:0,y:0},()=>.9);if(impulse)break;}
 assert.ok(impulse);assert.equal(impulse.x,.8);
});
