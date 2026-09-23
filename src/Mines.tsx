import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bomb,
  CheckCircle2,
  Coins,
  Gem,
  History,
  Minus,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Trophy,
  XCircle,
} from 'lucide-react';
import { BETS } from './catalog';
import type { Profile } from './economy';

export function getMinesMultiplier(mines: number, revealed: number): number {
  if (revealed <= 0) return 1.0;
  const maxDiamonds = 25 - mines;
  if (revealed > maxDiamonds) return 0;
  let prob = 1.0;
  for (let i = 0; i < revealed; i++) {
    prob *= (maxDiamonds - i) / (25 - i);
  }
  if (prob <= 0) return 0;
  const raw = 0.97 / prob;
  return Math.max(1.01, Math.floor(raw * 100) / 100);
}

type MinesProps = {
  profile: Profile;
  available: boolean;
  onStart: (id: string, bet: number, mineCount: number) => Promise<void>;
  onCashout: (id: string, multiplier: number, bet: number) => Promise<void>;
  onBust: (id: string, bet: number) => Promise<void>;
  onError: (msg: string) => void;
};

const PRESET_MINES = [1, 2, 3, 5, 10, 15, 20] as const;

export default function Mines({ profile, available, onStart, onCashout, onBust, onError }: MinesProps) {
  const [bet, setBet] = useState(100);
  const [mineCount, setMineCount] = useState<number>(3);
  const [activeMineCount, setActiveMineCount] = useState<number>(3);
  const [activeBet, setActiveBet] = useState<number>(100);
  const [lastRound, setLastRound] = useState<{
    bet: number;
    mineCount: number;
    multiplier: number;
    payout: number;
    userFoundCount: number;
    status: 'won' | 'bust';
  } | null>(null);

  const [gameActive, setGameActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [gameId, setGameId] = useState<string>('');

  // Board state: array of 25 tiles
  const [minedIndices, setMinedIndices] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<boolean[]>(Array(25).fill(false));
  const [pickedIndices, setPickedIndices] = useState<Set<number>>(new Set()); // tiles actually clicked by user
  const [hitIndex, setHitIndex] = useState<number | null>(null);
  const [gameOver, setGameOver] = useState<'won' | 'bust' | null>(null);

  const audioCtx = useRef<AudioContext | null>(null);

  const gameActiveRef = useRef(gameActive);
  gameActiveRef.current = gameActive;
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;
  const betRef = useRef(bet);
  betRef.current = bet;
  const activeMineCountRef = useRef(activeMineCount);
  activeMineCountRef.current = activeMineCount;
  const pickedIndicesRef = useRef(pickedIndices);
  pickedIndicesRef.current = pickedIndices;

  useEffect(() => {
    return () => {
      if (audioCtx.current && audioCtx.current.state !== 'closed') {
        void audioCtx.current.close().catch(() => {});
      }
      if (gameActiveRef.current && gameIdRef.current) {
        const found = pickedIndicesRef.current.size;
        if (found > 0) {
          // If diamonds were found, secure profits by auto-cashing out on exit!
          const mult = getMinesMultiplier(activeMineCountRef.current, found);
          void onCashout(gameIdRef.current, mult, betRef.current).catch(() => {});
        }
        // If 0 diamonds found, do not bust; App recover will safely refund the bet!
      }
    };
  }, [onCashout]);

  // When changing bet or mineCount after game over, reset the board for a fresh game
  const changeBet = (newBet: number) => {
    if (gameActive || busy) return;
    setBet(newBet);
    if (gameOver) {
      setGameOver(null);
      setLastRound(null);
      setRevealed(Array(25).fill(false));
      setPickedIndices(new Set());
      setHitIndex(null);
    }
  };

  const changeMineCount = (newCount: number) => {
    if (gameActive || busy) return;
    setMineCount(newCount);
    if (gameOver) {
      setGameOver(null);
      setLastRound(null);
      setRevealed(Array(25).fill(false));
      setPickedIndices(new Set());
      setHitIndex(null);
    }
  };

  const maxDiamonds = 25 - (gameActive ? activeMineCount : mineCount);
  const userFoundCount = gameActive ? pickedIndices.size : lastRound ? lastRound.userFoundCount : 0;
  const isBust = gameOver === 'bust';

  // Multiplier logic - NEVER dynamically recalculate old round with new inputs!
  const currentMultiplier = isBust
    ? 0
    : gameActive
    ? userFoundCount > 0
      ? getMinesMultiplier(activeMineCount, userFoundCount)
      : 1.0
    : lastRound
    ? lastRound.multiplier
    : 1.0;

  const nextMultiplier =
    isBust || gameOver !== null
      ? null
      : gameActive
      ? userFoundCount >= maxDiamonds
        ? null
        : getMinesMultiplier(activeMineCount, userFoundCount + 1)
      : getMinesMultiplier(mineCount, 1);

  // Payout calculation
  const currentPayout = isBust
    ? 0
    : gameActive
    ? userFoundCount > 0
      ? Math.floor(activeBet * currentMultiplier)
      : 0
    : lastRound
    ? lastRound.payout
    : 0;

  // Mines specific statistics from profile.results
  const minesHistory = profile.results.filter(r => r.id.startsWith('mines_'));
  const totalMinesWagered = minesHistory.reduce((sum, r) => sum + r.bet, 0);
  const totalMinesEarned = minesHistory.reduce((sum, r) => sum + r.payout, 0);
  const totalMinesProfit = totalMinesEarned - totalMinesWagered;
  const bestMinesMult = minesHistory.reduce((max, r) => Math.max(max, r.multiplier), 0);
  const winRounds = minesHistory.filter(r => r.payout > 0).length;
  const bustRounds = minesHistory.filter(r => r.payout === 0).length;
  const winRate = minesHistory.length > 0 ? Math.round((winRounds / minesHistory.length) * 100) : 0;

  const fmt = (n: number) => n.toLocaleString('ko-KR');

  const playSound = useCallback(
    (type: 'diamond' | 'mine' | 'cashout' | 'start') => {
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

        if (type === 'start') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          osc.start(now);
          osc.stop(now + 0.15);
        } else if (type === 'diamond') {
          const baseFreq = 520 + userFoundCount * 45;
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.18);
          gain.gain.setValueAtTime(0.06, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.start(now);
          osc.stop(now + 0.24);
        } else if (type === 'mine') {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(140, now);
          osc.frequency.exponentialRampToValueAtTime(35, now + 0.35);
          gain.gain.setValueAtTime(0.09, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
          osc.start(now);
          osc.stop(now + 0.42);
        } else if (type === 'cashout') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.setValueAtTime(660, now + 0.08);
          osc.frequency.setValueAtTime(880, now + 0.16);
          gain.gain.setValueAtTime(0.07, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.start(now);
          osc.stop(now + 0.38);
        }
      } catch {
        // Ignore audio failure
      }
    },
    [profile.sound, userFoundCount]
  );

  // Start new Mines game
  const startGame = async () => {
    if (!available || busy || gameActive || profile.balance < bet) return;
    setBusy(true);

    try {
      const selectedMinesCount = mineCount;
      const selectedBetAmount = bet;
      const mines = new Set<number>();
      while (mines.size < selectedMinesCount) {
        mines.add(Math.floor(Math.random() * 25));
      }

      const id = `mines_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      await onStart(id, selectedBetAmount, selectedMinesCount);

      setGameId(id);
      setActiveMineCount(selectedMinesCount);
      setActiveBet(selectedBetAmount);
      setLastRound(null);
      setMinedIndices(mines);
      setRevealed(Array(25).fill(false));
      setPickedIndices(new Set());
      setHitIndex(null);
      setGameOver(null);
      setGameActive(true);
      playSound('start');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '게임을 시작할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  // Flip tile
  const clickTile = async (index: number) => {
    if (!gameActive || revealed[index] || busy) return;

    // Check if bomb hit
    if (minedIndices.has(index)) {
      setHitIndex(index);
      setRevealed(Array(25).fill(true)); // reveal all so user sees whole board
      setGameOver('bust');
      setGameActive(false);
      setLastRound({
        bet: activeBet,
        mineCount: activeMineCount,
        multiplier: 0,
        payout: 0,
        userFoundCount: pickedIndices.size,
        status: 'bust',
      });
      playSound('mine');
      setBusy(true);
      try {
        await onBust(gameId, activeBet);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : '결과 정산 중 오류가 발생했습니다.');
      } finally {
        setBusy(false);
      }
      return;
    }

    // Diamond hit!
    const newRevealed = [...revealed];
    newRevealed[index] = true;
    setRevealed(newRevealed);

    const newPicked = new Set(pickedIndices);
    newPicked.add(index);
    setPickedIndices(newPicked);
    playSound('diamond');

    const newCount = newPicked.size;
    const effectiveMax = 25 - activeMineCount;

    // Check if jackpot (found all diamonds)
    if (newCount >= effectiveMax) {
      const finalMult = getMinesMultiplier(activeMineCount, effectiveMax);
      const finalPayout = Math.floor(activeBet * finalMult);
      setGameOver('won');
      setGameActive(false);
      setLastRound({
        bet: activeBet,
        mineCount: activeMineCount,
        multiplier: finalMult,
        payout: finalPayout,
        userFoundCount: effectiveMax,
        status: 'won',
      });
      setRevealed(Array(25).fill(true));
      playSound('cashout');
      setBusy(true);
      try {
        await onCashout(gameId, finalMult, activeBet);
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : '정산 중 오류가 발생했습니다.');
      } finally {
        setBusy(false);
      }
    }
  };

  // Cashout
  const handleCashout = async () => {
    if (!gameActive || busy || pickedIndices.size === 0) return;
    setBusy(true);
    try {
      const finalMult = getMinesMultiplier(activeMineCount, pickedIndices.size);
      const finalPayout = Math.floor(activeBet * finalMult);
      setGameOver('won');
      setGameActive(false);
      setLastRound({
        bet: activeBet,
        mineCount: activeMineCount,
        multiplier: finalMult,
        payout: finalPayout,
        userFoundCount: pickedIndices.size,
        status: 'won',
      });
      setRevealed(Array(25).fill(true)); // reveal rest of board
      playSound('cashout');
      await onCashout(gameId, finalMult, activeBet);
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : '캐시아웃 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mines-container">
      {/* 1. Main Game Board & Control Panel */}
      <div className="mines-layout">
        {/* Left Side: Control Panel */}
        <div className="mines-controls-card">
          <div className="mines-card-header">
            <div className="mines-badge">
              <Gem size={14} />
              <span>DIAMOND HUNT</span>
            </div>
            <span className="rtp-indicator">RTP 97.0%</span>
          </div>

          <div className="mines-input-group">
            <label>배팅 코인</label>
            <div className="bet-control">
              <button
                type="button"
                disabled={gameActive || busy || bet === BETS[0]}
                onClick={() => changeBet(BETS[Math.max(0, BETS.indexOf(bet) - 1)])}
              >
                <Minus size={16} />
              </button>
              <select
                value={bet}
                disabled={gameActive || busy}
                onChange={e => changeBet(Number(e.target.value))}
              >
                {BETS.map(b => (
                  <option key={b} value={b} disabled={b > profile.balance}>
                    {fmt(b)} 코인 {b > profile.balance ? '(잔액 부족)' : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={gameActive || busy || bet === BETS[BETS.length - 1] || BETS[BETS.indexOf(bet) + 1] > profile.balance}
                onClick={() => changeBet(BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)])}
              >
                <Plus size={16} />
              </button>
              <div className="bet-quick-buttons">
                <button
                  type="button"
                  disabled={gameActive || busy || bet <= BETS[0]}
                  onClick={() => {
                    const half = BETS.slice().reverse().find(b => b <= bet / 2) ?? BETS[0];
                    changeBet(half);
                  }}
                >
                  ½
                </button>
                <button
                  type="button"
                  disabled={gameActive || busy || !BETS.some(b => b >= bet * 2 && b <= profile.balance)}
                  onClick={() => {
                    const dbl = BETS.find(b => b >= bet * 2 && b <= profile.balance);
                    if (dbl) changeBet(dbl);
                  }}
                >
                  2×
                </button>
                <button
                  type="button"
                  disabled={gameActive || busy || profile.balance < BETS[0]}
                  onClick={() => {
                    const maxAffordable = BETS.slice().reverse().find(b => b <= profile.balance);
                    if (maxAffordable) changeBet(maxAffordable);
                  }}
                >
                  최대
                </button>
              </div>
            </div>
            <div className="bet-preset-chips">
              {BETS.slice(0, 6).map(b => (
                <button
                  key={b}
                  type="button"
                  disabled={gameActive || busy || profile.balance < b}
                  className={`bet-preset-btn ${bet === b ? 'active' : ''}`}
                  onClick={() => changeBet(b)}
                >
                  {fmt(b)}
                </button>
              ))}
            </div>
          </div>

          <div className="mines-input-group">
            <label>
              폭탄 개수 (Bombs): <b>{mineCount}개</b>
              <span className="sub-note">다이아몬드: {maxDiamonds}개</span>
            </label>
            <div className="mines-preset-selector">
              {PRESET_MINES.map(m => (
                <button
                  key={m}
                  type="button"
                  disabled={gameActive || busy}
                  className={`mine-pill ${mineCount === m ? 'active' : ''}`}
                  onClick={() => changeMineCount(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              type="range"
              disabled={gameActive || busy}
              min={1}
              max={24}
              value={mineCount}
              onChange={e => changeMineCount(Number(e.target.value))}
              className="mine-slider"
            />
          </div>

          <div className="mines-stats-panel">
            <div className="stat-box">
              <span className="stat-title">발견한 다이아</span>
              <span className="stat-val emerald">
                <Gem size={15} /> {userFoundCount} / {maxDiamonds}
              </span>
            </div>
            <div className="stat-box">
              <span className="stat-title">현재 배율</span>
              <span className={`stat-val ${isBust ? 'bust-val' : 'gold'}`}>
                {isBust ? '0.00×' : `${currentMultiplier.toFixed(2)}×`}
              </span>
            </div>
            <div className="stat-box highlight">
              <span className="stat-title">다음 성공 시</span>
              <span className="stat-val">
                {isBust ? '-' : nextMultiplier === null ? '최대 달성' : `${nextMultiplier.toFixed(2)}×`}
              </span>
            </div>
            <div className="stat-box payout">
              <span className="stat-title">예상 수령액</span>
              <span className={`stat-val ${isBust ? 'bust-val' : 'gold-bright'}`}>
                {isBust ? '0 코인' : userFoundCount > 0 ? `+${fmt(currentPayout)} 코인` : '0 코인'}
              </span>
            </div>
          </div>

          {/* Action button */}
          {!gameActive ? (
            <button
              className="primary-button full-width start-mines-btn"
              disabled={!available || busy || profile.balance < bet}
              onClick={startGame}
            >
              <Bomb size={18} />
              <span>다이아 찾기 시작</span>
            </button>
          ) : (
            <button
              className={`primary-button full-width cashout-btn ${userFoundCount > 0 ? 'active' : ''}`}
              disabled={!available || busy || userFoundCount === 0}
              onClick={handleCashout}
            >
              <Coins size={18} />
              <span>
                {userFoundCount === 0
                  ? '타일을 먼저 선택하세요'
                  : `+${fmt(currentPayout)} 코인 즉시 캐시아웃 (${currentMultiplier.toFixed(2)}×)`}
              </span>
            </button>
          )}

          <div className="mines-guide-tip">
            <ShieldCheck size={14} />
            <span>25개 칸 중 폭탄을 피해 다이아를 찾으세요. 언제든 즉시 수령 가능!</span>
          </div>
        </div>

        {/* Right Side: 5x5 Mines Grid */}
        <div className="mines-board-card">
          <div className="mines-grid-header">
            <div className="grid-status-badge">
              {!gameActive && !gameOver && <span>타일을 누르고 다이아를 찾아보세요!</span>}
              {gameActive && <span className="pulse-green">진행 중 · 안전한 칸을 선택하세요!</span>}
              {gameOver === 'won' && lastRound && (
                <span className="won-text">축하합니다! 캐시아웃 성공 (+{fmt(lastRound.payout)} 코인)</span>
              )}
              {gameOver === 'bust' && <span className="bust-text">폭탄 폭발! 배팅 코인을 잃었습니다.</span>}
            </div>
            <div className="mines-info-pills">
              <span className="info-pill safe">
                <Gem size={13} /> 남은 다이아: {gameOver ? 0 : maxDiamonds - userFoundCount}
              </span>
              <span className="info-pill danger">
                <Bomb size={13} /> 폭탄: {gameActive || gameOver ? activeMineCount : mineCount}
              </span>
            </div>
          </div>

          <div className={`mines-grid ${gameOver ? 'game-over' : ''}`}>
            {Array.from({ length: 25 }, (_, i) => {
              const isRevealed = revealed[i];
              const isMine = minedIndices.has(i);
              const isHitMine = hitIndex === i;
              const isUserPicked = pickedIndices.has(i);

              return (
                <button
                  key={i}
                  type="button"
                  className={`mine-tile ${
                    isRevealed
                      ? isMine
                        ? 'mine'
                        : isUserPicked
                        ? 'diamond picked'
                        : 'diamond unpicked'
                      : 'hidden'
                  } ${isHitMine ? 'hit' : ''} ${gameActive && !isRevealed ? 'clickable' : ''}`}
                  disabled={!gameActive || isRevealed || busy}
                  onClick={() => clickTile(i)}
                >
                  <div className="tile-inner">
                    <div className="tile-front">
                      <span className="tile-dot" />
                    </div>
                    <div className="tile-back">
                      {isMine ? (
                        <div className={`mine-content ${isHitMine ? 'explode-anim' : 'unexploded'}`}>
                          <Bomb size={32} />
                        </div>
                      ) : (
                        <div className={`diamond-content ${isUserPicked ? 'user-found' : 'auto-revealed'}`}>
                          <Gem size={30} />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick restart bar with exact outcome summary after game over */}
          {gameOver && lastRound && (
            <div className="mines-restart-banner">
              <div className="last-round-summary">
                <span className="summary-title">
                  {lastRound.status === 'won' ? '🎉 캐시아웃 성공' : '💥 폭탄 폭발'}
                </span>
                <span className="summary-details">
                  {lastRound.status === 'won' ? (
                    <>
                      배팅 <b>{fmt(lastRound.bet)}</b> 코인 ➔ <b>{lastRound.multiplier.toFixed(2)}배</b> 달성 ➔{' '}
                      <b className="text-emerald">+{fmt(lastRound.payout)}</b> 코인 획득 (순이익{' '}
                      <b className="text-emerald">+{fmt(lastRound.payout - lastRound.bet)}</b> 코인)
                    </>
                  ) : (
                    <>
                      배팅 <b>{fmt(lastRound.bet)}</b> 코인 전액 손실 (0.00배, 손실{' '}
                      <b className="text-rose">-{fmt(lastRound.bet)}</b> 코인)
                    </>
                  )}
                </span>
              </div>
              <button
                className="primary-button restart-action-btn"
                disabled={!available || busy || profile.balance < bet}
                onClick={startGame}
              >
                <RefreshCw size={15} />
                <span>다시 도전 ({fmt(bet)} 코인)</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Comprehensive Diamond Hunt Analytics & History Section */}
      <div className="mines-analytics-section">
        {/* Cumulative Stats Cards */}
        <div className="mines-summary-grid">
          <div className="mines-stat-card highlight">
            <div className="stat-card-header">
              <span className="stat-title">다이아 찾기 순손익</span>
              {totalMinesProfit >= 0 ? (
                <TrendingUp size={18} className="text-emerald" />
              ) : (
                <TrendingDown size={18} className="text-rose" />
              )}
            </div>
            <div className={`stat-card-value ${totalMinesProfit >= 0 ? 'emerald' : 'rose'}`}>
              {totalMinesProfit >= 0 ? `+${fmt(totalMinesProfit)}` : fmt(totalMinesProfit)}{' '}
              <small>코인</small>
            </div>
            <span className="stat-card-sub">
              {totalMinesProfit >= 0 ? '순수익 실현 중!' : '손실 구간 (역전 기회!)'}
            </span>
          </div>

          <div className="mines-stat-card">
            <div className="stat-card-header">
              <span className="stat-title">누적 획득 코인</span>
              <Coins size={18} className="text-gold" />
            </div>
            <div className="stat-card-value gold">
              +{fmt(totalMinesEarned)} <small>코인</small>
            </div>
            <span className="stat-card-sub">총 베팅 소모: {fmt(totalMinesWagered)} 코인</span>
          </div>

          <div className="mines-stat-card">
            <div className="stat-card-header">
              <span className="stat-title">최고 달성 배율</span>
              <Trophy size={18} className="text-gold" />
            </div>
            <div className="stat-card-value gold">
              {bestMinesMult > 0 ? `${bestMinesMult.toFixed(2)}×` : '-'}
            </div>
            <span className="stat-card-sub">역대 최고 탈출 잭팟</span>
          </div>

          <div className="mines-stat-card">
            <div className="stat-card-header">
              <span className="stat-title">탈출 전적 및 승률</span>
              <History size={18} className="text-cyan" />
            </div>
            <div className="stat-card-value">
              {winRounds}승 {bustRounds}패 <small>({winRate}%)</small>
            </div>
            <span className="stat-card-sub">총 {minesHistory.length}회 도전</span>
          </div>
        </div>

        {/* Detailed Recent Rounds History Table */}
        <div className="mines-history-card">
          <div className="history-card-header">
            <div className="history-card-title">
              <History size={18} />
              <h3>최근 다이아 찾기 기록 (최근 {minesHistory.length}판)</h3>
            </div>
            <span className="history-count-badge">실시간 자동 동기화</span>
          </div>

          {minesHistory.length > 0 ? (
            <div className="mines-history-table">
              <div className="table-header-row">
                <span>시간</span>
                <span>베팅 코인</span>
                <span>결과 배율</span>
                <span>지급 코인</span>
                <span>해당 판 순손익</span>
              </div>
              <div className="table-body">
                {minesHistory.slice(0, 15).map((r, idx) => {
                  const profit = r.payout - r.bet;
                  const isWin = r.payout > 0;
                  const timeStr = r.time
                    ? new Date(r.time).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '-';
                  return (
                    <div className={`table-row ${isWin ? 'win-row' : 'bust-row'}`} key={r.id || idx}>
                      <span className="col-time">{timeStr}</span>
                      <span className="col-bet">{fmt(r.bet)} 코인</span>
                      <span className="col-mult">
                        {isWin ? (
                          <span className="badge-mult win">
                            <CheckCircle2 size={13} /> {r.multiplier.toFixed(2)}×
                          </span>
                        ) : (
                          <span className="badge-mult bust">
                            <XCircle size={13} /> 0.00× (폭발)
                          </span>
                        )}
                      </span>
                      <span className={`col-payout ${isWin ? 'text-gold' : 'text-muted'}`}>
                        {isWin ? `+${fmt(r.payout)} 코인` : '0 코인'}
                      </span>
                      <span className={`col-profit ${profit >= 0 ? 'text-emerald' : 'text-rose'}`}>
                        {profit >= 0 ? `+${fmt(profit)} 코인 (수익)` : `${fmt(profit)} 코인 (손실)`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="empty-mines-history">
              <Gem size={34} />
              <p>아직 진행된 다이아 찾기 게임 기록이 없습니다.</p>
              <span>게임을 시작하고 폭탄을 피해 다이아를 찾아 배율을 올려보세요!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
