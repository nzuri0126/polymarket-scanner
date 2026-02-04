/**
 * Detect arbitrage opportunities in Polymarket markets
 */

/**
 * Find related markets that might have arbitrage opportunities
 * @param {array} markets - Array of market data
 * @returns {array} Potential arbitrage opportunities
 */
function detectArbitrage(markets) {
  const opportunities = [];

  // Strategy 1: Same event, different outcomes
  // Example: "Team A wins" + "Team B wins" should sum to ~100%
  const eventGroups = groupByEvent(markets);
  
  for (const [eventName, eventMarkets] of Object.entries(eventGroups)) {
    if (eventMarkets.length < 2) continue;

    // Check if probabilities sum correctly
    const totalProb = eventMarkets.reduce((sum, m) => {
      const prices = JSON.parse(m.outcomePrices);
      const yesPrice = parseFloat(prices[0]);
      return sum + (yesPrice * 100);
    }, 0);

    // If total probability < 100%, potential arbitrage
    if (totalProb < 98 && eventMarkets.length >= 2) {
      opportunities.push({
        type: 'underbook',
        eventName,
        markets: eventMarkets.map(m => ({
          question: m.question,
          yesPrice: parseFloat(JSON.parse(m.outcomePrices)[0]),
          slug: m.slug
        })),
        totalProb: totalProb.toFixed(2),
        edge: (100 - totalProb).toFixed(2),
        volume24hr: eventMarkets.reduce((sum, m) => sum + m.volume24hr, 0)
      });
    }

    // If total probability > 102%, potential arbitrage (overbook)
    if (totalProb > 102 && eventMarkets.length >= 2) {
      opportunities.push({
        type: 'overbook',
        eventName,
        markets: eventMarkets.map(m => ({
          question: m.question,
          yesPrice: parseFloat(JSON.parse(m.outcomePrices)[0]),
          slug: m.slug
        })),
        totalProb: totalProb.toFixed(2),
        edge: (totalProb - 100).toFixed(2),
        volume24hr: eventMarkets.reduce((sum, m) => sum + m.volume24hr, 0)
      });
    }
  }

  // Strategy 2: Contradictory markets
  // Example: "X happens by Feb" at 30% + "X doesn't happen by Feb" at 80%
  const contradictions = findContradictions(markets);
  opportunities.push(...contradictions);

  // Sort by edge size
  opportunities.sort((a, b) => parseFloat(b.edge) - parseFloat(a.edge));

  return opportunities;
}

/**
 * Group markets by event name
 * @param {array} markets - Array of markets
 * @returns {object} Markets grouped by event
 */
function groupByEvent(markets) {
  const groups = {};

  for (const market of markets) {
    // Extract event name from question
    // Example: "Will Trump win?" -> "Trump win"
    const eventKey = extractEventKey(market.question);
    
    if (!groups[eventKey]) {
      groups[eventKey] = [];
    }
    groups[eventKey].push(market);
  }

  return groups;
}

/**
 * Extract event key from question for grouping
 * @param {string} question - Market question
 * @returns {string} Event key
 */
function extractEventKey(question) {
  // Simple heuristic: extract main subject
  // TODO: Improve with NLP or manual mapping
  
  // Remove common prefixes
  let key = question
    .replace(/^Will /i, '')
    .replace(/^Does /i, '')
    .replace(/^Is /i, '');

  // Take first 50 chars as key
  key = key.slice(0, 50).toLowerCase();

  return key;
}

/**
 * Find contradictory markets
 * @param {array} markets - Array of markets
 * @returns {array} Contradictory pairs
 */
function findContradictions(markets) {
  const contradictions = [];

  // Look for YES/NO pairs on same event
  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const m1 = markets[i];
      const m2 = markets[j];

      // Check if questions are inverse of each other
      if (areInverse(m1.question, m2.question)) {
        const prices1 = JSON.parse(m1.outcomePrices);
        const prices2 = JSON.parse(m2.outcomePrices);

        const yes1 = parseFloat(prices1[0]);
        const yes2 = parseFloat(prices2[0]);

        // If both YES probabilities sum < 100%, contradiction arb
        const combined = (yes1 + yes2) * 100;
        
        if (combined < 98) {
          contradictions.push({
            type: 'contradiction',
            eventName: `${m1.question} vs ${m2.question}`,
            markets: [
              { question: m1.question, yesPrice: yes1, slug: m1.slug },
              { question: m2.question, yesPrice: yes2, slug: m2.slug }
            ],
            totalProb: combined.toFixed(2),
            edge: (100 - combined).toFixed(2),
            volume24hr: m1.volume24hr + m2.volume24hr
          });
        }
      }
    }
  }

  return contradictions;
}

/**
 * Check if two questions are inverse of each other
 * @param {string} q1 - First question
 * @param {string} q2 - Second question
 * @returns {boolean} True if inverse
 */
function areInverse(q1, q2) {
  // Simple heuristic: look for "not", "won't", etc.
  // TODO: Improve with better logic
  
  const q1Lower = q1.toLowerCase();
  const q2Lower = q2.toLowerCase();

  // Check for negative keywords
  const negatives = ['not', "won't", "doesn't", 'no ', 'less than', 'under'];
  
  const q1HasNeg = negatives.some(neg => q1Lower.includes(neg));
  const q2HasNeg = negatives.some(neg => q2Lower.includes(neg));

  // If one has negative and other doesn't, might be inverse
  // AND if they share significant text overlap
  if (q1HasNeg !== q2HasNeg) {
    const overlap = calculateTextOverlap(q1Lower, q2Lower);
    return overlap > 0.5; // 50% text similarity
  }

  return false;
}

/**
 * Calculate text overlap between two strings
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Overlap ratio (0-1)
 */
function calculateTextOverlap(s1, s2) {
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

module.exports = {
  detectArbitrage,
  groupByEvent,
  findContradictions
};
