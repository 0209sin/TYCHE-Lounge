import { useCallback, useEffect, useRef, useState } from 'react';
import { FastForward, Footprints, Layers3, Minus, Plus, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';

export const STEPS = [
  { step: 1, multiplier: 1.3, rate: 0.55, name: '1단계' },
  { step: 2, multiplier: 1.8, rate: 0.50, name: '2단계' },
  { step: 3, multiplier: 2.5, rate: 0.45, name: '3단계' },
  { step: 4, multiplier: 5.0, rate: 0.40, name: '4단계' },
  { step: 5, multiplier: 10.0, rate: 0.35, name: '5단계' },
  { step: 6, multiplier: 20.0, rate: 0.30, name: '6단계' },
  { step: 7, multiplier: 50.0, rate: 0.25, name: '7단계 (골든 잭팟)' },
] as const;

type Phase = 'idle' | 'jumping' | 'landed' | 'fallen' | 'cashed_out';

type PenguinProps = {
  profile: Profile;
  available: boolean;
  onStart: (id: string, bet: number) => Promise<void>;
  onCashout: (id: string, multiplier: number, bet: number) => Promise<void>;
  onFall: (id: string, bet: number) => Promise<void>;
  onError: (msg: string) => void;
};

export default function Penguin({ profile, available, onStart, onCashout, onFall, onError }: PenguinProps) {
  const [bet, setBet] = useState(100);
  const [currentStep, setCurrentStep] = useState(0); // 0 = start platform, 1~7 = ice floes
  const [phase, setPhase] = useState<Phase>('idle');
  const [busy, setBusy] = useState(false);
  const [gameId, setGameId] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrame = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);

  // Jump animation state
  const jumpState = useRef<{
    active: boolean;
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    startTime: number;
    duration: number;
    targetStep: number;
    willSucceed: boolean;
  }>({
    active: false,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    startTime: 0,
    duration: 450,
    targetStep: 0,
    willSucceed: true,
  });

  // Broken platform tracking
  const brokenTile = useRef<number | null>(null);
  const tileCrackProgress = useRef<number>(0);

  // Particles for splash, sparks, and victory
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

  // Sound effects
  const playSound = (type: 'jump' | 'land' | 'splash' | 'win') => {
    if (!profile.sound) return;
    try {
      audioCtx.current ??= new AudioContext();
      void audioCtx.current.resume();
      const ctx = audioCtx.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(580, now + 0.15);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.2);
      } else if (type === 'land') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.1);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.14);
      } else if (type === 'splash') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(90, now + 0.3);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'win') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1);
        osc.frequency.setValueAtTime(659, now + 0.2);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.45);
      }
    } catch {
      // Audio optional
    }
  };

  // Coordinates of start ledge (0) and 7 ice floes (1..7)
  const getTilePos = (stepIndex: number, W: number, H: number) => {
    // Start ledge at left
    if (stepIndex === 0) {
      return { x: 55, y: H - 120, width: 75, height: 28 };
    }
    // 7 ice floes distributed across remaining space
    const startX = 140;
    const endX = W - 60;
    const spacing = (endX - startX) / 6;
    const x = startX + (stepIndex - 1) * spacing;
    // Gentle natural wave arc in Y
    const yOffsets = [0, -12, 4, -18, -4, -22, -10];
    const y = H - 120 + (yOffsets[stepIndex - 1] || 0);
    const width = stepIndex === 7 ? 75 : 62; // Golden 7th tile is slightly larger
    return { x, y, width, height: 24 };
  };

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

      ctx.clearRect(0, 0, W, H);

      // 1. Draw Deep Arctic Ocean Background
      const oceanGrad = ctx.createLinearGradient(0, 0, 0, H);
      oceanGrad.addColorStop(0, '#060a12');
      oceanGrad.addColorStop(0.6, '#0b1426');
      oceanGrad.addColorStop(1, '#051829');
      ctx.fillStyle = oceanGrad;
      ctx.fillRect(0, 0, W, H);

      // Aurora Borealis subtle glow in the sky
      const auroraGrad = ctx.createRadialGradient(W * 0.5, -40, 10, W * 0.5, 160, 320);
      auroraGrad.addColorStop(0, 'rgba(5, 255, 161, 0.08)');
      auroraGrad.addColorStop(0.5, 'rgba(0, 242, 254, 0.04)');
      auroraGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = auroraGrad;
      ctx.fillRect(0, 0, W, H * 0.7);

      // Distant stars / snowflake specks
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let s = 0; s < 25; s++) {
        const sx = ((s * 137 + time * 0.005) % W);
        const sy = ((s * 93 + Math.sin(time * 0.001 + s) * 10) % (H * 0.55));
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }

      // Water surface wave lines
      const waterY = H - 85;
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 15) {
        const wy = waterY + Math.sin(time * 0.003 + x * 0.03) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();

      // 2. Draw Start Ledge (Step 0)
      const startPos = getTilePos(0, W, H);
      ctx.save();
      ctx.fillStyle = '#182438';
      ctx.strokeStyle = '#324a6d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(startPos.x - startPos.width / 2, startPos.y, startPos.width, startPos.height + 60, [10, 10, 0, 0]);
      ctx.fill();
      ctx.stroke();

      // Snow cap on start ledge
      ctx.fillStyle = '#eef6ff';
      ctx.beginPath();
      ctx.roundRect(startPos.x - startPos.width / 2, startPos.y - 2, startPos.width, 10, [6, 6, 2, 2]);
      ctx.fill();

      // Start text
      ctx.fillStyle = '#8aa0bf';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('START', startPos.x, startPos.y + 24);
      ctx.restore();

      // 3. Draw 7 Ice Floes (Step 1..7)
      for (let s = 1; s <= 7; s++) {
        const pos = getTilePos(s, W, H);
        const stepData = STEPS[s - 1];
        const isPassed = currentStep >= s && brokenTile.current !== s;
        const isCurrent = currentStep === s && phase !== 'fallen';
        const isNext = currentStep === s - 1 && (phase === 'idle' || phase === 'landed');
        const isBroken = brokenTile.current === s;
        const isGold = s === 7;

        // Platform gentle floating bob
        const tileBob = Math.sin(time * 0.002 + s * 1.1) * 2;
        const drawY = pos.y + tileBob + (isBroken ? tileCrackProgress.current * 45 : 0);

        ctx.save();

        // Water reflection ripple under floe
        ctx.fillStyle = isGold ? 'rgba(255, 209, 92, 0.06)' : isCurrent ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.ellipse(pos.x, drawY + pos.height + 6, pos.width * 0.65, 8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Glow ring for Next Target or Current
        if (isNext) {
          ctx.strokeStyle = isGold ? 'rgba(255, 209, 92, 0.6)' : 'rgba(0, 242, 254, 0.5)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.ellipse(pos.x, drawY + 8, pos.width * 0.6, pos.height * 0.55, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Ice Floe Body
        const iceGrad = ctx.createLinearGradient(pos.x, drawY, pos.x, drawY + pos.height);
        if (isGold) {
          iceGrad.addColorStop(0, '#ffeaa7');
          iceGrad.addColorStop(0.4, '#ffd15c');
          iceGrad.addColorStop(1, '#c99718');
        } else if (isCurrent) {
          iceGrad.addColorStop(0, '#e0fcff');
          iceGrad.addColorStop(0.4, '#80f1ff');
          iceGrad.addColorStop(1, '#1b8ea6');
        } else if (isPassed) {
          iceGrad.addColorStop(0, '#c7f1ff');
          iceGrad.addColorStop(0.4, '#5cb9e0');
          iceGrad.addColorStop(1, '#185f85');
        } else {
          iceGrad.addColorStop(0, '#2b3f5c');
          iceGrad.addColorStop(0.4, '#1b2a3f');
          iceGrad.addColorStop(1, '#0f1a28');
        }

        ctx.fillStyle = iceGrad;
        ctx.strokeStyle = isGold ? '#ffd15c' : isCurrent ? '#00f2fe' : isPassed ? '#5cb9e0' : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isGold || isCurrent ? 2 : 1;

        // Ice shard polygon shape
        ctx.beginPath();
        ctx.moveTo(pos.x - pos.width / 2, drawY + 6);
        ctx.lineTo(pos.x - pos.width * 0.35, drawY - 2);
        ctx.lineTo(pos.x + pos.width * 0.35, drawY - 2);
        ctx.lineTo(pos.x + pos.width / 2, drawY + 7);
        ctx.lineTo(pos.x + pos.width * 0.38, drawY + pos.height);
        ctx.lineTo(pos.x - pos.width * 0.4, drawY + pos.height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cracks on broken tile
        if (isBroken) {
          ctx.strokeStyle = '#ff3b80';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(pos.x - 12, drawY);
          ctx.lineTo(pos.x + 2, drawY + 8);
          ctx.lineTo(pos.x + 14, drawY + 3);
          ctx.moveTo(pos.x, drawY + 8);
          ctx.lineTo(pos.x - 4, drawY + pos.height);
          ctx.stroke();
        }

        // Top glistening ice sheen
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(pos.x, drawY + 3, pos.width * 0.3, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Multiplier & Probability Badge below tile
        const pillY = drawY + pos.height + 15;
        const pillColor = isGold ? '#ffd15c' : isPassed || isCurrent ? '#00f2fe' : '#6b7d96';
        ctx.fillStyle = isCurrent ? 'rgba(0, 242, 254, 0.22)' : 'rgba(15, 22, 36, 0.85)';
        ctx.strokeStyle = pillColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(pos.x - 26, pillY - 9, 52, 27, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = pillColor;
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${stepData.multiplier}×`, pos.x, pillY + 3);

        const successRate = Math.round(stepData.rate * 100);
        ctx.fillStyle = isGold ? '#ffeaa7' : isPassed || isCurrent ? '#c4fa6b' : '#889bb4';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.fillText(`${successRate}% 생존`, pos.x, pillY + 14);

        ctx.restore();
      }

      // 4. Calculate Penguin Position (Idle, Landed, or Jumping)
      let px = 0;
      let py = 0;
      let jumpArc = 0;
      let rotation = 0;
      let scaleY = 1.0;

      if (jumpState.current.active) {
        const j = jumpState.current;
        const elapsed = performance.now() - j.startTime;
        const progress = Math.min(1, elapsed / j.duration);

        // Linear interpolation X & Y
        px = j.fromX + (j.toX - j.fromX) * progress;
        py = j.fromY + (j.toY - j.fromY) * progress;

        // Parabolic jump arc
        const jumpH = 60;
        jumpArc = 4 * jumpH * progress * (1 - progress);
        py -= jumpArc;

        // Rotational tilt forward while jumping
        rotation = (progress - 0.5) * 0.5;

        // Complete jump
        if (progress >= 1) {
          j.active = false;
          if (j.willSucceed) {
            setCurrentStep(j.targetStep);
            setPhase('landed');
            playSound('land');

            // Landing sparkles
            for (let i = 0; i < 16; i++) {
              particles.current.push({
                x: px,
                y: py + 16,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 2.5,
                color: j.targetStep === 7 ? '#ffd15c' : '#00f2fe',
                size: 2 + Math.random() * 3,
                alpha: 1.0,
                decay: 0.03,
              });
            }

            // If 7th step reached, auto-cashout victory!
            if (j.targetStep === 7) {
              playSound('win');
              void triggerAutoJackpot();
            }
          } else {
            // Failed jump: tile cracks and penguin sinks
            brokenTile.current = j.targetStep;
            setPhase('fallen');
            playSound('splash');

            // Splash particles
            for (let i = 0; i < 30; i++) {
              particles.current.push({
                x: px + (Math.random() - 0.5) * 20,
                y: H - 90,
                vx: (Math.random() - 0.5) * 5,
                vy: -(2 + Math.random() * 5),
                color: ['#00f2fe', '#ffffff', '#5cb9e0', '#ff3b80'][Math.floor(Math.random() * 4)],
                size: 3 + Math.random() * 4,
                alpha: 1.0,
                decay: 0.025,
              });
            }

            void handleFall();
          }
        }
      } else {
        // Stationary on current tile
        const curTile = getTilePos(currentStep, W, H);
        px = curTile.x;
        const tileBob = currentStep === 0 ? 0 : Math.sin(time * 0.002 + currentStep * 1.1) * 2;
        py = curTile.y + tileBob;

        // Idle gentle breathing bob
        if (phase === 'idle' || phase === 'landed') {
          py += Math.sin(time * 0.004) * 2;
        } else if (phase === 'fallen') {
          // Sinking down into water
          tileCrackProgress.current = Math.min(1, tileCrackProgress.current + 0.03);
          py += tileCrackProgress.current * 40;
        }
      }

      // 5. Draw Cute Neon Penguin
      if (phase !== 'fallen' || tileCrackProgress.current < 0.95) {
        ctx.save();
        ctx.translate(px, py - 18);
        ctx.rotate(rotation);
        ctx.scale(1.0, scaleY);

        const isGoldPenguin = currentStep === 7;
        const penguinSkin = profile.equipped.penguin || 'penguin-classic';
        let bodyColor = isGoldPenguin ? '#2c2208' : '#111827';
        let bellyColor = isGoldPenguin ? '#fff9e6' : '#eef6ff';
        let feetColor = '#ff9f43';
        let scarfColor = isGoldPenguin ? '#ffd15c' : '#00f2fe';
        let visorColor = isGoldPenguin ? '#ffd15c' : '#ff3b80';
        let accessory: 'none' | 'crown' | 'sailor' | 'angel' | 'ribbon' = isGoldPenguin ? 'crown' : 'none';

        if (penguinSkin === 'penguin-pink') {
          bodyColor = '#ff77a9'; bellyColor = '#fff0f5'; feetColor = '#ff6b81'; scarfColor = '#ffffff'; visorColor = '#ff3b80'; accessory = 'ribbon';
        } else if (penguinSkin === 'penguin-frost') {
          bodyColor = '#48dbfb'; bellyColor = '#e0f7fa'; feetColor = '#feca57'; scarfColor = '#1dd1a1'; visorColor = '#00d2d3';
        } else if (penguinSkin === 'penguin-silver-sailor') {
          bodyColor = '#576574'; bellyColor = '#f1f2f6'; feetColor = '#ff9f43'; scarfColor = '#0abde3'; visorColor = '#54a0ff'; accessory = 'sailor';
        } else if (penguinSkin === 'penguin-golden-emperor') {
          bodyColor = '#2c2208'; bellyColor = '#fff9e6'; feetColor = '#ffa502'; scarfColor = '#ffd15c'; visorColor = '#ffd15c'; accessory = 'crown';
        } else if (penguinSkin === 'penguin-mecha-neon') {
          bodyColor = '#0c2461'; bellyColor = '#1e3799'; feetColor = '#00d2d3'; scarfColor = '#00f2fe'; visorColor = '#00f2fe';
        } else if (penguinSkin === 'penguin-tyche-angel') {
          bodyColor = '#ffffff'; bellyColor = '#fef9e7'; feetColor = '#f6b93b'; scarfColor = '#ffd15c'; visorColor = '#ffd15c'; accessory = 'angel';
        }

        // Penguin Shadow on ground
        if (!jumpState.current.active && phase !== 'fallen') {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.beginPath();
          ctx.ellipse(0, 20, 16, 5, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Penguin Feet
        ctx.fillStyle = feetColor;
        ctx.beginPath();
        ctx.ellipse(-6, 17, 5, 2.5, -0.2, 0, Math.PI * 2);
        ctx.ellipse(6, 17, 5, 2.5, 0.2, 0, Math.PI * 2);
        ctx.fill();

        // Penguin Body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.ellipse(0, 4, 16, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        // White Belly
        ctx.fillStyle = bellyColor;
        ctx.beginPath();
        ctx.ellipse(0, 7, 10, 13, 0, 0, Math.PI * 2);
        ctx.fill();

        // Flipper Wings (Flap when jumping)
        const flap = jumpState.current.active ? Math.sin(time * 0.04) * 6 : 0;
        ctx.fillStyle = bodyColor;
        // Left flipper
        ctx.beginPath();
        ctx.ellipse(-14, 5 + flap, 4, 9, -0.3 + flap * 0.05, 0, Math.PI * 2);
        ctx.fill();
        // Right flipper
        ctx.beginPath();
        ctx.ellipse(14, 5 - flap, 4, 9, 0.3 - flap * 0.05, 0, Math.PI * 2);
        ctx.fill();

        // Winter Scarf
        ctx.fillStyle = scarfColor;
        ctx.beginPath();
        ctx.roundRect(-11, -3, 22, 6, 3);
        ctx.fill();
        // Scarf tail flutter
        ctx.beginPath();
        ctx.roundRect(5, 0, 5, 9 + Math.sin(time * 0.006) * 2, 2);
        ctx.fill();

        // Cyber Visor / Goggles (Glowing)
        ctx.fillStyle = visorColor;
        ctx.beginPath();
        ctx.roundRect(-8, -11, 16, 7, 3);
        ctx.fill();
        // Visor lens shine
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(-6, -10, 4, 2, 1);
        ctx.roundRect(2, -10, 4, 2, 1);
        ctx.fill();

        // Orange Beak
        ctx.fillStyle = '#ff9f43';
        ctx.beginPath();
        ctx.moveTo(-3, -4);
        ctx.lineTo(3, -4);
        ctx.lineTo(0, -1);
        ctx.closePath();
        ctx.fill();

        // Head Accessories
        if (accessory === 'crown') {
          ctx.font = '16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('👑', 0, -16);
        } else if (accessory === 'angel') {
          ctx.strokeStyle = '#ffd15c';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.ellipse(0, -17, 10, 3.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        } else if (accessory === 'sailor') {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(-8, -17, 16, 5, 2);
          ctx.fill();
          ctx.fillStyle = '#0abde3';
          ctx.beginPath();
          ctx.arc(0, -17, 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (accessory === 'ribbon') {
          ctx.font = '13px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🎀', 9, -12);
        }

        ctx.restore();
      }

      // 6. Draw Particles (Sparks, Confetti, Water drops)
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
  }, [currentStep, phase]);

  // Jump to Next Tile
  const jumpNext = async () => {
    if (!available || busy || jumpState.current.active) return;
    const nextStep = currentStep + 1;
    if (nextStep > 7) return;

    setBusy(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setBusy(false);
      return;
    }

    const W = canvas.width;
    const H = canvas.height;
    const fromPos = getTilePos(currentStep, W, H);
    const toPos = getTilePos(nextStep, W, H);

    // If step 1, initiate game in economy first
    let id = gameId;
    if (currentStep === 0) {
      if (profile.balance < bet) {
        onError('코인이 부족합니다.');
        setBusy(false);
        return;
      }
      id = crypto.randomUUID();
      setGameId(id);
      brokenTile.current = null;
      tileCrackProgress.current = 0;
      try {
        await onStart(id, bet);
      } catch (e) {
        onError(e instanceof Error ? e.message : '게임 시작 실패');
        setBusy(false);
        return;
      }
    }

    // Determine random success for this step using exact configured rates
    const stepConfig = STEPS[nextStep - 1];
    const rand = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const willSucceed = rand < stepConfig.rate;

    playSound('jump');
    setPhase('jumping');

    jumpState.current = {
      active: true,
      fromX: fromPos.x,
      fromY: fromPos.y,
      toX: toPos.x,
      toY: toPos.y,
      startTime: performance.now(),
      duration: 450,
      targetStep: nextStep,
      willSucceed,
    };

    setBusy(false);
  };

  // Fall settlement
  const handleFall = useCallback(async () => {
    try {
      await onFall(gameId, bet);
    } catch (e) {
      onError(e instanceof Error ? e.message : '실패 정산 오류');
    }
  }, [gameId, bet, onFall, onError]);

  // Cashout current multiplier
  const cashout = async () => {
    if (!available || busy || currentStep === 0 || phase !== 'landed') return;
    setBusy(true);
    const stepConfig = STEPS[currentStep - 1];
    playSound('win');
    setPhase('cashed_out');
    try {
      await onCashout(gameId, stepConfig.multiplier, bet);
    } catch (e) {
      onError(e instanceof Error ? e.message : '캐시아웃 실패');
    } finally {
      setBusy(false);
    }
  };

  // Auto cashout for 50x 7th step
  const triggerAutoJackpot = useCallback(async () => {
    setPhase('cashed_out');
    try {
      await onCashout(gameId, 50.0, bet);
    } catch (e) {
      onError(e instanceof Error ? e.message : '잭팟 정산 실패');
    }
  }, [gameId, bet, onCashout, onError]);

  // Reset to Play Again
  const resetGame = () => {
    setCurrentStep(0);
    setPhase('idle');
    brokenTile.current = null;
    tileCrackProgress.current = 0;
  };

  const currentMultiplier = currentStep > 0 ? STEPS[currentStep - 1].multiplier : 1.0;
  const nextMultiplier = currentStep < 7 ? STEPS[currentStep].multiplier : 50.0;
  const nextRatePercent = currentStep < 7 ? Math.round(STEPS[currentStep].rate * 100) : 0;
  const currentPayout = Math.round(bet * currentMultiplier);

  return (
    <div className="penguin-layout">
      <div className="penguin-main-grid">
        {/* Left Column: Canvas Viewport & History */}
        <div className="penguin-left-col">
          <div className="penguin-viewport">
            <canvas ref={canvasRef} width={720} height={380} className="penguin-canvas" />

            {/* In-Game Status Overlay */}
            {phase === 'landed' && (
              <div className="penguin-live-badge">
                <span className="live-pulse" />
                <span>{STEPS[currentStep - 1].name} 성공 · {currentMultiplier}× 확보!</span>
              </div>
            )}

            {/* Result Overlays */}
            {phase === 'cashed_out' && (
              <div className="penguin-result-overlay">
                <div className="result-banner win">
                  <Trophy size={28} />
                  <div>
                    <h4>탈출 성공! {currentMultiplier}배 캐시아웃</h4>
                    <p>+{fmt(currentPayout)} 코인을 획득했습니다! (순손익: +{fmt(currentPayout - bet)})</p>
                  </div>
                </div>
              </div>
            )}

            {phase === 'fallen' && (
              <div className="penguin-result-overlay">
                <div className="result-banner loss">
                  <span className="cry-emoji">💦</span>
                  <div>
                    <h4>얼음이 콰직- 깨졌습니다!</h4>
                    <p>펭귄이 물에 빠졌어요. (0배 처리, -{fmt(bet)} 코인)</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stepping Stones Progress Bar */}
          <div className="penguin-step-tracker">
            {STEPS.map(s => {
              const isPassed = currentStep >= s.step && brokenTile.current !== s.step;
              const isCurrent = currentStep === s.step && phase !== 'fallen';
              const isFailed = brokenTile.current === s.step;
              const succ = Math.round(s.rate * 100);
              const fail = 100 - succ;
              return (
                <div
                  key={s.step}
                  className={`tracker-step ${isCurrent ? 'current' : isPassed ? 'passed' : ''} ${isFailed ? 'failed' : ''}`}
                >
                  <span className="step-num">{s.step}단계</span>
                  <span className="step-mult">{s.multiplier}×</span>
                  <span className="step-rate-tag">{succ}% 성공</span>
                  <small className="step-fail-tag">({fail}% 퐁당)</small>
                </div>
              );
            })}
          </div>

          {/* My Play History (LAST 8 JUMPS) */}
          <section className="results-card penguin-results-card">
            <div className="section-heading">
              <h3>내 플레이 기록</h3>
              <span>LAST 8 JUMPS</span>
            </div>
            {profile.results.length ? (
              <div className="results-list">
                {profile.results.slice(0, 8).map(r => {
                  const isWin = r.multiplier >= 1;
                  const profit = r.payout - r.bet;
                  return (
                    <div className="result-row" key={r.id}>
                      <span className={`multiplier ${isWin ? 'win' : 'bust-tag'}`}>
                        {isWin ? `${r.multiplier.toFixed(2)}×` : '탈락'}
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
                <p>첫 번째 점프에 도전해 보세요</p>
                <span>점프 성공 배율과 획득 코인이 여기에 기록됩니다.</span>
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Betting & Action Controls */}
        <aside className="penguin-controls">
          {/* Bet Amount */}
          <div className="control-card">
            <h3>베팅 금액</h3>
            <div className="bet-control">
              <button
                disabled={bet === BETS[0] || phase === 'jumping' || (phase === 'landed' && currentStep > 0)}
                onClick={() => setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
              >
                <Minus size={16} />
              </button>
              <select
                value={bet}
                disabled={phase === 'jumping' || (phase === 'landed' && currentStep > 0)}
                onChange={e => setBet(Number(e.target.value))}
              >
                {BETS.map(b => (
                  <option key={b} value={b}>{fmt(b)} 코인</option>
                ))}
              </select>
              <button
                disabled={bet === BETS[BETS.length - 1] || phase === 'jumping' || (phase === 'landed' && currentStep > 0)}
                onClick={() => setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="quick-bets">
              {[100, 1000, 5000, 10000].map(b => (
                <button
                  key={b}
                  disabled={phase === 'jumping' || (phase === 'landed' && currentStep > 0)}
                  className={bet === b ? 'selected' : ''}
                  onClick={() => setBet(b)}
                >
                  {fmt(b)}
                </button>
              ))}
            </div>
          </div>

          {/* Game Action Buttons */}
          <div className="action-button-group">
            {phase === 'fallen' || phase === 'cashed_out' ? (
              <button className="penguin-button start-btn" onClick={resetGame}>
                <Sparkles size={20} />
                <span>
                  <b>새 게임 시작하기</b>
                  <small>다시 1번 얼음부터 점프</small>
                </span>
              </button>
            ) : currentStep === 0 ? (
              <button
                className="penguin-button start-btn"
                disabled={!available || busy || profile.balance < bet}
                onClick={() => void jumpNext()}
              >
                <Footprints size={20} />
                <span>
                  <b>{profile.balance < bet ? '코인이 부족해요' : '1번 얼음 점프! (성공 55%)'}</b>
                  <small>실패 위험 45% · 성공 시 1.30× 확보 ({fmt(bet)} 코인)</small>
                </span>
              </button>
            ) : (
              <>
                {/* Jump to Next Tile Button */}
                <button
                  className="penguin-button jump-btn"
                  disabled={!available || busy || phase === 'jumping' || currentStep >= 7}
                  onClick={() => void jumpNext()}
                >
                  <FastForward size={20} />
                  <span>
                    <b>{currentStep + 1}번 얼음 점프 ➡️ (성공 {nextRatePercent}%)</b>
                    <small>실패 위험 {100 - nextRatePercent}% · 성공 시 {nextMultiplier}× 달성</small>
                  </span>
                </button>

                {/* Cashout Button */}
                <button
                  className="penguin-button cashout-btn"
                  disabled={!available || busy || phase === 'jumping' || currentStep === 0}
                  onClick={() => void cashout()}
                >
                  <Trophy size={20} />
                  <span>
                    <b>여기서 멈추기 (캐시아웃)</b>
                    <small>+{fmt(currentPayout)} 코인 수령 ({currentMultiplier}×)</small>
                  </span>
                </button>
              </>
            )}
          </div>

          {/* Multiplier Ladder Preview */}
          <div className="ladder-card">
            <h4>얼음길 단계별 성공 & 실패 확률</h4>
            <div className="ladder-list">
              {STEPS.map(s => {
                const succ = Math.round(s.rate * 100);
                const fail = 100 - succ;
                return (
                  <div key={s.step} className={`ladder-row ${currentStep === s.step ? 'active' : ''}`}>
                    <span className="ladder-name">{s.step}번 얼음 (<b>{s.multiplier}×</b>)</span>
                    <span className="ladder-stats">
                      <b className="succ-text">성공 {succ}%</b>
                      <small className="fail-text">실패 {fail}%</small>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="penguin-guide-note">
            <ShieldCheck size={14} />
            <span>각 칸마다 언제든 멈춰서 캐시아웃할 수 있으며, 얼음이 깨지면 0배가 됩니다!</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
