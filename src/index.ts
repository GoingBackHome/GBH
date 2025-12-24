import { CONFIG } from './config.js';
import { sleep, lamportsToSol } from './utils.js';
import { claimCreatorFees, computeFeesClaimedLamportsFromTx } from './pumpportal_claim.js';
import { fetchHoldersSnapshot } from './holders.js';
import { pickWinners, PRIZE_COUNT } from './raffle.js';
import { sendPayouts, PRIZE_BPS } from './payout.js';
import { recordCycle } from './db/write.js';
import { tgSend } from './telegram.js';

function fmtSol(sol: number) {
  return sol.toFixed(6);
}
function solscanTx(sig: string) {
  return sig.split(',').map(s => `https://solscan.io/tx/${s}`).join('\n');
}
function max(a: number, b: number) { return a > b ? a : b; }

async function runOnce() {
  const { signature: claimSig } = await claimCreatorFees();

  const feesClaimedLamports = await computeFeesClaimedLamportsFromTx(claimSig);
  const feesClaimedSol = lamportsToSol(feesClaimedLamports);

  if (feesClaimedLamports <= 0n) {
    await tgSend(`🎄 <b>GBH Claim</b>\nNo fees available.\nTx: https://solscan.io/tx/${claimSig}`);
    return;
  }

  const { holders, snapshotHash } = await fetchHoldersSnapshot();

  const seed = `${claimSig}:${snapshotHash}`;
  const winners = pickWinners(holders, PRIZE_COUNT, seed);

  const payout = await sendPayouts({ feesClaimedLamports, winners });

  const winnerRows = winners.map((w, i) => {
    const lamports = payout.prizeLamports[i];
    const sol = lamportsToSol(lamports);
    return { winner: w, rank: i+1, prizePct: PRIZE_BPS[i] / 10000, prizeLamports: lamports, prizeSol: sol };
  });

  await recordCycle({
    claimSig,
    feesClaimedLamports,
    feesClaimedSol,
    fixedWallet: CONFIG.FIXED_WALLET,
    fixedSig: payout.fixedSig,
    raffleSig: payout.raffleSig,
    mintAddress: CONFIG.MINT_ADDRESS,
    snapshotHash,
    intervalSeconds: CONFIG.INTERVAL_SECONDS,
    dryRun: CONFIG.DRY_RUN,
    winners: winnerRows,
    notes: `seed=${seed}`,
  });

  let msg = `🎁 <b>GBH Claim</b>\n` +
            `Claimed: <b>${fmtSol(feesClaimedSol)} SOL</b>\n` +
            `Claim tx: https://solscan.io/tx/${claimSig}\n\n` +
            `➡️ 50% fixed: <b>${fmtSol(feesClaimedSol*0.5)} SOL</b>\n` +
            (payout.fixedSig ? `Tx: ${solscanTx(payout.fixedSig)}\n\n` : `Tx: (dry-run)\n\n`) +
            `🎲 50% raffle: <b>${fmtSol(feesClaimedSol*0.5)} SOL</b>\n` +
            `Snapshot: <code>${snapshotHash.slice(0, 16)}…</code>\n` +
            `Seed: <code>${seed.slice(0, 24)}…</code>\n` +
            (payout.raffleSig ? `Payout tx: ${solscanTx(payout.raffleSig)}\n\n` : `Payout tx: (dry-run)\n\n`);

  msg += `<b>Winners</b>\n`;
  for (let i = 0; i < winners.length; i++) {
    const w = winners[i];
    msg += `${i+1}) ${w.wallet.slice(0,4)}…${w.wallet.slice(-4)} — ${(PRIZE_BPS[i] / 100).toFixed(0)}%\n`;
  }

  await tgSend(msg);
}

async function main() {
  console.log(`GBH bot starting. interval=${CONFIG.INTERVAL_SECONDS}s dryRun=${CONFIG.DRY_RUN}`);
  const sum = PRIZE_BPS.reduce((a,b)=>a+b,0);
  if (sum !== 10000) throw new Error(`Prize bps sum must be 10000 (got ${sum})`);

  while (true) {
    const started = Date.now();
    try {
      await runOnce();
    } catch (e: any) {
      const err = (e?.stack || e?.message || String(e)).slice(0, 3500);
      console.error('Cycle error:', err);
      try { await tgSend(`⚠️ GBH bot error\n<code>${err}</code>`); } catch {}
    }
    const elapsed = Date.now() - started;
    const sleepMs = max(5_000, CONFIG.INTERVAL_SECONDS * 1000 - elapsed);
    await sleep(sleepMs);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
