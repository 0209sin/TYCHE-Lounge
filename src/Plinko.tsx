import {forwardRef,useEffect,useImperativeHandle,useRef} from 'react';
import type PhaserType from 'phaser';
import {CATALOG,MULTIPLIERS} from './catalog';
import type {Profile} from './economy';
import {PHYSICS,PINS,WALLS,DIVIDERS,DEFLECTORS,pinOptions,wallOptions,dividerOptions,deflectorOptions,ballOptions,spawn,landingSlot,watchMotion,unstuckVelocity,type MotionWatch} from './plinkoPhysics';
export type PlinkoHandle={drop:(id:string)=>boolean};
type Props={profile:Profile;onResult:(id:string,slot:number)=>void;onRefund:(id:string)=>void;onReady:()=>void;onError:()=>void};
export default forwardRef<PlinkoHandle,Props>(function Plinko({profile,onResult,onRefund,onReady,onError},ref){
 const host=useRef<HTMLDivElement>(null),controller=useRef<((id:string)=>boolean)|null>(null);
 const current=useRef({profile,onResult,onRefund,onReady,onError});current.current={profile,onResult,onRefund,onReady,onError};
 useImperativeHandle(ref,()=>({drop:(id)=>controller.current?.(id)??false}),[]);
 useEffect(()=>{
 let cancelled=false,game:PhaserType.Game|undefined;
 void import('phaser').then(({default:Phaser})=>{
  if(cancelled||!host.current)return;
  const W=660,H=535;
  class Board extends Phaser.Scene{
   ink!:PhaserType.GameObjects.Graphics;balls=new Map<string,{body:MatterJS.BodyType;color:number;trail:string;points:{x:number;y:number}[];age:number;watch:MotionWatch}>();pins=PINS;flashes=new Map<number,number>();labels:PhaserType.GameObjects.Text[]=[];accumulator=0;
   random(){const r=new Uint32Array(1);crypto.getRandomValues(r);return r[0]/4294967296;}
   create(){
    this.ink=this.add.graphics();this.matter.world.autoUpdate=false;this.matter.world.setGravity(0,PHYSICS.gravity);
    for(const pin of PINS)this.matter.add.circle(pin.x,pin.y,PHYSICS.pinRadius,pinOptions());
    for(const d of DEFLECTORS)this.matter.add.circle(d.x,d.y,d.r,deflectorOptions());
    for(const wall of WALLS)this.matter.add.rectangle(wall.x,wall.y,wall.width,wall.height,wallOptions());
    for(const divider of DIVIDERS)this.matter.add.rectangle(divider.x,divider.y,divider.width,divider.height,dividerOptions());
    MULTIPLIERS.forEach((m,i)=>this.labels.push(this.add.text(120+i*42,493,`${m}×`,{fontFamily:'Arial, sans-serif',fontSize:'15px',fontStyle:'bold',color:m>=2?'#0b1016':'#e1e6f0'}).setOrigin(.5)));
    controller.current=(id)=>{
     if(this.balls.size>=5)return false;
     const p=current.current.profile,item=CATALOG.find(x=>x.id===p.equipped.ball)!;
     const start=spawn(this.random(),this.random());
     const body=this.matter.add.circle(start.x,start.y,PHYSICS.ballRadius,ballOptions());
     this.matter.body.setVelocity(body,{x:start.vx,y:start.vy});
     this.balls.set(id,{body,color:parseInt(item.color.slice(1),16),trail:p.equipped.trail,points:[],age:0,watch:watchMotion(start.x,start.y)});return true;
    };current.current.onReady();
   }
   update(_time:number,delta:number){
    const elapsed=Math.min(delta,100);this.accumulator+=elapsed;
    while(this.accumulator>=PHYSICS.step){
     this.matter.world.step(PHYSICS.step);this.accumulator-=PHYSICS.step;
     for(const[id,ball]of this.balls){
      ball.age+=PHYSICS.step;const {x,y}=ball.body.position;
      if(!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>W||y>H||ball.age>PHYSICS.timeout){this.matter.world.remove(ball.body);this.balls.delete(id);current.current.onRefund(id);continue;}
      if(y>PHYSICS.landingY){const slot=landingSlot(x);this.matter.world.remove(ball.body);this.balls.delete(id);this.flashes.set(slot,500);current.current.onResult(id,slot);continue;}
      const velocity=unstuckVelocity(ball.watch,ball.body.position,ball.body.velocity,()=>this.random());
      if(velocity)this.matter.body.setVelocity(ball.body,velocity);
     }
    }
    const g=this.ink;g.clear();const theme=CATALOG.find(x=>x.id===current.current.profile.equipped.board)!;const tint=parseInt(theme.color.slice(1),16);
    g.lineStyle(1,tint,.1);g.strokeCircle(330,267,216);g.strokeCircle(330,267,265);
    for(const pin of this.pins){g.fillStyle(tint,.07);g.fillCircle(pin.x,pin.y,8);g.fillStyle(tint,.85);g.fillCircle(pin.x,pin.y,3.2);g.fillStyle(0xffffff,.65);g.fillCircle(pin.x-.5,pin.y-.8,1.2);}
    for(const d of DEFLECTORS){g.fillStyle(0xffcd69,.15);g.fillCircle(d.x,d.y,d.r+4);g.fillStyle(0xffcd69,.9);g.fillCircle(d.x,d.y,d.r);g.fillStyle(0xffffff,.8);g.fillCircle(d.x-.5,d.y-.8,1.5);}
    // Spawn guide and multiplier bins are part of the live board.
    g.lineStyle(1,0xffffff,.12);g.strokeCircle(330,24,12);g.fillStyle(0xffffff,.18);g.fillCircle(330,24,2);
    MULTIPLIERS.forEach((m,i)=>{
     const color=m>=20?0xc4fa6b:m>=5?0x9ad96a:m>=2?0x6fa970:m>=1.5?0x3a5749:m>=0.5?0x2c3645:0x222a36;
     const flash=this.flashes.get(i)??0;g.fillStyle(color,1);g.fillRoundedRect(101+i*42,475,38,36,6);
     if(flash>0){g.lineStyle(2,0xffffff,flash/500);g.strokeRoundedRect(101+i*42,475,38,36,6);this.flashes.set(i,Math.max(0,flash-elapsed));}
    });
    for(const ball of this.balls.values()){
     const {x,y}=ball.body.position;
     ball.points.push({x,y});if(ball.points.length>22)ball.points.shift();
     if(ball.trail&&ball.trail!=='trail-none'&&ball.points.length>1){
      const trailItem=CATALOG.find(x=>x.id===ball.trail);
      const trailColor=trailItem?parseInt(trailItem.color.slice(1),16):0x77d9ff;
      if(ball.trail==='trail-stardust'||ball.trail==='trail-silver-spark'){
       const isSilver=ball.trail==='trail-silver-spark';
       const c1=isSilver?0xf0f4f8:0xffcd69,c2=isSilver?0xa0b2c6:0xffa502;
       ball.points.forEach((p,i)=>{
        const r=i/ball.points.length,a=r*0.85,sz=1.2+r*3.5;
        const jx=(Math.sin(i*1.7+ball.age*0.2)*3)*(1-r),jy=(Math.cos(i*2.3+ball.age*0.2)*3)*(1-r);
        g.fillStyle(i%2===0?c1:c2,a);g.fillCircle(p.x+jx,p.y+jy,sz);
        if(r>0.5){g.fillStyle(0xffffff,a*0.8);g.fillCircle(p.x+jx,p.y+jy,sz*0.45);}
       });
      }else if(ball.trail==='trail-neon'){
       for(let i=1;i<ball.points.length;i++){
        const p1=ball.points[i-1],p2=ball.points[i],r=i/ball.points.length;
        g.lineStyle(6*r+1,0x00f2fe,r*0.4);g.lineBetween(p1.x,p1.y,p2.x,p2.y);
        g.lineStyle(2.5*r+0.5,0xffffff,r*0.9);g.lineBetween(p1.x,p1.y,p2.x,p2.y);
       }
      }else if(ball.trail==='trail-lightning'){
       for(let i=1;i<ball.points.length;i++){
        const p1=ball.points[i-1],p2=ball.points[i],r=i/ball.points.length;
        const arc=(Math.sin(i*3.1+ball.age*0.5)*2.5)*(1-r*0.5);
        g.lineStyle(4*r+1,0xffd15c,r*0.65);g.lineBetween(p1.x+arc,p1.y,p2.x-arc,p2.y);
        g.lineStyle(1.8*r+0.5,0xffffff,r*0.95);g.lineBetween(p1.x+arc,p1.y,p2.x-arc,p2.y);
       }
      }else if(ball.trail==='trail-prism'){
       const rainbow=[0xff3b80,0x9b51e0,0x00f2fe,0x2ed573,0xffd15c,0xff785e];
       for(let i=1;i<ball.points.length;i++){
        const p1=ball.points[i-1],p2=ball.points[i],r=i/ball.points.length;
        const c=rainbow[(i+Math.floor(ball.age*0.1))%rainbow.length];
        g.lineStyle(5*r+1,c,r*0.75);g.lineBetween(p1.x,p1.y,p2.x,p2.y);
        g.fillStyle(0xffffff,r*0.8);g.fillCircle(p2.x,p2.y,2*r);
       }
      }else{
       for(let i=1;i<ball.points.length;i++){
        const p1=ball.points[i-1],p2=ball.points[i],r=i/ball.points.length;
        g.lineStyle(5*r+1,trailColor,r*0.55);g.lineBetween(p1.x,p1.y,p2.x,p2.y);
        g.fillStyle(trailColor,r*0.7);g.fillCircle(p2.x,p2.y,3*r);
        if(r>0.6){g.fillStyle(0xffffff,r*0.8);g.fillCircle(p2.x,p2.y,1.2*r);}
       }
      }
     }
     g.fillStyle(ball.color,.09);g.fillCircle(x,y,18);g.fillStyle(ball.color,.15);g.fillCircle(x,y,11);g.fillStyle(ball.color);g.fillCircle(x,y,7);g.fillStyle(0xffffff,.65);g.fillCircle(x-2,y-2,2);
    }
   }
  }
  game=new Phaser.Game({type:Phaser.AUTO,parent:host.current,width:W,height:H,transparent:true,antialias:true,scene:Board,physics:{default:'matter',matter:{enableSleeping:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},banner:false,audio:{noAudio:true}});
 }).catch(()=>current.current.onError());
 return()=>{cancelled=true;controller.current=null;game?.destroy(true);};
 },[]);
 return <div className="board-canvas" ref={host} role="img" aria-label="핀 10단을 통과해 11개 배율 칸으로 떨어지는 플링코 보드"/>;
});
