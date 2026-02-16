---
name: predictmax
description: Direct API access to Kalshi and Polymarket prediction markets. Fetch live market data, prices, order books, and historical data via HTTP. Analyze raw responses to provide trading insights, fair value calculations, and recommendations.
---

# PredictMax — Prediction Market API Skill

Use this skill to query **Kalshi** and **Polymarket** prediction markets directly via their public HTTP APIs. Fetch raw market data, then analyze it yourself to provide insights, fair value estimates, and trade recommendations.

> **Do NOT run the NestJS application.** Instead, make direct HTTP requests to the APIs below and analyze the responses.

---

## Kalshi API

**Base URL:** `https://api.elections.kalshi.com/trade-api/v2`

Kalshi requires an API key for authentication. Pass it as a Bearer token:
```
Authorization: Bearer <KALSHI_API_KEY>
```

**Price format:** Cents (0–100). A `yes_bid` of 42 = 42¢ = 42% implied probability.

### Key Concepts

- **Series** → recurring template (e.g., "S&P 500 Daily")
- **Event** → specific instance (e.g., "S&P 500 Jan 15")
- **Market** → individual contract (e.g., "S&P 500 above 6000")
- **Ticker format:** `SERIES-DATE-THRESHOLD` (e.g., `INXD-25JAN15-T6000`)

### Endpoints

#### List Markets
```
GET /markets?limit=100&status=open
```
Optional params: `event_ticker`, `series_ticker`, `tickers` (comma-separated), `min_close_ts`, `max_close_ts`, `cursor`

**When to use:** User asks "show me markets", "what's available", any discovery/browsing request.

**Response fields to analyze:**
- `ticker` — unique market ID
- `title` — the market question
- `yes_bid`, `yes_ask`, `no_bid`, `no_ask` — prices in cents
- `volume`, `volume_24h` — trading volume
- `open_interest` — outstanding contracts
- `status` — open/closed/settled
- `close_time`, `expiration_time` — when market ends
- `category` — sports, politics, crypto, economics, etc.

---

#### Get Single Market
```
GET /markets/{ticker}
```

**When to use:** User asks about a specific market by ticker, or you need details after finding a ticker from the list.

---

#### Get Order Book
```
GET /markets/{ticker}/orderbook?depth=10
```

**When to use:** User asks about liquidity, spread, depth, or "is it liquid enough to trade".

**Response:** `yes` and `no` arrays with `{ price, quantity }` at each level.

**How to analyze:**
- Spread = lowest `yes_ask` − highest `yes_bid`
- Tight spread (<3¢) = good liquidity
- Wide spread (>10¢) = low liquidity, avoid large positions

---

#### Get Trades
```
GET /markets/{ticker}/trades?limit=50
GET /markets/trades?limit=50
```
Optional params: `min_ts`, `max_ts`, `cursor`

**When to use:** User asks about recent trading activity, price action, or "what's been happening".

---

#### Get Price History
```
GET /markets/{ticker}/stats_history
```
Optional params: `start_ts`, `end_ts` (Unix timestamps)

**When to use:** User asks about price trends, historical movement, or "how has it moved".

---

#### List Events
```
GET /events?limit=100&status=open
```

**When to use:** User asks about a topic with multiple related markets (e.g., "Super Bowl markets").

---

#### Get Event
```
GET /events/{event_ticker}
```

**When to use:** You have an event_ticker and want to see all markets within that event.

---

### Kalshi: Finding Trending Markets

Fetch a large set then sort client-side:
```
GET /markets?limit=200&status=open
```
Sort by `volume_24h` descending. Return top N.

---

## Polymarket API

Polymarket has **two separate APIs**:

### Gamma API (Market Metadata & Search)

**Base URL:** `https://gamma-api.polymarket.com`
**Auth:** None required — fully public.

#### List Markets
```
GET /markets?limit=100&offset=0&active=true&order=volume
```

**When to use:** Discovery, browsing, finding markets by category.

**Response fields to analyze:**
- `condition_id` — unique market identifier
- `question` — the market question
- `outcome_prices` — array of decimal prices `["0.42", "0.58"]` (index 0 = YES, index 1 = NO)
- `outcomes` — array `["Yes", "No"]`
- `volume` — total volume traded
- `liquidity` — current liquidity
- `end_date_iso` — expiration date
- `category` — market category
- `active`, `closed` — status booleans
- `clobTokenIds` — array of token IDs needed for CLOB API calls `["token_yes", "token_no"]`

---

#### Get Single Market
```
GET /markets/{condition_id}
```

**When to use:** User asks about a specific Polymarket market.

---

#### Search Markets
```
GET /markets?_q={search_query}&limit=20
```

**When to use:** User searches by keyword (e.g., "Bitcoin", "Trump", "tennis").

---

#### Get Markets by Category
```
GET /markets?tag={category}&limit=50&active=true
```
Categories: `politics`, `crypto`, `sports`, `pop-culture`, `science`, `business`, `finance`

**When to use:** User asks "show me crypto/politics/sports markets".

---

### CLOB API (Live Prices & Order Books)

**Base URL:** `https://clob.polymarket.com`
**Auth:** None required for read endpoints.

**Price format:** Decimals (0–1). A price of 0.42 = 42% implied probability.

> **Important:** CLOB endpoints require `token_id`, NOT `condition_id`. Get token IDs from the `clobTokenIds` field in the Gamma API response.

#### Get Price
```
GET /price?token_id={token_id}&side=buy
```

**When to use:** Quick price check for a specific outcome.

---

#### Get Order Book
```
GET /book?token_id={token_id}
```

**When to use:** Liquidity analysis, spread calculation.

**Response:** `bids` and `asks` arrays with `{ price, size }`.

**How to analyze:**
- Best bid = highest bid price
- Best ask = lowest ask price  
- Spread = best ask − best bid
- Midpoint = (best bid + best ask) / 2

---

#### Get Midpoint
```
GET /midpoint?token_id={token_id}
```

**When to use:** Quick implied probability without full order book.

---

#### Get Price History
```
GET /prices-history?market={condition_id}&interval=1d&fidelity=60
```
Intervals: `1m`, `5m`, `15m`, `1h`, `4h`, `1d`

**When to use:** Historical price trends and movement.

---

## Analysis Framework

When you receive raw data from the APIs above, use these frameworks to analyze and present insights.

### Market Overview

For any market, present:
- **Question** and resolution criteria
- **Current price** (YES/NO) and implied probability
- **Volume** (24h and total) — indicates market interest
- **Liquidity** — determines tradability
- **Time to expiry** — affects risk profile

### Fair Value Estimation

Calculate your own fair value using:

1. **Market consensus** — current price reflects crowd wisdom
2. **External data** — polls, rankings, odds from other sources
3. **Historical baselines** — what happened in similar past events
4. **Structural factors** — time decay, event catalysts, information asymmetry

**Edge = Your Fair Value − Market Price**
- Edge > +5% → potential BUY YES opportunity
- Edge < −5% → potential BUY NO opportunity
- Edge within ±5% → no clear edge, WAIT

### Liquidity Assessment

Rate liquidity based on:
- 24h volume > $50K = HIGH
- 24h volume $5K–$50K = MEDIUM
- 24h volume < $5K = LOW
- Spread < 3% = tight (good)
- Spread > 10% = wide (bad)
- Max recommended position = 5% of daily volume

### Risk Factors

Always mention:
- **Liquidity risk** — can you get in/out at fair prices?
- **Time risk** — how long until resolution?
- **Settlement risk** — ambiguous resolution criteria?
- **Concentration risk** — is one side heavily loaded?

### Output Format

Structure responses like:

```
**MARKET**: [Question]
**PLATFORM**: Kalshi/Polymarket | **EXPIRES**: [Date]

**PRICING**
| Side | Bid | Ask | Midpoint |
|------|-----|-----|----------|
| YES  | X   | X   | X        |
| NO   | X   | X   | X        |

**FAIR VALUE ANALYSIS**
Fair Value: X% | Market Price: X% | Edge: +/-X%

**LIQUIDITY**: HIGH/MEDIUM/LOW (24h vol: $X, spread: X%)

**RECOMMENDATION**: BUY/SELL/WAIT [side]
- Confidence: X%
- Position size: $X (based on liquidity)
- Entry: limit at X
- Risk: [key risk]
```

---

## Decision Tree: Which Endpoint to Call

```
User asks about prediction markets
├── "Show me trending/popular markets"
│   ├── Kalshi: GET /markets?limit=200&status=open → sort by volume_24h
│   └── Polymarket: GET /markets?limit=100&active=true&order=volume
│
├── "Find [topic] markets" (e.g., Bitcoin, tennis, Trump)
│   ├── Kalshi: GET /markets?limit=100&status=open → filter titles client-side
│   └── Polymarket: GET /markets?_q={topic}&limit=20
│
├── "[Category] markets" (sports, crypto, politics)
│   ├── Kalshi: GET /markets?limit=100&status=open → filter by category
│   └── Polymarket: GET /markets?tag={category}&limit=50&active=true
│
├── "Analyze [specific market]"
│   ├── Kalshi: GET /markets/{ticker} + GET /markets/{ticker}/orderbook
│   └── Polymarket: GET /markets/{condition_id} + GET /book?token_id={yes_token}
│
├── "What's the price / odds for..."
│   ├── Kalshi: GET /markets/{ticker} → read yes_bid/yes_ask
│   └── Polymarket: GET /price?token_id={token_id}&side=buy
│
├── "Is [market] liquid enough?"
│   ├── Kalshi: GET /markets/{ticker}/orderbook?depth=20
│   └── Polymarket: GET /book?token_id={token_id}
│
├── "How has [market] moved?"
│   ├── Kalshi: GET /markets/{ticker}/stats_history
│   └── Polymarket: GET /prices-history?market={condition_id}&interval=1d
│
├── "Recent trades / activity"
│   ├── Kalshi: GET /markets/{ticker}/trades?limit=50
│   └── Polymarket: (use price history as proxy)
│
├── "Compare markets across platforms"
│   ├── Fetch from both Kalshi and Polymarket
│   ├── Normalize prices (Kalshi cents÷100 = Polymarket decimal)
│   └── Compare: same question, different prices = potential arbitrage
│
└── "Best opportunity / what should I bet on?"
    ├── Fetch trending from both platforms
    ├── For top 10 by volume, fetch order books
    ├── Calculate spread, implied probability, edge estimates
    └── Rank by: |edge| × liquidity_score ÷ risk_score
```

---

## Cross-Platform Normalization

Kalshi and Polymarket use different formats. Normalize like this:

| Field | Kalshi | Polymarket | Normalized |
|-------|--------|------------|------------|
| Market ID | `ticker` | `condition_id` | Use as-is per platform |
| Question | `title` | `question` | Direct map |
| YES price | `(yes_bid + yes_ask) / 200` | `parseFloat(outcome_prices[0])` | Decimal 0–1 |
| NO price | `(no_bid + no_ask) / 200` | `parseFloat(outcome_prices[1])` | Decimal 0–1 |
| Volume | `volume` | `parseFloat(volume)` | Number |
| End date | `close_time` | `end_date_iso` | ISO date string |
| Category | `category` | `category` or tag | String |

---

## Arbitrage Detection

When the same event exists on both platforms:
1. Fetch from Kalshi: normalize YES price to decimal
2. Fetch from Polymarket: read YES price as decimal
3. If `|kalshi_yes - poly_yes| > 0.05` (5%), flag as arbitrage
4. Account for fees: Kalshi ~1-2%, Polymarket ~1-2%
5. Net edge must exceed total fees to be profitable

---

## Common Categories

| Category | Kalshi | Polymarket Tag |
|----------|--------|----------------|
| Politics | `politics` | `politics` |
| Crypto | `crypto` | `crypto` |
| Sports | `sports` | `sports` |
| Economics | `economics` | `business` or `finance` |
| Entertainment | `entertainment` | `pop-culture` |
| Science | `science` | `science` |
