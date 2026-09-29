import { useCallback, useEffect, useRef, useState } from 'react';
import { Layers3, Minus, Play, Plus, RefreshCw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';
import { SLOT_SYMBOLS, spinSlots, type SlotSpinResult } from './gameMath';

type SlotsProps = {
  profile: Profile;
  available: boolean;
  onSpin: (id: string, bet: number, reels: [number, number, number], multiplier: number) => Promise<void>;
  onError: (msg: string) => void;
};

type ReelState = {
  isSpinning: boolean;
  symbolIndex: number;
  isBounce: boolean;
};

// 4-times repeated strip symbols for infinite vertical scroll blur effect
const STRIP_LOOP = [
  ...SLOT_SYMBOLS,
  ...SLOT_SYMBOLS,
  ...SLOT_SYMBOLS,
  ...SLOT_SYMBOLS,
];

export default function Slots({ profile, available, onSpin, onError }: SlotsProps) {
  const [bet, setBet] = useState(100);
  const [spinning, setSpinning] = useState(false);
  const [reelStates, setReelStates] = useState<[ReelState, ReelState, ReelState]>([
    { isSpinning: false, symbolIndex: 5, isBounce: false }, // 3 cherries initially
    { isSpinning: false, symbolIndex: 5, isBounce: false },
    { isSpinning: false, symbolIndex: 5, isBounce: false },
  ]);
  const [lastWin, setLastWin] = useState<SlotSpinResult | null>(null);
  const [lastPayout, setLastPayout] = useState<number>(0);
  const [autoSpinCount, setAutoSpinCount] = useState<number>(0);
  const [fastMode, setFastMode] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ reels: [number, number, number]; mult: number; payout: number }>>([]);

  const audioCtx = useRef<AudioContext | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const autoSpinRef = useRef(autoSpinCount);
  autoSpinRef.current = autoSpinCount;
  const spinningRef = useRef(spinning);
  spinningRef.current = spinning;

  const onSpinRef = useRef(onSpin);
  onSpinRef.current = onSpin;

  // Sound effects synthesizer
  const playTone = useCallback((type: 'click' | 'tick' | 'reel_stop' | 'win' | 'jackpot') => {
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
      } else if (type === 'tick') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(140, now + 0.03);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.03);
      } else if (type === 'reel_stop') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.12);
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

  // Clean up timers & audio context on unmount
  useEffect(() => {
    return () => {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
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

    // Trigger visual spinning on all 3 reels simultaneously
    setReelStates(prev => [
      { isSpinning: true, symbolIndex: prev[0].symbolIndex, isBounce: false },
      { isSpinning: true, symbolIndex: prev[1].symbolIndex, isBounce: false },
      { isSpinning: true, symbolIndex: prev[2].symbolIndex, isBounce: false },
    ]);

    // Mechanical reel ticking sound loop
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = window.setInterval(() => {
      playTone('tick');
    }, fastMode ? 55 : 85);

    const id = crypto.randomUUID();
    const result = spinSlots();
    const payout = Math.floor(bet * result.multiplier);

    try {
      await onSpinRef.current(id, bet, result.reels, result.multiplier);
      setLastPayout(payout);
      setLastWin(null);

      // Animate reels stopping sequentially
      const baseDuration = fastMode ? 350 : 800;
      const stagger = fastMode ? 180 : 400;
      const finishTime = baseDuration + stagger * 2;

      const targetIndices = result.reels;
      targetIndices.forEach((targetSymbol, reelIdx) => {
        const reelDuration = baseDuration + reelIdx * stagger;
        setTimeout(() => {
          playTone('reel_stop');
          setReelStates(prev => {
            const next = [...prev] as [ReelState, ReelState, ReelState];
            next[reelIdx] = { isSpinning: false, symbolIndex: targetSymbol, isBounce: true };
            return next;
          });
          // Remove bounce class after landing animation completes
          setTimeout(() => {
            setReelStates(prev => {
              const next = [...prev] as [ReelState, ReelState, ReelState];
              if (next[reelIdx].symbolIndex === targetSymbol) {
                next[reelIdx] = { ...next[reelIdx], isBounce: false };
              }
              return next;
            });
          }, 350);
        }, reelDuration);
      });

      // After all reels stop
      setTimeout(() => {
        if (tickTimerRef.current) {
          clearInterval(tickTimerRef.current);
          tickTimerRef.current = null;
        }
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
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      setSpinning(false);
      setReelStates(prev => [
        { isSpinning: false, symbolIndex: prev[0].symbolIndex, isBounce: false },
        { isSpinning: false, symbolIndex: prev[1].symbolIndex, isBounce: false },
        { isSpinning: false, symbolIndex: prev[2].symbolIndex, isBounce: false },
      ]);
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
                  const state = reelStates[reelIdx];
                  const activeSym = SLOT_SYMBOLS[state.symbolIndex];

                  return (
                    <div
                      key={reelIdx}
                      className={`slot-reel ${state.isSpinning ? 'is-spinning' : ''} ${
                        state.isBounce ? 'reel-bounce' : ''
                      }`}
                    >
                      {state.isSpinning ? (
                        <div className="reel-strip-scroller">
                          {STRIP_LOOP.map((sym, sIdx) => (
                            <div key={sIdx} className="strip-cell">
                              <span className="sym-icon">{sym.icon}</span>
                              <span className="sym-name" style={{ color: sym.color }}>
                                {sym.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="reel-inner">
                          {/* Top Adjacent Symbol Preview */}
                          <div className="symbol-cell symbol-preview">
                            <span className="sym-icon">
                              {SLOT_SYMBOLS[(state.symbolIndex + 5) % SLOT_SYMBOLS.length].icon}
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
                              {SLOT_SYMBOLS[(state.symbolIndex + 1) % SLOT_SYMBOLS.length].icon}
                            </span>
                          </div>
                        </div>
                      )}
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

          {/* Full Probability & Payout Table Card directly below cabinet */}
          <div className="slots-prob-table-card">
            <div className="prob-table-header">
              <div className="prob-header-left">
                <Sparkles size={18} className="text-gold" />
                <h3>🎰 당첨 확률 및 배당 안내표</h3>
                <span className="rtp-badge">환급률(RTP) 92.75%</span>
              </div>
              <span className="provably-fair-tag">Provably Fair (수학적 공정 확률)</span>
            </div>

            <div className="prob-table-content">
              <div className="prob-grid">
                <div className="prob-row header-row">
                  <span>심볼 조합</span>
                  <span>당첨 조건</span>
                  <span>배율</span>
                  <span>당첨 확률</span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('777') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🎰 777</span>
                  <span>3개 일치 (메가 잭팟)</span>
                  <strong className="mult-col text-jackpot">50.0×</strong>
                  <span className="rate-col">0.02% <small>(1/4,913)</small></span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('BAR') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🍫 BAR</span>
                  <span>3개 일치</span>
                  <strong className="mult-col text-gold">40.0×</strong>
                  <span className="rate-col">0.16% <small>(8/4,913)</small></span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('다이아') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">💎 다이아몬드</span>
                  <span>3개 일치</span>
                  <strong className="mult-col text-gold">25.0×</strong>
                  <span className="rate-col">0.16% <small>(8/4,913)</small></span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('종') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🔔 황금 종</span>
                  <span>3개 일치</span>
                  <strong className="mult-col">15.0×</strong>
                  <span className="rate-col">0.55% <small>(27/4,913)</small></span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('포도') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🍇 네온 포도</span>
                  <span>3개 일치</span>
                  <strong className="mult-col">8.0×</strong>
                  <span className="rate-col">2.54% <small>(125/4,913)</small></span>
                </div>

                <div className={`prob-row ${lastWin && lastWin.winType.includes('3체리') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🍒 체리 3개</span>
                  <span>3개 일치</span>
                  <strong className="mult-col">5.0×</strong>
                  <span className="rate-col">1.30% <small>(64/4,913)</small></span>
                </div>

                <div className={`prob-row highlight-row ${lastWin && lastWin.winType.includes('2체리') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🍒🍒 체리 2개</span>
                  <span>위치 무관 2개 일치</span>
                  <strong className="mult-col text-win">2.0×</strong>
                  <span className="rate-col">12.70% <small>(624/4,913)</small></span>
                </div>

                <div className={`prob-row highlight-row ${lastWin && lastWin.winType.includes('1체리') && !spinning ? 'current-win' : ''}`}>
                  <span className="sym-col">🍒 체리 1개</span>
                  <span>어느 위치든 1개만 (절반 페이백)</span>
                  <strong className="mult-col text-partial">0.5×</strong>
                  <span className="rate-col text-partial font-bold">41.28% <small>(2,028/4,913)</small></span>
                </div>

                <div className={`prob-row bust-row ${lastWin && lastWin.multiplier === 0 && !spinning ? 'current-bust' : ''}`}>
                  <span className="sym-col">💀 꽝 (낙첨)</span>
                  <span>일치 없음 & 체리 없음</span>
                  <strong className="mult-col text-dim">0.0×</strong>
                  <span className="rate-col text-dim">41.28% <small>(2,028/4,913)</small></span>
                </div>
              </div>

              <div className="prob-footer-tips">
                <div className="tip-box">
                  <span className="tip-icon">🍒</span>
                  <div>
                    <strong>높은 생존력의 체리 페이백 (총 당첨 확률 58.72%)</strong>
                    <p>전체 스핀 중 <b>58.72%</b> 확률(체리 1개 41.3% + 체리 2개 12.7% + 3개 일치 4.7%)로 배당 또는 페이백이 지급되어 코인이 급격히 줄어들지 않고 오래 즐길 수 있습니다.</p>
                  </div>
                </div>
                <div className="tip-box">
                  <span className="tip-icon">⚖️</span>
                  <div>
                    <strong>하우스 엣지 7.25% (RTP 92.75%)</strong>
                    <p>모든 스핀은 조작 없는 수학적 가중치 알고리즘으로 독립 추첨되며 장기 경제 밸런스를 지켜줍니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Betting Controls & History */}
        <aside className="slots-controls-sidebar">
          {/* Bet Selector */}
          <div className="control-card">
            <div className="control-card-header">
              <h3>베팅 금액</h3>
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
