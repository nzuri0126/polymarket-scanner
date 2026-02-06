# Polymarket Scanner Scripts

## heartbeat-check.js

Automated arbitrage opportunity scanner for OpenClaw heartbeat integration.

### Usage

```bash
node scripts/heartbeat-check.js
```

### What it does

1. Runs `node src/cli.js arb` to scan for arbitrage opportunities
2. Parses the output for UNDERBOOK/OVERBOOK/CONTRADICTION opportunities
3. Filters for high-value opportunities:
   - Edge ≥ 20% (significant arbitrage)
   - Combined volume ≥ $10,000 (enough liquidity)
4. Outputs `DM_NOTIFICATION:` JSON if opportunities found
5. Exits with code 0 (success) or 1 (error)

### Configuration

Edit thresholds in `scripts/heartbeat-check.js`:

```javascript
const CONFIG = {
  minEdge: 20,           // Minimum edge % to alert
  minVolume: 10000,      // Minimum combined volume
  discordDMSession: '...', // Discord DM session key
};
```

### Output Format

When opportunities are found:

```
DM_NOTIFICATION: {"sessionKey":"agent:main:discord:channel:...","message":"🎯 **Polymarket Arbitrage Alert**\n\n..."}
```

### Heartbeat Integration

Called by `HEARTBEAT.md` Step 4.5:
- Runs Mon/Wed/Fri only
- OpenClaw parses `DM_NOTIFICATION:` line
- Sends Discord DM via `sessions_send`

### Testing

```bash
# Test the script
cd /Users/nzuri/.openclaw/workspace/projects/javascript/polymarket-scanner
node scripts/heartbeat-check.js

# Check output
# Should see: [Polymarket Heartbeat] messages
# If opportunities found: DM_NOTIFICATION: {...}
```

### Example Output

```
[Polymarket Heartbeat] Starting arbitrage scan...
[Polymarket Heartbeat] High-value opportunities found, sending DM...
DM_NOTIFICATION: {"sessionKey":"...","message":"🎯 **Polymarket Arbitrage Alert**\n\nFound 2 high-value opportunities!\n\n**1. UNDERBOOK** - elon and doge cut in federal spending in 2025?\n• **Edge:** 92.7% | **Volume:** $35,429\n• **Total Probability:** 7.3%\n• **Markets:** 5 related markets\n..."}
```

### Discord Message Format

The DM includes:
- Number of opportunities
- Type (UNDERBOOK/OVERBOOK/CONTRADICTION)
- Event description
- Edge percentage
- Combined volume
- Total probability
- Top 3 markets (with probabilities)
- Count of additional markets if >3
