import { useCallback, useEffect, useRef, useState } from 'react';
import { FastForward, Layers3, Minus, Plus, ShieldCheck, Trophy } from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';

export const HORSES = [
  { id: 0, num: 1, name: '골든 선더', eng: 'Golden Thunder', color: '#ffd15c', bg: 'rgba(255, 209, 92, 0.12)', border: '#ffd15c', odd: 3.0 },
  { id: 1, num: 2, name: '사이버 블레이즈', eng: 'Cyber Blaze', color: '#00f2fe', bg: 'rgba(0, 242, 254, 0.12)', border: '#00f2fe', odd: 3.0 },
  { id: 2, num: 3, name: '팬텀 마젠타', eng: 'Phantom Magenta', color: '#ff3b80', bg: 'rgba(255, 59, 128, 0.12)', border: '#ff3b80', odd: 3.0 },
  { id: 3, num: 4, name: '네온 에메랄드', eng: 'Neon Emerald', color: '#05ffa1', bg: 'rgba(5, 255, 161, 0.12)', border: '#05ffa1', odd: 3.0 },
] as const;

type Phase = 'idle' | 'racing' | 'finished';

type RaceProps = {
  profile: Profile;
  available: boolean;
  onStart: (id: string, bet: number, horseIndex: number) => Promise<void>;
  onSettle: (id: string, winnerIndex: number, bet: number, chosenHorse: number) => Promise<void>;
  onError: (msg: string) => void;
};

// 1/4 exact equal probability for all 4 horses (25% each)
function pickWinner(): number {
  const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  if (rand < 0.25) return 0;
  if (rand < 0.50) return 1;
  if (rand < 0.75) return 2;
  return 3;
}

export default function Race({ profile, available, onStart, onSettle, onError }: RaceProps) {
  const [selectedHorse, setSelectedHorse] = useState<number>(0);
  const [bet, setBet] = useState(100);
  const [phase, setPhase] = useState<Phase>('idle');
  const [winner, setWinner] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrame = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const raceRef = useRef<{
    id: string;
    bet: number;
    chosenHorse: number;
    winner: number;
    startTime: number;
    duration: number;
    active: boolean;
    progress: [number, number, number, number];
    speeds: [number, number, number, number];
  } | null>(null);

  // Unmount auto-settle cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const current = raceRef.current;
      if (current && current.active) {
        current.active = false;
        void onSettle(current.id, current.winner, current.bet, current.chosenHorse).catch(() => {});
      }
    };
  }, [onSettle]);

  // Particles for hoof sparks, dust, and victory confetti
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

  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const signed = (n: number) => `${n > 0 ? '+' : ''}${fmt(n)}`;

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const render = (time: number) => {
      if (!running) return;
      const W = canvas.width;
      const H = canvas.height;
      const laneH = (H - 40) / 4;

      ctx.clearRect(0, 0, W, H);

      // 1. Draw Race Track Background
      ctx.fillStyle = '#080d16';
      ctx.fillRect(0, 0, W, H);

      // Distance markings & Grid
      const trackStart = 60;
      const trackFinish = W - 70;
      const trackLen = trackFinish - trackStart;

      // Track distance ticks
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      for (let m = 200; m <= 800; m += 200) {
        const x = trackStart + (m / 1000) * trackLen;
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, H - 20);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '10px monospace';
        ctx.fillText(`${m}m`, x - 10, 16);
      }

      // 2. Draw 4 Lanes
      for (let i = 0; i < 4; i++) {
        const laneY = 20 + i * laneH;
        const horse = HORSES[i];

        // Lane background
        ctx.fillStyle = i % 2 === 0 ? 'rgba(15, 22, 36, 0.6)' : 'rgba(11, 17, 28, 0.6)';
        ctx.fillRect(0, laneY, W, laneH);

        // Lane Divider
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, laneY + laneH);
        ctx.lineTo(W, laneY + laneH);
        ctx.stroke();

        // Lane Number Gate (Left)
        ctx.fillStyle = horse.bg;
        ctx.strokeStyle = horse.border;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(14, laneY + 12, 34, laneH - 24, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = horse.color;
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, 31, laneY + laneH / 2 + 6);
        ctx.textAlign = 'left';
      }

      // 3. Start Line & Checkered Finish Line
      // Start Line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(trackStart, 20);
      ctx.lineTo(trackStart, H - 20);
      ctx.stroke();

      // Finish Line (Checkered pattern)
      const checkerSize = 8;
      for (let y = 20; y < H - 20; y += checkerSize) {
        for (let col = 0; col < 2; col++) {
          const isWhite = ((Math.floor((y - 20) / checkerSize) + col) % 2) === 0;
          ctx.fillStyle = isWhite ? '#ffffff' : '#111520';
          ctx.fillRect(trackFinish + col * checkerSize, y, checkerSize, checkerSize);
        }
      }

      // Finish Banner Text
      ctx.fillStyle = '#ff785e';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('FINISH', trackFinish - 10, 16);

      // 4. Update Race Positions if active
      const currentRace = raceRef.current;
      if (currentRace && currentRace.active) {
        const elapsed = (performance.now() - currentRace.startTime) / 1000;
        const totalDur = currentRace.duration;
        const raceProgress = Math.min(1, elapsed / totalDur);

        // Calculate positions with dynamic surges
        for (let i = 0; i < 4; i++) {
          let pos = 0;
          if (raceProgress < 1) {
            // Mid-race dynamic fluctuating leads
            const baseProgress = Math.pow(raceProgress, 0.95);
            // Oscillating surge waves
            const surge = Math.sin(elapsed * 3.5 + i * 2.1) * 0.045 + Math.cos(elapsed * 1.8 + i) * 0.025;
            // Bias toward winner in the final 35% of race
            const winnerBias = (i === currentRace.winner ? Math.pow(raceProgress, 2.5) * 0.12 : 0);
            pos = Math.max(0, Math.min(0.98, baseProgress + surge + winnerBias));
          } else {
            // Finished: Winner reaches 1.0, others slightly behind
            pos = i === currentRace.winner ? 1.0 : 0.92 - (i * 0.03);
          }
          currentRace.progress[i] = pos;

          // Spawn hoof dust / spark particles
          if (phase === 'racing' && Math.random() < 0.45) {
            const laneY = 20 + i * laneH;
            const hx = trackStart + pos * trackLen;
            const hy = laneY + laneH * 0.75;
            particles.current.push({
              x: hx - 12 + Math.random() * 4,
              y: hy + Math.random() * 4,
              vx: -(1.5 + Math.random() * 2.5),
              vy: (Math.random() - 0.5) * 1.2,
              color: Math.random() > 0.4 ? HORSES[i].color : '#56667d',
              size: 2 + Math.random() * 3,
              alpha: 0.8,
              decay: 0.03 + Math.random() * 0.02,
            });
          }
        }
      }

      // 5. Draw Horses in Each Lane
      for (let i = 0; i < 4; i++) {
        const laneY = 20 + i * laneH;
        const horse = HORSES[i];
        const progress = currentRace ? currentRace.progress[i] : (phase === 'finished' && winner === i ? 1.0 : 0);
        const hx = trackStart + progress * trackLen;
        const hy = laneY + laneH / 2;

        // Gallop animation phase based on time
        const gallopTime = phase === 'racing' ? time * 0.015 : 0;
        const legPhase = Math.sin(gallopTime + i);
        const bob = phase === 'racing' ? Math.abs(Math.sin(gallopTime * 2 + i)) * 3.5 : 0;

        ctx.save();
        ctx.translate(hx, hy - bob);

        // Glow ring around selected horse
        if (selectedHorse === i) {
          ctx.strokeStyle = `${horse.color}40`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, 4, 32, 22, 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Horse Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.ellipse(0, 16 + bob, 24, 7, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- Draw Vector Horse ---
        // Back Legs
        ctx.strokeStyle = '#222d42';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(-10, 5);
        ctx.lineTo(-18 + legPhase * 8, 18);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-6, 5);
        ctx.lineTo(-10 - legPhase * 8, 18);
        ctx.stroke();

        // Horse Torso / Body
        ctx.fillStyle = '#1c2638';
        ctx.beginPath();
        ctx.ellipse(-2, 0, 16, 9, -0.1, 0, Math.PI * 2);
        ctx.fill();

        // Saddle & Jockey Silk (Horse's signature color)
        ctx.fillStyle = horse.color;
        ctx.beginPath();
        ctx.roundRect(-7, -7, 12, 8, 2);
        ctx.fill();

        // Horse Number on Silk
        ctx.fillStyle = '#080d16';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${i + 1}`, -1, -1);
        ctx.textAlign = 'left';

        // Neck & Head
        ctx.fillStyle = '#1c2638';
        ctx.beginPath();
        ctx.moveTo(8, -2);
        ctx.lineTo(16, -14);
        ctx.lineTo(22, -11);
        ctx.lineTo(13, 4);
        ctx.closePath();
        ctx.fill();

        // Muzzle / Snout
        ctx.fillStyle = '#26344d';
        ctx.beginPath();
        ctx.arc(20, -11, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Eye
        ctx.fillStyle = horse.color;
        ctx.beginPath();
        ctx.arc(16, -13, 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Glowing Mane (Hair)
        ctx.strokeStyle = horse.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(9, -2);
        ctx.lineTo(12, -11);
        ctx.stroke();

        // Glowing Tail
        ctx.strokeStyle = horse.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-16, -2);
        ctx.quadraticCurveTo(-24, legPhase * 4, -26, 6);
        ctx.stroke();

        // Front Legs
        ctx.strokeStyle = '#2d3b55';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(10, 4);
        ctx.lineTo(18 - legPhase * 9, 18);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(7, 4);
        ctx.lineTo(11 + legPhase * 9, 18);
        ctx.stroke();

        // Winner Crown / Sparkles
        if (phase === 'finished' && winner === i) {
          ctx.fillStyle = '#ffd15c';
          ctx.font = '16px sans-serif';
          ctx.fillText('👑', -5, -22);
        }

        ctx.restore();
      }

      // 6. Draw Particles
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.size *= 0.96;
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
  }, [phase, winner, selectedHorse]);

  // Start Race Handler
  const startRace = async () => {
    if (!available || busy || phase === 'racing' || profile.balance < bet) return;
    setBusy(true);

    const id = crypto.randomUUID();
    const finalWinner = pickWinner();
    const raceDuration = 7.0; // 7 seconds standard race

    try {
      await onStart(id, bet, selectedHorse);
      setWinner(null);
      setPhase('racing');

      raceRef.current = {
        id,
        bet,
        chosenHorse: selectedHorse,
        winner: finalWinner,
        startTime: performance.now(),
        duration: raceDuration,
        active: true,
        progress: [0, 0, 0, 0],
        speeds: [1, 1, 1, 1],
      };

      // Set timeout for race finish
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        void finishRace(finalWinner);
      }, raceDuration * 1000);
    } catch (e) {
      onError(e instanceof Error ? e.message : '경주 시작 실패');
      setPhase('idle');
    } finally {
      setBusy(false);
    }
  };

  // Instant Skip Handler
  const skipRace = () => {
    const current = raceRef.current;
    if (!current || !current.active || phase !== 'racing') return;
    void finishRace(current.winner);
  };

  // Settle & Finish Race
  const finishRace = useCallback(async (finalWinner: number) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const current = raceRef.current;
    if (!current || !current.active) return;
    current.active = false;

    setWinner(finalWinner);
    setPhase('finished');

    // Winner explosion confetti
    const canvas = canvasRef.current;
    if (canvas) {
      const W = canvas.width;
      const H = canvas.height;
      const laneH = (H - 40) / 4;
      const wx = W - 70;
      const wy = 20 + finalWinner * laneH + laneH / 2;

      for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 6;
        particles.current.push({
          x: wx,
          y: wy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: ['#ffd15c', '#00f2fe', '#ff3b80', '#05ffa1', '#ffffff', '#c4fa6b'][Math.floor(Math.random() * 6)],
          size: 3 + Math.random() * 5,
          alpha: 1.0,
          decay: 0.02 + Math.random() * 0.025,
        });
      }
    }

    try {
      await onSettle(current.id, finalWinner, current.bet, current.chosenHorse);
    } catch (e) {
      onError(e instanceof Error ? e.message : '결과 저장 실패');
    }
  }, [onSettle, onError]);

  return (
    <div className="race-layout">
      {/* 1. Race Track Viewport */}
      <div className="race-main-grid">
        <div className="race-left-col">
          <div className="race-viewport">
            <canvas ref={canvasRef} width={680} height={400} className="race-canvas" />

            {/* In-Race Overlay Status */}
            {phase === 'racing' && (
              <div className="race-overlay-badge">
                <span className="live-pulse" />
                <span>RACE IN PROGRESS</span>
              </div>
            )}

            {phase === 'finished' && winner !== null && (
              <div className="race-result-overlay">
                <div className={`result-banner ${winner === selectedHorse ? 'win' : 'loss'}`}>
                  <Trophy size={26} />
                  <div>
                    <h4>{HORSES[winner].num}번 {HORSES[winner].name} 1위 골인!</h4>
                    <p>
                      {winner === selectedHorse
                        ? `축하합니다! 3.00배 적중 (+${fmt(Math.round(bet * 3))} 코인)`
                        : `아쉽네요! 다음 레이스를 노려보세요.`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. My Play History (LAST 8) */}
          <section className="results-card race-results-card">
            <div className="section-heading">
              <h3>내 플레이 기록</h3>
              <span>LAST 8 RACES</span>
            </div>
            {profile.results.length ? (
              <div className="results-list">
                {profile.results.slice(0, 8).map(r => {
                  const isWin = r.multiplier >= 1;
                  const profit = r.payout - r.bet;
                  return (
                    <div className="result-row" key={r.id}>
                      <span className={`multiplier ${isWin ? 'win' : 'bust-tag'}`}>
                        {isWin ? `${r.multiplier.toFixed(2)}×` : '패배'}
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
                <p>첫 번째 경주에 베팅해 보세요</p>
                <span>우승 여부와 획득 코인이 여기에 기록됩니다.</span>
              </div>
            )}
          </section>
        </div>

        {/* 3. Betting & Controls Sidebar */}
        <aside className="race-controls">
          {/* Horse Selection Cards */}
          <div className="control-card">
            <h3>우승 예상마 선택 (1/4 확률 · 3.00×)</h3>
            <div className="horse-select-list">
              {HORSES.map(h => (
                <button
                  key={h.id}
                  disabled={phase === 'racing'}
                  className={`horse-card ${selectedHorse === h.id ? 'selected' : ''}`}
                  style={{
                    '--h-color': h.color,
                    '--h-bg': h.bg,
                    '--h-border': h.border,
                  } as React.CSSProperties}
                  onClick={() => setSelectedHorse(h.id)}
                >
                  <div className="horse-card-num" style={{ background: h.color }}>
                    {h.num}
                  </div>
                  <div className="horse-card-info">
                    <span className="horse-name">{h.name}</span>
                    <small>{h.eng}</small>
                  </div>
                  <span className="horse-odd-pill">3.00×</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bet Amount */}
          <div className="control-card">
            <h3>베팅 금액</h3>
            <div className="bet-control">
              <button
                disabled={bet === BETS[0] || phase === 'racing'}
                onClick={() => setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
              >
                <Minus size={16} />
              </button>
              <select
                value={bet}
                disabled={phase === 'racing'}
                onChange={e => setBet(Number(e.target.value))}
              >
                {BETS.map(b => (
                  <option key={b} value={b}>{fmt(b)} 코인</option>
                ))}
              </select>
              <button
                disabled={bet === BETS[BETS.length - 1] || phase === 'racing'}
                onClick={() => setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="quick-bets">
              {[100, 1000, 5000, 10000].map(b => (
                <button
                  key={b}
                  disabled={phase === 'racing'}
                  className={bet === b ? 'selected' : ''}
                  onClick={() => setBet(b)}
                >
                  {fmt(b)}
                </button>
              ))}
            </div>
          </div>

          {/* Action Button: Start or Skip */}
          {phase === 'racing' ? (
            <button className="race-button skip-btn" onClick={skipRace}>
              <FastForward size={20} />
              <span>
                <b>⚡ 결과 즉시 보기 (스킵)</b>
                <small>클릭 시 즉시 결승선 통과 및 정산</small>
              </span>
            </button>
          ) : (
            <button
              className="race-button start-btn"
              disabled={!available || busy || profile.balance < bet}
              onClick={() => void startRace()}
            >
              <Trophy size={20} />
              <span>
                {profile.balance < bet ? '코인이 부족해요' : `${HORSES[selectedHorse].num}번마에 베팅 및 출발`}
                <small>{fmt(bet)} 코인 투입 (우승 시 +{fmt(bet * 3)} 코인)</small>
              </span>
            </button>
          )}

          <div className="race-guide-note">
            <ShieldCheck size={14} />
            <span>4마리의 말은 1/4의 동일한 승률을 가지며, 적중 시 배팅액의 3배를 획득합니다!</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
