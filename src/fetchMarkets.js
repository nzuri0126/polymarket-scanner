const axios = require('axios');

const POLYMARKET_API = 'https://gamma-api.polymarket.com';

/**
 * Fetch active markets from Polymarket
 * @param {object} options - Filter options
 * @param {boolean} options.activeOnly - Only return active markets
 * @param {number} options.minVolume - Minimum 24h volume
 * @param {number} options.minLiquidity - Minimum liquidity
 * @returns {Promise<array>} Array of market events
 */
async function fetchMarkets(options = {}) {
  const {
    activeOnly = true,
    minVolume = 0,
    minLiquidity = 0,
    limit = 100,

    // pagination controls
    pageSize = 100,
    maxPages = 2000
  } = options;

  const safePageSize = Math.max(1, Math.min(parseInt(pageSize, 10) || 100, 500));
  const safeMaxPages = Math.max(1, parseInt(maxPages, 10) || 2000);

  try {
    const all = [];
    let offset = 0;
    let exhausted = false;

    for (let pageIndex = 0; pageIndex < safeMaxPages; pageIndex++) {
      const params = {
        limit: safePageSize,
        offset,
        _t: Date.now() // Cache bust
      };

      if (activeOnly) {
        params.active = true;
        params.closed = false;
      }

      const response = await axios.get(`${POLYMARKET_API}/markets`, {
        params,
        timeout: 30000
      });

      const page = response.data;

      if (!Array.isArray(page)) {
        throw new Error(`Unexpected /markets response (expected array, got ${typeof page})`);
      }

      all.push(...page);

      // If we got a short (or empty) page, we've exhausted pagination
      if (page.length < safePageSize) {
        exhausted = true;
        break;
      }

      offset += safePageSize;
    }

    if (!exhausted) {
      throw new Error(`Pagination hit maxPages=${safeMaxPages} (increase maxPages to fetch more)`);
    }

    const volMin = Number(minVolume) || 0;
    const liqMin = Number(minLiquidity) || 0;

    let markets = all;

    // Filter by volume
    if (volMin > 0) {
      markets = markets.filter((m) => (Number(m.volume24hr) || 0) >= volMin);
    }

    // Filter by liquidity
    if (liqMin > 0) {
      markets = markets.filter((m) => (Number(m.liquidityNum) || 0) >= liqMin);
    }

    // Sort by 24h volume (descending)
    markets.sort((a, b) => (Number(b.volume24hr) || 0) - (Number(a.volume24hr) || 0));

    // Limit results
    if (limit == null) return markets;

    const safeLimit = Math.max(0, parseInt(limit, 10) || 0);
    return markets.slice(0, safeLimit);
  } catch (error) {
    console.error('Error fetching markets:', error.message);
    throw error;
  }
}

/**
 * Get market details by slug
 * @param {string} slug - Market slug
 * @returns {Promise<object>} Market details
 */
async function getMarketBySlug(slug) {
  try {
    const response = await axios.get(`${POLYMARKET_API}/events/${slug}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching market ${slug}:`, error.message);
    throw error;
  }
}

module.exports = {
  fetchMarkets,
  getMarketBySlug
};
