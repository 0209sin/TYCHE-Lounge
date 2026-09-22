import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Award,
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleHelp,
  Coins,
  Footprints,
  Frown,
  Gift,
  Grid2X2,
  Info,
  Layers3,
  LoaderCircle,
  Minus,
  Package,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Flame,
  Medal,
  CheckCircle2,
} from 'lucide-react';
import {
  BETS,
  CATALOG,
  LABELS,
  MULTIPLIERS,
  BOXES,
  TITLES,
  DAILY_QUESTS,
  WEEKLY_QUESTS,
  ACHIEVEMENTS,
  type Category,
  type Product,
  type LuckyBox,
  type BoxPrize,
  type WheelSlot,
} from './catalog';
import { initialProfile, validateProfile, getDayKey, type Action, type Profile } from './economy';
import { changeProfile, readProfile } from './storage';
import Plinko, { type PlinkoHandle } from './Plinko';
import Crash from './Crash';
import Race from './Race';
import Penguin from './Penguin';
import DailyWheel from './DailyWheel';
import { TermsModal, PrivacyModal, AboutModal, type LegalModalType } from './LegalModals';

type Page = 'play' | 'crash' | 'race' | 'penguin' | 'games' | 'shop' | 'inventory' | 'missions' | 'settings';
const fmt = (n: number) => n.toLocaleString('ko-KR');
const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

function Coin({ amount, className = '' }: { amount: number; className?: string }) {
  return (
    <span className={`coin ${className}`}>
      <Coins size={16} />
      {fmt(amount)}
    </span>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-title">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="닫기" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function ProductArt({ item }: { item: Product }) {
  return (
    <div className={`product-art ${item.category}`} style={{ '--item-color': item.color } as React.CSSProperties}>
      {item.category === 'board' ? (
        <div className="mini-board">
          {Array.from({ length: 15 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      ) : item.category === 'rocket' ? (
        <div className="mini-rocket" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Rocket size={50} style={{ color: item.color, filter: `drop-shadow(0 0 14px ${item.color})` }} />
        </div>
      ) : item.category === 'penguin' ? (
        <div className="mini-penguin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <span style={{ fontSize: 48, lineHeight: 1, filter: `drop-shadow(0 0 14px ${item.color})` }}>🐧</span>
        </div>
      ) : (
        <div className={`orb ${item.id === 'trail-none' ? 'clean' : ''}`} />
      )}
    </div>
  );
}

function BoxArt({ box }: { box: LuckyBox }) {
  return (
    <div
      className="box-art"
      style={{ '--box-color': box.color, '--box-bg': box.bg, '--box-border': box.border } as React.CSSProperties}
    >
      <div className="box-glow" />
      <div className="box-chest">
        <Package size={48} style={{ color: box.color }} />
      </div>
    </div>
  );
}

export default function App() {
  const [p, setP] = useState<Profile>(initialProfile);
  const [loaded, setLoaded] = useState(false);
  const [writer, setWriter] = useState(false);
  const [fatal, setFatal] = useState('');
  const [saveError, setSaveError] = useState('');

  const [page, setPage] = useState<Page>('play');
  const [bet, setBet] = useState(100);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState<Category | 'all'>('all');

  const [shopTab, setShopTab] = useState<'skins' | 'boxes'>('skins');
  const [invTab, setInvTab] = useState<'skins' | 'titles'>('skins');
  const [questTab, setQuestTab] = useState<'wheel' | 'daily' | 'weekly' | 'achievements'>('wheel');

  const [ratesBox, setRatesBox] = useState<LuckyBox | null>(null);
  const [unboxing, setUnboxing] = useState<{
    box: LuckyBox;
    prize: BoxPrize;
    isNewSkin?: boolean;
    phase: 'opening' | 'revealed';
  } | null>(null);
  const [wheelPrizeModal, setWheelPrizeModal] = useState<WheelSlot | null>(null);
  const [legalModal, setLegalModal] = useState<LegalModalType>(null);

  const [modal, setModal] = useState<'help' | 'reset' | 'import' | Product | null>(null);
  const [imported, setImported] = useState<Profile | null>(null);
  const [resetText, setResetText] = useState('');

  const board = useRef<PlinkoHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const activeWriter = useRef(false);
  const profileRef = useRef(p);
  const purchaseBusy = useRef(false);
  const lastDrop = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const audio = useRef<AudioContext | null>(null);

  const failedResults = useRef<Map<string, Action>>(new Map());
  const [failCount, setFailCount] = useState(0);
  profileRef.current = p;

  const notify = useCallback((s: string) => setToast(s), []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 3600);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    let release: (() => void) | undefined;
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('orbit-save') : null;
    channel.current = bc;
    if (bc) {
      bc.onmessage = () => {
        void readProfile()
          .then(s => {
            if (!disposed) setP(s);
          })
          .catch(() => {});
      };
    }
    const init = async () => {
      try {
        const value = await readProfile();
        if (disposed) return;
        setP(value);
        setLoaded(true);
        if (!navigator.locks) {
          setFatal('이 브라우저에서는 안전한 저장을 지원하지 않습니다. 최신 Chrome, Edge 또는 Safari로 열어 주세요.');
          return;
        }
        void navigator.locks
          .request('orbit-active-session', { signal: abort.signal }, async () => {
            if (disposed) return;
            const hold = new Promise<void>(r => {
              release = r;
            });
            try {
              const old = await readProfile();
              const saved = await changeProfile({ type: 'recover' });
              if (disposed) return;
              activeWriter.current = true;
              setWriter(true);
              setP(saved);
              bc?.postMessage('saved');
              if (old.pending.length) notify('이전 게임에서 미정산된 공의 금액을 돌려드렸어요.');
              await hold;
            } catch (e) {
              if (!disposed) setFatal(String(e instanceof Error ? e.message : e));
            }
          })
          .catch(e => {
            if (!disposed && e.name !== 'AbortError') setFatal('게임 저장 잠금을 얻지 못했습니다. 다시 열어 주세요.');
          });
      } catch (e) {
        if (!disposed) setFatal(e instanceof Error ? e.message : '저장 데이터를 불러오지 못했습니다.');
      }
    };
    void init();
    return () => {
      disposed = true;
      activeWriter.current = false;
      abort.abort();
      release?.();
      bc?.close();
    };
  }, [notify]);

  const act = useCallback(async (action: Action | { type: 'import'; profile: Profile }) => {
    if (!activeWriter.current) throw new Error('게임을 실행 중인 다른 탭을 먼저 닫아 주세요.');
    try {
      const next = await changeProfile(action);
      setP(next);
      profileRef.current = next;
      setSaveError('');
      channel.current?.postMessage('saved');
      return next;
    } catch (e) {
      const message = e instanceof Error ? e.message : '변경을 저장하지 못했습니다.';
      if (message.includes('저장')) setSaveError(message);
      throw e;
    }
  }, []);

  const run = async (action: Action, message?: string) => {
    try {
      await act(action);
      if (message) notify(message);
    } catch (e) {
      notify((e as Error).message);
    }
  };

  const tone = () => {
    if (!profileRef.current.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const ctx = audio.current,
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);
    } catch {
      /* Audio is optional. */
    }
  };

  const finish = useCallback(
    async (action: Action, id: string) => {
      try {
        await act(action);
        failedResults.current.delete(id);
        setFailCount(failedResults.current.size);
        if (action.type === 'refund') notify('공의 이동을 완료하지 못해 구매 금액을 돌려드렸어요.');
      } catch {
        failedResults.current.set(id, action);
        setFailCount(failedResults.current.size);
        setSaveError('공의 결과를 저장하지 못했습니다. 정산 재시도를 눌러 주세요.');
      }
    },
    [act, notify]
  );

  const drop = async () => {
    if (!ready || purchaseBusy.current || !writer || failCount || Date.now() - lastDrop.current < 250) return;
    purchaseBusy.current = true;
    setBusy(true);
    lastDrop.current = Date.now();
    const id = crypto.randomUUID();
    try {
      await act({ type: 'drop', id, bet });
      tone();
      if (!board.current?.drop(id)) await finish({ type: 'refund', id }, id);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      purchaseBusy.current = false;
      setBusy(false);
    }
  };

  const handleOpenBox = async (box: LuckyBox) => {
    if (!available || busy) return;
    if (p.balance < box.price) {
      notify('코인이 부족합니다.');
      return;
    }
    setBusy(true);
    const randArr = new Uint32Array(1);
    crypto.getRandomValues(randArr);
    const roll = (randArr[0] / 4294967296) * 100;
    let cumulative = 0;
    let prize = box.drops[box.drops.length - 1].prize;
    for (const drop of box.drops) {
      cumulative += drop.rate;
      if (roll < cumulative) {
        prize = drop.prize;
        break;
      }
    }
    const isNewSkin = prize.type === 'skin' && !p.owned.includes(prize.skinId);
    setUnboxing({ box, prize, isNewSkin, phase: 'opening' });
    try {
      await act({ type: 'box_open', boxId: box.id, prize });
      setTimeout(() => {
        setUnboxing(prev => (prev ? { ...prev, phase: 'revealed' } : null));
        setBusy(false);
      }, 1100);
    } catch (e) {
      setUnboxing(null);
      setBusy(false);
      notify((e as Error).message);
    }
  };

  const go = (next: Page) => {
    if (next !== 'play' && next !== 'crash' && next !== 'race' && next !== 'penguin' && profileRef.current.pending.length) {
      notify('진행 중인 게임이 끝난 뒤 이동할 수 있어요.');
      return;
    }
    setPage(next);
    if (next === 'shop' || next === 'inventory') setFilter('all');
  };

  const exportSave = () => {
    if (p.pending.length) {
      notify('진행 중인 게임이 끝난 뒤 백업해 주세요.');
      return;
    }
    const blob = new Blob(
      [JSON.stringify({ app: 'tyche-lounge', exportedAt: new Date().toISOString(), profile: p }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `tyche-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('백업 파일을 다운로드했어요.');
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error('백업 파일이 너무 큽니다.');
      const raw = JSON.parse(await file.text());
      if (raw.app !== 'orbit-arcade' && raw.app !== 'tyche-lounge') {
        throw new Error('티케 라운지 백업 파일을 선택해 주세요.');
      }
      const saved = validateProfile(raw.profile, true);
      setImported(saved);
      setModal('import');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const today = getDayKey();
  const checkedInToday = !!p.lastAttendance && getDayKey(p.lastAttendance) === today;
  const wheelReady = !p.lastWheelSpin || Date.now() - p.lastWheelSpin >= 24 * 60 * 60 * 1000;

  const nav = [
    { page: 'play' as Page, label: '플링코', icon: Target, tag: '01' },
    { page: 'crash' as Page, label: '로켓 크래시', icon: Rocket, tag: '02' },
    { page: 'race' as Page, label: '네온 경마', icon: Trophy, tag: '03' },
    { page: 'penguin' as Page, label: '펭귄 점프', icon: Footprints, tag: '04' },
    { page: 'games' as Page, label: '게임 라운지', icon: Grid2X2 },
    { page: 'shop' as Page, label: '상점', icon: ShoppingBag },
    { page: 'inventory' as Page, label: '보관함', icon: Package },
    { page: 'missions' as Page, label: '퀘스트 & 룰렛', icon: Gift, hasNotice: wheelReady || !checkedInToday },
  ];

  const available = loaded && writer && !fatal;
  const selected = CATALOG.find(x => x.id === p.equipped.ball)!;
  const profit = p.earned - p.wagered;
  const canRelief = available && p.balance < 100 && !p.pending.length && Date.now() - p.lastRelief >= 21600000;

  const titles: Record<Page, [string, string]> = {
    play: ['플링코', '작은 공 하나, 새로운 가능성.'],
    crash: ['로켓 크래시', '폭발하기 직전, 배율을 낚아채세요.'],
    race: ['네온 경마', '4마리의 질주, 1등마를 맞히면 3배 지급!'],
    penguin: ['네온 펭귄 점프', '7개의 얼음길, 언제 멈출지는 당신의 선택.'],
    games: ['게임 라운지', '오늘은 어떤 게임을 즐겨볼까요?'],
    shop: ['상점 및 럭키 박스', '모은 코인으로 스킨을 구매하거나 대박 상자를 열어보세요.'],
    inventory: ['내 보관함', '보유 중인 스킨과 칭호를 장착해 보세요.'],
    missions: ['퀘스트 & 행운 룰렛', '매일 출석, 일퀘, 주간퀘, 업적으로 끝없이 코인을 모으세요.'],
    settings: ['설정과 저장', '내 기기에 안전하게, 내 방식대로.'],
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go('play')} aria-label="티케 라운지 홈">
          <Sparkles size={29} />
          <span>
            TYCHE<span className="brand-sub">LOUNGE <span className="version-pill">v2.2</span></span>
          </span>
        </button>
        <div className="nav-caption">GAMING LOUNGE</div>
        <nav>
          {nav.map(n => (
            <button key={n.page} className={`nav-link ${page === n.page ? 'active' : ''}`} onClick={() => go(n.page)}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {n.tag && <span className="tiny-tag">{n.tag}</span>}
              {n.hasNotice && <span className="notification-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-card">
            <ShieldCheck size={19} />
            <span>
              티케 라운지 보관소<small>이 브라우저에 자동 저장</small>
            </span>
          </div>
          <button className={`nav-link ${page === 'settings' ? 'active' : ''}`} onClick={() => go('settings')}>
            <Settings size={19} />
            설정과 저장
          </button>
          <button className="nav-link" onClick={() => setModal('help')}>
            <CircleHelp size={19} />
            플레이 가이드
          </button>
          <div className="sidebar-foot">
            WHERE FORTUNE SMILES.<span>TYCHE LOUNGE © 2026</span>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span className="breadcrumb">
            티케 라운지 <ChevronRight size={14} />
            <b>{titles[page][0]}</b>
          </span>
          <div className="topbar-right">
            {wheelReady && (
              <button
                className="topbar-wheel-pill"
                onClick={() => {
                  go('missions');
                  setQuestTab('wheel');
                }}
              >
                <Gift size={13} />
                <span>행운 룰렛 ON</span>
              </button>
            )}
            <span className="topbar-version-badge">v2.2</span>
            <span className={`save-indicator ${saveError ? 'error' : ''}`}>
              <ShieldCheck size={14} />
              {saveError ? '저장 확인 필요' : !loaded ? '불러오는 중' : writer ? '기기에 저장됨' : '다른 탭 사용 중'}
            </span>
            <div className="wallet-pill">
              <span>내 코인</span>
              <Coin amount={p.balance} />
            </div>
            {p.title && (
              <div
                className="topbar-title-badge"
                style={{ color: TITLES[p.title]?.color || '#ffd15c', borderColor: TITLES[p.title]?.color || '#ffd15c' }}
              >
                <Award size={13} />
                <span>{p.title}</span>
              </div>
            )}
            <button className="avatar" aria-label="설정 열기" onClick={() => go('settings')}>
              T<span />
            </button>
          </div>
        </header>

        <main>
          {(fatal || saveError || (!writer && loaded)) && (
            <div className="notice" role="alert">
              <Info size={18} />
              <span>{fatal || saveError || '다른 탭에서 게임이 열려 있어요. 그 탭을 닫으면 여기서 이어 할 수 있습니다.'}</span>
              {failCount > 0 && (
                <button
                  onClick={() => {
                    for (const [id, a] of failedResults.current) void finish(a, id);
                  }}
                >
                  정산 재시도
                </button>
              )}
            </div>
          )}

          {/* Bankruptcy Rescue Banner (Shown when balance < 100) */}
          {p.balance < 100 && (
            <div className="bankruptcy-rescue-banner">
              <div className="rescue-text">
                <div className="rescue-tag">
                  <Coins size={14} />
                  <span>코인 긴급 수혈</span>
                </div>
                <h4>코인을 모두 소진하셨나요? 티케 라운지는 멈추지 않습니다!</h4>
                <p>바닥의 동전을 주워 즉시 파밍하거나, 재기 지원금 & 출석 룰렛을 이용해 코인을 채워보세요.</p>
              </div>
              <div className="rescue-btns">
                <button
                  className="coin-tap-btn"
                  disabled={!available}
                  onClick={() => void run({ type: 'coin_tap' }, '바닥에 떨어진 50코인을 주웠어요!')}
                >
                  <Coins size={17} className="coin-jump" />
                  <span>동전 줍기 (+50)</span>
                </button>
                <button
                  className="relief-btn"
                  disabled={!canRelief}
                  onClick={() => void run({ type: 'relief' }, '재기 지원금 500코인을 받았어요.')}
                >
                  <Gift size={16} />
                  <span>재기 지원 (+500){!canRelief && ' (대기중)'}</span>
                </button>
                <button
                  className="wheel-jump-btn"
                  onClick={() => {
                    go('missions');
                    setQuestTab('wheel');
                  }}
                >
                  <Sparkles size={16} />
                  <span>출석 & 룰렛 이동</span>
                </button>
              </div>
            </div>
          )}

          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === 'play'
                  ? 'THE ORIGINAL DROP'
                  : page === 'crash'
                  ? 'EXPONENTIAL MULTIPLIER'
                  : page === 'race'
                  ? 'QUAD GLORY HORSE RACE'
                  : page === 'penguin'
                  ? 'ICE FLOE STEP HOP'
                  : 'TYCHE GAMING LOUNGE'}
              </span>
              <h1>
                {titles[page][0]}
                {page === 'play' && <span className="title-chip">PLINKO</span>}
                {page === 'crash' && <span className="title-chip">CRASH</span>}
                {page === 'race' && <span className="title-chip">HORSE RACE</span>}
                {page === 'penguin' && <span className="title-chip">PENGUIN JUMP</span>}
              </h1>
              <p>{titles[page][1]}</p>
            </div>
            {page === 'play' ? (
              <button className="subtle-button" onClick={() => setModal('help')}>
                <CircleHelp size={16} />
                게임 방법
              </button>
            ) : page === 'shop' ? (
              <span className="section-note">모든 상품 및 칭호 영구 소장</span>
            ) : null}
          </div>

          {page === 'play' && (
            <div className="play-layout">
              <section className="game-panel">
                <div className="game-toolbar">
                  <span className="live-label">
                    <span />
                    READY TO DROP
                  </span>
                  <span className="toolbar-right">
                    <span>10 ROWS</span>
                    <button
                      className="icon-button"
                      disabled={!available}
                      onClick={() => void run({ type: 'sound' })}
                      aria-label={p.sound ? '소리 끄기' : '소리 켜기'}
                    >
                      {p.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                    </button>
                  </span>
                </div>
                <div className="board-wrap">
                  <div className="board-watermark">
                    LET IT<br />DROP.
                  </div>
                  <Plinko
                    ref={board}
                    profile={p}
                    onReady={() => setReady(true)}
                    onError={() => setFatal('게임 화면을 불러오지 못했습니다. 새로고침해 주세요.')}
                    onResult={(id, slot) => void finish({ type: 'settle', id, slot }, id)}
                    onRefund={id => void finish({ type: 'refund', id }, id)}
                  />
                  {!ready && (
                    <div className="board-loading">
                      <LoaderCircle className="spin" />
                      보드를 준비하는 중
                    </div>
                  )}
                </div>
                <div className="board-legend">
                  <span>도착한 칸의 배율만큼 돌려받아요</span>
                  <span>
                    최대 <b>{Math.max(...MULTIPLIERS)}×</b>
                  </span>
                </div>
                <div className="play-controls">
                  <div className="bet-block">
                    <label>공 1개 가격</label>
                    <div className="bet-control">
                      <button
                        disabled={bet === BETS[0]}
                        aria-label="공 가격 낮추기"
                        onClick={() => setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
                      >
                        <Minus size={16} />
                      </button>
                      <select aria-label="공 1개 가격 선택" value={bet} onChange={e => setBet(Number(e.target.value))}>
                        {BETS.map(b => (
                          <option key={b} value={b}>
                            {fmt(b)} 코인
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={bet === BETS[BETS.length - 1]}
                        aria-label="공 가격 높이기"
                        onClick={() => setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="quick-bets">
                    {[100, 1000, 5000, 10000].map(b => (
                      <button key={b} className={bet === b ? 'selected' : ''} onClick={() => setBet(b)}>
                        {fmt(b)}
                      </button>
                    ))}
                  </div>
                  <button
                    className="drop-button"
                    onClick={() => void drop()}
                    disabled={!available || !ready || busy || p.balance < bet || p.pending.length >= 5 || failCount > 0}
                  >
                    <ArrowDown size={20} />
                    {p.balance < bet ? '코인이 부족해요' : '공 떨어뜨리기'}
                    <span>{p.pending.length}/5</span>
                  </button>
                </div>
                <div className="under-controls">
                  <span>
                    <ShieldCheck size={13} />
                    구매와 결과가 자동 저장됩니다
                  </span>
                  <span>
                    현재 공 <i style={{ background: selected.color }} />
                    {selected.name}
                  </span>
                </div>
              </section>

              <aside className="right-rail">
                <section className="balance-card">
                  <span className="small-label">MY WALLET</span>
                  <h2>
                    <Coins size={26} />
                    {fmt(p.balance)}
                    <small>코인</small>
                  </h2>
                  <div className="balance-divider" />
                  <div className="stat-row">
                    <span>누적 게임 손익</span>
                    <strong className={profit >= 0 ? 'positive' : 'negative'}>{signed(profit)}</strong>
                  </div>
                  <div className="stat-row">
                    <span>플레이한 공</span>
                    <strong>
                      {fmt(p.rounds)}
                      <small> 개</small>
                    </strong>
                  </div>
                  <div className="stat-row">
                    <span>최고 배율</span>
                    <strong>{p.best ? p.best + '×' : '—'}</strong>
                  </div>
                  {p.balance < 100 && (
                    <button
                      className="relief-button"
                      disabled={!canRelief}
                      onClick={() => void run({ type: 'relief' }, '재기 지원금 500코인을 받았어요.')}
                    >
                      <Gift size={16} />
                      재기 지원 +500{!canRelief && <small>6시간 간격 · 공 정산 후</small>}
                    </button>
                  )}
                </section>
                <section className="results-card">
                  <div className="section-heading">
                    <h3>최근 결과</h3>
                    <span>LAST 8</span>
                  </div>
                  {p.results.length ? (
                    <div className="results-list">
                      {p.results.slice(0, 8).map(r => (
                        <div className="result-row" key={r.id}>
                          <span className={`multiplier ${r.multiplier >= 1 ? 'win' : ''}`}>{r.multiplier}×</span>
                          <span>
                            <b>{fmt(r.payout)}</b>
                            <small>지급 코인</small>
                          </span>
                          <strong className={r.payout - r.bet >= 0 ? 'positive' : 'negative'}>
                            {signed(r.payout - r.bet)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-results">
                      <Layers3 size={28} />
                      <p>첫 번째 공을 떨어뜨려 보세요</p>
                      <span>도착 배율과 손익이 여기에 쌓여요.</span>
                    </div>
                  )}
                </section>
                <button className="shop-teaser" onClick={() => go('shop')}>
                  <span className="teaser-orb" />
                  <span>
                    <small>MAKE IT YOURS</small>
                    <b>다음 공은, 다른 색으로.</b>
                    <span>
                      스킨 둘러보기 <ArrowRight size={15} />
                    </span>
                  </span>
                </button>
              </aside>
            </div>
          )}

          {page === 'crash' && (
            <Crash
              profile={p}
              available={available}
              onStart={async (id, betAmount) => {
                await act({ type: 'crash_start', id, bet: betAmount });
              }}
              onCashout={async (id, multiplier, betAmount) => {
                await act({ type: 'crash_cashout', id, multiplier });
                notify(`${multiplier.toFixed(2)}배 캐시아웃 성공! (+${fmt(Math.round(betAmount * multiplier))} 코인)`);
              }}
              onBust={async (id, crashPoint) => {
                await act({ type: 'crash_bust', id, crashPoint });
                notify(`로켓이 ${crashPoint.toFixed(2)}배에서 폭발했어요.`);
              }}
              onError={msg => notify(msg)}
            />
          )}

          {page === 'race' && (
            <Race
              profile={p}
              available={available}
              onStart={async (id, betAmount, horseIndex) => {
                await act({ type: 'race_start', id, bet: betAmount, horseIndex });
              }}
              onSettle={async (id, winnerIndex) => {
                await act({ type: 'race_settle', id, winnerIndex });
              }}
              onError={msg => notify(msg)}
            />
          )}

          {page === 'penguin' && (
            <Penguin
              profile={p}
              available={available}
              onStart={async (id, betAmount) => {
                await act({ type: 'penguin_start', id, bet: betAmount });
              }}
              onCashout={async (id, multiplier, betAmount) => {
                await act({ type: 'penguin_cashout', id, multiplier });
                notify(`${multiplier.toFixed(2)}배 탈출 성공! (+${fmt(Math.round(betAmount * multiplier))} 코인)`);
              }}
              onFall={async id => {
                await act({ type: 'penguin_fall', id });
                notify('얼음이 깨져 바다로 빠졌습니다!');
              }}
              onError={msg => notify(msg)}
            />
          )}

          {page === 'shop' && (
            <div className="shop-layout">
              <div className="shop-tabs">
                <button className={`shop-tab-btn ${shopTab === 'skins' ? 'active' : ''}`} onClick={() => setShopTab('skins')}>
                  🛒 상점 일반 스킨
                </button>
                <button
                  className={`shop-tab-btn ${shopTab === 'boxes' ? 'active' : ''} highlight-tab`}
                  onClick={() => setShopTab('boxes')}
                >
                  🎁 미스터리 럭키 박스
                </button>
              </div>

              {shopTab === 'skins' ? (
                <>
                  <div className="filter-row">
                    {(['all', 'ball', 'board', 'trail', 'rocket', 'penguin'] as const).map(c => (
                      <button
                        key={c}
                        className={`filter-chip ${filter === c ? 'active' : ''}`}
                        onClick={() => setFilter(c)}
                      >
                        {c === 'all' ? '전체 보기' : LABELS[c]}
                      </button>
                    ))}
                  </div>
                  <div className="catalog-grid">
                    {CATALOG.filter(x => (filter === 'all' ? true : x.category === filter)).map(item => {
                      const owned = p.owned.includes(item.id),
                        equipped = p.equipped[item.category] === item.id;
                      return (
                        <article className={`catalog-card ${owned ? 'owned' : ''}`} key={item.id}>
                          <div className="card-top">
                            <span className="category-tag">{LABELS[item.category]}</span>
                            <span className={`rarity-tag ${item.rarity.toLowerCase()}`}>{item.rarity}</span>
                          </div>
                          <ProductArt item={item} />
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <div className="card-bottom">
                            {item.boxOnly ? (
                              <button
                                className="secondary-button full-width"
                                style={{ background: 'rgba(255, 59, 128, 0.15)', borderColor: '#ff3b80', color: '#ff78a9' }}
                                onClick={() => {
                                  setShopTab('boxes');
                                  notify(`${item.boxName}에서 획득할 수 있습니다.`);
                                }}
                              >
                                🎁 {item.boxName} 전용
                              </button>
                            ) : owned ? (
                              <button
                                className={`secondary-button ${equipped ? 'equipped' : ''}`}
                                disabled={!available || equipped}
                                onClick={() => void run({ type: 'equip', id: item.id }, `${item.name} 장착 완료`)}
                              >
                                {equipped ? (
                                  <>
                                    <Check size={16} />
                                    장착 중
                                  </>
                                ) : (
                                  '장착하기'
                                )}
                              </button>
                            ) : (
                              <button
                                className="primary-button"
                                disabled={!available || p.balance < item.price}
                                onClick={() => setModal(item)}
                              >
                                {item.price === 0 ? '기본 제공' : <Coin amount={item.price} />}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="boxes-grid">
                  {BOXES.map(box => (
                    <article
                      className="lucky-box-card"
                      key={box.id}
                      style={{ '--box-theme': box.color, '--box-border': box.border, '--box-bg': box.bg } as React.CSSProperties}
                    >
                      <div className="box-card-top">
                        <span className={`box-tier-chip ${box.tier}`}>{box.tier.toUpperCase()} BOX</span>
                        <button className="rate-info-btn" onClick={() => setRatesBox(box)}>
                          확률표 보기
                        </button>
                      </div>
                      <BoxArt box={box} />
                      <h3>{box.name}</h3>
                      <p>{box.description}</p>
                      <div className="box-price-tag">
                        <span>개봉 비용</span>
                        <Coin amount={box.price} />
                      </div>
                      <button
                        className="box-open-action-btn"
                        disabled={!available || p.balance < box.price || busy}
                        onClick={() => void handleOpenBox(box)}
                      >
                        {p.balance < box.price ? '코인이 부족해요' : '상자 열기'}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {page === 'inventory' && (
            <div className="inventory-layout">
              <div className="inventory-tabs">
                <button className={`inv-tab-btn ${invTab === 'skins' ? 'active' : ''}`} onClick={() => setInvTab('skins')}>
                  🎨 보유 스킨 ({p.owned.length})
                </button>
                <button
                  className={`inv-tab-btn ${invTab === 'titles' ? 'active' : ''} highlight-tab`}
                  onClick={() => setInvTab('titles')}
                >
                  👑 보유 칭호 ({p.ownedTitles.length})
                </button>
              </div>

              {invTab === 'skins' ? (
                <>
                  <div className="filter-row">
                    {(['all', 'ball', 'board', 'trail', 'rocket', 'penguin'] as const).map(c => (
                      <button
                        key={c}
                        className={`filter-chip ${filter === c ? 'active' : ''}`}
                        onClick={() => setFilter(c)}
                      >
                        {c === 'all' ? '전체 보기' : LABELS[c]}
                      </button>
                    ))}
                  </div>
                  <div className="catalog-grid">
                    {CATALOG.filter(x => p.owned.includes(x.id) && (filter === 'all' ? true : x.category === filter)).map(item => {
                      const equipped = p.equipped[item.category] === item.id;
                      return (
                        <article className="catalog-card owned" key={item.id}>
                          <div className="card-top">
                            <span className="category-tag">{LABELS[item.category]}</span>
                            <span className={`rarity-tag ${item.rarity.toLowerCase()}`}>{item.rarity}</span>
                          </div>
                          <ProductArt item={item} />
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <div className="card-bottom">
                            <button
                              className={`secondary-button ${equipped ? 'equipped' : ''}`}
                              disabled={!available || equipped}
                              onClick={() => void run({ type: 'equip', id: item.id }, `${item.name} 장착 완료`)}
                            >
                              {equipped ? (
                                <>
                                  <Check size={16} />
                                  장착 중
                                </>
                              ) : (
                                '장착하기'
                              )}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="titles-collection-section">
                  <div className="titles-intro">
                    <Award size={24} style={{ color: '#ffd15c' }} />
                    <div>
                      <h3>명예의 칭호 컬렉션</h3>
                      <p>럭키 박스 개봉을 통해 희귀한 칭호를 모으고 장착해 보세요. 칭호는 상단 바에 멋지게 표시됩니다.</p>
                    </div>
                  </div>
                  <div className="titles-grid">
                    {Object.values(TITLES).map(t => {
                      const isOwned = p.ownedTitles.includes(t.name);
                      const isEquipped = p.title === t.name;
                      return (
                        <article
                          key={t.id}
                          className={`title-card ${isOwned ? 'owned' : 'locked'} ${isEquipped ? 'equipped' : ''}`}
                          style={{ '--title-color': t.color } as React.CSSProperties}
                        >
                          <div className="title-card-header">
                            <span className={`title-tier-badge ${t.tier}`}>{t.tier.toUpperCase()}</span>
                            {isEquipped && <span className="title-eq-badge">착용 중</span>}
                          </div>
                          <h4 style={{ color: t.color }}>[{t.name}]</h4>
                          <p>{t.desc}</p>
                          <div className="title-action-wrap">
                            {isOwned ? (
                              <button
                                className={`secondary-button ${isEquipped ? 'equipped' : ''}`}
                                disabled={!available || isEquipped}
                                onClick={() => void run({ type: 'title_equip', title: t.name }, `[${t.name}] 칭호 장착 완료`)}
                              >
                                {isEquipped ? '착용 중' : '칭호 착용'}
                              </button>
                            ) : (
                              <span className="how-to-get">
                                {t.tier === 'silver' ? '실버' : t.tier === 'gold' ? '골드' : t.tier === 'platinum' ? '플래티넘' : '다이아'}{' '}
                                상자에서 획득
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {page === 'games' && (
            <div className="game-grid">
              <button className="lounge-card available" onClick={() => go('play')}>
                <span className="eyebrow">01 / AVAILABLE NOW</span>
                <Target size={80} />
                <h2>플링코</h2>
                <p>공 하나에 담긴 작은 반전.</p>
                <span className="lounge-action">
                  지금 플레이
                  <ArrowRight size={19} />
                </span>
              </button>
              <button className="lounge-card available" onClick={() => go('crash')}>
                <span className="eyebrow">02 / AVAILABLE NOW</span>
                <Rocket size={80} />
                <h2>로켓 크래시</h2>
                <p>폭발 직전의 스릴, 배율 탈출 게임.</p>
                <span className="lounge-action">
                  지금 플레이
                  <ArrowRight size={19} />
                </span>
              </button>
              <button className="lounge-card available" onClick={() => go('race')}>
                <span className="eyebrow">03 / AVAILABLE NOW</span>
                <Trophy size={80} />
                <h2>네온 경마</h2>
                <p>4마리의 질주, 1등마 적중 시 3배 지급!</p>
                <span className="lounge-action">
                  지금 플레이
                  <ArrowRight size={19} />
                </span>
              </button>
              <button className="lounge-card available" onClick={() => go('penguin')}>
                <span className="eyebrow">04 / AVAILABLE NOW</span>
                <Footprints size={80} />
                <h2>펭귄 점프</h2>
                <p>위태로운 얼음 디딤돌, 최대 50배 대탈출!</p>
                <span className="lounge-action">
                  지금 플레이
                  <ArrowRight size={19} />
                </span>
              </button>
            </div>
          )}

          {/* New Quests, Daily Wheel & Achievements Hub */}
          {page === 'missions' && (
            <div className="quests-hub-layout">
              {/* Hub Tabs */}
              <div className="quests-nav-tabs">
                <button
                  className={`quest-tab-btn ${questTab === 'wheel' ? 'active' : ''}`}
                  onClick={() => setQuestTab('wheel')}
                >
                  <Gift size={18} />
                  <span>출석 & 행운 룰렛</span>
                  {wheelReady && <span className="mini-badge-dot" />}
                </button>
                <button
                  className={`quest-tab-btn ${questTab === 'daily' ? 'active' : ''}`}
                  onClick={() => setQuestTab('daily')}
                >
                  <CalendarCheck size={18} />
                  <span>일일 퀘스트</span>
                </button>
                <button
                  className={`quest-tab-btn ${questTab === 'weekly' ? 'active' : ''}`}
                  onClick={() => setQuestTab('weekly')}
                >
                  <Flame size={18} />
                  <span>주간 퀘스트</span>
                </button>
                <button
                  className={`quest-tab-btn ${questTab === 'achievements' ? 'active' : ''}`}
                  onClick={() => setQuestTab('achievements')}
                >
                  <Trophy size={18} />
                  <span>명예의 업적</span>
                </button>
              </div>

              {/* Tab 1: Attendance & Daily Wheel */}
              {questTab === 'wheel' && (
                <div className="wheel-and-attendance-view">
                  <div className="attendance-checkin-card">
                    <div className="checkin-info">
                      <div className="checkin-badge">
                        <CalendarCheck size={15} />
                        <span>DAILY ATTENDANCE</span>
                      </div>
                      <h3>오늘의 출석 체크</h3>
                      <p>매일 접속하고 500코인을 무료로 받으세요! (매일 자정 00:00 KST 기준 갱신)</p>
                    </div>
                    <button
                      className="primary-button checkin-action-btn"
                      disabled={!available || checkedInToday}
                      onClick={() => void run({ type: 'attendance' }, '오늘 출석 체크 완료! 500코인을 받았습니다.')}
                    >
                      <CheckCircle2 size={18} />
                      {checkedInToday ? '오늘 출석 완료' : '출석 체크 (+500 코인)'}
                    </button>
                  </div>

                  <DailyWheel
                    lastSpinTime={p.lastWheelSpin}
                    available={available}
                    onSpin={async slotIndex => {
                      await act({ type: 'wheel_spin', slotIndex });
                    }}
                    onSuccess={slot => {
                      setWheelPrizeModal(slot);
                      notify(`축하합니다! 행운 룰렛에서 [${slot.label}] 당첨!`);
                    }}
                    soundEnabled={p.sound}
                  />
                </div>
              )}

              {/* Tab 2: Daily Quests */}
              {questTab === 'daily' && (
                <div className="quests-view">
                  <div className="quest-header-banner">
                    <div>
                      <h3>일일 퀘스트 (Daily Quests)</h3>
                      <p>매일 자정(00:00)에 초기화됩니다. 가볍게 플레이하고 매일 코인을 챙겨가세요!</p>
                    </div>
                    <div className="quest-stat-pill">
                      <span>오늘 플레이: <b>{p.dailyRounds}</b>회</span>
                      <span>최고 배율: <b>{p.dailyMaxMult}×</b></span>
                    </div>
                  </div>

                  <div className="quests-grid">
                    {DAILY_QUESTS.map(q => {
                      const current = q.type === 'rounds' ? p.dailyRounds : p.dailyMaxMult;
                      const done = current >= q.target;
                      const claimed = p.dailyClaimed.includes(q.id);
                      return (
                        <article className={`quest-card ${claimed ? 'claimed' : done ? 'ready' : ''}`} key={q.id}>
                          <div className="quest-card-top">
                            <span className="quest-type-tag">일일 미션</span>
                            <Coin amount={q.reward} />
                          </div>
                          <h4>{q.name}</h4>
                          <p>{q.description}</p>
                          <div className="progress-track">
                            <div style={{ width: `${Math.min(100, (current / q.target) * 100)}%` }} />
                          </div>
                          <div className="quest-card-bottom">
                            <span>
                              진행도: <b>{Math.min(current, q.target)}</b> / {q.target}
                            </span>
                            <button
                              className={`primary-button ${claimed ? 'claimed-btn' : ''}`}
                              disabled={!available || !done || claimed}
                              onClick={() => void run({ type: 'daily_claim', questId: q.id }, `${fmt(q.reward)}코인을 받았습니다.`)}
                            >
                              {claimed ? '수령 완료' : done ? '보상 받기' : '진행 중'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 3: Weekly Quests */}
              {questTab === 'weekly' && (
                <div className="quests-view">
                  <div className="quest-header-banner">
                    <div>
                      <h3>주간 퀘스트 (Weekly Quests)</h3>
                      <p>매주 월요일 00시에 초기화됩니다. 한 주간 꾸준히 도전하고 고액 코인을 획득하세요!</p>
                    </div>
                    <div className="quest-stat-pill">
                      <span>이번 주 플레이: <b>{p.weeklyRounds}</b>회</span>
                      <span>주간 최고 배율: <b>{p.weeklyMaxMult}×</b></span>
                    </div>
                  </div>

                  <div className="quests-grid">
                    {WEEKLY_QUESTS.map(q => {
                      const current = q.type === 'rounds' ? p.weeklyRounds : p.weeklyMaxMult;
                      const done = current >= q.target;
                      const claimed = p.weeklyClaimed.includes(q.id);
                      return (
                        <article className={`quest-card ${claimed ? 'claimed' : done ? 'ready' : ''}`} key={q.id}>
                          <div className="quest-card-top">
                            <span className="quest-type-tag weekly">주간 미션</span>
                            <Coin amount={q.reward} />
                          </div>
                          <h4>{q.name}</h4>
                          <p>{q.description}</p>
                          <div className="progress-track">
                            <div style={{ width: `${Math.min(100, (current / q.target) * 100)}%` }} />
                          </div>
                          <div className="quest-card-bottom">
                            <span>
                              진행도: <b>{Math.min(current, q.target)}</b> / {q.target}
                            </span>
                            <button
                              className={`primary-button ${claimed ? 'claimed-btn' : ''}`}
                              disabled={!available || !done || claimed}
                              onClick={() => void run({ type: 'weekly_claim', questId: q.id }, `${fmt(q.reward)}코인을 받았습니다.`)}
                            >
                              {claimed ? '수령 완료' : done ? '보상 받기' : '진행 중'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 4: Milestone Achievements (코인 보상!) */}
              {questTab === 'achievements' && (
                <div className="quests-view">
                  <div className="quest-header-banner">
                    <div>
                      <h3>명예의 업적 (Achievements)</h3>
                      <p>티케 라운지에서의 위대한 발자취! 각 업적을 달성하면 풍성한 코인 보상이 지급됩니다.</p>
                    </div>
                    <div className="quest-stat-pill">
                      <span>
                        달성: <b>{p.achievementsClaimed.length}</b> / {ACHIEVEMENTS.length}
                      </span>
                    </div>
                  </div>

                  <div className="achievements-grid">
                    {ACHIEVEMENTS.map(ach => {
                      let done = false;
                      let currentVal = 0;
                      let targetVal = 0;

                      if (ach.id === 'ach_first_step') {
                        currentVal = p.rounds;
                        targetVal = 1;
                        done = p.rounds >= 1;
                      } else if (ach.id === 'ach_rounds_50') {
                        currentVal = p.rounds;
                        targetVal = 50;
                        done = p.rounds >= 50;
                      } else if (ach.id === 'ach_rounds_200') {
                        currentVal = p.rounds;
                        targetVal = 200;
                        done = p.rounds >= 200;
                      } else if (ach.id === 'ach_rounds_500') {
                        currentVal = p.rounds;
                        targetVal = 500;
                        done = p.rounds >= 500;
                      } else if (ach.id === 'ach_mult_2x') {
                        currentVal = p.best;
                        targetVal = 2;
                        done = p.best >= 2;
                      } else if (ach.id === 'ach_mult_5x') {
                        currentVal = p.best;
                        targetVal = 5;
                        done = p.best >= 5;
                      } else if (ach.id === 'ach_mult_10x') {
                        currentVal = p.best;
                        targetVal = 10;
                        done = p.best >= 10;
                      } else if (ach.id === 'ach_mult_20x') {
                        currentVal = p.best;
                        targetVal = 20;
                        done = p.best >= 20;
                      } else if (ach.id === 'ach_owned_7') {
                        currentVal = p.owned.length;
                        targetVal = 7;
                        done = p.owned.length >= 7;
                      } else if (ach.id === 'ach_owned_12') {
                        currentVal = p.owned.length;
                        targetVal = 12;
                        done = p.owned.length >= 12;
                      } else if (ach.id === 'ach_titles_3') {
                        currentVal = (p.ownedTitles || []).length;
                        targetVal = 3;
                        done = (p.ownedTitles || []).length >= 3;
                      } else if (ach.id === 'ach_titles_7') {
                        currentVal = (p.ownedTitles || []).length;
                        targetVal = 7;
                        done = (p.ownedTitles || []).length >= 7;
                      }

                      const claimed = p.achievementsClaimed.includes(ach.id);

                      return (
                        <article className={`achievement-card ${claimed ? 'claimed' : done ? 'ready' : ''}`} key={ach.id}>
                          <div className="achievement-icon-wrap">
                            <Medal size={28} style={{ color: claimed ? '#6be4c4' : done ? '#ffd15c' : '#64748b' }} />
                          </div>
                          <div className="achievement-details">
                            <div className="ach-card-top">
                              <h4>{ach.name}</h4>
                              <Coin amount={ach.reward} className="ach-reward-badge" />
                            </div>
                            <p>{ach.description}</p>
                            <div className="ach-progress-row">
                              <div className="progress-track">
                                <div style={{ width: `${Math.min(100, (currentVal / targetVal) * 100)}%` }} />
                              </div>
                              <span>
                                {Math.min(currentVal, targetVal)} / {targetVal}
                              </span>
                            </div>
                          </div>
                          <div className="ach-action">
                            <button
                              className={`primary-button ${claimed ? 'claimed-btn' : ''}`}
                              disabled={!available || !done || claimed}
                              onClick={() =>
                                void run(
                                  { type: 'achievement_claim', achievementId: ach.id },
                                  `[${ach.name}] 업적 달성! ${fmt(ach.reward)}코인을 받았습니다.`
                                )
                              }
                            >
                              {claimed ? '수령 완료' : done ? '코인 수령' : '미달성'}
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {page === 'settings' && (
            <div className="settings-layout">
              <section className="settings-card">
                <div className="section-heading">
                  <h2>저장 데이터</h2>
                  <ShieldCheck size={21} />
                </div>
                <p>
                  코인과 컬렉션은 이 기기의 현재 브라우저에 저장됩니다. 다른 기기로 옮기거나 사이트 데이터를 지우기 전에 백업해 주세요.
                </p>
                <div className="save-summary">
                  <span>
                    내 코인<b>{fmt(p.balance)}</b>
                  </span>
                  <span>
                    보유 상품<b>{p.owned.length}개</b>
                  </span>
                  <span>
                    보유 칭호<b>{p.ownedTitles.length} / 15</b>
                  </span>
                  <span>
                    플레이<b>{p.rounds}회</b>
                  </span>
                </div>
                <div className="settings-buttons">
                  <button className="secondary-button" disabled={!loaded || !!p.pending.length} onClick={exportSave}>
                    <ArrowDownToLine size={18} />
                    백업 내보내기
                  </button>
                  <button className="secondary-button" disabled={!available || !!p.pending.length} onClick={() => fileInput.current?.click()}>
                    <ArrowUpFromLine size={18} />
                    백업 가져오기
                  </button>
                </div>
                <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => void importFile(e.target.files?.[0])} />
                <div className="storage-note">
                  <Info size={17} />
                  <span>
                    <b>캐시 삭제와 사이트 데이터 삭제는 달라요.</b>이미지·파일 캐시만 삭제하면 보통 유지됩니다. 쿠키 및 사이트 데이터를
                    삭제하면 저장한 코인과 스킨도 삭제됩니다. 백업이 없으면 복구할 수 없습니다.
                  </span>
                </div>
              </section>

              <section className="settings-card">
                <h2>플레이 설정</h2>
                <div className="setting-row">
                  <div>
                    <b>게임 소리</b>
                    <p>공을 떨어뜨릴 때 짧은 효과음</p>
                  </div>
                  <button
                    className={`toggle ${p.sound ? 'on' : ''}`}
                    role="switch"
                    aria-checked={p.sound}
                    aria-label="게임 소리"
                    disabled={!available}
                    onClick={() => void run({ type: 'sound' })}
                  >
                    <span />
                  </button>
                </div>
                <div className="setting-row">
                  <div>
                    <b>재기 지원금</b>
                    <p>
                      잔액 100 미만 · 6시간마다 500코인
                      <br />
                      스킨과 업적을 유지합니다.
                    </p>
                  </div>
                  <button className="secondary-button" disabled={!canRelief} onClick={() => void run({ type: 'relief' }, '500코인을 받았어요.')}>
                    지원받기
                  </button>
                </div>
              </section>

              <section className="settings-card danger-card">
                <div>
                  <h2>처음부터 다시 시작</h2>
                  <p>코인, 구매한 스킨, 미션, 기록을 모두 지우고 10,000코인으로 시작합니다.</p>
                </div>
                <button
                  className="danger-button"
                  disabled={!available || !!p.pending.length}
                  onClick={() => {
                    setResetText('');
                    setModal('reset');
                  }}
                >
                  <RotateCcw size={17} />
                  전체 초기화
                </button>
              </section>
            </div>
          )}

          {/* Dedicated Legal Footer for AdSense Compliance */}
          <footer className="arcade-legal-footer">
            <div className="legal-footer-inner">
              <div className="legal-left">
                <div className="legal-brand">
                  <Sparkles size={16} />
                  <b>TYCHE LOUNGE</b>
                  <span className="version-pill">v2.2</span>
                </div>
                <p className="legal-disclaimer">
                  티케 라운지는 순수 오락용 무료 가상 아케이드 게임 서비스입니다. 본 사이트 내에서 제공되는 모든 코인 및 재화는 순수 가상 게임
                  데이터이며 실제 현금 가치가 없고, 어떠한 경우에도 충전·환전·거래가 불가능합니다.
                </p>
              </div>
              <div className="legal-links">
                <button type="button" className="legal-link-btn" onClick={() => setLegalModal('terms')}>
                  서비스 이용약관
                </button>
                <span className="legal-sep">·</span>
                <button type="button" className="legal-link-btn" onClick={() => setLegalModal('privacy')}>
                  개인정보처리방침
                </button>
                <span className="legal-sep">·</span>
                <button type="button" className="legal-link-btn" onClick={() => setLegalModal('about')}>
                  서비스 소개 및 문의
                </button>
              </div>
            </div>
            <div className="legal-copyright">
              <span>Copyright © 2026 TYCHE LOUNGE. All Rights Reserved.</span>
              <span className="responsible-badge">100% Free Virtual Web Arcade · No Real Money Gambling</span>
            </div>
          </footer>
        </main>
      </div>

      {toast && (
        <div role="status" className="toast">
          <Info size={18} />
          {toast}
        </div>
      )}

      {/* Modals */}
      {modal && (
        <Modal
          title={
            typeof modal === 'object'
              ? modal.name
              : modal === 'help'
              ? '플링코 플레이 가이드'
              : modal === 'reset'
              ? '정말 처음부터 시작할까요?'
              : '백업을 복원할까요?'
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
        >
          {typeof modal === 'object' ? (
            modal.boxOnly ? (
              <>
                <ProductArt item={modal} />
                <p>{modal.description}</p>
                <div className="not-for-sale-tag" style={{ margin: '20px 0', alignItems: 'center', textAlign: 'center' }}>
                  <span className="nfs-badge">비매품 (럭키 박스 전용)</span>
                  <small style={{ fontSize: '13px', marginTop: '6px' }}>
                    {modal.boxName} 뽑기를 통해서만 획득할 수 있는 스킨입니다.
                  </small>
                </div>
                <button
                  className="primary-button full-width"
                  onClick={() => {
                    setModal(null);
                    setShopTab('boxes');
                  }}
                >
                  🎁 럭키 박스로 이동하기
                </button>
              </>
            ) : (
              <>
                <ProductArt item={modal} />
                <p>{modal.description} 구매 후 보관함에서 장착할 수 있어요. 성능과 당첨 확률은 바뀌지 않습니다.</p>
                <div className="modal-total">
                  <span>구매 가격</span>
                  <Coin amount={modal.price} />
                </div>
                <div className="modal-total">
                  <span>구매 후 잔액</span>
                  <b>{fmt(Math.max(0, p.balance - modal.price))} 코인</b>
                </div>
                <button
                  className="primary-button full-width"
                  disabled={busy || p.balance < modal.price || !available}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await act({ type: 'buy', id: modal.id });
                      notify(`${modal.name} 구매 완료! 보관함에서 장착해 보세요.`);
                      setModal(null);
                    } catch (e) {
                      notify((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {p.balance < modal.price ? '코인이 부족해요' : '구매 확정'}
                </button>
              </>
            )
          ) : modal === 'help' ? (
            <div className="help-content">
              <div>
                <b>01. 공 가격을 고르세요</b>
                <p>10~10,000코인 중 선택합니다. 금액 목록에서 바로 고르거나 빠른 선택 버튼을 사용할 수 있어요.</p>
              </div>
              <div>
                <b>02. 어디에 떨어지는지 지켜보세요</b>
                <p>실제 물리 충돌로 도착 칸을 결정합니다. 공은 동시에 5개까지 떨어뜨릴 수 있어요.</p>
              </div>
              <div>
                <b>03. 배율만큼 돌려받으세요</b>
                <p>100코인으로 2배에 도착하면 200코인 지급, 순이익은 100코인입니다.</p>
              </div>
            </div>
          ) : modal === 'reset' ? (
            <>
              <p>
                현재 <b>{fmt(p.balance)}코인</b>, 보유 상품 <b>{p.owned.length}개</b>와 모든 플레이 기록이 삭제됩니다.
              </p>
              <button className="secondary-button full-width" onClick={exportSave}>
                <ArrowDownToLine size={17} />
                초기화 전에 백업 다운로드
              </button>
              <label className="reset-label">
                계속하려면 ‘초기화’를 입력하세요
                <input autoComplete="off" value={resetText} onChange={e => setResetText(e.target.value)} placeholder="초기화" />
              </label>
              <button
                className="danger-button full-width"
                disabled={resetText !== '초기화' || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await act({ type: 'reset' });
                    setModal(null);
                    notify('새로운 아케이드가 시작됐어요. 10,000코인을 받았습니다.');
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                모두 지우고 새로 시작
              </button>
            </>
          ) : (
            <>
              <p>현재 저장을 백업 파일의 상태로 교체합니다. 현재 진행 상황은 덮어씁니다.</p>
              <div className="modal-total">
                <span>복원할 코인</span>
                <Coin amount={imported?.balance ?? 0} />
              </div>
              <div className="modal-total">
                <span>복원할 보유 상품</span>
                <b>{imported?.owned.length}개</b>
              </div>
              <button className="secondary-button full-width" onClick={exportSave}>
                현재 데이터 먼저 백업
              </button>
              <button
                className="primary-button full-width"
                disabled={busy || !imported}
                onClick={async () => {
                  if (!imported) return;
                  setBusy(true);
                  try {
                    await act({ type: 'import', profile: imported });
                    setModal(null);
                    notify('백업을 복원했어요.');
                  } catch (e) {
                    notify((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                이 백업으로 복원
              </button>
            </>
          )}
        </Modal>
      )}

      {/* Wheel Prize Modal */}
      {wheelPrizeModal && (
        <Modal title="🎉 행운의 룰렛 당첨!" onClose={() => setWheelPrizeModal(null)}>
          <div className="wheel-result-dialog">
            <div className="wheel-prize-icon">
              <Gift size={54} style={{ color: '#ffd15c' }} />
            </div>
            <span className="wheel-prize-badge">DAILY WHEEL REWARD</span>
            <h2>{wheelPrizeModal.label}</h2>
            <p>오늘의 행운 룰렛 보상이 지갑에 즉시 적립되었습니다!</p>
            <div className="modal-total">
              <span>현재 코인 잔액</span>
              <Coin amount={p.balance} />
            </div>
            <button className="primary-button full-width" onClick={() => setWheelPrizeModal(null)}>
              멋져요! 확인
            </button>
          </div>
        </Modal>
      )}

      {/* Legal Modals (Terms, Privacy, About) */}
      {legalModal === 'terms' && (
        <Modal title="서비스 이용약관" onClose={() => setLegalModal(null)}>
          <TermsModal onClose={() => setLegalModal(null)} />
        </Modal>
      )}
      {legalModal === 'privacy' && (
        <Modal title="개인정보처리방침" onClose={() => setLegalModal(null)}>
          <PrivacyModal onClose={() => setLegalModal(null)} />
        </Modal>
      )}
      {legalModal === 'about' && (
        <Modal title="서비스 소개 및 문의" onClose={() => setLegalModal(null)}>
          <AboutModal onClose={() => setLegalModal(null)} />
        </Modal>
      )}

      {ratesBox && (
        <Modal title={`${ratesBox.name} 확률 정보 안내`} onClose={() => setRatesBox(null)}>
          <div className="rates-modal-body">
            <div className="rates-info-banner">
              <Info size={18} style={{ color: ratesBox.color }} />
              <span>티케 라운지는 조작 없는 100% 투명한 확률 공개 원칙을 준수합니다.</span>
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
                  {ratesBox.drops.map((d, idx) => (
                    <tr key={idx}>
                      <td>
                        <span className={`drop-type-tag ${d.prize.type}`}>
                          {d.prize.type === 'coins' ? '코인' : d.prize.type === 'skin' ? '스킨' : d.prize.type === 'title' ? '칭호' : '꽝'}
                        </span>
                      </td>
                      <td className="drop-name-cell">{d.prize.name}</td>
                      <td className="drop-rate-cell">
                        <b>{d.rate.toFixed(2)}%</b>
                      </td>
                      <td className="drop-sub-cell">
                        {d.prize.type === 'skin'
                          ? '중복 획득 시 환급 없음'
                          : d.prize.type === 'dud'
                          ? '보상 없음 (0 코인)'
                          : d.prize.type === 'coins'
                          ? '코인 즉시 적립'
                          : '영구 소장'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rates-summary-foot">
              <span>
                확률 합계: <b>100.00%</b>
              </span>
              <button className="secondary-button" onClick={() => setRatesBox(null)}>
                닫기
              </button>
            </div>
          </div>
        </Modal>
      )}

      {unboxing && (
        <Modal title={unboxing.phase === 'opening' ? '럭키 박스 개봉 중...' : '🎉 개봉 결과!'} onClose={() => { if (!busy) setUnboxing(null); }}>
          <div className="unboxing-modal-body">
            {unboxing.phase === 'opening' ? (
              <div className="unboxing-animation-area">
                <div className="unboxing-chest-anim" style={{ '--box-color': unboxing.box.color } as React.CSSProperties}>
                  <Package size={72} style={{ color: unboxing.box.color }} className="shake-anim" />
                </div>
                <h3>{unboxing.box.name} 개봉 중...</h3>
                <p>과연 어떤 행운이 들어있을까요?</p>
              </div>
            ) : (
              <div className="unboxing-result-area">
                {unboxing.prize.type === 'dud' && (
                  <div className="result-prize-box dud-prize">
                    <div className="prize-icon-circle dud-circle">
                      <Frown size={54} style={{ color: '#ff7878' }} />
                    </div>
                    <span className="prize-tier-text dud-tag">아쉬운 꽝!</span>
                    <h2 style={{ color: '#ff7878' }}>💨 빈 상자였습니다...</h2>
                    <p>{unboxing.prize.message}</p>
                    <button className="secondary-button full-width" onClick={() => setUnboxing(null)}>
                      다음 기회에...
                    </button>
                  </div>
                )}
                {unboxing.prize.type === 'coins' && (
                  <div className="result-prize-box coins-prize">
                    <div className="prize-icon-circle">
                      <Coins size={54} style={{ color: '#ffd15c' }} />
                    </div>
                    <span className="prize-tier-text">COINS REWARD</span>
                    <h2>+{fmt(unboxing.prize.amount)} 코인</h2>
                    <p>{unboxing.prize.name}</p>
                    <div className="modal-total">
                      <span>적립 후 잔액</span>
                      <Coin amount={p.balance} />
                    </div>
                    <button className="primary-button full-width" onClick={() => setUnboxing(null)}>
                      확인
                    </button>
                  </div>
                )}
                {unboxing.prize.type === 'skin' && (
                  <div className="result-prize-box skin-prize">
                    {unboxing.isNewSkin ? (
                      <>
                        <span className="prize-tier-text new-tag">✨ NEW SKIN 획득!</span>
                        <h2>{unboxing.prize.name}</h2>
                        <div className="prize-skin-preview">
                          {(() => {
                            const it = CATALOG.find(x => x.id === (unboxing.prize as { skinId: string }).skinId);
                            return it ? <ProductArt item={it} /> : null;
                          })()}
                        </div>
                        <p>새로운 스킨을 획득했습니다! 지금 바로 장착하시겠습니까?</p>
                        <div className="prize-actions-row">
                          <button className="secondary-button" onClick={() => setUnboxing(null)}>
                            보관함에 보관
                          </button>
                          <button
                            className="primary-button"
                            onClick={async () => {
                              await act({ type: 'equip', id: (unboxing.prize as { skinId: string }).skinId });
                              notify(`${unboxing.prize.name} 장착 완료!`);
                              setUnboxing(null);
                            }}
                          >
                            지금 장착하기
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="prize-tier-text dup-tag">중복 스킨 획득</span>
                        <h2>{unboxing.prize.name}</h2>
                        <div className="prize-skin-preview">
                          {(() => {
                            const it = CATALOG.find(x => x.id === (unboxing.prize as { skinId: string }).skinId);
                            return it ? <ProductArt item={it} /> : null;
                          })()}
                        </div>
                        <p className="dup-notice">이미 보유 중인 스킨입니다. 별도 환급 없이 소장 상태가 유지됩니다.</p>
                        <button className="secondary-button full-width" onClick={() => setUnboxing(null)}>
                          확인
                        </button>
                      </>
                    )}
                  </div>
                )}
                {unboxing.prize.type === 'title' && (
                  <div className="result-prize-box title-prize">
                    <div className="prize-icon-circle">
                      <Award size={50} style={{ color: TITLES[unboxing.prize.title]?.color || '#ffd15c' }} />
                    </div>
                    <span className="prize-tier-text">TITLE UNLOCKED</span>
                    <h2 style={{ color: TITLES[unboxing.prize.title]?.color || '#ffd15c' }}>[{unboxing.prize.title}]</h2>
                    <p>{TITLES[unboxing.prize.title]?.desc || '새로운 명예의 칭호를 획득했습니다.'}</p>
                    <div className="prize-actions-row">
                      <button className="secondary-button" onClick={() => setUnboxing(null)}>
                        확인
                      </button>
                      <button
                        className="primary-button"
                        onClick={async () => {
                          await act({ type: 'title_equip', title: (unboxing.prize as { title: string }).title });
                          notify(`[${(unboxing.prize as { title: string }).title}] 칭호 장착 완료!`);
                          setUnboxing(null);
                        }}
                      >
                        칭호 즉시 장착
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
