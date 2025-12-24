import fetch from 'node-fetch';
import { CONFIG } from './config.js';
import { sha256Hex } from './utils.js';

export type Holder = {
  owner: string;
  balanceRaw: bigint;
  balanceUi: number;
};

type TokenAccountRow = {
  owner: string;
  amount: number | string;
  decimals?: number;
};

export async function fetchHoldersSnapshot(): Promise<{ holders: Holder[]; snapshotHash: string }> {
  // Helius guide uses getTokenAccounts with params { page, limit, mint } and returns data.result.token_accounts.
  // https://www.helius.dev/blog/how-to-get-token-holders-on-solana citeturn3view0
  const url = `https://mainnet.helius-rpc.com/?api-key=${CONFIG.HELIUS_API_KEY}`;

  let page = 1;
  const limit = 1000;

  const owners = new Map<string, { raw: bigint; decimals: number }>();

  while (true) {
    const body = {
      jsonrpc: '2.0',
      id: 'helius-holders',
      method: 'getTokenAccounts',
      params: {
        page,
        limit,
        displayOptions: {},
        mint: CONFIG.MINT_ADDRESS,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new Error(`Helius getTokenAccounts failed: ${res.status} ${res.statusText} ${t}`);
    }

    const data: any = await res.json();
    const tokenAccounts: TokenAccountRow[] = data?.result?.token_accounts ?? [];

    if (!tokenAccounts || tokenAccounts.length === 0) break;

    for (const ta of tokenAccounts) {
      const owner = ta?.owner;
      if (!owner) continue;

      const decimals = Number(ta?.decimals ?? 0);
      const amountRaw = BigInt(typeof ta.amount === 'string' ? ta.amount : Math.trunc(Number(ta.amount)));

      const prev = owners.get(owner);
      if (!prev) owners.set(owner, { raw: amountRaw, decimals });
      else owners.set(owner, { raw: prev.raw + amountRaw, decimals: prev.decimals ?? decimals });
    }

    page += 1;
    if (page > 10000) throw new Error('Helius pagination runaway (page>10000)');
  }

  const holders: Holder[] = [];
  for (const [owner, v] of owners.entries()) {
    const ui = Number(v.raw) / Math.pow(10, v.decimals);
    if (ui >= CONFIG.MIN_HOLD_TOKENS && v.raw > 0n) {
      holders.push({ owner, balanceRaw: v.raw, balanceUi: ui });
    }
  }

  holders.sort((a, b) => a.owner.localeCompare(b.owner));
  const snapshotStr = holders.map(h => `${h.owner}:${h.balanceRaw.toString()}`).join('|');
  const snapshotHash = sha256Hex(snapshotStr);

  return { holders, snapshotHash };
}
