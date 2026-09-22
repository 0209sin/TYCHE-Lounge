import {useCallback,useEffect,useRef,useState,type ReactNode} from 'react';
import {Award,ArrowDown,ArrowDownToLine,ArrowRight,ArrowUpFromLine,Check,ChevronRight,CircleHelp,Coins,Footprints,Frown,Gift,Grid2X2,HelpCircle,Info,Layers3,LoaderCircle,Lock,Minus,Package,Plus,Rocket,RotateCcw,Settings,ShieldCheck,ShoppingBag,Sparkles,Target,Trophy,Volume2,VolumeX,X} from 'lucide-react';
import {BETS,CATALOG,LABELS,MISSIONS,MULTIPLIERS,BOXES,TITLES,type Category,type Product,type LuckyBox,type BoxPrize} from './catalog';
import {initialProfile,validateProfile,type Action,type Profile} from './economy';
import {changeProfile,readProfile} from './storage';
import Plinko,{type PlinkoHandle} from './Plinko';
import Crash from './Crash';
import Race, { HORSES } from './Race';
import Penguin from './Penguin';
type Page='play'|'crash'|'race'|'penguin'|'games'|'shop'|'inventory'|'missions'|'settings';
const fmt=(n:number)=>n.toLocaleString('ko-KR');
const signed=(n:number)=>`${n>0?'+':''}${fmt(n)}`;
function Coin({amount,className=''}:{amount:number;className?:string}){return <span className={`coin ${className}`}><Coins size={16}/>{fmt(amount)}</span>;}
function Modal({title,children,onClose}:{title:string;children:ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close();},[]);
 return <dialog ref={ref} className="modal" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-title"><h2>{title}</h2><button className="icon-button" aria-label="닫기" onClick={onClose}><X size={20}/></button></div>{children}</dialog>;
}
function ProductArt({item}:{item:Product}){
 return <div className={`product-art ${item.category}`} style={{'--item-color':item.color} as React.CSSProperties}>
  {item.category==='board'?<div className="mini-board">{Array.from({length:15},(_,i)=><i key={i}/>)}</div>:item.category==='rocket'?<div className="mini-rocket" style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><Rocket size={50} style={{color:item.color,filter:`drop-shadow(0 0 14px ${item.color})`}}/></div>:item.category==='penguin'?<div className="mini-penguin" style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}><span style={{fontSize:48,lineHeight:1,filter:`drop-shadow(0 0 14px ${item.color})`}}>🐧</span></div>:<div className={`orb ${item.id==='trail-none'?'clean':''}`}/>}
 </div>;
}
function BoxArt({box}:{box:LuckyBox}){return <div className="box-art" style={{'--box-color':box.color,'--box-bg':box.bg,'--box-border':box.border} as React.CSSProperties}><div className="box-glow"/><div className="box-chest"><Package size={48} style={{color:box.color}}/></div></div>;}
export default function App(){
 const [p,setP]=useState<Profile>(initialProfile),[loaded,setLoaded]=useState(false),[writer,setWriter]=useState(false),[fatal,setFatal]=useState(''),[saveError,setSaveError]=useState('');
 const [page,setPage]=useState<Page>('play'),[bet,setBet]=useState(100),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[toast,setToast]=useState(''),[filter,setFilter]=useState<Category|'all'>('all');
 const [shopTab,setShopTab]=useState<'skins'|'boxes'>('skins'),[invTab,setInvTab]=useState<'skins'|'titles'>('skins');
 const [ratesBox,setRatesBox]=useState<LuckyBox|null>(null);
 const [unboxing,setUnboxing]=useState<{box:LuckyBox;prize:BoxPrize;isNewSkin?:boolean;phase:'opening'|'revealed'}|null>(null);
 const [modal,setModal]=useState<'help'|'reset'|'import'|Product|null>(null),[imported,setImported]=useState<Profile|null>(null),[resetText,setResetText]=useState('');
 const board=useRef<PlinkoHandle>(null),fileInput=useRef<HTMLInputElement>(null),activeWriter=useRef(false),profileRef=useRef(p),purchaseBusy=useRef(false),lastDrop=useRef(0),channel=useRef<BroadcastChannel|null>(null),audio=useRef<AudioContext|null>(null);
 const failedResults=useRef<Map<string,Action>>(new Map());const [failCount,setFailCount]=useState(0);profileRef.current=p;
 const notify=useCallback((s:string)=>setToast(s),[]);
 useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),3600);return()=>clearTimeout(timer);}},[toast]);
 useEffect(()=>{
  let disposed=false;const abort=new AbortController();let release:(()=>void)|undefined;
  const bc=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('orbit-save'):null;channel.current=bc;
  if(bc)bc.onmessage=()=>{void readProfile().then(s=>{if(!disposed)setP(s);}).catch(()=>{});};
  const init=async()=>{
   try{const value=await readProfile();if(disposed)return;setP(value);setLoaded(true);
    if(!navigator.locks){setFatal('이 브라우저에서는 안전한 저장을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari로 열어 주세요.');return;}
    void navigator.locks.request('orbit-active-session',{signal:abort.signal},async()=>{
     if(disposed)return;const hold=new Promise<void>(r=>{release=r;});
     try{const old=await readProfile();const saved=await changeProfile({type:'recover'});if(disposed)return;activeWriter.current=true;setWriter(true);setP(saved);bc?.postMessage('saved');if(old.pending.length)notify('이전 게임에서 미정산된 공의 금액을 돌려드렸어요.');await hold;}catch(e){if(!disposed)setFatal(String(e instanceof Error?e.message:e));}
    }).catch(e=>{if(!disposed&&e.name!=='AbortError')setFatal('게임 저장 잠금을 얻지 못했습니다. 다시 열어 주세요.');});
   }catch(e){if(!disposed)setFatal(e instanceof Error?e.message:'저장 데이터를 불러오지 못했습니다.');}
  };void init();return()=>{disposed=true;activeWriter.current=false;abort.abort();release?.();bc?.close();};
 },[notify]);
 const act=useCallback(async(action:Action|{type:'import';profile:Profile})=>{
  if(!activeWriter.current)throw new Error('게임을 실행 중인 다른 탭을 먼저 닫아 주세요.');
  try{const next=await changeProfile(action);setP(next);profileRef.current=next;setSaveError('');channel.current?.postMessage('saved');return next;}catch(e){const message=e instanceof Error?e.message:'변경을 저장하지 못했습니다.';if(message.includes('저장'))setSaveError(message);throw e;}
 },[]);
 const run=async(action:Action,message?:string)=>{try{await act(action);if(message)notify(message);}catch(e){notify((e as Error).message);}};
 const tone=()=>{if(!profileRef.current.sound)return;try{audio.current??=new AudioContext();void audio.current.resume();const ctx=audio.current,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(620,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(340,ctx.currentTime+.12);gain.gain.setValueAtTime(.045,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.15);osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.16);}catch{/* Audio is optional. */}};
 const finish=useCallback(async(action:Action,id:string)=>{
  try{await act(action);failedResults.current.delete(id);setFailCount(failedResults.current.size);if(action.type==='refund')notify('공의 이동을 완료하지 못해 구매 금액을 돌려드렸어요.');}
  catch{failedResults.current.set(id,action);setFailCount(failedResults.current.size);setSaveError('공의 결과를 저장하지 못했습니다. 정산 재시도를 눌러 주세요.');}
 },[act,notify]);
 const drop=async()=>{
  if(!ready||purchaseBusy.current||!writer||failCount||Date.now()-lastDrop.current<250)return;
  purchaseBusy.current=true;setBusy(true);lastDrop.current=Date.now();const id=crypto.randomUUID();
  try{await act({type:'drop',id,bet});tone();if(!board.current?.drop(id))await finish({type:'refund',id},id);}catch(e){notify((e as Error).message);}finally{purchaseBusy.current=false;setBusy(false);}
 };
 const handleOpenBox=async(box:LuckyBox)=>{
  if(!available||busy)return;
  if(p.balance<box.price){notify('코인이 부족합니다.');return;}
  setBusy(true);
  const randArr=new Uint32Array(1);
  crypto.getRandomValues(randArr);
  const roll=(randArr[0]/4294967296)*100;
  let cumulative=0;
  let prize=box.drops[box.drops.length-1].prize;
  for(const drop of box.drops){
   cumulative+=drop.rate;
   if(roll<cumulative){
    prize=drop.prize;
    break;
   }
  }
  const isNewSkin=prize.type==='skin'&&!p.owned.includes(prize.skinId);
  setUnboxing({box,prize,isNewSkin,phase:'opening'});
  try{
   await act({type:'box_open',boxId:box.id,prize});
   setTimeout(()=>{
    setUnboxing(prev=>prev?{...prev,phase:'revealed'}:null);
    setBusy(false);
   },1100);
  }catch(e){
   setUnboxing(null);
   setBusy(false);
   notify((e as Error).message);
  }
 };
 const go=(next:Page)=>{if(next!=='play'&&next!=='crash'&&next!=='race'&&next!=='penguin'&&profileRef.current.pending.length){notify('진행 중인 게임이 끝난 뒤 이동할 수 있어요.');return;}setPage(next);if(next==='shop'||next==='inventory')setFilter('all');};
 const exportSave=()=>{
  if(p.pending.length){notify('진행 중인 게임이 끝난 뒤 백업해 주세요.');return;}
  const blob=new Blob([JSON.stringify({app:'tyche-lounge',exportedAt:new Date().toISOString(),profile:p},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tyche-save-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('백업 파일을 다운로드했어요.');
 };
 const importFile=async(file?:File)=>{if(!file)return;try{if(file.size>100000)throw new Error('백업 파일이 너무 큽니다.');const raw=JSON.parse(await file.text());if(raw.app!=='orbit-arcade'&&raw.app!=='tyche-lounge')throw new Error('티케 라운지 백업 파일을 선택해 주세요.');const saved=validateProfile(raw.profile,true);setImported(saved);setModal('import');}catch(e){notify((e as Error).message);}finally{if(fileInput.current)fileInput.current.value='';}};
 // Read-only WebMCP capability; mutations always use the visible, confirmed UI.
 useEffect(()=>{
  const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;if(!context?.registerTool)return;const life=new AbortController();
  try{void Promise.resolve(context.registerTool({name:'read_arcade_save',title:'아케이드 저장 상태 읽기',description:'현재 기기의 잔액, 보유 상품, 장착 상태와 플레이 횟수를 읽습니다. 변경하지 않습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('빈 객체를 입력하세요.');const s=profileRef.current;return {balance:s.balance,owned:s.owned,equipped:s.equipped,rounds:s.rounds};}},{signal:life.signal})).catch(()=>{});}catch{/* Experimental API unavailable. */}return()=>life.abort();
 },[]);
 const nav=[{page:'play' as Page,label:'플링코',icon:Target,tag:'01'},{page:'crash' as Page,label:'로켓 크래시',icon:Rocket,tag:'02'},{page:'race' as Page,label:'네온 경마',icon:Trophy,tag:'03'},{page:'penguin' as Page,label:'펭귄 점프',icon:Footprints,tag:'04'},{page:'games' as Page,label:'게임 라운지',icon:Grid2X2},{page:'shop' as Page,label:'상점',icon:ShoppingBag},{page:'inventory' as Page,label:'보관함',icon:Package},{page:'missions' as Page,label:'미션',icon:Gift}];
 const available=loaded&&writer&&!fatal;const selected=CATALOG.find(x=>x.id===p.equipped.ball)!;const profit=p.earned-p.wagered;const canRelief=available&&p.balance<100&&!p.pending.length&&Date.now()-p.lastRelief>=21600000;
 const titles:Record<Page,[string,string]>={play:['플링코','작은 공 하나, 새로운 가능성.'],crash:['로켓 크래시','폭발하기 직전, 배율을 낚아채세요.'],race:['네온 경마','4마리의 질주, 1등마를 맞히면 3배 지급!'],penguin:['네온 펭귄 점프','7개의 얼음길, 언제 멈출지는 당신의 선택.'],games:['게임 라운지','오늘은 어떤 게임을 즐겨볼까요?'],shop:['상점 및 럭키 박스','모은 코인으로 스킨을 구매하거나 대박 상자를 열어보세요.'],inventory:['내 보관함','보유 중인 스킨과 칭호를 장착해 보세요.'],missions:['작은 목표, 확실한 보상','플레이를 쌓고 코인을 모으세요.'],settings:['설정과 저장','내 기기에 안전하게, 내 방식대로.']};
 return <div className="app-shell">
  <aside className="sidebar"><button className="brand" onClick={()=>go('play')} aria-label="티케 라운지 홈"><Sparkles size={29}/><span>TYCHE<span className="brand-sub">LOUNGE <span className="version-pill">v2.1</span></span></span></button><div className="nav-caption">GAMING LOUNGE</div><nav>{nav.map(n=><button key={n.page} className={`nav-link ${page===n.page?'active':''}`} onClick={()=>go(n.page)}><n.icon size={19}/><span>{n.label}</span>{n.tag&&<span className="tiny-tag">{n.tag}</span>}{n.page==='missions'&&MISSIONS.some(m=>p.rounds>=m.target&&!p.claimed.includes(m.id))&&<span className="notification-dot"/>}</button>)}</nav><div className="sidebar-bottom"><div className="local-card"><ShieldCheck size={19}/><span>티케 라운지 보관소<small>이 브라우저에 자동 저장</small></span></div><button className={`nav-link ${page==='settings'?'active':''}`} onClick={()=>go('settings')}><Settings size={19}/>설정과 저장</button><button className="nav-link" onClick={()=>setModal('help')}><CircleHelp size={19}/>플레이 가이드</button><div className="sidebar-foot">WHERE FORTUNE SMILES.<span>TYCHE LOUNGE © 2026</span></div></div></aside>
  <div className="workspace"><header className="topbar"><span className="breadcrumb">티케 라운지 <ChevronRight size={14}/><b>{titles[page][0]}</b></span><div className="topbar-right"><span className="topbar-version-badge">v2.1</span><span className={`save-indicator ${saveError?'error':''}`}><ShieldCheck size={14}/>{saveError?'저장 확인 필요':!loaded?'불러오는 중':writer?'기기에 저장됨':'다른 탭 사용 중'}</span><div className="wallet-pill"><span>내 코인</span><Coin amount={p.balance}/></div>{p.title&&<div className="topbar-title-badge" style={{color:TITLES[p.title]?.color||'#ffd15c',borderColor:TITLES[p.title]?.color||'#ffd15c'}}><Award size={13}/><span>{p.title}</span></div>}<button className="avatar" aria-label="설정 열기" onClick={()=>go('settings')}>T<span/></button></div></header>
  <main>
   {(fatal||saveError||(!writer&&loaded))&&<div className="notice" role="alert"><Info size={18}/><span>{fatal||saveError||'다른 탭에서 게임이 열려 있어요. 그 탭을 닫으면 여기서 이어 할 수 있습니다.'}</span>{failCount>0&&<button onClick={()=>{for(const[id,a]of failedResults.current)void finish(a,id);}}>정산 재시도</button>}</div>}
   <div className="page-heading"><div><span className="eyebrow">{page==='play'?'THE ORIGINAL DROP':page==='crash'?'EXPONENTIAL MULTIPLIER':page==='race'?'QUAD GLORY HORSE RACE':page==='penguin'?'ICE FLOE STEP HOP':'TYCHE GAMING LOUNGE'}</span><h1>{titles[page][0]}{page==='play'&&<span className="title-chip">PLINKO</span>}{page==='crash'&&<span className="title-chip">CRASH</span>}{page==='race'&&<span className="title-chip">HORSE RACE</span>}{page==='penguin'&&<span className="title-chip">PENGUIN JUMP</span>}</h1><p>{titles[page][1]}</p></div>{page==='play'?<button className="subtle-button" onClick={()=>setModal('help')}><CircleHelp size={16}/>게임 방법</button>:page==='shop'?<span className="section-note">모든 상품 및 칭호 영구 소장</span>:null}</div>
   {page==='play'&&<div className="play-layout"><section className="game-panel"><div className="game-toolbar"><span className="live-label"><span/>READY TO DROP</span><span className="toolbar-right"><span>10 ROWS</span><button className="icon-button" disabled={!available} onClick={()=>void run({type:'sound'})} aria-label={p.sound?'소리 끄기':'소리 켜기'}>{p.sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button></span></div><div className="board-wrap"><div className="board-watermark">LET IT<br/>DROP.</div><Plinko ref={board} profile={p} onReady={()=>setReady(true)} onError={()=>setFatal('게임 화면을 불러오지 못했습니다. 새로고침해 주세요.')} onResult={(id,slot)=>void finish({type:'settle',id,slot},id)} onRefund={id=>void finish({type:'refund',id},id)}/>{!ready&&<div className="board-loading"><LoaderCircle className="spin"/>보드를 준비하는 중</div>}</div><div className="board-legend"><span>도착한 칸의 배율만큼 돌려받아요</span><span>최대 <b>{Math.max(...MULTIPLIERS)}×</b></span></div><div className="play-controls"><div className="bet-block"><label>공 1개 가격</label><div className="bet-control"><button disabled={bet===BETS[0]} aria-label="공 가격 낮추기" onClick={()=>setBet(BETS[Math.max(0,BETS.indexOf(bet)-1)])}><Minus size={16}/></button><select aria-label="공 1개 가격 선택" value={bet} onChange={e=>setBet(Number(e.target.value))}>{BETS.map(b=><option key={b} value={b}>{fmt(b)} 코인</option>)}</select><button disabled={bet===BETS[BETS.length-1]} aria-label="공 가격 높이기" onClick={()=>setBet(BETS[Math.min(BETS.length-1,BETS.indexOf(bet)+1)])}><Plus size={16}/></button></div></div><div className="quick-bets">{[100,1000,5000,10000].map(b=><button key={b} className={bet===b?'selected':''} onClick={()=>setBet(b)}>{fmt(b)}</button>)}</div><button className="drop-button" onClick={()=>void drop()} disabled={!available||!ready||busy||p.balance<bet||p.pending.length>=5||failCount>0}><ArrowDown size={20}/>{p.balance<bet?'코인이 부족해요':'공 떨어뜨리기'}<span>{p.pending.length}/5</span></button></div><div className="under-controls"><span><ShieldCheck size={13}/>구매와 결과가 자동 저장됩니다</span><span>현재 공 <i style={{background:selected.color}}/>{selected.name}</span></div></section>
    <aside className="right-rail"><section className="balance-card"><span className="small-label">MY WALLET</span><h2><Coins size={26}/>{fmt(p.balance)}<small>코인</small></h2><div className="balance-divider"/><div className="stat-row"><span>누적 게임 손익</span><strong className={profit>=0?'positive':'negative'}>{signed(profit)}</strong></div><div className="stat-row"><span>플레이한 공</span><strong>{fmt(p.rounds)}<small> 개</small></strong></div><div className="stat-row"><span>최고 배율</span><strong>{p.best?p.best+'×':'—'}</strong></div>{p.balance<100&&<button className="relief-button" disabled={!canRelief} onClick={()=>void run({type:'relief'},'재기 지원금 500코인을 받았어요.')}><Gift size={16}/>재기 지원 +500{!canRelief&&<small>6시간 간격 · 공 정산 후</small>}</button>}</section>
     <section className="results-card"><div className="section-heading"><h3>최근 결과</h3><span>LAST 8</span></div>{p.results.length?<div className="results-list">{p.results.slice(0,8).map(r=><div className="result-row" key={r.id}><span className={`multiplier ${r.multiplier>=1?'win':''}`}>{r.multiplier}×</span><span><b>{fmt(r.payout)}</b><small>지급 코인</small></span><strong className={r.payout-r.bet>=0?'positive':'negative'}>{signed(r.payout-r.bet)}</strong></div>)}</div>:<div className="empty-results"><Layers3 size={28}/><p>첫 번째 공을 떨어뜨려 보세요</p><span>도착 배율과 손익이 여기에 쌓여요.</span></div>}</section>
     <button className="shop-teaser" onClick={()=>go('shop')}><span className="teaser-orb"/><span><small>MAKE IT YOURS</small><b>다음 공은, 다른 색으로.</b><span>스킨 둘러보기 <ArrowRight size={15}/></span></span></button>
    </aside></div>}
   {page==='crash'&&<Crash
     profile={p}
     available={available}
     onStart={async(id,betAmount)=>{await act({type:'crash_start',id,bet:betAmount});}}
     onCashout={async(id,multiplier,betAmount)=>{
       await act({type:'crash_cashout',id,multiplier});
       notify(`${multiplier.toFixed(2)}배 캐시아웃 성공! (+${fmt(Math.round(betAmount*multiplier))} 코인)`);
     }}
     onBust={async(id,crashPoint)=>{
       await act({type:'crash_bust',id,crashPoint});
       notify(`로켓이 ${crashPoint.toFixed(2)}배에서 폭발했어요.`);
     }}
     onError={msg=>notify(msg)}
   />}
   {page==='race'&&<Race
     profile={p}
     available={available}
     onStart={async(id,betAmount,horseIndex)=>{await act({type:'race_start',id,bet:betAmount,horseIndex});}}
     onSettle={async(id,winnerIndex,betAmount,chosenHorse)=>{
       await act({type:'race_settle',id,winnerIndex});
       if(winnerIndex===chosenHorse){
         notify(`축하합니다! ${HORSES[winnerIndex].num}번 ${HORSES[winnerIndex].name} 1위 적중! (+${fmt(betAmount*3)} 코인)`);
       }else{
         notify(`${HORSES[winnerIndex].num}번 ${HORSES[winnerIndex].name} 1위 골인. 아쉽게 빗나갔어요.`);
       }
     }}
     onError={msg=>notify(msg)}
   />}
   {page==='penguin'&&<Penguin
     profile={p}
     available={available}
     onStart={async(id,betAmount)=>{await act({type:'penguin_start',id,bet:betAmount});}}
     onCashout={async(id,multiplier,betAmount)=>{
       await act({type:'penguin_cashout',id,multiplier});
       notify(`탈출 성공! ${multiplier.toFixed(2)}배 캐시아웃 (+${fmt(Math.round(betAmount*multiplier))} 코인)`);
     }}
     onFall={async(id,betAmount)=>{
       await act({type:'penguin_fall',id});
       notify(`얼음이 깨져 펭귄이 물에 빠졌어요. (-${fmt(betAmount)} 코인)`);
     }}
     onError={msg=>notify(msg)}
   />}
   {page==='shop'&&<div className="shop-layout">
    <div className="shop-header-tabs">
     <button className={`shop-tab-btn ${shopTab==='skins'?'active':''}`} onClick={()=>setShopTab('skins')}><ShoppingBag size={18}/><span>스킨 상점</span></button>
     <button className={`shop-tab-btn ${shopTab==='boxes'?'active':''}`} onClick={()=>setShopTab('boxes')}><Gift size={18}/><span>🎁 럭키 박스 (뽑기)</span><span className="badge-new">NEW</span></button>
    </div>
    {shopTab==='skins'?(
     <>
      <div className="filter-bar"><div className="filters">{(['all','ball','board','trail','rocket','penguin'] as const).map(c=><button key={c} className={filter===c?'selected':''} onClick={()=>setFilter(c)}>{c==='all'?'전체':LABELS[c]}</button>)}</div><span>스킨은 게임 확률에 영향을 주지 않아요</span></div>
      <div className="product-grid">{CATALOG.filter(item=>(filter==='all'||item.category===filter)).map(item=>{const owned=p.owned.includes(item.id),equipped=p.equipped[item.category]===item.id;return <article className={`product-card ${item.boxOnly?'box-only-card':''}`} key={item.id}><span className="rarity">{item.rarity}</span>{item.boxOnly&&<span className="box-only-badge">🎁 {item.boxName}</span>}{equipped&&<span className="equipped-tag"><Check size={12}/>장착 중</span>}<ProductArt item={item}/><div className="product-info"><span>{LABELS[item.category]}</span><h3>{item.name}</h3><p>{item.description}</p><div className="product-bottom">{owned?<span className="owned-label"><Check size={14}/>보유 중</span>:item.boxOnly?<div className="not-for-sale-tag"><span className="nfs-badge">비매품</span><small>상자 뽑기 전용</small></div>:<Coin amount={item.price}/>}<button className={equipped?'equipped':owned?'purchase':item.boxOnly?'box-jump-btn':'purchase'} disabled={!available||equipped} onClick={()=>{if(owned){void run({type:'equip',id:item.id},`${item.name} 장착 완료`);}else if(item.boxOnly){setShopTab('boxes');}else{setModal(item);}}}>{equipped?'사용 중':owned?'장착하기':item.boxOnly?'상자 뽑기 ➔':'구매하기'}{!equipped&&!item.boxOnly&&<ArrowRight size={14}/>}</button></div></div></article>;})}</div>
     </>
    ):(
     <div className="lucky-box-shelf">
      <div className="lucky-box-banner">
       <Sparkles size={24} style={{color:'#ffd15c'}}/>
       <div>
        <h3>행운의 여신이 깃든 4대 미스터리 럭키 박스</h3>
        <p>코인 대박, 고급 스킨, 고유 칭호를 획득해 보세요! 모든 상자의 확률은 100% 투명하게 공개됩니다.</p>
       </div>
      </div>
      <div className="lucky-box-grid">
       {BOXES.map(box=>{
        const canAfford = p.balance >= box.price;
        return (
         <article className={`lucky-box-card ${box.tier}`} key={box.id} style={{'--b-color':box.color,'--b-bg':box.bg,'--b-border':box.border} as React.CSSProperties}>
          <div className="box-tier-chip">{box.tier.toUpperCase()}</div>
          <BoxArt box={box}/>
          <div className="box-card-content">
           <h3>{box.name}</h3>
           <p>{box.description}</p>
           <div className="box-feature-tags">
            <span>최대 3배 잭팟</span>
            <span>고급 스킨</span>
            <span>전용 칭호</span>
           </div>
           <div className="box-card-price">
            <span>개봉 비용</span>
            <Coin amount={box.price}/>
           </div>
           <div className="box-card-actions">
            <button className="box-rates-btn" onClick={()=>setRatesBox(box)}><HelpCircle size={15}/><span>확률 정보</span></button>
            <button className="box-open-btn" disabled={!available||busy||!canAfford} onClick={()=>handleOpenBox(box)}><Gift size={16}/><span>{canAfford?'상자 개봉하기':'코인 부족'}</span></button>
           </div>
          </div>
         </article>
        );
       })}
      </div>
     </div>
    )}
   </div>}
   {page==='inventory'&&<div className="inventory-layout">
    <div className="shop-header-tabs">
     <button className={`shop-tab-btn ${invTab==='skins'?'active':''}`} onClick={()=>setInvTab('skins')}><Package size={18}/><span>스킨 보관함 ({p.owned.length})</span></button>
     <button className={`shop-tab-btn ${invTab==='titles'?'active':''}`} onClick={()=>setInvTab('titles')}><Award size={18}/><span>칭호 보관함 ({p.ownedTitles.length}/15)</span></button>
    </div>
    {invTab==='skins'?(
     <>
      <div className="filter-bar"><div className="filters">{(['all','ball','board','trail','rocket','penguin'] as const).map(c=><button key={c} className={filter===c?'selected':''} onClick={()=>setFilter(c)}>{c==='all'?'전체':LABELS[c]}</button>)}</div><span>{p.owned.length}개 소장 중</span></div>
      <div className="product-grid">{CATALOG.filter(item=>(filter==='all'||item.category===filter)&&p.owned.includes(item.id)).map(item=>{const equipped=p.equipped[item.category]===item.id;return <article className={`product-card ${item.boxOnly?'box-only-card':''}`} key={item.id}><span className="rarity">{item.rarity}</span>{item.boxOnly&&<span className="box-only-badge">✨ 한정판</span>}{equipped&&<span className="equipped-tag"><Check size={12}/>장착 중</span>}<ProductArt item={item}/><div className="product-info"><span>{LABELS[item.category]}</span><h3>{item.name}</h3><p>{item.description}</p><div className="product-bottom"><span className="owned-label"><Check size={14}/>소장 중</span><button className={equipped?'equipped':'purchase'} disabled={!available||equipped} onClick={()=>void run({type:'equip',id:item.id},`${item.name} 장착 완료`)}>{equipped?'사용 중':'장착하기'}{!equipped&&<ArrowRight size={14}/>}</button></div></div></article>;})}</div>
     </>
    ):(
     <div className="titles-shelf">
      <div className="titles-summary-bar">
       <span>현재 장착 중인 칭호: <b style={{color:TITLES[p.title]?.color||'#ffd15c'}}>[{p.title}]</b></span>
       <span>수집률: <b>{p.ownedTitles.length} / 15</b> ({Math.round(p.ownedTitles.length/15*100)}%)</span>
      </div>
      <div className="titles-grid">
       {Object.values(TITLES).map(t=>{
        const isOwned = p.ownedTitles.includes(t.name);
        const isEquipped = p.title === t.name;
        return (
         <article className={`title-card ${t.tier} ${isOwned?'owned':'locked'}`} key={t.id} style={{'--t-color':t.color} as React.CSSProperties}>
          <div className="title-card-top">
           <span className="title-tier-badge">{t.tier.toUpperCase()}</span>
           {isEquipped ? <span className="equipped-tag"><Check size={12}/>장착 중</span> : isOwned ? <span className="owned-tag">보유</span> : <span className="locked-tag"><Lock size={12}/>미보유</span>}
          </div>
          <h3 style={{color:isOwned?t.color:'#647087'}}>{t.name}</h3>
          <p>{t.desc}</p>
          <div className="title-card-bottom">
           {isOwned ? (
            <button className={isEquipped?'equipped':'primary-button'} disabled={!available||isEquipped} onClick={()=>void run({type:'title_equip',title:t.name},`[${t.name}] 칭호 장착 완료`)}>
             {isEquipped?'장착 중':'칭호 장착하기'}
            </button>
           ) : (
            <span className="how-to-get">{t.tier==='silver'?'실버':t.tier==='gold'?'골드':t.tier==='platinum'?'플래티넘':'다이아'} 상자에서 획득</span>
           )}
          </div>
         </article>
        );
       })}
      </div>
     </div>
    )}
   </div>}
   {page==='games'&&<div className="game-grid"><button className="lounge-card available" onClick={()=>go('play')}><span className="eyebrow">01 / AVAILABLE NOW</span><Target size={80}/><h2>플링코</h2><p>공 하나에 담긴 작은 반전.</p><span className="lounge-action">지금 플레이<ArrowRight size={19}/></span></button><button className="lounge-card available" onClick={()=>go('crash')}><span className="eyebrow">02 / AVAILABLE NOW</span><Rocket size={80}/><h2>로켓 크래시</h2><p>폭발 직전의 스릴, 배율 탈출 게임.</p><span className="lounge-action">지금 플레이<ArrowRight size={19}/></span></button><button className="lounge-card available" onClick={()=>go('race')}><span className="eyebrow">03 / AVAILABLE NOW</span><Trophy size={80}/><h2>네온 경마</h2><p>4마리의 질주, 1등마 적중 시 3배 지급!</p><span className="lounge-action">지금 플레이<ArrowRight size={19}/></span></button><button className="lounge-card available" onClick={()=>go('penguin')}><span className="eyebrow">04 / AVAILABLE NOW</span><Footprints size={80}/><h2>펭귄 점프</h2><p>위태로운 얼음 디딤돌, 최대 50배 대탈출!</p><span className="lounge-action">지금 플레이<ArrowRight size={19}/></span></button>{[{n:'05',title:'홀짝',desc:'단순한 선택, 짧은 승부.',icon:'½'},{n:'06',title:'섯다',desc:'두 장의 카드로 만나는 긴장감.',icon:'花'}].map(g=><article className="lounge-card upcoming" key={g.n}><span className="eyebrow">{g.n} / COMING LATER</span><div className="game-symbol">{g.icon}</div><h2>{g.title}</h2><p>{g.desc}</p><span className="coming-chip">추후 추가 예정</span></article>)}</div>}
   {page==='missions'&&<><div className="mission-intro"><Gift size={28}/><div><h2>운과 상관없이, 플레이한 만큼.</h2><p>각 미션 보상은 한 번 받을 수 있어요. 구매한 스킨은 계속 남습니다.</p></div><span>{fmt(p.rounds)}<small>누적 플레이</small></span></div><div className="mission-grid">{MISSIONS.map(m=>{const claimed=p.claimed.includes(m.id),done=p.rounds>=m.target;return <article className="mission-card" key={m.id}><div className="mission-icon"><Target size={25}/></div><h3>{m.name}</h3><p>{m.description}</p><div className="progress-track"><div style={{width:`${Math.min(100,p.rounds/m.target*100)}%`}}/></div><div className="progress-label">{Math.min(p.rounds,m.target)} / {m.target}<Coin amount={m.reward}/></div><button className="primary-button" disabled={!available||!done||claimed} onClick={()=>void run({type:'claim',id:m.id},`${fmt(m.reward)}코인을 받았어요.`)}>{claimed?'보상 받기 완료':done?'보상 받기':'플레이하고 달성하기'}</button></article>;})}</div></>}
   {page==='settings'&&<div className="settings-layout"><section className="settings-card"><div className="section-heading"><h2>저장 데이터</h2><ShieldCheck size={21}/></div><p>코인과 컬렉션은 이 기기의 현재 브라우저에 저장됩니다. 다른 기기로 옮기거나 사이트 데이터를 지우기 전에 백업해 주세요.</p><div className="save-summary"><span>내 코인<b>{fmt(p.balance)}</b></span><span>보유 상품<b>{p.owned.length}개</b></span><span>보유 칭호<b>{p.ownedTitles.length} / 15</b></span><span>플레이<b>{p.rounds}회</b></span></div><div className="settings-buttons"><button className="secondary-button" disabled={!loaded||!!p.pending.length} onClick={exportSave}><ArrowDownToLine size={18}/>백업 내보내기</button><button className="secondary-button" disabled={!available||!!p.pending.length} onClick={()=>fileInput.current?.click()}><ArrowUpFromLine size={18}/>백업 가져오기</button></div><input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e=>void importFile(e.target.files?.[0])}/><div className="storage-note"><Info size={17}/><span><b>캐시 삭제와 사이트 데이터 삭제는 달라요.</b>이미지·파일 캐시만 삭제하면 보통 유지됩니다. 쿠키 및 사이트 데이터를 삭제하면 저장한 코인과 스킨도 삭제됩니다. 백업이 없으면 복구할 수 없습니다.</span></div></section><section className="settings-card"><h2>플레이 설정</h2><div className="setting-row"><div><b>게임 소리</b><p>공을 떨어뜨릴 때 짧은 효과음</p></div><button className={`toggle ${p.sound?'on':''}`} role="switch" aria-checked={p.sound} aria-label="게임 소리" disabled={!available} onClick={()=>void run({type:'sound'})}><span/></button></div><div className="setting-row"><div><b>재기 지원금</b><p>잔액 100 미만 · 6시간마다 500코인<br/>스킨과 업적을 유지합니다.</p></div><button className="secondary-button" disabled={!canRelief} onClick={()=>void run({type:'relief'},'500코인을 받았어요.')}>지원받기</button></div></section><section className="settings-card danger-card"><div><h2>처음부터 다시 시작</h2><p>코인, 구매한 스킨, 미션, 기록을 모두 지우고 10,000코인으로 시작합니다.</p></div><button className="danger-button" disabled={!available||!!p.pending.length} onClick={()=>{setResetText('');setModal('reset');}}><RotateCcw size={17}/>전체 초기화</button></section></div>}
   <footer className="main-footer"><span><Sparkles size={14}/>행운과 기회가 머무는 곳, 티케 라운지.</span><span>가상 코인 전용 · 현금 결제 및 환전 없음</span></footer>
  </main></div>
  {toast&&<div role="status" className="toast"><Info size={18}/>{toast}</div>}
  {modal&&<Modal title={typeof modal==='object'?modal.name:modal==='help'?'플링코 플레이 가이드':modal==='reset'?'정말 처음부터 시작할까요?':'백업을 복원할까요?'} onClose={()=>{if(!busy)setModal(null);}}>
   {typeof modal==='object'?modal.boxOnly?<><ProductArt item={modal}/><p>{modal.description}</p><div className="not-for-sale-tag" style={{margin:'20px 0',alignItems:'center',textAlign:'center'}}><span className="nfs-badge">비매품 (럭키 박스 전용)</span><small style={{fontSize:'13px',marginTop:'6px'}}>{modal.boxName} 뽑기를 통해서만 획득할 수 있는 스킨입니다.</small></div><button className="primary-button full-width" onClick={()=>{setModal(null);setShopTab('boxes');}}>🎁 럭키 박스로 이동하기</button></>:<><ProductArt item={modal}/><p>{modal.description} 구매 후 보관함에서 장착할 수 있어요. 성능과 당첨 확률은 바뀌지 않습니다.</p><div className="modal-total"><span>구매 가격</span><Coin amount={modal.price}/></div><div className="modal-total"><span>구매 후 잔액</span><b>{fmt(Math.max(0,p.balance-modal.price))} 코인</b></div><button className="primary-button full-width" disabled={busy||p.balance<modal.price||!available} onClick={async()=>{setBusy(true);try{await act({type:'buy',id:modal.id});notify(`${modal.name} 구매 완료! 보관함에서 장착해 보세요.`);setModal(null);}catch(e){notify((e as Error).message);}finally{setBusy(false);}}}>{p.balance<modal.price?'코인이 부족해요':'구매 확정'}</button></>:modal==='help'?<div className="help-content"><div><b>01. 공 가격을 고르세요</b><p>10~10,000코인 중 선택합니다. 금액 목록에서 바로 고르거나 빠른 선택 버튼을 사용할 수 있어요. 공을 떨어뜨리면 선택한 가격이 차감됩니다.</p></div><div><b>02. 어디에 떨어지는지 지켜보세요</b><p>실제 물리 충돌로 도착 칸을 결정합니다. 공은 동시에 5개까지 떨어뜨릴 수 있어요.</p></div><div><b>03. 배율만큼 돌려받으세요</b><p>100코인으로 2배에 도착하면 200코인 지급, 순이익은 100코인입니다. 0.5배는 50코인 지급, 손실은 50코인입니다.</p></div><div className="storage-note"><Info size={18}/><span>배율은 지급액 기준입니다. 칸별 확률은 동일하지 않으며 수익을 보장하지 않습니다. 이동 오류가 발생한 공은 구매 금액을 환불합니다.</span></div></div>:modal==='reset'?<><p>현재 <b>{fmt(p.balance)}코인</b>, 보유 상품 <b>{p.owned.length}개</b>와 모든 플레이 기록이 삭제됩니다. 백업 파일이 없다면 되돌릴 수 없습니다.</p><button className="secondary-button full-width" onClick={exportSave}><ArrowDownToLine size={17}/>초기화 전에 백업 다운로드</button><label className="reset-label">계속하려면 ‘초기화’를 입력하세요<input autoComplete="off" value={resetText} onChange={e=>setResetText(e.target.value)} placeholder="초기화"/></label><button className="danger-button full-width" disabled={resetText!=='초기화'||busy} onClick={async()=>{setBusy(true);try{await act({type:'reset'});setModal(null);notify('새로운 아케이드가 시작됐어요. 10,000코인을 받았습니다.');}catch(e){notify((e as Error).message);}finally{setBusy(false);}}}>모두 지우고 새로 시작</button></>:<><p>현재 저장을 백업 파일의 상태로 교체합니다. 현재 진행 상황은 덮어씁니다.</p><div className="modal-total"><span>복원할 코인</span><Coin amount={imported?.balance??0}/></div><div className="modal-total"><span>복원할 보유 상품</span><b>{imported?.owned.length}개</b></div><button className="secondary-button full-width" onClick={exportSave}>현재 데이터 먼저 백업</button><button className="primary-button full-width" disabled={busy||!imported} onClick={async()=>{if(!imported)return;setBusy(true);try{await act({type:'import',profile:imported});setModal(null);notify('백업을 복원했어요.');}catch(e){notify((e as Error).message);}finally{setBusy(false);}}}>이 백업으로 복원</button></>}
  </Modal>}
  {ratesBox&&<Modal title={`${ratesBox.name} 확률 정보 안내`} onClose={()=>setRatesBox(null)}>
   <div className="rates-modal-body">
    <div className="rates-info-banner">
     <Info size={18} style={{color:ratesBox.color}}/>
     <span>티케 라운지는 조작 없는 100% 투명한 확률 공개 원칙을 준수합니다. 중복 스킨 획득 시 별도의 대체 환급 코인은 지급되지 않는 순수 운빨 시스템입니다.</span>
    </div>
    <div className="rates-table-wrap">
     <table className="rates-table">
      <thead>
       <tr>
        <th>종류</th>
        <th>아이템 명칭</th>
        <th>확률</th>
        <th>중복 / 비고</th>
       </tr>
      </thead>
      <tbody>
       {ratesBox.drops.map((d,idx)=>(
        <tr key={idx}>
         <td>
          <span className={`drop-type-tag ${d.prize.type}`}>
           {d.prize.type==='coins'?'코인':d.prize.type==='skin'?'스킨':d.prize.type==='title'?'칭호':'꽝'}
          </span>
         </td>
         <td className="drop-name-cell">{d.prize.name}</td>
         <td className="drop-rate-cell"><b>{d.rate.toFixed(2)}%</b></td>
         <td className="drop-sub-cell">
          {d.prize.type==='skin'?'중복 획득 시 환급 없음':d.prize.type==='dud'?'보상 없음 (0 코인)':d.prize.type==='coins'?'코인 즉시 적립':'영구 소장'}
         </td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>
    <div className="rates-summary-foot">
     <span>확률 합계: <b>100.00%</b></span>
     <button className="secondary-button" onClick={()=>setRatesBox(null)}>닫기</button>
    </div>
   </div>
  </Modal>}
  {unboxing&&<Modal title={unboxing.phase==='opening'?'럭키 박스 개봉 중...':'🎉 개봉 결과!'} onClose={()=>{if(!busy)setUnboxing(null);}}>
   <div className="unboxing-modal-body">
    {unboxing.phase==='opening'?(
     <div className="unboxing-animation-area">
      <div className="unboxing-chest-anim" style={{'--box-color':unboxing.box.color} as React.CSSProperties}>
       <Package size={72} style={{color:unboxing.box.color}} className="shake-anim"/>
      </div>
      <h3>{unboxing.box.name} 개봉 중...</h3>
      <p>과연 어떤 행운이 들어있을까요?</p>
     </div>
    ):(
     <div className="unboxing-result-area">
      {unboxing.prize.type==='dud'&&(
       <div className="result-prize-box dud-prize">
        <div className="prize-icon-circle dud-circle"><Frown size={54} style={{color:'#ff7878'}}/></div>
        <span className="prize-tier-text dud-tag">아쉬운 꽝!</span>
        <h2 style={{color:'#ff7878'}}>💨 빈 상자였습니다...</h2>
        <p>{unboxing.prize.message}</p>
        <button className="secondary-button full-width" onClick={()=>setUnboxing(null)}>다음 기회에...</button>
       </div>
      )}
      {unboxing.prize.type==='coins'&&(
       <div className="result-prize-box coins-prize">
        <div className="prize-icon-circle"><Coins size={54} style={{color:'#ffd15c'}}/></div>
        <span className="prize-tier-text">COINS REWARD</span>
        <h2>+{fmt(unboxing.prize.amount)} 코인</h2>
        <p>{unboxing.prize.name}</p>
        <div className="modal-total"><span>적립 후 잔액</span><Coin amount={p.balance}/></div>
        <button className="primary-button full-width" onClick={()=>setUnboxing(null)}>확인</button>
       </div>
      )}
      {unboxing.prize.type==='skin'&&(
       <div className="result-prize-box skin-prize">
        {unboxing.isNewSkin?(
         <>
          <span className="prize-tier-text new-tag">✨ NEW SKIN 획득!</span>
          <h2>{unboxing.prize.name}</h2>
          <div className="prize-skin-preview">
           {(()=>{
            const it = CATALOG.find(x=>x.id===(unboxing.prize as {skinId:string}).skinId);
            return it ? <ProductArt item={it}/> : null;
           })()}
          </div>
          <p>새로운 스킨을 획득했습니다! 지금 바로 장착하시겠습니까?</p>
          <div className="prize-actions-row">
           <button className="secondary-button" onClick={()=>setUnboxing(null)}>보관함에 보관</button>
           <button className="primary-button" onClick={async()=>{
            await act({type:'equip',id:(unboxing.prize as {skinId:string}).skinId});
            notify(`${unboxing.prize.name} 장착 완료!`);
            setUnboxing(null);
           }}>지금 장착하기</button>
          </div>
         </>
        ):(
         <>
          <span className="prize-tier-text dup-tag">중복 스킨 획득</span>
          <h2>{unboxing.prize.name}</h2>
          <div className="prize-skin-preview">
           {(()=>{
            const it = CATALOG.find(x=>x.id===(unboxing.prize as {skinId:string}).skinId);
            return it ? <ProductArt item={it}/> : null;
           })()}
          </div>
          <p className="dup-notice">이미 보유 중인 스킨입니다. 별도 환급 없이 소장 상태가 유지됩니다. 아쉽지만 다음 기회에!</p>
          <button className="secondary-button full-width" onClick={()=>setUnboxing(null)}>확인</button>
         </>
        )}
       </div>
      )}
      {unboxing.prize.type==='title'&&(
       <div className="result-prize-box title-prize">
        <div className="prize-icon-circle"><Award size={50} style={{color:TITLES[unboxing.prize.title]?.color||'#ffd15c'}}/></div>
        <span className="prize-tier-text">TITLE UNLOCKED</span>
        <h2 style={{color:TITLES[unboxing.prize.title]?.color||'#ffd15c'}}>[{unboxing.prize.title}]</h2>
        <p>{TITLES[unboxing.prize.title]?.desc||'새로운 명예의 칭호를 획득했습니다.'}</p>
        <div className="prize-actions-row">
         <button className="secondary-button" onClick={()=>setUnboxing(null)}>확인</button>
         <button className="primary-button" onClick={async()=>{
          await act({type:'title_equip',title:(unboxing.prize as {title:string}).title});
          notify(`[${(unboxing.prize as {title:string}).title}] 칭호 장착 완료!`);
          setUnboxing(null);
         }}>칭호 즉시 장착</button>
        </div>
       </div>
      )}
     </div>
    )}
   </div>
  </Modal>}
 </div>;
}

