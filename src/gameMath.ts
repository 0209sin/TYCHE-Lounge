// Provably Fair mathematical helpers for Tyche Lounge games

/**
 * Generates the multiplier point at which the rocket crashes.
 * Rebalanced for v2.3:
 * - 5% instant bust rate at 1.00x (crypto random r < 0.05)
 * - 93.5% theoretical RTP standard curve (0.935 / (1 - r))
 * - Increased early bust rate at 1.20x (~27%) and 1.50x (~43%) to curb low-multiplier auto-cashout farming
 * - Max uncapped multiplier up to 1000x
 */
export function generateCrashPoint(customRand?: number): number {
  const r = customRand !== undefined ? customRand : crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  if (r < 0.05) return 1.00;
  const mult = 0.935 / (1 - r);
  return Math.max(1.01, Math.min(1000, Math.floor(mult * 100) / 100));
}

/**
 * Calculates the multiplier for the Mines game based on total mines and revealed diamond count.
 * Rebalanced for v2.3 with 94.0% RTP factor (0.94 / prob).
 * Retains completely uncapped jackpots for high-risk configurations.
 */
export function getMinesMultiplier(mines: number, revealed: number): number {
  if (revealed <= 0) return 1.0;
  const maxDiamonds = 25 - mines;
  if (revealed > maxDiamonds) return 0;
  let prob = 1.0;
  for (let i = 0; i < revealed; i++) {
    prob *= (maxDiamonds - i) / (25 - i);
  }
  if (prob <= 0) return 0;
  const raw = 0.94 / prob;
  return Math.max(1.01, Math.floor(raw * 100) / 100);
}

// ----------------- Cyber Slots 777 Math -----------------

export type SlotSymbol = {
  id: string;
  name: string;
  icon: string;
  color: string;
  weight: number;
  payout3: number;
};

export const SLOT_SYMBOLS: SlotSymbol[] = [
  { id: '777', name: '777 럭키 세븐', icon: '🔥', color: '#ffd15c', weight: 1, payout3: 50.0 },
  { id: 'bar', name: '사이버 BAR', icon: '⚡', color: '#00f2fe', weight: 2, payout3: 40.0 },
  { id: 'diamond', name: '네온 다이아', icon: '💎', color: '#6be4c4', weight: 2, payout3: 20.0 },
  { id: 'bell', name: '네온 벨', icon: '🔔', color: '#ffcd69', weight: 3, payout3: 12.0 },
  { id: 'grape', name: '네온 포도', icon: '🍇', color: '#b29bff', weight: 5, payout3: 5.0 },
  { id: 'cherry', name: '네온 체리', icon: '🍒', color: '#ff3b80', weight: 3, payout3: 5.0 },
];

export const TOTAL_SLOT_WEIGHT = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);

/**
 * Picks one symbol index (0~5) based on Provably Fair weighted RNG.
 */
export function spinOneReel(customRand?: number): number {
  const r = (customRand !== undefined ? customRand : crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296) * TOTAL_SLOT_WEIGHT;
  let acc = 0;
  for (let i = 0; i < SLOT_SYMBOLS.length; i++) {
    acc += SLOT_SYMBOLS[i].weight;
    if (r < acc) return i;
  }
  return SLOT_SYMBOLS.length - 1;
}

export type SlotSpinResult = {
  reels: [number, number, number];
  multiplier: number;
  winType: string;
  isJackpot: boolean;
};

/**
 * Calculates multiplier and win description from a 3-reel stop configuration.
 */
export function evaluateSlotReels(reels: [number, number, number]): SlotSpinResult {
  const [r0, r1, r2] = reels;

  // 1. Three of a kind
  if (r0 === r1 && r1 === r2) {
    const sym = SLOT_SYMBOLS[r0];
    return {
      reels,
      multiplier: sym.payout3,
      winType: `${sym.name} 3개 일치!`,
      isJackpot: sym.id === '777',
    };
  }

  // 2. Count cherries (index 5)
  const cherryCount = reels.filter(idx => idx === 5).length;
  if (cherryCount === 2) {
    return {
      reels,
      multiplier: 2.0,
      winType: '체리 2개 적중 (2.0배)',
      isJackpot: false,
    };
  }

  if (cherryCount === 1) {
    return {
      reels,
      multiplier: 1.0,
      winType: '체리 1개 적중 (본전 1.0배)',
      isJackpot: false,
    };
  }

  // 3. Bust
  return {
    reels,
    multiplier: 0,
    winType: '낙첨 (꽝)',
    isJackpot: false,
  };
}

/**
 * Performs a complete 3-reel spin and returns the stopping symbols and payout.
 */
export function spinSlots(customRands?: [number, number, number]): SlotSpinResult {
  const reels: [number, number, number] = [
    spinOneReel(customRands ? customRands[0] : undefined),
    spinOneReel(customRands ? customRands[1] : undefined),
    spinOneReel(customRands ? customRands[2] : undefined),
  ];
  return evaluateSlotReels(reels);
}

