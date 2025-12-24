# GBH Raffle Bot (Pump.fun creator fee claim → 50% fixed wallet + 50% raffle)

This worker does, every interval (default 5 minutes):

1) Claims Pump.fun **creator fees** via PumpPortal **Local Transaction API** (`collectCreatorFee`).  
2) Computes **FEES_CLAIMED** from the *claim transaction* itself (not from arbitrary wallet balance changes).  
3) Sends **50%** of FEES_CLAIMED to a fixed wallet.  
4) Takes a **holders snapshot** for `MINT_ADDRESS` (Helius DAS `getTokenAccounts`).  
5) Runs a weighted raffle (tickets = `sqrt(balance)`), picks 10 unique winners.  
6) Sends **the other 50%** as 10 prizes, totaling 100% of the raffle pool:
   - 32%, 12%, 12%, 8%, 8%, 8%, 5%, 5%, 5%, 5%
7) Stores everything in Postgres and optionally posts a Telegram summary.

## Important safety notes
- This is fully automated and signs transactions. Use a **dedicated fee wallet** with limited funds.
- Set `DRY_RUN=true` to test end-to-end without sending transfers (it will still claim if you let it).
- Set `MAX_PAYOUT_SOL_PER_CYCLE` as a hard cap.

## Deploy (Railway, no terminal approach)
1) Create a new Railway project.
2) Add a Postgres database plugin. Copy its `DATABASE_URL`.
3) Add a new service from GitHub (upload this repo), or "Deploy from source".
4) Set environment variables (see `.env.example`).
5) Railway will run:
   - Build: `npm run build`
   - Start: `npm start`

## Database
Run the SQL in `src/db/schema.sql` in your Railway Postgres "Query" UI.

## Telegram
Create a bot via @BotFather, add it to a group/channel, and set:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (group id or channel id)

## What you still need later
- Your `MINT_ADDRESS` once the token exists.
- Your `FEE_WALLET_PRIVATE_KEY` should be the wallet that can claim creator fees.

