import { withClient } from './pg.js';
import { Winner } from '../raffle.js';

export async function recordCycle(params: {
  claimSig: string;
  feesClaimedLamports: bigint;
  feesClaimedSol: number;
  fixedWallet: string;
  fixedSig?: string;
  raffleSig?: string;
  mintAddress: string;
  snapshotHash: string;
  intervalSeconds: number;
  dryRun: boolean;
  winners: { winner: Winner; rank: number; prizePct: number; prizeLamports: bigint; prizeSol: number }[];
  notes?: string;
}) {
  await withClient(async c => {
    await c.query('BEGIN');

    await c.query(
      `INSERT INTO claims (
        claim_signature, fees_claimed_lamports, fees_claimed_sol, fixed_wallet, fixed_signature, raffle_signature,
        mint_address, snapshot_hash, interval_seconds, dry_run, notes
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (claim_signature) DO NOTHING`,
      [
        params.claimSig,
        params.feesClaimedLamports.toString(),
        params.feesClaimedSol,
        params.fixedWallet,
        params.fixedSig ?? null,
        params.raffleSig ?? null,
        params.mintAddress,
        params.snapshotHash,
        params.intervalSeconds,
        params.dryRun,
        params.notes ?? null,
      ]
    );

    for (const w of params.winners) {
      await c.query(
        `INSERT INTO winners (
          claim_signature, rank, wallet, weight, balance_raw, balance_ui, prize_pct, prize_lamports, prize_sol
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          params.claimSig,
          w.rank,
          w.winner.wallet,
          w.winner.weight,
          w.winner.balanceRaw.toString(),
          w.winner.balanceUi,
          w.prizePct,
          w.prizeLamports.toString(),
          w.prizeSol,
        ]
      );
    }

    await c.query('COMMIT');
  });
}
