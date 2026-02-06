/**
 * Analyze markets for opportunities
 */

/**
 * Calculate implied probability from price
 * @param {number} price - Market price (0-1)
 * @returns {number} Implied probability as percentage
 */
function calculateImpliedProbability(price) {
  return price * 100;
}

/**
 * Calculate value score (higher = better value)
 * This is a simplified model - real edge requires domain knowledge
 * @param {object} market - Market data
 * @returns {object} Value analysis
 */
function analyzeValue(market) {
  if (!market.outcomePrices) {
    return null;
  }

  const prices = JSON.parse(market.outcomePrices);
  
  const yesPrice = parseFloat(prices[0]);
  const noPrice = parseFloat(prices[1]);

  const yesProb = calculateImpliedProbability(yesPrice);
  const noProb = calculateImpliedProbability(noPrice);

  // Check for market efficiency (should sum to ~100%)
  const totalProb = yesProb + noProb;
  const spread = Math.abs(totalProb - 100);

  // Volume/liquidity ratio (higher = more tradeable)
  const liquidityRaw = market.liquidityNum ?? market.liquidity;
  const liquidityNum = Number(liquidityRaw);
  const liquidity = Number.isFinite(liquidityNum) && liquidityNum > 0 ? liquidityNum : 1;

  const volume24hrNum = Number(market.volume24hr);
  const volume24hr = Number.isFinite(volume24hrNum) && volume24hrNum > 0 ? volume24hrNum : 0;

  const volumeLiquidityRatio = volume24hr / liquidity;

  return {
    slug: market.slug,
    title: market.question,
    category: market.category,
    yesPrice: yesPrice.toFixed(4),
    noPrice: noPrice.toFixed(4),
    yesProb: yesProb.toFixed(2) + '%',
    noProb: noProb.toFixed(2) + '%',
    spread: spread.toFixed(2) + '%',
    volume24hr: volume24hr,
    liquidity: liquidity,
    volumeLiquidityRatio: volumeLiquidityRatio.toFixed(2),
    endDate: market.endDate
  };
}

/**
 * Find arbitrage opportunities between related markets
 * (Would need to implement market relationship detection)
 * @param {array} markets - Array of markets
 * @returns {array} Arbitrage opportunities
 */
function findArbitrage(markets) {
  // TODO: Implement arbitrage detection
  // Look for related markets where combined probabilities don't add up
  // Example: "Team A wins" + "Team B wins" should sum to ~100%
  return [];
}

/**
 * Score opportunities by potential value
 * @param {array} markets - Array of markets
 * @returns {array} Scored opportunities
 */
function scoreOpportunities(markets) {
  const analyzed = markets
    .map(analyzeValue)
    .filter(a => a !== null);

  // Sort by volume/liquidity ratio (tradeable opportunities)
  analyzed.sort((a, b) => b.volumeLiquidityRatio - a.volumeLiquidityRatio);

  return analyzed;
}

module.exports = {
  analyzeValue,
  findArbitrage,
  scoreOpportunities,
  calculateImpliedProbability
};
