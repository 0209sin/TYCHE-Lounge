import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Layers3, Minus, Plus, Rocket, ShieldCheck, Zap } from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';

type Phase = 'idle' | 'flying' | 'crashed';

type CrashProps = {
  profile: Profile;
  available: boolean;
  onStart: (id: string, bet: number) => Promise<void>;
  onCashout: (id: string, mult: number, bet: number) => Promise<void>;
  onBust: (id: string, crashPoint: number) => Promise<void>;
  onError: (msg: string) => void;
};

// Provably Fair standard curve with ~96.5% RTP and 3% instant bust
function generateCrashPoint(): number {
  const r = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  if (r < 0.03) return 1.00;
  const mult = 0.965 / (1 - r);
  return Math.max(1.01, Math.min(1000, Math.floor(mult * 100) / 100));
}

export default function Crash({ profile, available, onStart, onCashout, onBust, onError }: CrashProps) {
  const [bet, setBet] = useState(100);
  const [autoCashoutEnabled, setAutoCashoutEnabled] = useState(false);
  const [autoCashoutMult, setAutoCashoutMult] = useState(2.0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mult, setMult] = useState(1.00);
  const [cashedOutAt, setCashedOutAt] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([1.45, 2.12, 1.08, 5.40, 1.88, 12.30, 1.00, 3.15]);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<number | null>(null);
  const gameRef = useRef<{
    id: string;
    bet: number;
    crashPoint: number;
    startTime: number;
    cashedOut: boolean;
    active: boolean;
  } | null>(null);
  const animFrame = useRef<number | null>(null);

  // Particles for booster fire, smoke, and explosions
  const particles = useRef<Array<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    alpha: number;
    decay: number;
  }>>([]);
  const stars = useRef<Array<{ x: number; y: number; speed: number; size: number }>>([]);

  // Initialize stars once
  useEffect(() => {
    stars.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * 660,
      y: Math.random() * 420,
      speed: 0.3 + Math.random() * 1.2,
      size: 0.8 + Math.random() * 1.8,
    }));
  }, []);

  // Main canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = () => {
      if (!running) return;
      const W = canvas.width;
      const H = canvas.height;

      ctx.clearRect(0, 0, W, H);

      // 1. Draw Starfield Background
      ctx.fillStyle = '#080c14';
      ctx.fillRect(0, 0, W, H);

      const isWarping = Boolean(cashedOutAt && phase === 'flying');
      const warpSpeed = isWarping ? 5 : 1;

      stars.current.forEach(star => {
        if (gameRef.current?.active && phase === 'flying') {
          star.x -= star.speed * (1 + (mult - 1) * 0.35) * warpSpeed;
          if (star.x < 0) {
            star.x = W;
            star.y = Math.random() * H;
          }
        }
        ctx.globalAlpha = Math.min(1, 0.25 + (star.speed / 1.5) * 0.5);
        if (isWarping) {
          ctx.strokeStyle = '#00d2ff';
          ctx.lineWidth = star.size;
          ctx.beginPath();
          ctx.moveTo(star.x, star.y);
          ctx.lineTo(star.x + star.speed * 14, star.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(star.x, star.y, star.size, star.size);
        }
      });
      ctx.globalAlpha = 1.0;

      // 2. Draw Grid Lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let y = 60; y < H - 40; y += 60) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(W - 20, y);
        ctx.stroke();
      }
      for (let x = 110; x < W - 20; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x, H - 40);
        ctx.stroke();
      }

      // Axes
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 30);
      ctx.lineTo(50, H - 40);
      ctx.lineTo(W - 20, H - 40);
      ctx.stroke();

      const originX = 50;
      const originY = H - 40;
      const plotW = W - 70;
      const plotH = H - 80;

      // 3. Draw Flight Curve & Rocket if playing or crashed
      if (phase === 'flying' || phase === 'crashed') {
        const currentM = mult;
        const maxDisplayM = Math.max(10, Math.ceil(currentM * 1.35));
        const progress = Math.min(0.92, Math.log(currentM) / Math.log(maxDisplayM));
        const rocketX = originX + progress * plotW;
        const rocketY = originY - Math.pow(progress, 0.82) * plotH;

        // Draw Y-axis tick markers
        const ticks = [2, 5, 10, 25, 50, 100, 250, 500, 1000].filter(t => t <= maxDisplayM);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ticks.forEach(t => {
          const tProg = Math.log(t) / Math.log(maxDisplayM);
          const ty = originY - Math.pow(tProg, 0.82) * plotH;
          if (ty > 45 && ty < originY - 12) {
            ctx.fillText(`${t}×`, 44, ty + 3);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(48, ty);
            ctx.lineTo(W - 20, ty);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });
        ctx.textAlign = 'left';

        // Draw trajectory line
        ctx.beginPath();
        ctx.moveTo(originX, originY);
        const steps = 40;
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const px = originX + t * (rocketX - originX);
          const py = originY - Math.pow(t, 1.8) * (originY - rocketY);
          ctx.lineTo(px, py);
        }

        // Gradient under curve
        const gradient = ctx.createLinearGradient(0, rocketY, 0, originY);
        if (phase === 'crashed') {
          ctx.strokeStyle = '#ff4d4d';
          gradient.addColorStop(0, 'rgba(255, 77, 77, 0.25)');
          gradient.addColorStop(1, 'rgba(255, 77, 77, 0.0)');
        } else if (cashedOutAt) {
          ctx.strokeStyle = '#00d2ff';
          gradient.addColorStop(0, 'rgba(0, 210, 255, 0.25)');
          gradient.addColorStop(1, 'rgba(0, 210, 255, 0.0)');
        } else {
          ctx.strokeStyle = '#6be4c4';
          gradient.addColorStop(0, 'rgba(107, 228, 196, 0.25)');
          gradient.addColorStop(1, 'rgba(107, 228, 196, 0.0)');
        }

        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.lineTo(rocketX, originY);
        ctx.lineTo(originX, originY);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Rocket skin configuration
        const rocketSkin = profile.equipped.rocket || 'rocket-classic';
        let bodyColor = '#f2f4ff';
        let wingColor = '#ff785e';
        let cockpitColor = '#6be4c4';
        let flameColors = ['#ffcd69', '#ff785e'];

        if (rocketSkin === 'rocket-crimson') {
          bodyColor = '#ff4d4d'; wingColor = '#ff9f43'; cockpitColor = '#ffeaa7'; flameColors = ['#ff3838', '#ff9f43'];
        } else if (rocketSkin === 'rocket-stealth') {
          bodyColor = '#242b35'; wingColor = '#707e94'; cockpitColor = '#a55eea'; flameColors = ['#9b51e0', '#3867d6'];
        } else if (rocketSkin === 'rocket-silver-falcon') {
          bodyColor = '#e2e8f0'; wingColor = '#8fa3b8'; cockpitColor = '#00f2fe'; flameColors = ['#f1f5f9', '#00f2fe'];
        } else if (rocketSkin === 'rocket-cyber-striker') {
          bodyColor = '#0d131f'; wingColor = '#00f2fe'; cockpitColor = '#c4fa6b'; flameColors = ['#00f2fe', '#c4fa6b'];
        } else if (rocketSkin === 'rocket-plasma-phoenix') {
          bodyColor = '#ff3b80'; wingColor = '#ffd15c'; cockpitColor = '#ff9f43'; flameColors = ['#ff3b80', '#ffd15c'];
        } else if (rocketSkin === 'rocket-tyche-hyperion') {
          bodyColor = '#fffdfa'; wingColor = '#ffd15c'; cockpitColor = '#6be4c4'; flameColors = ['#ffd15c', '#ffffff'];
        }

        // Rocket flight booster particles
        if (phase === 'flying') {
          const particleCount = isWarping ? 5 : 3;
          for (let k = 0; k < particleCount; k++) {
            particles.current.push({
              x: rocketX - 8 + Math.random() * 4,
              y: rocketY + 8 + Math.random() * 4,
              vx: -(1.8 + Math.random() * (isWarping ? 4 : 2)),
              vy: 1.0 + Math.random() * 1.5,
              color: isWarping
                ? Math.random() > 0.4 ? '#00d2ff' : '#c4fa6b'
                : Math.random() > 0.5 ? flameColors[0] : flameColors[1],
              size: 2 + Math.random() * (isWarping ? 4.5 : 3.5),
              alpha: 0.95,
              decay: 0.035 + Math.random() * 0.02,
            });
          }
        }

        // Draw Rocket if alive
        if (phase === 'flying') {
          ctx.save();
          ctx.translate(rocketX, rocketY);
          ctx.rotate(-0.55);

          // Rear Thruster glow
          ctx.fillStyle = flameColors[0];
          ctx.beginPath();
          ctx.arc(-8, 0, 3, 0, Math.PI * 2);
          ctx.fill();

          // Rocket Body
          ctx.fillStyle = bodyColor;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(-10, -6);
          ctx.lineTo(-6, 0);
          ctx.lineTo(-10, 6);
          ctx.closePath();
          ctx.fill();

          // Wings & Nose
          ctx.fillStyle = wingColor;
          ctx.beginPath();
          ctx.moveTo(15, 0);
          ctx.lineTo(6, -3.5);
          ctx.lineTo(6, 3.5);
          ctx.closePath();
          ctx.fill();

          // Side stabilizers
          ctx.beginPath();
          ctx.moveTo(-4, -4);
          ctx.lineTo(-12, -9);
          ctx.lineTo(-7, -1);
          ctx.closePath();
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(-4, 4);
          ctx.lineTo(-12, 9);
          ctx.lineTo(-7, 1);
          ctx.closePath();
          ctx.fill();

          // Cockpit Window
          ctx.fillStyle = cockpitColor;
          ctx.beginPath();
          ctx.arc(2, 0, 2.8, 0, Math.PI * 2);
          ctx.fill();

          // Glow outline for legendary/mythic
          if (rocketSkin.includes('plasma') || rocketSkin.includes('tyche') || rocketSkin.includes('cyber')) {
            ctx.strokeStyle = wingColor;
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(15, 0);
            ctx.lineTo(-10, -6);
            ctx.lineTo(-6, 0);
            ctx.lineTo(-10, 6);
            ctx.closePath();
            ctx.stroke();
          }

          ctx.restore();
        }
      }

      // 4. Update and Draw Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.size *= 0.97;
        if (p.alpha <= 0) {
          particles.current.splice(i, 1);
          continue;
        }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;

      animFrame.current = requestAnimationFrame(render);
    };

    animFrame.current = requestAnimationFrame(render);
    return () => {
      running = false;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
    };
  }, [phase, mult, cashedOutAt]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const skipCrash = () => {
    const current = gameRef.current;
    if (!current || !current.active || phase !== 'flying') return;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    void triggerCrash(current.crashPoint);
  };

  const launch = async () => {
    if (!available || busy || phase === 'flying' || profile.balance < bet) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const crashPoint = generateCrashPoint();

    try {
      await onStart(id, bet);
      setCashedOutAt(null);
      setMult(1.00);
      setPhase('flying');

      const startTime = performance.now();
      gameRef.current = {
        id,
        bet,
        crashPoint,
        startTime,
        cashedOut: false,
        active: true,
      };

      let simulatedSec = 0;
      let lastTick = performance.now();

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = window.setInterval(() => {
        const current = gameRef.current;
        if (!current || !current.active) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return;
        }

        const now = performance.now();
        const deltaSec = Math.min(0.08, (now - lastTick) / 1000);
        lastTick = now;

        // When cashed out, run at 6.0x warp speed so user never waits for long flights
        const warp = current.cashedOut ? 6.0 : 1.0;
        simulatedSec += deltaSec * warp;

        // Accelerating curve: 2.0x in ~3s, 10x in ~7s, 100x in ~10.2s
        const exponent = 0.16 * simulatedSec + 0.018 * (simulatedSec ** 2) + 0.001 * (simulatedSec ** 3);
        const rawM = Math.exp(exponent);
        const currentM = Math.max(1.00, Math.floor(rawM * 100) / 100);

        setMult(currentM);

        if (autoCashoutEnabled && !current.cashedOut && currentM >= autoCashoutMult && currentM < current.crashPoint) {
          void doCashout(autoCashoutMult);
        }

        if (currentM >= current.crashPoint) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          void triggerCrash(current.crashPoint);
        }
      }, 30);
    } catch (e) {
      onError(e instanceof Error ? e.message : '로켓 발사에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const doCashout = async (targetMult?: number) => {
    const current = gameRef.current;
    if (!current || !current.active || current.cashedOut || phase !== 'flying') return;
    current.cashedOut = true;

    const payoutMult = targetMult ?? mult;
    setCashedOutAt(payoutMult);

    try {
      await onCashout(current.id, payoutMult, current.bet);
    } catch (e) {
      onError(e instanceof Error ? e.message : '캐시아웃 저장 실패');
    }
  };

  const triggerCrash = useCallback(async (finalCrashPoint: number) => {
    const current = gameRef.current;
    if (!current) return;
    current.active = false;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPhase('crashed');
    setMult(finalCrashPoint);

    const canvas = canvasRef.current;
    if (canvas) {
      const W = canvas.width;
      const H = canvas.height;
      const maxDisplayM = Math.max(10, Math.ceil(finalCrashPoint * 1.35));
      const progress = Math.min(0.92, Math.log(finalCrashPoint) / Math.log(maxDisplayM));
      const ex = 50 + progress * (W - 70);
      const ey = H - 40 - Math.pow(progress, 0.82) * (H - 80);

      for (let i = 0; i < 45; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5.5;
        particles.current.push({
          x: ex,
          y: ey,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ['#ff4d4d', '#ff785e', '#ffcd69', '#ffffff'][Math.floor(Math.random() * 4)],
          size: 3 + Math.random() * 5,
          alpha: 1.0,
          decay: 0.02 + Math.random() * 0.025,
        });
      }
    }

    setHistory(prev => [finalCrashPoint, ...prev.slice(0, 7)]);

    if (!current.cashedOut) {
      try {
        await onBust(current.id, finalCrashPoint);
      } catch (e) {
        onError(e instanceof Error ? e.message : '결과 저장 실패');
      }
    }
  }, [onBust, onError]);

  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

  return (
    <div className="crash-layout">
      <div className="crash-history-bar">
        <span className="history-label">최근 배율</span>
        <div className="history-chips">
          {history.map((h, i) => (
            <span
              key={i}
              className={`history-chip ${h >= 10 ? 'mega' : h >= 2 ? 'win' : h <= 1.2 ? 'bust' : ''}`}
            >
              {h.toFixed(2)}×
            </span>
          ))}
        </div>
      </div>

      <div className="crash-main-grid">
        <div className="crash-left-col">
          <div className="crash-viewport">
            <canvas ref={canvasRef} width={660} height={420} className="crash-canvas" />

            <div className="crash-center-overlay">
              {phase === 'flying' && (
                <div className="flying-badge">
                  <span className="live-pulse" />
                  <span>FLIGHT IN PROGRESS</span>
                </div>
              )}
              <div className={`crash-multiplier-text ${phase === 'crashed' ? 'crashed' : cashedOutAt ? 'cashed' : ''}`}>
                {phase === 'crashed' ? (
                  <>
                    <span className="crashed-label">CRASHED AT</span>
                    <h1>{mult.toFixed(2)}×</h1>
                  </>
                ) : (
                  <h1>{mult.toFixed(2)}×</h1>
                )}
              </div>

              {cashedOutAt && phase === 'flying' && (
                <div className="cashout-success-pill">
                  <ShieldCheck size={16} />
                  <span>{cashedOutAt.toFixed(2)}× 캐시아웃 성공! (+{fmt(Math.round((gameRef.current?.bet ?? bet) * cashedOutAt))} 코인)</span>
                  <span className="warp-badge">⚡ 6× 워프 중</span>
                </div>
              )}
            </div>
          </div>

          <section className="results-card crash-results-card">
            <div className="section-heading">
              <h3>내 플레이 기록</h3>
              <span>LAST 8 ROUNDS</span>
            </div>
            {profile.results.length ? (
              <div className="results-list">
                {profile.results.slice(0, 8).map(r => {
                  const isBust = r.multiplier === 0;
                  const profit = r.payout - r.bet;
                  return (
                    <div className="result-row" key={r.id}>
                      <span className={`multiplier ${r.multiplier >= 2 ? 'win' : isBust ? 'bust-tag' : ''}`}>
                        {isBust ? '폭발' : `${r.multiplier.toFixed(2)}×`}
                      </span>
                      <span>
                        <b>{fmt(r.payout)} 코인</b>
                        <small>배팅 {fmt(r.bet)} 코인</small>
                      </span>
                      <strong className={profit > 0 ? 'positive' : profit < 0 ? 'negative' : ''}>
                        {signed(profit)}
                      </strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-results">
                <Layers3 size={28} />
                <p>첫 번째 로켓을 발사해 보세요</p>
                <span>탈출 배율과 획득 코인이 여기에 기록됩니다.</span>
              </div>
            )}
          </section>
        </div>

        <aside className="crash-controls">
          <div className="control-card">
            <h3>베팅 금액</h3>
            <div className="bet-control">
              <button
                disabled={bet === BETS[0] || phase === 'flying'}
                onClick={() => setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
              >
                <Minus size={16} />
              </button>
              <select
                value={bet}
                disabled={phase === 'flying'}
                onChange={e => setBet(Number(e.target.value))}
              >
                {BETS.map(b => (
                  <option key={b} value={b}>{fmt(b)} 코인</option>
                ))}
              </select>
              <button
                disabled={bet === BETS[BETS.length - 1] || phase === 'flying'}
                onClick={() => setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="quick-bets">
              {[100, 1000, 5000, 10000].map(b => (
                <button
                  key={b}
                  disabled={phase === 'flying'}
                  className={bet === b ? 'selected' : ''}
                  onClick={() => setBet(b)}
                >
                  {fmt(b)}
                </button>
              ))}
            </div>
          </div>

          <div className="control-card">
            <div className="auto-cashout-header">
              <span className="auto-label">
                <Zap size={16} /> 자동 캐시아웃
              </span>
              <button
                className={`toggle-small ${autoCashoutEnabled ? 'on' : ''}`}
                disabled={phase === 'flying'}
                onClick={() => setAutoCashoutEnabled(!autoCashoutEnabled)}
              >
                <span />
              </button>
            </div>
            {autoCashoutEnabled && (
              <div className="auto-input-row">
                <span>목표 배율</span>
                <input
                  type="number"
                  step="0.1"
                  min="1.1"
                  max="100"
                  disabled={phase === 'flying'}
                  value={autoCashoutMult}
                  onChange={e => setAutoCashoutMult(Math.max(1.1, Number(e.target.value)))}
                />
                <span>×</span>
              </div>
            )}
          </div>

          {phase === 'flying' ? (
            !cashedOutAt ? (
              <button className="crash-button cashout-btn" onClick={() => void doCashout()}>
                <Flame size={20} />
                <span>
                  <b>캐시아웃</b>
                  <small>+{fmt(Math.round(bet * mult))} 코인</small>
                </span>
              </button>
            ) : (
              <button className="crash-button skip-btn" onClick={skipCrash}>
                <Zap size={20} />
                <span>
                  <b>⚡ 즉시 스킵 (다음 발사)</b>
                  <small>6배속 워프 진행 중 · 클릭 시 즉시 완료</small>
                </span>
              </button>
            )
          ) : (
            <button
              className="crash-button launch-btn"
              disabled={!available || busy || profile.balance < bet}
              onClick={() => void launch()}
            >
              <Rocket size={20} />
              <span>
                {profile.balance < bet ? '코인이 부족해요' : '로켓 발사하기'}
                <small>{fmt(bet)} 코인 투입</small>
              </span>
            </button>
          )}

          <div className="crash-guide-note">
            <ShieldCheck size={14} />
            <span>로켓이 폭발하기 전에 멈추면 해당 배율만큼 코인을 획득합니다!</span>
          </div>
        </aside>
      </div>
    </div>
  );
}