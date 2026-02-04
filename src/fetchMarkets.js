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
    limit = 100
  } = options;

  try {
    const params = {
      limit: Math.max(limit, 100), // Fetch more to filter
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

    let markets = response.data;

    // Filter by volume
    if (minVolume > 0) {
      markets = markets.filter(m => m.volume24hr >= minVolume);
    }

    // Filter by liquidity
    if (minLiquidity > 0) {
      markets = markets.filter(m => m.liquidityNum >= minLiquidity);
    }

    // Sort by 24h volume (descending)
    markets.sort((a, b) => b.volume24hr - a.volume24hr);

    // Limit results
    markets = markets.slice(0, limit);

    return markets;
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
