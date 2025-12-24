import { CONFIG } from '../config.js';
import { PRIZE_BPS } from '../payout.js';

const sum = PRIZE_BPS.reduce((a,b)=>a+b,0);
if (sum !== 10000) throw new Error(`Prize bps sum != 10000 (got ${sum})`);

if (!CONFIG.SOLANA_RPC_URL.startsWith('http')) throw new Error('SOLANA_RPC_URL must be http(s)');
if (CONFIG.INTERVAL_SECONDS < 30) throw new Error('INTERVAL_SECONDS too small');

console.log('Selfcheck OK');
