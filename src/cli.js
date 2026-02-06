#!/usr/bin/env node

const { program } = require('commander');
const { fetchMarkets } = require('./fetchMarkets');
const { scoreOpportunities } = require('./analyzer');
const { detectArbitrage } = require('./arbitrageDetector');

program
  .name('polymarket-scanner')
  .description('Scan Polymarket for value and arbitrage opportunities')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan active markets for opportunities')
  .option('--min-volume <number>', 'Minimum 24h volume', parseFloat, 0)
  .option('--min-liquidity <number>', 'Minimum liquidity', parseFloat, 50)
  .option('--limit <number>', 'Max markets to fetch', (val) => parseInt(val, 10), 50)
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      console.log('Fetching markets with:', {
        minVolume: options.minVolume,
        minLiquidity: options.minLiquidity,
        limit: options.limit
      });
      
      const markets = await fetchMarkets({
        activeOnly: true,
        minVolume: options.minVolume,
        minLiquidity: options.minLiquidity,
        limit: options.limit
      });

      console.log(`Found ${markets.length} active markets\n`);

      const opportunities = scoreOpportunities(markets);

      if (options.json) {
        console.log(JSON.stringify(opportunities, null, 2));
      } else {
        printOpportunities(opportunities);
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('top')
  .description('Show top markets by volume')
  .option('--limit <number>', 'Number of markets to show', (val) => parseInt(val, 10), 10)
  .action(async (options) => {
    try {
      const markets = await fetchMarkets({
        activeOnly: true,
        limit: options.limit
      });

      console.log('\n🔥 Top Markets by 24h Volume\n');
      markets.forEach((m, i) => {
        const liquidity = m.liquidityNum || m.liquidity || 0;
        console.log(`${i + 1}. ${m.question}`);
        console.log(`   Volume: $${m.volume24hr.toLocaleString()}`);
        console.log(`   Liquidity: $${liquidity.toLocaleString()}`);
        console.log(`   Category: ${m.category || 'N/A'}`);
        console.log('');
      });
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program
  .command('arb')
  .description('Detect arbitrage opportunities')
  .option('--min-volume <number>', 'Minimum 24h volume', parseFloat, 0)
  .option('--limit <number>', 'Markets to analyze', (val) => parseInt(val, 10), 200)
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    try {
      console.log('Fetching markets for arbitrage analysis...');
      
      const markets = await fetchMarkets({
        activeOnly: true,
        minVolume: options.minVolume,
        limit: options.limit
      });

      console.log(`Analyzing ${markets.length} markets...\n`);

      const opportunities = detectArbitrage(markets);

      if (options.json) {
        console.log(JSON.stringify(opportunities, null, 2));
      } else {
        if (opportunities.length === 0) {
          console.log('No arbitrage opportunities found.');
        } else {
          console.log(`🎯 Found ${opportunities.length} Arbitrage Opportunities\n`);
          
          opportunities.slice(0, 10).forEach((opp, i) => {
            console.log(`${i + 1}. ${opp.type.toUpperCase()} - Edge: ${opp.edge}%`);
            console.log(`   Event: ${opp.eventName}`);
            console.log(`   Total Probability: ${opp.totalProb}%`);
            console.log(`   Combined Volume: $${opp.volume24hr.toLocaleString()}`);
            console.log('   Markets:');
            opp.markets.forEach(m => {
              console.log(`     - ${m.question}: ${(m.yesPrice * 100).toFixed(2)}%`);
            });
            console.log('');
          });
        }
      }
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

function printOpportunities(opportunities) {
  console.log('💡 Opportunities\n');
  console.log('(Sorted by Volume/Liquidity Ratio - higher = more tradeable)\n');

  opportunities.slice(0, 20).forEach((opp, i) => {
    console.log(`${i + 1}. ${opp.title}`);
    console.log(`   Category: ${opp.category}`);
    console.log(`   YES: ${opp.yesPrice} (${opp.yesProb}) | NO: ${opp.noPrice} (${opp.noProb})`);
    console.log(`   Spread: ${opp.spread} | V/L Ratio: ${opp.volumeLiquidityRatio}`);
    console.log(`   Volume: $${opp.volume24hr.toLocaleString()} | Liquidity: $${opp.liquidity.toLocaleString()}`);
    console.log(`   Ends: ${new Date(opp.endDate).toLocaleDateString()}`);
    console.log('');
  });
}

program.parse();
