// Shared by the live board and the headless balance/regression simulations.
export const PHYSICS = {step:1000/120,gravity:0.85,restitution:0.275,airDrag:0.050,ballRadius:7,pinRadius:3.8,timeout:20000,landingY:469};
export const PINS=Array.from({length:10},(_,row)=>Array.from({length:row+3},(_,col)=>({x:330+(col-(row+2)/2)*42,y:77+row*36}))).flat();
// Old walls at 80/580 left only 9.2px beside the outside pins for a 14px ball.
export const WALLS=[60,600].map(x=>({x,y:260,width:12,height:540}));
export const DIVIDERS=Array.from({length:10},(_,i)=>({x:99+(i+1)*42,y:477,width:3,height:62}));
export const DEFLECTORS=[{x:123,y:440,r:5.5},{x:537,y:440,r:5.5}];
export const pinOptions=()=>({isStatic:true,restitution:PHYSICS.restitution,friction:0,collisionFilter:{category:1,mask:2}});
export const wallOptions=()=>({isStatic:true,collisionFilter:{category:1,mask:2}});
export const dividerOptions=()=>({isStatic:true,restitution:0.2,collisionFilter:{category:1,mask:2}});
export const deflectorOptions=()=>({isStatic:true,restitution:0.35,friction:0,collisionFilter:{category:1,mask:2}});
export const ballOptions=()=>({restitution:PHYSICS.restitution,friction:0,frictionAir:PHYSICS.airDrag,density:0.001,collisionFilter:{category:2,mask:1|2}});
export const spawn=(r1:number,r2:number)=>({x:330+(r1-.5)*32,y:24,vx:(r2-.5)*1.4,vy:0});
export const landingSlot=(x:number)=>Math.max(0,Math.min(10,Math.floor((x-99)/42)));
export type MotionWatch={x:number;y:number;windowMs:number;quietMs:number;nudges:number};
export const watchMotion=(x:number,y:number):MotionWatch=>({x,y,windowMs:0,quietMs:0,nudges:0});
export function unstuckVelocity(watch:MotionWatch,position:{x:number;y:number},velocity:{x:number;y:number},random:()=>number){
 watch.windowMs+=PHYSICS.step;
 if(watch.windowMs<200)return null;
 const distance=Math.hypot(position.x-watch.x,position.y-watch.y);
 watch.quietMs=distance<0.65?watch.quietMs+watch.windowMs:0;
 watch.x=position.x;watch.y=position.y;watch.windowMs=0;
 if(watch.quietMs<600||watch.nudges>=3)return null;
 watch.quietMs=0;watch.nudges++;
 // A small left/right impulse only after a real stall; never chooses a payout.
 const direction=position.x<80?1:position.x>580?-1:random()<.5?-1:1;
 return {x:direction*.8,y:Math.max(0.1,velocity.y)};
}
