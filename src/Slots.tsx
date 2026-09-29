import { useCallback, useEffect, useRef, useState } from 'react';
import { HelpCircle, Layers3, Minus, Play, Plus, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';
import { SLOT_SYMBOLS, spinSlots, type SlotSpinResult } from './gameMath';

type SlotsProps = {
  profile: Profile;
  available: boolean;
  onSpin: (id: string, bet: number, reels: [number, number, number], multiplier: number) => Promise<void>;
  onError: (msg: string) => void;
};

export default function Slots({ profile, available, onSpin, onError }: SlotsProps) {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<[number, number, number]>([5, 5, 5]); // Initial: 3 cherries
  const [lastWin, setLastWin] = useState<SlotSpinResult | null>(null);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [autoSpinCount, setAutoSpinCount] = useState<number>(0);
  const [fastMode, setFastMode] = useState<boolean>(false);
  const [showPaytable, setShowPaytable] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ reels: [number, number, number]; mult: number; payout: number }>>([]);

  const audioCtx = useRef<AudioContext | null>(null);
  const autoSpinRef = useRef(autoSpinCount);
  autoSpinRef.current = autoSpinCount;
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

  const onSpinRef = useRef(onSpin);
  onSpinRef.current = onSpin;

  // Sound effects synthesizer
  const playTone = useCallback((type: 'click' | 'reel_stop' | 'win' | 'jackpot') => {
    if (!profile.sound) return;
    try {
      audioCtx.current ??= new AudioContext();
      if (audioCtx.current.state === 'suspended') void audioCtx.current.resume();
      const ctx = audioCtx.current;
      const now = ctx.currentTime;

      if (type === 'click') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === 'reel_stop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.setValueAtTime(freq, now + idx * 0.07);
          gain.gain.setValueAtTime(0.04, now + idx * 0.07);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.07 + 0.12);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.07);
          osc.stop(now + idx * 0.07 + 0.13);
        });
      } else if (type === 'jackpot') {
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.06, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(0, now + idx * 0.08 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.26);
        });
      }
    } catch {
      // Audio is non-blocking
    }
  }, [profile.sound]);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        void audioCtx.current.close().catch(() => {});
      }
    };
  }, []);

  // Spin executor
  const executeSpin = useCallback(async () => {
    if (!available || spinningRef.current || profile.balance < bet) {
      setAutoSpinCount(0);
      return;
    }

    setSpinning(true);
    playTone('click');

    const id = crypto.randomUUID();
    const result = spinSlots();
    const payout = Math.floor(bet * result.multiplier);

    try {
      await onSpinRef.current(id, bet, result.reels, result.multiplier);
      setLastPayout(payout);
      setLastWin(null);

      // Animate reels
      const baseDuration = fastMode ? 350 : 900;
      const stagger = fastMode ? 150 : 350;

      const finishTime = baseDuration + stagger * 2;

      // Animate visual stopping
      const targetIndices = result.reels;
      targetIndices.forEach((targetSymbol, reelIdx) => {
        const reelDuration = baseDuration + reelIdx * stagger;
        setTimeout(() => {
          playTone('reel_stop');
          setReels(prev => {
            const next = [...prev] as [number, number, number];
            next[reelIdx] = targetSymbol;
            return next;
          });
        }, reelDuration);
      });

      // After all reels stop
      setTimeout(() => {
        setSpinning(false);
        setLastWin(result);
        setHistory(prev => [{ reels: result.reels, mult: result.multiplier, payout }, ...prev.slice(0, 9)]);

        if (result.isJackpot) {
          playTone('jackpot');
        } else if (result.multiplier > 0) {
          playTone('win');
        }

        // Auto Spin check
        if (autoSpinRef.current > 0) {
          setAutoSpinCount(prev => prev - 1);
          setTimeout(() => {
            if (autoSpinRef.current > 0) {
              void executeSpin();
            }
          }, fastMode ? 400 : 700);
        }
      }, finishTime + 80);
    } catch (e) {
      setSpinning(false);
      setAutoSpinCount(0);
      onError(e instanceof Error ? e.message : '스핀 처리에 실패했습니다.');
    }
  }, [available, bet, fastMode, onError, playTone, profile.balance]);

  const handleStartAuto = (count: number) => {
    if (autoSpinCount > 0) {
      setAutoSpinCount(0);
      return;
    }
    setAutoSpinCount(count);
    if (!spinning) {
      void executeSpin();
    }
  };

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  return (
    <div className="slots-layout">
      <div className="slots-main-grid">
        {/* Slot Cabinet Section */}
        <div className="slots-cabinet-col">
          <div className="slots-cabinet">
            {/* Top Cabinet Marquee */}
            <div className="slots-marquee">
              <div className="marquee-glow-bar" />
              <div className="marquee-content">
                <span className="marquee-badge">JACKPOT ×50</span>
                <h2>CYBER SLOTS 777</h2>
                <div className="marquee-lights">
                  <span className="dot dot-1" />
                  <span className="dot dot-2" />
                  <span className="dot dot-3" />
                  <span className="dot dot-4" />
                </div>
              </div>
            </div>

            {/* Reel Display Viewport */}
            <div className="reels-viewport-frame">
              {/* Center Payline Glowing Guide */}
              <div className="payline-laser">
                <div className="payline-left-marker">▶</div>
                <div className="payline-line" />
                <div className="payline-right-marker">◀</div>
              </div>

              {/* 3 Reels Window */}
              <div className="reels-window">
                {[0, 1, 2].map(reelIdx => {
                  const activeSymbolIdx = reels[reelIdx];
                  const activeSym = SLOT_SYMBOLS[activeSymbolIdx];

                  return (
                    <div key={reelIdx} className={`slot-reel ${spinning ? 'reel-blur' : ''}`}>
                      <div className="reel-inner">
                        {/* Top Adjacent Symbol Preview */}
                        <div className="symbol-cell symbol-preview">
                          <span className="sym-icon">
                            {SLOT_SYMBOLS[(activeSymbolIdx + 5) % SLOT_SYMBOLS.length].icon}
                          </span>
                        </div>

                        {/* Center Winning Payline Symbol */}
                        <div
                          className={`symbol-cell symbol-center ${
                            lastWin && lastWin.multiplier > 0 && !spinning ? 'win-pulse' : ''
                          }`}
                          style={{
                            '--sym-color': activeSym.color,
                            borderColor: lastWin && lastWin.multiplier > 0 ? activeSym.color : 'transparent',
                          } as React.CSSProperties}
                        >
                          <span className="sym-icon" style={{ filter: `drop-shadow(0 0 10px ${activeSym.color}88)` }}>
                            {activeSym.icon}
                          </span>
                          <span className="sym-name" style={{ color: activeSym.color }}>
                            {activeSym.name}
                          </span>
                        </div>

                        {/* Bottom Adjacent Symbol Preview */}
                        <div className="symbol-cell symbol-preview">
                          <span className="sym-icon">
                            {SLOT_SYMBOLS[(activeSymbolIdx + 1) % SLOT_SYMBOLS.length].icon}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* In-game Overlay Toast when Winning */}
              {lastWin && lastWin.multiplier > 0 && !spinning && (
                <div className={`slots-win-banner ${lastWin.isJackpot ? 'jackpot-banner' : ''}`}>
                  <div className="win-banner-title">
                    <Sparkles size={18} />
                    <span>{lastWin.winType}</span>
                  </div>
                  <div className="win-banner-payout">
                    +{fmt(lastPayout)} <small>코인</small>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status Bar */}
            <div className="slots-status-bar">
              <div className="status-box">
                <span>배팅 코인</span>
                <strong>{fmt(bet)}</strong>
              </div>
              <div className="status-box highlight">
                <span>최근 당첨금</span>
                <strong className={lastPayout > 0 ? 'text-win' : ''}>
                  {lastPayout > 0 ? `+${fmt(lastPayout)}` : '0'}
                </strong>
              </div>
              <div className="status-box">
                <span>당첨 배율</span>
                <strong>{lastWin ? `${lastWin.multiplier.toFixed(1)}×` : '—'}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Betting Controls & Paytable */}
        <aside className="slots-controls-sidebar">
          {/* Bet Selector */}
          <div className="control-card">
            <div className="control-card-header">
              <h3>베팅 금액</h3>
              <button
                type="button"
                className="paytable-toggle-btn"
                onClick={() => setShowPaytable(prev => !prev)}
              >
                <HelpCircle size={15} />
                <span>{showPaytable ? '배당표 닫기' : '배당표 보기'}</span>
              </button>
            </div>

            <div className="bet-control">
              <button
                type="button"
                disabled={bet === BETS[0] || spinning}
                onClick={() => setBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
              >
                <Minus size={16} />
              </button>
              <select
                value={bet}
                disabled={spinning}
                onChange={e => setBet(Number(e.target.value))}
              >
                {BETS.map(b => (
                  <option key={b} value={b}>{fmt(b)} 코인</option>
                ))}
              </select>
              <button
                type="button"
                disabled={bet === BETS[BETS.length - 1] || spinning}
                onClick={() => setBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="quick-bets">
              {[100, 500, 1000, 5000, 10000].map(b => (
                <button
                  key={b}
                  type="button"
                  disabled={spinning}
                  className={bet === b ? 'selected' : ''}
                  onClick={() => setBet(b)}
                >
                  {fmt(b)}
                </button>
              ))}
            </div>
          </div>

          {/* Paytable Pop-in Card */}
          {showPaytable && (
            <div className="control-card paytable-card">
              <h3>심볼 배당표 (3릴 중앙 일치 시)</h3>
              <div className="paytable-grid">
                {SLOT_SYMBOLS.map(sym => (
                  <div key={sym.id} className="paytable-row">
                    <span className="pt-icon">{sym.icon}</span>
                    <span className="pt-name" style={{ color: sym.color }}>{sym.name} 3개</span>
                    <strong className="pt-mult">{sym.payout3}×</strong>
                  </div>
                ))}
                <div className="paytable-row highlight">
                  <span className="pt-icon">🍒🍒</span>
                  <span className="pt-name" style={{ color: '#ff3b80' }}>체리 2개</span>
                  <strong className="pt-mult">2.0×</strong>
                </div>
                <div className="paytable-row highlight">
                  <span className="pt-icon">🍒</span>
                  <span className="pt-name" style={{ color: '#ff3b80' }}>체리 1개 (약 41% 출현)</span>
                  <strong className="pt-mult">0.5×</strong>
                </div>
              </div>
            </div>
          )}

          {/* Action Button: Spin */}
          <button
            type="button"
            className="slot-spin-btn"
            disabled={!available || spinning || profile.balance < bet}
            onClick={() => void executeSpin()}
          >
            <Play size={22} className="spin-play-icon" />
            <span>
              {spinning
                ? '릴 회전 중...'
                : profile.balance < bet
                ? '코인이 부족해요'
                : '스핀 (SPIN)'}
              <small>{fmt(bet)} 코인 투입</small>
            </span>
          </button>

          {/* Auto Spin & Speed Controls */}
          <div className="slot-extra-controls">
            <div className="auto-spin-group">
              <span className="auto-label">
                <RefreshCw size={14} className={autoSpinCount > 0 ? 'spin' : ''} />
                <span>자동 스핀:</span>
              </span>
              {[10, 25, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  disabled={spinning && autoSpinCount === 0}
                  className={`auto-pill ${autoSpinCount === cnt ? 'active' : ''}`}
                  onClick={() => handleStartAuto(cnt)}
                >
                  {autoSpinCount === cnt ? '정지' : `${cnt}회`}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={`fast-toggle-btn ${fastMode ? 'active' : ''}`}
              onClick={() => setFastMode(prev => !prev)}
            >
              <Zap size={15} />
              <span>{fastMode ? '고속 모드 ON' : '고속 모드 OFF'}</span>
            </button>
          </div>

          {/* History */}
          <div className="control-card history-card">
            <div className="control-card-header">
              <h3>최근 결과</h3>
              <span>LAST 10</span>
            </div>
            {history.length ? (
              <div className="slots-history-list">
                {history.map((h, i) => (
                  <div key={i} className="slots-history-row">
                    <div className="hist-icons">
                      {h.reels.map((r, ri) => (
                        <span key={ri}>{SLOT_SYMBOLS[r].icon}</span>
                      ))}
                    </div>
                    <span className={`hist-mult ${h.mult >= 1 ? 'win' : h.mult > 0 ? 'partial' : ''}`}>
                      {h.mult > 0 ? `${h.mult.toFixed(1)}×` : '꽝'}
                    </span>
                    <strong className={h.payout >= bet ? 'positive' : 'negative'}>
                      {h.payout > 0 ? `+${fmt(h.payout)}` : `-${fmt(bet)}`}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-results">
                <Layers3 size={24} />
                <p>스핀 버튼을 눌러보세요</p>
                <span>3개의 심볼 결과가 여기에 기록됩니다.</span>
              </div>
            )}
          </div>

          <div className="slot-guide-note">
            <ShieldCheck size={14} />
            <span>체리가 1개만 나와도 50% 페이백! 777 일치 시 50배 대박 잭팟!</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
