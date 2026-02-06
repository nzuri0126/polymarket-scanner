## Bug Found (2026-02-06)

**Scanner missing high-probability buckets:**
- DOGE event has 6 buckets, scanner only found 5
- Missed: <$50B bucket (95.5% probability)
- Result: False positive arbitrage detection
- Fix needed: Remove probability filters in bucket grouping

**See:** memory/research/2026-02-06-polymarket-trading-mechanics.md
**Error:** error-learn #25

