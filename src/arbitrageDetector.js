/**
 * Detect arbitrage opportunities in Polymarket markets
 */

/**
 * Check if a market is a range/bucket market
 * @param {string} question - Market question
 * @returns {boolean} True if range/bucket market
 */
function isRangeMarket(question) {
  const questionLower = question.toLowerCase();
  
  // Keywords that indicate range/bucket markets
  const rangeKeywords = [
    'less than',
    'more than',
    'greater than',
    'between',
    'under',
    'over'
  ];
  
  // Check for range keywords
  if (rangeKeywords.some(keyword => questionLower.includes(keyword))) {
    return true;
  }
  
  // Check for bucket range pattern: $10b-$20b, $5m-$10m, $1t-$2t
  const bucketPattern = /\$\d+[bmt]-\$\d+[bmt]/i;
  if (bucketPattern.test(question)) {
    return true;
  }
  
  return false;
}

/**
 * Check if a market should be excluded from arbitrage detection
 * @param {string} question - Market question
 * @returns {boolean} True if should be excluded
 */
function shouldExcludeMarket(question) {
  const questionLower = question.toLowerCase();
  
  // Keywords that produce false positives (not real arbitrage)
  const excludeKeywords = [
    'perform',           // Super Bowl performers, concert lineups
    'halftime show',     // Super Bowl halftime performers
    'headline',          // Festival headliners
    'lineup',            // Concert/festival lineups
    'opening act',       // Concert openers
    'surprise guest'     // Special appearances
  ];
  
  return excludeKeywords.some(keyword => questionLower.includes(keyword));
}

/**
 * Find related markets that might have arbitrage opportunities
 * @param {array} markets - Array of market data
 * @returns {array} Potential arbitrage opportunities
 */
function detectArbitrage(markets) {
  // Filter out markets that produce false positives
  const validMarkets = markets.filter(m => !shouldExcludeMarket(m.question));
  
  // NOTE: Removed isRangeMarket() filter to allow bucket market analysis
  // Bucket markets (e.g., DOGE spending $50-100b, $100-150b) are mutually 
  // exclusive and should be analyzed for consistency
  
  const opportunities = [];

  // Strategy 1: Same event, different outcomes
  // Example: "Team A wins" + "Team B wins" should sum to ~100%
  const eventGroups = groupByEvent(validMarkets);
  
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
  // Use filtered markets to avoid false positives
  const contradictions = findContradictions(validMarkets);
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
  // Improved to group bucket markets by stripping amount/range patterns

  // Remove common prefixes
  let key = question
    .replace(/^Will /i, '')
    .replace(/^Does /i, '')
    .replace(/^Is /i, '')
    .replace(/^Are /i, '')
    .replace(/^Did /i, '')
    .replace(/^Has /i, '')
    .replace(/^Have /i, '');

  // Normalize unicode punctuation/operators so bucket clauses are removed consistently
  key = key
    .replace(/\u00A0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');

  const unitSrc = '(?:m|b|t|mn|bn|million|billion|trillion)';
  const numberSrc = '\\$?\\s*\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?';
  const amountWithUnitSrc = `${numberSrc}\\s*${unitSrc}\\b`;

  const hasUnitAmount = new RegExp(amountWithUnitSrc, 'i').test(key);
  const hasComparatorWord = /\b(between|less\s+than|more\s+than|greater\s+than|under|over|above|below|at\s+least|at\s+most|no\s+more\s+than|no\s+less\s+than|or\s+more|or\s+less|exceed(?:s|ing)?|surpass(?:es|ing)?)\b/i.test(key);
  const hasComparatorSymbol = /[<>]=?/.test(key);
  const hasRangeDash = new RegExp(`${numberSrc}(?:\\s*${unitSrc})?\\s*-\\s*${numberSrc}\\s*${unitSrc}\\b`, 'i').test(key);
  const shouldStripBuckets = hasUnitAmount && (hasComparatorWord || hasComparatorSymbol || hasRangeDash);

  if (shouldStripBuckets) {
    const stripPatterns = [
      // between $50 and $100b / between $50b and $100b / between 50 and 100b
      new RegExp(`\\bbetween\\s+(${numberSrc}(?:\\s*${unitSrc})?)\\s+(?:and|to)\\s+(${amountWithUnitSrc})\\b`, 'gi'),

      // $50b-$100b (unit both sides)
      new RegExp(`(${numberSrc}\\s*${unitSrc}\\b)\\s*-\\s*(${numberSrc}\\s*${unitSrc}\\b)`, 'gi'),

      // $50-$100b (unit only at end) / 50-100b
      new RegExp(`(${numberSrc})\\s*-\\s*(${amountWithUnitSrc})`, 'gi'),

      // $50 to $100b (unit only at end)
      new RegExp(`(${numberSrc})\\s+to\\s+(${amountWithUnitSrc})\\b`, 'gi'),

      // < $50b, <= $50b, > $250b, >= $250b
      new RegExp(`(?:<=|<)\\s*(${amountWithUnitSrc})`, 'gi'),
      new RegExp(`(?:>=|>)\\s*(${amountWithUnitSrc})`, 'gi'),

      // verbal comparisons
      new RegExp(`\\b(?:less\\s+than|under|below|at\\s+most|no\\s+more\\s+than)\\s+(${amountWithUnitSrc})\\b`, 'gi'),
      new RegExp(`\\b(?:more\\s+than|over|above|greater\\s+than|at\\s+least|no\\s+less\\s+than|exceed(?:s|ing)?|surpass(?:es|ing)?)\\s+(${amountWithUnitSrc})\\b`, 'gi'),

      // trailing forms: $250b+ / $250b or more / $50b or less
      new RegExp(`(${amountWithUnitSrc})\\s*(?:\\+|\\bor\\s+more\\b|\\band\\s+up\\b)`, 'gi'),
      new RegExp(`(${amountWithUnitSrc})\\s*(?:\\bor\\s+less\\b|\\band\\s+under\\b)`, 'gi')
    ];

    for (const pattern of stripPatterns) {
      key = key.replace(pattern, ' ');
    }

    // Remove any remaining standalone large amounts (only with million/billion/trillion-ish units)
    key = key.replace(new RegExp(amountWithUnitSrc, 'gi'), ' ');
  }

  // Clean up leftover comparison symbols/punctuation and extra spaces
  key = key
    .replace(/[<>]=?/g, ' ')
    .replace(/[+]/g, ' ')
    .replace(/[?.,:;()\[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Take first 50 chars as key
  key = key.slice(0, 50).toLowerCase();

  return key;
// ... existing code ...
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
  findContradictions,
  isRangeMarket,
  shouldExcludeMarket
};
