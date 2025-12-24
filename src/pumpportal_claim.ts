import fetch from 'node-fetch';
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { CONFIG } from './config.js';

/**
 * Claims creator fees using PumpPortal Local Transaction API.
 * Docs: https://pumpportal.fun/creator-fee/  (collectCreatorFee) citeturn1view1
 */
export async function claimCreatorFees(): Promise<{ signature: string }> {
  const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed');

  // Build tx bytes
  const resp = await fetch('https://pumpportal.fun/api/trade-local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: Keypair.fromSecretKey(bs58.decode(CONFIG.FEE_WALLET_PRIVATE_KEY)).publicKey.toBase58(),
      action: 'collectCreatorFee',
      priorityFee: CONFIG.PRIORITY_FEE_SOL,
      pool: CONFIG.PUMP_POOL, // "pump" or "meteora-dbc"
      // mint optional per docs; pump.fun claims all at once
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(()=> '');
    throw new Error(`PumpPortal trade-local failed: ${resp.status} ${resp.statusText} ${t}`);
  }

  const buf = new Uint8Array(await resp.arrayBuffer());
  const tx = VersionedTransaction.deserialize(buf);

  const signer = Keypair.fromSecretKey(bs58.decode(CONFIG.FEE_WALLET_PRIVATE_KEY));
  tx.sign([signer]);

  // Send
  const sig = await connection.sendTransaction(tx, { maxRetries: 3 });
  await connection.confirmTransaction(sig, 'confirmed');

  return { signature: sig };
}

/**
 * Computes FEES_CLAIMED from the *claim transaction* meta:
 * feesClaimed = (post - pre) + txFee   (for the fee wallet account)
 *
 * This avoids mixing with other wallet movements, and follows your rule:
 * use the claim's fee amount as the base, then multiply by 0.5.
 */
export async function computeFeesClaimedLamportsFromTx(signature: string): Promise<bigint> {
  const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed');
  const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0, commitment: 'confirmed' });
  if (!tx?.meta) throw new Error(`Could not fetch tx meta for claim sig: ${signature}`);

  const feeWallet = Keypair.fromSecretKey(bs58.decode(CONFIG.FEE_WALLET_PRIVATE_KEY)).publicKey.toBase58();
  const keys = tx.transaction.message.staticAccountKeys.map(k => k.toBase58());
  const idx = keys.indexOf(feeWallet);
  if (idx === -1) throw new Error(`Fee wallet not found in claim tx accounts`);

  const pre = BigInt(tx.meta.preBalances[idx] ?? 0);
  const post = BigInt(tx.meta.postBalances[idx] ?? 0);
  const fee = BigInt(tx.meta.fee ?? 0);

  // If claim credited SOL, post > pre - fee. This formula nets the credited amount.
  const claimed = (post - pre) + fee;
  if (claimed < 0n) return 0n;
  return claimed;
}
