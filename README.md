# Polymarket Opportunity Scanner

Scan Polymarket prediction markets for trading opportunities, arbitrage, and value bets.

## What It Does

- Fetches active markets from Polymarket API
- Analyzes market efficiency (spread between YES/NO)
- Ranks by Volume/Liquidity ratio (higher = more tradeable)
- Identifies potential value opportunities

## Installation

```bash
npm install
```

## Usage

### Scan for Opportunities

```bash
# Default scan (min $100 volume)
npm run scan

# Custom filters
node src/cli.js scan --min-volume 10000 --min-liquidity 1000 --limit 20

# JSON output
node src/cli.js scan --json
```

### Show Top Markets

```bash
# Top 10 by volume
npm run top

# Top 20
node src/cli.js top --limit 20
```

## What To Look For

**High V/L Ratio** = More liquid, easier to enter/exit positions

**Low Spread** = Efficient market (YES + NO ≈ 100%)

**High Volume** = Active trading, more price discovery

## Example Output

```
1. Will Trump deport 250,000-500,000 people?
   YES: 0.8910 (89.10%) | NO: 0.1090 (10.90%)
   Spread: 0.00% | V/L Ratio: 19.53
   Volume: $83,815 | Liquidity: $4,290
```

## Opportunity Types

### Value Bets
Markets where you believe the probability is mispriced (requires domain knowledge)

### Arbitrage
Related markets with inconsistent probabilities (TODO: implement detection)

### Liquidity Plays
High-volume markets with tight spreads = safe entry/exit

## Roadmap

- [x] MVP: Fetch and analyze active markets
- [ ] Arbitrage detection (related market comparison)
- [ ] Historical price tracking
- [ ] Automated alerts (Discord DMs)
- [ ] Web dashboard
- [ ] Integration with Polymarket CLOB API (for trading)

## Notes

This scanner identifies *potential* opportunities. Always DYOR (Do Your Own Research) before trading.

Polymarket markets reflect collective wisdom - beating the market requires genuine edge (insider knowledge, better models, faster execution, etc.)

## Tech Stack

- Node.js
- Axios (API calls)
- Better-sqlite3 (future: historical tracking)
- Commander.js (CLI)

## API

Free public API: `https://gamma-api.polymarket.com/markets`
