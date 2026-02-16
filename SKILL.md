---
name: predictmax
description: PredictMax — AI prediction market analyst with cross-platform intelligence for Kalshi and Polymarket. Provides REST APIs, WebSocket chat, and 33+ AI tools for market discovery, analysis, fair value calculation, risk assessment, arbitrage detection, and trade recommendations.
---

# PredictMax Skill

PredictMax is an AI-powered prediction market analysis backend built on NestJS. It connects to **Kalshi** and **Polymarket** (plus Helius for Solana data) and provides institutional-grade market intelligence through REST endpoints, WebSocket chat, and an internal AI tool-calling system powered by Claude.

---

## Quick Start

### 1. Environment Variables

Copy `.env.example` to `.env` and configure:

```env
# Required
ANTHROPIC_API_KEY=sk-ant-xxx          # Claude API key (powers AI analysis)
SUPABASE_URL=https://xxx.supabase.co  # Supabase project URL
SUPABASE_ANON_KEY=eyJ...              # Supabase anon key

# Platform APIs
KALSHI_API_KEY=xxx                     # Kalshi API key
KALSHI_API_SECRET=xxx                  # Kalshi API secret
POLYMARKET_API_KEY=xxx                 # Polymarket API key (read-only endpoints are public)
HELIUS_API_KEY=xxx                     # Helius RPC for Solana blockchain data

# Optional
YOUTUBE_API_KEY=xxx                    # YouTube Data API v3 for live sports streams
PORT=3000                              # Server port (default 3000)
NODE_ENV=development                   # development or production
```

### 2. Install & Run

```bash
cd /Users/singhajeet/Documents/prediction_maxxing/predictmax
npm install
npm run start:dev     # Development (hot-reload)
npm run build && npm run start:prod  # Production
```

The server starts at `http://localhost:3000` with:
- REST API at `http://localhost:3000/api/*`
- WebSocket chat at `ws://localhost:3000/chat`

---

## Architecture Overview

```
src/
├── main.ts                          # Bootstrap, CORS, /api prefix, port 3000
├── app.module.ts                    # Root module imports all feature modules
├── config/
│   ├── config.module.ts
│   └── config.service.ts            # Env var accessors
├── database/
│   ├── database.module.ts
│   └── database.service.ts          # Supabase client wrapper
├── ai/
│   ├── ai.module.ts
│   ├── ai.service.ts                # Claude AI with 22 base tools + retry logic
│   ├── chat.gateway.ts              # WebSocket gateway (/chat namespace)
│   ├── conversation.service.ts      # Conversation persistence (Supabase)
│   ├── tools.ts                     # 22 base tool definitions for Claude
│   └── prompts.ts                   # Re-exports enhanced system prompt
├── integrations/
│   ├── integrations.module.ts
│   ├── kalshi.service.ts            # Kalshi V2 API client
│   ├── polymarket.service.ts        # Polymarket Gamma + CLOB API client
│   ├── helius.service.ts            # Helius Solana RPC client
│   ├── sports-event-detector.service.ts  # Live sports event detection
│   └── youtube-stream-finder.service.ts  # YouTube live stream finder
├── market/
│   ├── market.module.ts
│   ├── market.controller.ts         # REST endpoints under /api/markets
│   └── market.service.ts            # Cross-platform market aggregation
├── intelligence/
│   ├── intelligence.module.ts
│   ├── enhanced-tools.ts            # 13 enhanced tool definitions
│   ├── tool-handler.service.ts      # Enhanced tool executor
│   ├── query-intelligence.service.ts    # NLP query parsing via Claude
│   ├── unified-market-search.service.ts # Cross-platform fuzzy search
│   ├── sports-intelligence.service.ts   # ATP/WTA rankings, H2H, form
│   ├── probability-engine.service.ts    # Multi-model ensemble fair value
│   ├── risk-assessment.service.ts       # Liquidity/settlement/volatility risk
│   ├── recommendation-engine.service.ts # BUY/SELL/WAIT + position sizing
│   ├── report-generator.service.ts      # ASCII and markdown reports
│   ├── prompts.ts                       # System prompt + domain templates
│   ├── types.ts                         # UnifiedMarket, probability types
│   └── index.ts                         # Module exports
└── common/
    ├── common.module.ts
    └── cache.service.ts              # In-memory cache with TTL
```

---

## REST API Endpoints

All endpoints are prefixed with `/api` and nested under the `markets` controller.

### `GET /api/markets`

List and filter markets across both platforms.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `platform` | `kalshi` \| `polymarket` \| `all` | `all` | Filter by platform |
| `category` | `string` | — | Category filter (e.g., `sports`, `crypto`, `politics`) |
| `minVolume` | `number` | — | Minimum trading volume |
| `minLiquidity` | `number` | — | Minimum liquidity |
| `search` | `string` | — | Keyword search |
| `limit` | `number` | `50` | Max results |

**Example:**
```bash
curl "http://localhost:3000/api/markets?platform=kalshi&category=sports&limit=10"
```

**Response:**
```json
{
  "success": true,
  "count": 10,
  "filters": { "platform": "kalshi", "category": "sports", "limit": 10 },
  "markets": [
    {
      "platform": "kalshi",
      "marketId": "INXD-24JAN01-T7999",
      "question": "Will S&P 500 close above 7999?",
      "yesPrice": 0.42,
      "noPrice": 0.58,
      "volume": 125000,
      "liquidity": 50000,
      "endDate": "2024-01-31T23:59:59Z",
      "category": "economics",
      "status": "open"
    }
  ]
}
```

---

### `GET /api/markets/trending`

Get top markets by 24h trading volume.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | `number` | `20` | Number of trending markets |

**Example:**
```bash
curl "http://localhost:3000/api/markets/trending?limit=5"
```

---

### `GET /api/markets/discover`

AI-powered market discovery with recommendations.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `category` | `string` | — | Market category |
| `timeHorizon` | `string` | — | Days until expiry (e.g., `30`) |
| `riskProfile` | `conservative` \| `moderate` \| `aggressive` | — | Risk tolerance |
| `liquidityPreference` | `high` \| `medium` \| `low` | — | Liquidity filter |

**Example:**
```bash
curl "http://localhost:3000/api/markets/discover?category=crypto&riskProfile=moderate&liquidityPreference=high"
```

**Response includes** `recommendations` — an AI-generated analysis string.

---

### `GET /api/markets/analyze/:platform/:marketId`

Deep analysis of a specific market with AI-generated opportunity scoring.

**Path Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `platform` | `kalshi` \| `polymarket` | Platform name |
| `marketId` | `string` | Kalshi ticker or Polymarket condition_id |

**Example:**
```bash
curl "http://localhost:3000/api/markets/analyze/kalshi/INXD-24JAN01-T7999"
```

**Response includes:**
- `market` — normalized market data
- `opportunity` — `{ opportunityScore, impliedProbability, spreadPercent, volumeRank, reasons }`
- `aiAnalysis` — AI-generated analysis text

---

### `GET /api/markets/:platform/:marketId`

Get raw market details for a specific market.

**Example:**
```bash
curl "http://localhost:3000/api/markets/polymarket/0x1234abcd..."
```

---

### `GET /api/markets/compare`

Compare multiple markets side-by-side with AI analysis.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `markets` | `string` | Comma-separated `platform:marketId` pairs |

**Example:**
```bash
curl "http://localhost:3000/api/markets/compare?markets=kalshi:TICKER1,polymarket:0xABC"
```

---

## WebSocket Chat API

Connect to `ws://localhost:3000/chat` using Socket.io.

### Events (Client → Server)

| Event | Payload | Description |
|-------|---------|-------------|
| `register` | `{ userId: string }` | Register user session |
| `message` | `{ content: string, userId: string, conversationId?: string }` | Send a chat message |
| `join_conversation` | `{ conversationId: string, userId: string }` | Rejoin existing conversation |
| `list_conversations` | `{ userId: string }` | List user's conversations |

### Events (Server → Client)

| Event | Payload | Description |
|-------|---------|-------------|
| `connected` | `{ socketId }` | Connection confirmed |
| `conversation_created` | `{ conversationId }` | New conversation started |
| `assistant_typing` | `{ conversationId }` | AI is processing |
| `assistant_stopped_typing` | `{ conversationId }` | AI finished processing |
| `message_response` | `{ conversationId, content, messageId, role, timestamp }` | AI response |
| `conversation_history` | `{ conversationId, messages }` | History when rejoining |
| `conversations_list` | `{ conversations }` | List of conversations |
| `error` | `{ message, error? }` | Error occurred |

### Example (JavaScript)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000/chat');

socket.on('connected', () => {
  socket.emit('register', { userId: 'user-123' });

  socket.emit('message', {
    content: 'Find the best tennis market on Kalshi',
    userId: 'user-123',
  });
});

socket.on('message_response', (data) => {
  console.log('AI Response:', data.content);
});
```

---

## AI Tools Reference

The AI agent has access to **33 tools** (22 base + 11 enhanced) that it invokes automatically based on user intent. When interacting via WebSocket chat, the AI selects the appropriate tool(s). These are also the tools used internally by the REST endpoints.

### Base Tools (22)

#### Kalshi Market Tools (8)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_kalshi_markets` | List markets with filtering (limit, status, event_ticker, series_ticker, tickers, min/max_close_ts) | None |
| `get_kalshi_market` | Get single market by ticker | `ticker` |
| `get_kalshi_orderbook` | Real-time order book (YES/NO bids at price levels) | `ticker` |
| `get_kalshi_trades` | Recent trades (price, count, taker_side) | None |
| `get_kalshi_market_history` | Historical OHLCV candlestick data | `ticker` |
| `get_kalshi_events` | List events (collections of related markets) | None |
| `get_kalshi_event` | Get specific event with all its markets | `event_ticker` |
| `get_kalshi_series` | List recurring event templates | None |

**Kalshi Price Format:** Prices are in **cents (0–100)**. A yes_bid of 42 means 42¢ = 42% implied probability.

#### Polymarket Market Tools (10)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_polymarket_markets` | List markets from Gamma API (limit, offset, active, order, volume/liquidity filters) | None |
| `get_polymarket_market` | Get market by ID or slug | `id` |
| `get_polymarket_events` | List events with nested markets | None |
| `get_polymarket_event` | Get specific event by ID or slug | `id` |
| `get_polymarket_price` | Current token price from CLOB | `token_id` |
| `get_polymarket_orderbook` | Order book (bids and asks) | `token_id` |
| `get_polymarket_spread` | Bid-ask spread | `token_id` |
| `get_polymarket_midpoint` | Midpoint price (avg of best bid/ask) | `token_id` |
| `get_polymarket_price_history` | Historical candlestick data (1m, 5m, 15m, 1h, 4h, 1d intervals) | `market` |
| `search_polymarket` | Keyword search across markets, events, profiles | `query` |

**Polymarket Price Format:** Prices are **decimals (0–1)**. A price of 0.42 = 42% implied probability.

**Polymarket has TWO API layers:**
- **Gamma API** (`gamma-api.polymarket.com`) — Market metadata, search, events  
- **CLOB API** (`clob.polymarket.com`) — Real-time prices, order books, trading

#### Cross-Platform Tools (4)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_trending_markets` | Top markets by 24h volume (sorted, one call) | None |
| `discover_markets` | Advanced multi-criteria filtering across both platforms | None |
| `analyze_market` | Opportunity score (1–100), implied probability, spread, liquidity | `platform`, `market_id` |
| `compare_markets` | Side-by-side comparison | `markets` (array) |

### Enhanced Intelligence Tools (11)

These tools provide deeper analysis using the intelligence services.

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `intelligent_search` | Natural language market search with fuzzy matching and relevance scoring | `query` |
| `analyze_market_deep` | Full analysis: fair value, risk assessment, trade recommendation, report | `platform`, `market_id` |
| `compare_markets_detailed` | Detailed comparison with fair value, edge, risk-adjusted ranking, arbitrage | `markets` (array) |
| `get_sports_intelligence` | Player rankings, H2H records, form analysis, surface advantage, external odds | `platform`, `market_id` |
| `calculate_fair_value` | Multi-model ensemble probability (market consensus, statistical, external odds, historical) | `platform`, `market_id` |
| `assess_market_risk` | Liquidity, settlement, volatility, concentration, time risk + Kelly sizing | `platform`, `market_id` |
| `find_best_opportunity` | Scans markets, ranks by risk-adjusted EV, returns best with full analysis | None |
| `find_arbitrage` | Cross-platform price differences accounting for fees/slippage | None |
| `quick_recommendation` | Fast BUY/SELL/WAIT screening | `platform`, `market_id` |
| `scan_category` | Category-wide scan with edge estimates and ranked results | `category` |
| `generate_report` | Professional report (formats: full, markdown, quick) | `platform`, `market_id` |

### Live Sports Tools (2)

| Tool | Description | Required Params |
|------|-------------|-----------------|
| `get_live_stream` | Find YouTube live stream for a sports market | `platform`, `market_id` |
| `get_live_games` | Get all live games for a sport | `sport` |

---

## Kalshi API Integration Details

**Base URL:** `https://api.elections.kalshi.com/trade-api/v2`

**Authentication:** API key + secret passed via headers. The service handles auth automatically.

**Key Concepts:**
- **Series** → recurring templates (e.g., "Daily Temperature")
- **Event** → specific instance of a series (e.g., "Jan 15 Temperature")
- **Market** → individual contract within an event (e.g., "Above 80°F")
- **Ticker format:** `SERIES-DATE-THRESHOLD` (e.g., `INXD-24JAN01-T7999`)

**Normalized Market Fields (from Kalshi):**
```typescript
{
  platform: 'kalshi',
  marketId: market.ticker,
  ticker: market.ticker,
  question: market.title,
  description: market.subtitle,
  yesPrice: (market.yes_bid + market.yes_ask) / 200,  // avg, normalized to 0-1
  noPrice: (market.no_bid + market.no_ask) / 200,
  volume: market.volume,
  endDate: market.close_time,
  category: market.category,
  status: market.status,
  isActive: market.status === 'open'
}
```

---

## Polymarket API Integration Details

**Gamma API Base URL:** `https://gamma-api.polymarket.com`  
**CLOB API Base URL:** `https://clob.polymarket.com`

**Authentication:** Read-only endpoints are **fully public** — no API key required.

**Key Concepts:**
- **Market** → a prediction market with outcomes and prices
- **condition_id** → unique market identifier
- **token_id** → identifier for a specific outcome token (needed for CLOB price/orderbook)
- **clobTokenIds** → array of token IDs in a market (index 0 = YES, index 1 = NO for binary)
- **Outcome prices** are decimals (0–1)

**Normalized Market Fields (from Polymarket):**
```typescript
{
  platform: 'polymarket',
  marketId: market.condition_id,
  question: market.question,
  description: market.description,
  yesPrice: parseFloat(market.outcome_prices?.[0] || '0'),
  noPrice: parseFloat(market.outcome_prices?.[1] || '0'),
  volume: parseFloat(market.volume || '0'),
  liquidity: parseFloat(market.liquidity || '0'),
  endDate: market.end_date_iso,
  category: market.category || 'general',
  isActive: market.active && !market.closed
}
```

---

## Common Workflows

### 1. Find Trending Markets
```bash
# Via REST
curl "http://localhost:3000/api/markets/trending?limit=5"

# Via WebSocket chat
"Show me the top 5 trending markets"
# → AI uses get_trending_markets tool
```

### 2. Analyze a Specific Market
```bash
# Via REST
curl "http://localhost:3000/api/markets/analyze/kalshi/INXD-24JAN01-T7999"

# Via WebSocket chat
"Analyze INXD-24JAN01-T7999 on Kalshi"
# → AI uses analyze_market_deep tool
```

### 3. Search Markets by Topic
```bash
# Via REST
curl "http://localhost:3000/api/markets?search=bitcoin&platform=polymarket"

# Via WebSocket chat
"Find Bitcoin markets on Polymarket"
# → AI uses intelligent_search with platform constraint
```

### 4. Compare Markets Across Platforms
```bash
# Via REST
curl "http://localhost:3000/api/markets/compare?markets=kalshi:TICKER1,polymarket:0xABC"

# Via WebSocket chat
"Compare these two markets: TICKER1 on Kalshi vs 0xABC on Polymarket"
# → AI uses compare_markets_detailed tool
```

### 5. Find Best Opportunity
```bash
# Via WebSocket chat
"What's the best bet in sports right now?"
# → AI uses find_best_opportunity with category=sports

"Where should I bet $500?"
# → AI uses find_best_opportunity + assess_market_risk for position sizing
```

### 6. Arbitrage Detection
```bash
# Via WebSocket chat
"Find arbitrage opportunities between Kalshi and Polymarket"
# → AI uses find_arbitrage tool
```

### 7. Category Scan
```bash
# Via WebSocket chat
"Show me all tennis markets"
# → AI uses scan_category with category=sports/tennis

"Scan crypto markets for opportunities"
# → AI uses scan_category with category=crypto
```

### 8. Get a Professional Report
```bash
# Via WebSocket chat
"Generate a full report for INXD-24JAN01-T7999 on Kalshi"
# → AI uses generate_report with format=full
```

---

## Platform-Specific Notes

### Kalshi
- **Auth required** for all API calls
- Prices in **cents (0–100)**
- Order books return only bids (yes_bid + no_ask ≈ 100 due to complementary nature)
- Use `event_ticker` to find all markets within a topic
- `series_ticker` groups recurring events (e.g., weekly temperature markets)

### Polymarket
- **No auth required** for read-only data
- Prices in **decimals (0–1)**
- Two separate APIs: Gamma (metadata/search) and CLOB (prices/orderbooks)
- Use `condition_id` for market identification
- Use `token_id` (from `clobTokenIds`) for price/orderbook queries
- Search is available via `search_polymarket` tool
- Categories: politics, crypto, sports, pop-culture, science, business, etc.

### Platform Detection
When a user mentions a specific platform (e.g., "on Kalshi" or "Polymarket"), the AI automatically constrains queries to that platform only. This works across the conversation — once a platform is mentioned, follow-up queries maintain context.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ANTHROPIC_API_KEY` missing | Set the key in `.env` — required for AI analysis |
| Kalshi returns 401 | Check `KALSHI_API_KEY` and `KALSHI_API_SECRET` |
| Polymarket data empty | Polymarket read endpoints are public, check network connectivity |
| Rate limit errors | AI service has built-in retry with exponential backoff (max 1 retry, 500ms–5s delay) |
| WebSocket won't connect | Ensure CORS is enabled (default: all origins allowed) |
| Live streams not working | Set `YOUTUBE_API_KEY` (optional, requires YouTube Data API v3 enabled) |

---

## Database Schema

Uses **Supabase** (PostgreSQL). Schema files:
- `supabase-schema.sql` — Base tables (conversations, messages)
- `supabase-schema-v2.sql` — Enhanced tables (predictions, performance_metrics, market_alerts, user_trades, market_snapshots, model_calibration)

Execute the SQL files in your Supabase SQL Editor to set up the database.
