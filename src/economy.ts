import { BETS, CATALOG, MISSIONS, MULTIPLIERS, HISTORICAL_MULTIPLIERS, BOXES, TITLES, type Category, type BoxPrize } from './catalog.ts';
export type Pending = {id:string; bet:number; created:number; target?:number};
export type Result = {id:string; bet:number; multiplier:number; payout:number; time:number};
export type Profile = {version:1; balance:number; owned:string[]; equipped:Record<Category,string>; title:string; ownedTitles:string[]; results:Result[]; pending:Pending[]; rounds:number; wagered:number; earned:number; best:number; claimed:string[]; lastRelief:number; sound:boolean; savedAt:number};
export const initialProfile = ():Profile => ({version:1,balance:10000,owned:['ball-coral','board-midnight','trail-none','rocket-classic','penguin-classic'],equipped:{ball:'ball-coral',board:'board-midnight',trail:'trail-none',rocket:'rocket-classic',penguin:'penguin-classic'},title:'티케의 손님',ownedTitles:['티케의 손님'],results:[],pending:[],rounds:0,wagered:0,earned:0,best:0,claimed:[],lastRelief:0,sound:false,savedAt:Date.now()});
export type Action = {type:'drop';id:string;bet:number}|{type:'settle';id:string;slot:number}|{type:'crash_start';id:string;bet:number}|{type:'crash_cashout';id:string;multiplier:number}|{type:'crash_bust';id:string;crashPoint:number}|{type:'race_start';id:string;bet:number;horseIndex:number}|{type:'race_settle';id:string;winnerIndex:number}|{type:'penguin_start';id:string;bet:number}|{type:'penguin_cashout';id:string;multiplier:number}|{type:'penguin_fall';id:string}|{type:'refund';id:string}|{type:'recover'}|{type:'buy';id:string}|{type:'equip';id:string}|{type:'claim';id:string}|{type:'box_open';boxId:string;prize:BoxPrize}|{type:'title_equip';title:string}|{type:'relief'}|{type:'sound'}|{type:'reset'};
export function reduceProfile(previous:Profile, action:Action, now=Date.now()):Profile {
 const p=structuredClone(previous); p.savedAt=now;
 switch(action.type){
 case 'drop':
  if(!BETS.includes(action.bet)||p.balance<action.bet)throw new Error('코인이 부족합니다.');
  if(p.pending.length>=5)throw new Error('한 번에 공 5개까지 떨어뜨릴 수 있어요.');
  if(p.pending.some(b=>b.id===action.id))throw new Error('이미 처리된 공입니다.');
  p.balance-=action.bet;p.pending.push({id:action.id,bet:action.bet,created:now});break;
 case 'settle':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  if(!Number.isInteger(action.slot)||action.slot<0||action.slot>=MULTIPLIERS.length)throw new Error('도착 칸을 확인할 수 없습니다.');
  const multiplier=MULTIPLIERS[action.slot],payout=Math.round(b.bet*multiplier);
  p.pending=p.pending.filter(x=>x.id!==b.id);p.balance+=payout;p.rounds++;p.wagered+=b.bet;p.earned+=payout;p.best=Math.max(p.best,multiplier);
  p.results=[{id:b.id,bet:b.bet,multiplier,payout,time:now},...p.results].slice(0,30);break;
 }
 case 'crash_start':{
  if(!BETS.includes(action.bet)||p.balance<action.bet)throw new Error('코인이 부족합니다.');
  if(p.pending.length>=5)throw new Error('진행 중인 게임이 있습니다.');
  if(p.pending.some(b=>b.id===action.id))throw new Error('이미 처리된 게임입니다.');
  p.balance-=action.bet;p.pending.push({id:action.id,bet:action.bet,created:now});break;
 }
 case 'crash_cashout':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  if(typeof action.multiplier!=='number'||!Number.isFinite(action.multiplier)||action.multiplier<1.0)throw new Error('올바른 배율이 아닙니다.');
  const mult=Math.round(action.multiplier*100)/100,payout=Math.round(b.bet*mult);
  p.pending=p.pending.filter(x=>x.id!==b.id);p.balance+=payout;p.rounds++;p.wagered+=b.bet;p.earned+=payout;p.best=Math.max(p.best,mult);
  p.results=[{id:b.id,bet:b.bet,multiplier:mult,payout,time:now},...p.results].slice(0,30);break;
 }
 case 'crash_bust':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  p.pending=p.pending.filter(x=>x.id!==b.id);p.rounds++;p.wagered+=b.bet;
  p.results=[{id:b.id,bet:b.bet,multiplier:0,payout:0,time:now},...p.results].slice(0,30);break;
 }
 case 'race_start':{
  if(!BETS.includes(action.bet)||p.balance<action.bet)throw new Error('코인이 부족합니다.');
  if(p.pending.length>=5)throw new Error('진행 중인 게임이 있습니다.');
  if(p.pending.some(b=>b.id===action.id))throw new Error('이미 처리된 게임입니다.');
  if(action.horseIndex<0||action.horseIndex>3)throw new Error('올바른 말을 선택해 주세요.');
  p.balance-=action.bet;p.pending.push({id:action.id,bet:action.bet,created:now,target:action.horseIndex});break;
 }
 case 'race_settle':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  const isWin=b.target===action.winnerIndex,multiplier=isWin?3.0:0,payout=isWin?Math.round(b.bet*3):0;
  p.pending=p.pending.filter(x=>x.id!==b.id);p.balance+=payout;p.rounds++;p.wagered+=b.bet;p.earned+=payout;
  if(isWin)p.best=Math.max(p.best,multiplier);
  p.results=[{id:b.id,bet:b.bet,multiplier,payout,time:now},...p.results].slice(0,30);break;
 }
 case 'penguin_start':{
  if(!BETS.includes(action.bet)||p.balance<action.bet)throw new Error('코인이 부족합니다.');
  if(p.pending.length>=5)throw new Error('진행 중인 게임이 있습니다.');
  if(p.pending.some(b=>b.id===action.id))throw new Error('이미 처리된 게임입니다.');
  p.balance-=action.bet;p.pending.push({id:action.id,bet:action.bet,created:now});break;
 }
 case 'penguin_cashout':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  if(typeof action.multiplier!=='number'||!Number.isFinite(action.multiplier)||action.multiplier<1.0)throw new Error('올바른 배율이 아닙니다.');
  const mult=Math.round(action.multiplier*100)/100,payout=Math.round(b.bet*mult);
  p.pending=p.pending.filter(x=>x.id!==b.id);p.balance+=payout;p.rounds++;p.wagered+=b.bet;p.earned+=payout;p.best=Math.max(p.best,mult);
  p.results=[{id:b.id,bet:b.bet,multiplier:mult,payout,time:now},...p.results].slice(0,30);break;
 }
 case 'penguin_fall':{
  const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;
  p.pending=p.pending.filter(x=>x.id!==b.id);p.rounds++;p.wagered+=b.bet;
  p.results=[{id:b.id,bet:b.bet,multiplier:0,payout:0,time:now},...p.results].slice(0,30);break;
 }
 case 'refund':{const b=p.pending.find(b=>b.id===action.id);if(!b)return previous;p.balance+=b.bet;p.pending=p.pending.filter(x=>x.id!==b.id);break;}
 case 'recover': p.balance+=p.pending.reduce((sum,b)=>sum+b.bet,0);p.pending=[];break;
 case 'buy':{
  const item=CATALOG.find(x=>x.id===action.id);if(!item)throw new Error('상품을 찾을 수 없습니다.');
  if(item.boxOnly)throw new Error('럭키 박스에서만 획득할 수 있는 한정 스킨입니다.');
  if(p.owned.includes(item.id))throw new Error('이미 보유한 상품입니다.');
  if(p.balance<item.price)throw new Error('코인이 부족합니다.');p.balance-=item.price;p.owned.push(item.id);break;
 }
 case 'equip':{const item=CATALOG.find(x=>x.id===action.id);if(!item||!p.owned.includes(item.id))throw new Error('보유하지 않은 상품입니다.');p.equipped[item.category]=item.id;break;}
 case 'claim':{const m=MISSIONS.find(x=>x.id===action.id);if(!m||p.rounds<m.target||p.claimed.includes(m.id))throw new Error('아직 받을 수 없는 보상입니다.');p.balance+=m.reward;p.claimed.push(m.id);break;}
 case 'box_open':{
  const box=BOXES.find(b=>b.id===action.boxId);if(!box)throw new Error('상자를 찾을 수 없습니다.');
  if(p.balance<box.price)throw new Error('코인이 부족합니다.');
  p.balance-=box.price;
  const prize=action.prize;
  if(prize.type==='coins'){
   p.balance+=prize.amount;
  }else if(prize.type==='skin'){
   if(!p.owned.includes(prize.skinId)){
    p.owned.push(prize.skinId);
   }
  }else if(prize.type==='title'){
   p.ownedTitles=p.ownedTitles||['티케의 손님'];
   if(!p.ownedTitles.includes(prize.title)){
    p.ownedTitles.push(prize.title);
   }
  }
  break;
 }
 case 'title_equip':{
  p.ownedTitles=p.ownedTitles||['티케의 손님'];
  if(!p.ownedTitles.includes(action.title)||!TITLES[action.title])throw new Error('보유하지 않은 칭호입니다.');
  p.title=action.title;break;
 }
 case 'relief':
  if(p.pending.length||p.balance>=100||now-p.lastRelief<6*60*60*1000)throw new Error('잔액 100코인 미만일 때 6시간마다 받을 수 있어요.');
  p.balance+=500;p.lastRelief=now;break;
 case 'sound':p.sound=!p.sound;break;
 case 'reset':if(p.pending.length)throw new Error('진행 중인 게임이 모두 끝난 뒤 초기화해 주세요.');return initialProfile();
 }
 if(!Number.isSafeInteger(p.balance)||p.balance<0)throw new Error('잔액 범위를 벗어났습니다.');
 return p;
}
const integer=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
export function validateProfile(raw:unknown, backup=false):Profile {
 if(!raw||typeof raw!=='object')throw new Error('올바른 저장 파일이 아닙니다.');
 const p=raw as Partial<Profile>;
 if(p.version!==1)throw new Error('지원하지 않는 저장 버전입니다.');
 if(!['balance','rounds','wagered','earned','lastRelief','savedAt'].every(k=>integer(p[k as keyof Profile]))||typeof p.sound!=='boolean'||!Number.isFinite(p.best)||p.best===undefined||p.best<0||p.best>1000)throw new Error('저장된 숫자가 올바르지 않습니다.');
 const rawOwned = Array.isArray(p.owned) ? [...p.owned] : [];
 if (!rawOwned.includes('rocket-classic')) rawOwned.push('rocket-classic');
 if (!rawOwned.includes('penguin-classic')) rawOwned.push('penguin-classic');
 const owned = rawOwned;
 if(!Array.isArray(owned)||owned.length>CATALOG.length||new Set(owned).size!==owned.length||!owned.every(id=>CATALOG.some(x=>x.id===id))||!['ball-coral','board-midnight','trail-none','rocket-classic','penguin-classic'].every(id=>owned.includes(id)))throw new Error('보유 상품 데이터가 올바르지 않습니다.');
 const equipped = p.equipped ? {...p.equipped} : {} as Record<Category,string>;
 if(!equipped.rocket) equipped.rocket = 'rocket-classic';
 if(!equipped.penguin) equipped.penguin = 'penguin-classic';
 if(!(['ball','board','trail','rocket','penguin'] as Category[]).every(c=>equipped&&owned.includes(equipped[c])&&CATALOG.some(x=>x.id===equipped[c]&&x.category===c)))throw new Error('장착 데이터가 올바르지 않습니다.');
 if(!Array.isArray(p.claimed)||new Set(p.claimed).size!==p.claimed.length||!p.claimed.every(id=>MISSIONS.some(m=>m.id===id&&(p.rounds??0)>=m.target)))throw new Error('미션 데이터가 올바르지 않습니다.');
 if(!Array.isArray(p.pending)||p.pending.length>5||!p.pending.every(b=>b&&typeof b.id==='string'&&b.id.length<100&&BETS.includes(b.bet)&&integer(b.created)&&(b.target===undefined||(typeof b.target==='number'&&b.target>=0&&b.target<=3)))||new Set(p.pending.map(b=>b.id)).size!==p.pending.length)throw new Error('진행 중인 게임 데이터가 올바르지 않습니다.');
 if(backup&&p.pending.length)throw new Error('진행 중인 게임이 포함된 백업은 불러올 수 없습니다.');
 if(!Array.isArray(p.results)||p.results.length>30||!p.results.every(r=>r&&typeof r.id==='string'&&r.id.length<100&&BETS.includes(r.bet)&&typeof r.multiplier==='number'&&Number.isFinite(r.multiplier)&&r.multiplier>=0&&r.multiplier<=1000&&(HISTORICAL_MULTIPLIERS.includes(r.multiplier)||(r.multiplier===0&&r.payout===0)||r.payout===Math.round(r.bet*r.multiplier))&&integer(r.time)))throw new Error('게임 기록이 올바르지 않습니다.');
 
 // Safely normalize title & ownedTitles (with backwards compatibility for older saves)
 const validOwnedTitles = Array.isArray(p.ownedTitles) && p.ownedTitles.length > 0 && p.ownedTitles.every(t => typeof t === 'string' && TITLES[t])
  ? Array.from(new Set(p.ownedTitles))
  : ['티케의 손님'];
 const validTitle = typeof p.title === 'string' && TITLES[p.title] && validOwnedTitles.includes(p.title)
  ? p.title
  : validOwnedTitles[0] || '티케의 손님';

 // Reconstruct known fields only; never merge arbitrary backup properties.
 return {version:1,balance:p.balance!,owned:[...owned],equipped:{ball:equipped.ball,board:equipped.board,trail:equipped.trail,rocket:equipped.rocket,penguin:equipped.penguin},title:validTitle,ownedTitles:validOwnedTitles,results:p.results.map(r=>({id:r.id,bet:r.bet,multiplier:r.multiplier,payout:r.payout,time:r.time})),pending:p.pending.map(b=>({id:b.id,bet:b.bet,created:b.created,target:b.target})),rounds:p.rounds!,wagered:p.wagered!,earned:p.earned!,best:p.best,claimed:[...p.claimed],lastRelief:p.lastRelief!,sound:p.sound,savedAt:p.savedAt!};
}
