import { Holder } from './holders.js';

export type Winner = {
  wallet: string;
  weight: number;
  balanceRaw: bigint;
  balanceUi: number;
};

export function computeWeight(balanceUi: number): number {
  return Math.sqrt(Math.max(0, balanceUi));
}

function pickOneWeighted(items: { wallet: string; weight: number; holder: Holder }[], rng: () => number) {
  const total = items.reduce((s, x) => s + x.weight, 0);
  if (total <= 0) throw new Error('Total weight is 0; no eligible holders?');
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight;
    if (r <= 0) return i;
  }
  return items.length - 1;
}

export function pickWinners(holders: Holder[], n: number, seed: string): Winner[] {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);

  function rng() {
    h ^= h << 13; h >>>= 0;
    h ^= h >> 17; h >>>= 0;
    h ^= h << 5;  h >>>= 0;
    return (h >>> 0) / 4294967296;
  }

  const pool = holders.map(holder => ({
    wallet: holder.owner,
    holder,
    weight: computeWeight(holder.balanceUi),
  })).filter(x => x.weight > 0);

  const winners: Winner[] = [];
  const used = new Set<string>();

  for (let k = 0; k < n; k++) {
    const candidates = pool.filter(x => !used.has(x.wallet));
    if (candidates.length === 0) break;

    const idx = pickOneWeighted(candidates, rng);
    const picked = candidates[idx];
    used.add(picked.wallet);
    winners.push({
      wallet: picked.wallet,
      weight: picked.weight,
      balanceRaw: picked.holder.balanceRaw,
      balanceUi: picked.holder.balanceUi,
    });
  }

  if (winners.length < n) throw new Error(`Not enough eligible holders to pick ${n} winners (picked ${winners.length})`);
  return winners;
}

export const PRIZE_COUNT = 10;
