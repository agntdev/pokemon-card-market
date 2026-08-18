# Pokémon Card Marketplace — Bot specification

**Archetype:** commerce

**Voice:** professional and warm — write every user-facing message, button label, error, and empty state in this voice.

A Telegram bot enabling users to list and sell Pokémon cards priced in USD. Buyers pay LTC on-chain via generated addresses/QRs. Payments are held in escrow until buyer confirmation or 7-day auto-release to seller after deducting a 10% platform fee.

> This is the complete contract for the bot. Implement EVERY entry point, flow, feature, integration, and edge case below. The completeness review checks the bot against this document after each build pass.

## Primary audience

- individual Pokémon card sellers
- LTC-paying buyers

## Success criteria

- successful on-chain LTC payment confirmation
- auto-release of escrow funds after 7 days if unconfirmed
- 10% fee deduction from seller payouts

## Entry points

Every feature must be reachable from the bot's command/button surface (button-first; only /start and /help are slash commands).

- **/start** (command, actor: user, command: /start) — Open main menu with listing creation and browse options
- **Create Listing** (button, actor: user, callback: listing:create) — Initiate listing creation flow with title, description, photos, and USD price
- **Browse Listings** (button, actor: user, callback: listing:browse) — View active listings with search/filter options
- **Buy Now** (button, actor: user, callback: order:initiate) — Generate LTC payment address/QR for selected listing

## Flows

### Listing Creation
_Trigger:_ /start or listing:create

1. capture title/description
2. select card condition
3. upload photos
4. set USD price

_Data touched:_ User, Listing

### Payment Processing
_Trigger:_ Buy button on listing

1. show USD price
2. calculate LTC amount
3. generate payment address/QR
4. monitor on-chain confirmation

_Data touched:_ Listing, Order, Escrow

### Escrow Management
_Trigger:_ On-chain payment confirmation

1. mark order as Paid
2. wait for buyer confirmation or 7-day timeout
3. release funds to seller minus 10% fee

_Data touched:_ Order, Escrow

## Owner-supplied settings

The OWNER provides these; they are collected in chat and injected into the environment at deploy. Read each one from the environment where it is used (`ctx.env.<KEY>` / `env.<KEY>` on Cloudflare Workers; `process.env.<KEY>` only as a Node/harness fallback — never the sole read). Do NOT invent your own way of learning the value, do NOT ask for it in a bot message, and do NOT hardcode a default.

- **ADMIN_CHAT_ID** — Target chat for system messages to sellers
  - this is the OWNER's own chat id; the platform already knows it. Read `ADMIN_CHAT_ID` via `ctx.env` (prefer toolkit `adminChatId` / `requireOwner`) — never ask a user, never treat whoever writes first as the admin, never invent claim-admin or open manage for everyone.
  - may be UNSET at runtime: the bot must still start, and the feature needing ADMIN_CHAT_ID must say so plainly instead of failing.

Your behavioral specs run WITHOUT these values, so no spec may depend on one.

## Data entities

Durable data (must survive a restart) uses the toolkit's persistent store, never in-memory maps.

An entity that merely NAMES an owner-supplied setting above (an admin chat, an API account) is not something to store or discover — read it from the environment.

- **User** _(retention: persistent)_ — Telegram-authenticated seller/buyer profile
  - fields: telegram_id, display_name
- **Listing** _(retention: persistent)_ — Active Pokémon card listing
  - fields: title, description, condition, photos, usd_price, seller_id, status
- **Order** _(retention: persistent)_ — Buyer payment and confirmation tracking
  - fields: buyer_id, listing_id, ltc_amount, status, timestamps
- **Escrow** _(retention: persistent)_ — On-chain payment tracking
  - fields: tx_id, amount, fee, release_status

## Integrations

- **Telegram** (required) — Bot API messaging and payment QR generation
- **Litecoin Blockchain** (required) — On-chain payment monitoring and address generation
Call external APIs against their real contract (correct endpoints, ids, params); credentials from env. Do not fake responses.

## Owner controls

- ADMIN_CHAT_ID for seller notifications

## Notifications

- Seller DM on listing purchase
- Buyer payment instructions
- Escrow release status updates

## Permissions & privacy

- Telegram account-linked authentication
- Stored listing media and payment metadata
- No personal data beyond Telegram IDs

## Edge cases

- Failed LTC payment detection
- Dispute-free auto-release after 7 days
- 10% fee calculation during payout

## Required tests

- End-to-end LTC payment flow with escrow release
- 7-day timeout auto-release validation
- Fee deduction from seller payout

## Assumptions

- Telegram account auto-verification for sellers
- Live USD-to-LTC conversion at payment time
- 7-day escrow timeout default
