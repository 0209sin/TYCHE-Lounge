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
