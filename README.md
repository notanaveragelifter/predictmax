# PredictMax

PredictMax is an AI-powered prediction market analysis platform. It aggregates data from Kalshi and Polymarket, provides cross-platform market intelligence, and delivers institutional-grade trading analysis through both REST and WebSocket interfaces.

---

## Architecture

Built on NestJS with a modular service architecture.

```
src/
├── ai/                  Claude AI service, WebSocket chat, tool definitions
├── integrations/        Kalshi V2, Polymarket Gamma/CLOB, Helius Solana RPC
├── intelligence/        Probability engine, risk assessment, recommendations
├── market/              REST controller, cross-platform aggregation
├── database/            Supabase client, conversation persistence
├── config/              Environment variable management
└── common/              In-memory cache with TTL
```

**Data flow:**

1. Client connects via REST (`/api/*`) or WebSocket (`/chat`).
2. Market data is fetched from Kalshi and Polymarket APIs in parallel.
3. The intelligence layer calculates fair value, assesses risk, and generates recommendations.
4. Claude processes raw data through domain-specific prompts and returns structured analysis.

---

## Core Capabilities

- **Cross-platform market discovery** across Kalshi and Polymarket with unified normalization.
- **Deep market analysis** with fair value calculation, edge detection, and opportunity scoring.
- **Risk assessment** covering liquidity, settlement, volatility, concentration, and time risk.
- **Position sizing** via Kelly criterion with conservative, recommended, and maximum tiers.
- **Arbitrage detection** identifying cross-platform price discrepancies net of fees.
- **Real-time chat** with WebSocket-based conversational AI, typing indicators, and session persistence.
- **Sports intelligence** including player rankings, head-to-head records, surface analysis, and external odds.
- **Professional reporting** in full, markdown, and quick formats.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | NestJS (Node.js / TypeScript) |
| AI Model | Claude 3.5 Sonnet (Anthropic SDK) |
| Database | Supabase (PostgreSQL) |
| Real-time | Socket.io |
| HTTP Client | Axios with connection pooling |
| Blockchain | Helius (Solana RPC) |

---

## Setup

### Prerequisites

- Node.js v18 or later
- Supabase project
- API keys: Anthropic, Kalshi, Polymarket (optional), Helius (optional)

### Installation

```bash
git clone https://github.com/notanaveragelifter/predictmax.git
cd predictmax
npm install
```

### Configuration

Copy `.env.example` to `.env` and populate:

```env
ANTHROPIC_API_KEY=sk-ant-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
KALSHI_API_KEY=xxx
KALSHI_API_SECRET=xxx
POLYMARKET_API_KEY=xxx
HELIUS_API_KEY=xxx
```

### Database

Execute the schema files in your Supabase SQL editor:

1. `supabase-schema.sql` — base tables (conversations, messages)
2. `supabase-schema-v2.sql` — extended tables (predictions, alerts, trades, calibration)

### Run

```bash
npm run start:dev          # Development with hot-reload
npm run build && npm run start:prod   # Production
```

The server starts at `http://localhost:3000`.

---

## API

### REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/markets` | List and filter markets across both platforms |
| GET | `/api/markets/trending` | Top markets by 24h trading volume |
| GET | `/api/markets/discover` | AI-powered market discovery with recommendations |
| GET | `/api/markets/analyze/:platform/:marketId` | Deep analysis with opportunity scoring |
| GET | `/api/markets/:platform/:marketId` | Raw market details |
| GET | `/api/markets/compare` | Side-by-side market comparison |

### WebSocket

Connect to `ws://localhost:3000/chat` via Socket.io.

| Direction | Event | Purpose |
|-----------|-------|---------|
| Client | `register` | Register user session |
| Client | `message` | Send a chat message |
| Server | `message_response` | AI analysis response |
| Server | `assistant_typing` | Processing indicator |

---

## AI Tools

The AI agent has access to 33 tools across three tiers:

**Platform tools** (18) — direct Kalshi and Polymarket API wrappers for markets, order books, trades, events, prices, and search.

**Cross-platform tools** (4) — unified trending, discovery, analysis, and comparison across both platforms.

**Intelligence tools** (11) — deep analysis, fair value calculation, risk assessment, best opportunity finder, arbitrage detection, category scanning, sports intelligence, and report generation.

Full tool documentation is available in `SKILL.md`.

---

## OpenClaw Skill

PredictMax is available as an OpenClaw skill for AI agents that need direct access to prediction market data.

```bash
npx skills add notanaveragelifter/predictmax
```

The skill provides instructions for calling Kalshi and Polymarket APIs directly via HTTP, along with analysis frameworks for interpreting the data. See `SKILL.md` for details.

---

## Disclaimer

Prediction markets involve substantial risk. PredictMax provides data-driven analysis for informational purposes only. Past market behavior does not guarantee future results. This is not financial advice.
