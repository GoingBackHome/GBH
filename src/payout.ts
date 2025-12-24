import { Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, ComputeBudgetProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { CONFIG } from './config.js';
import { Winner } from './raffle.js';

export type PayoutResult = {
  fixedSig?: string;
  raffleSig?: string;
  fixedLamports: bigint;
  raffleLamports: bigint;
  prizeLamports: bigint[];
};

// Basis points (sum = 10000): 32%, 12%, 12%, 8%, 8%, 8%, 5%, 5%, 5%, 5%
export const PRIZE_BPS = [3200, 1200, 1200, 800, 800, 800, 500, 500, 500, 500];

export async function sendPayouts(params: {
  feesClaimedLamports: bigint;
  winners: Winner[];
}): Promise<PayoutResult> {
  const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed');
  const signer = Keypair.fromSecretKey(bs58.decode(CONFIG.FEE_WALLET_PRIVATE_KEY));
  const feeWallet = signer.publicKey;

  const feesClaimedSol = Number(params.feesClaimedLamports) / 1_000_000_000;
  if (feesClaimedSol > CONFIG.MAX_PAYOUT_SOL_PER_CYCLE) {
    throw new Error(`Safety stop: feesClaimedSol=${feesClaimedSol} exceeds MAX_PAYOUT_SOL_PER_CYCLE=${CONFIG.MAX_PAYOUT_SOL_PER_CYCLE}`);
  }

  const fixedLamports = params.feesClaimedLamports / 2n;
  const raffleLamports = params.feesClaimedLamports - fixedLamports;

  if (params.winners.length !== PRIZE_BPS.length) throw new Error(`Expected ${PRIZE_BPS.length} winners`);

  const prizeLamports: bigint[] = [];
  let allocated = 0n;
  for (let i = 0; i < PRIZE_BPS.length; i++) {
    let p: bigint;
    if (i < PRIZE_BPS.length - 1) {
      p = (raffleLamports * BigInt(PRIZE_BPS[i])) / 10000n;
    } else {
      p = raffleLamports - allocated;
    }
    prizeLamports.push(p);
    allocated += p;
  }

  if (CONFIG.DRY_RUN) {
    return { fixedLamports, raffleLamports, prizeLamports };
  }

  const fixedIx = SystemProgram.transfer({
    fromPubkey: feeWallet,
    toPubkey: new PublicKey(CONFIG.FIXED_WALLET),
    lamports: Number(fixedLamports),
  });

  const { blockhash: bh1 } = await connection.getLatestBlockhash('confirmed');
  const msg1 = new TransactionMessage({
    payerKey: feeWallet,
    recentBlockhash: bh1,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
      fixedIx,
    ],
  }).compileToV0Message();

  const tx1 = new VersionedTransaction(msg1);
  tx1.sign([signer]);
  const fixedSig = await connection.sendTransaction(tx1, { maxRetries: 3 });
  await connection.confirmTransaction(fixedSig, 'confirmed');

  const transfers = params.winners.map((w, i) => SystemProgram.transfer({
    fromPubkey: feeWallet,
    toPubkey: new PublicKey(w.wallet),
    lamports: Number(prizeLamports[i]),
  }));

  async function sendBatch(ixs: any[]): Promise<string> {
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const msg = new TransactionMessage({
      payerKey: feeWallet,
      recentBlockhash: blockhash,
      instructions: [
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
        ...ixs,
      ],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([signer]);
    const sig = await connection.sendTransaction(tx, { maxRetries: 3 });
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  }

  let raffleSig = '';
  try {
    raffleSig = await sendBatch(transfers);
  } catch {
    const sigA = await sendBatch(transfers.slice(0, 5));
    const sigB = await sendBatch(transfers.slice(5));
    raffleSig = `${sigA},${sigB}`;
  }

  return { fixedSig, raffleSig, fixedLamports, raffleLamports, prizeLamports };
}
