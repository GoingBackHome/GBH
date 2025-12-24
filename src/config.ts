import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
function num(name: string, def: number): number {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${name}: ${v}`);
  return n;
}
function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (!v) return def;
  return ['1','true','yes','y','on'].includes(v.toLowerCase());
}

export const CONFIG = {
  SOLANA_RPC_URL: req('SOLANA_RPC_URL'),
  HELIUS_API_KEY: req('HELIUS_API_KEY'),
  FEE_WALLET_PRIVATE_KEY: req('FEE_WALLET_PRIVATE_KEY'),
  FIXED_WALLET: req('FIXED_WALLET'),
  MINT_ADDRESS: req('MINT_ADDRESS'),
  DATABASE_URL: req('DATABASE_URL'),

  INTERVAL_SECONDS: Math.max(30, Math.floor(num('INTERVAL_SECONDS', 300))),
  MIN_HOLD_TOKENS: num('MIN_HOLD_TOKENS', 0),
  PRIORITY_FEE_SOL: num('PRIORITY_FEE_SOL', 0.000001),
  PUMP_POOL: process.env.PUMP_POOL ?? 'pump',

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',

  DRY_RUN: bool('DRY_RUN', false),
  MAX_PAYOUT_SOL_PER_CYCLE: num('MAX_PAYOUT_SOL_PER_CYCLE', 50),
};
