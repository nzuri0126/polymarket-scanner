#!/usr/bin/env node

/**
 * Polymarket Heartbeat Check
 * Scans for arbitrage opportunities and sends Discord DM if found
 * Called by HEARTBEAT.md Mon/Wed/Fri
 */

const { execSync } = require('child_process');
const path = require('path');

// Configuration
const CONFIG = {
  minEdge: 20,           // Minimum edge % to alert (20% = significant arbitrage)
  minVolume: 10000,      // Minimum combined volume ($10K = enough liquidity)
  discordDMSession: 'agent:main:discord:channel:339514828710215691',
};

async function main() {
  try {
    console.log('[Polymarket Heartbeat] Starting arbitrage scan...');
    
    // Run arbitrage detector
    const scannerPath = path.join(__dirname, '../src/cli.js');
    const result = execSync(`node ${scannerPath} arb`, { 
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });
    
    // Parse output (not JSON, parse text output)
    const opportunities = parseArbitrageOutput(result);
    
    if (opportunities.length === 0) {
      console.log('[Polymarket Heartbeat] No opportunities found');
      process.exit(0);
    }
    
    // Filter for high-value opportunities
    const highValue = opportunities.filter(opp => 
      opp.edge >= CONFIG.minEdge && 
      opp.volume >= CONFIG.minVolume
    );
    
    if (highValue.length === 0) {
      console.log(`[Polymarket Heartbeat] Found ${opportunities.length} opportunities but none meet thresholds`);
      console.log(`  Min edge: ${CONFIG.minEdge}%, Min volume: $${CONFIG.minVolume}`);
      process.exit(0);
    }
    
    // Format Discord message
    const message = formatDiscordMessage(highValue);
    
    // Send DM (using sessions_send - requires OpenClaw context)
    console.log('[Polymarket Heartbeat] High-value opportunities found, sending DM...');
    console.log('DM_NOTIFICATION:', JSON.stringify({
      sessionKey: CONFIG.discordDMSession,
      message: message
    }));
    
    // Exit success - OpenClaw will pick up DM_NOTIFICATION and send
    process.exit(0);
    
  } catch (error) {
    console.error('[Polymarket Heartbeat] Error:', error.message);
    process.exit(1);
  }
}

/**
 * Parse arbitrage detector text output
 */
function parseArbitrageOutput(text) {
  const opportunities = [];
  const lines = text.split('\n');
  
  let currentOpp = null;
  
  for (const line of lines) {
    // Start of new opportunity
    if (line.match(/^\d+\. (UNDERBOOK|OVERBOOK|CONTRADICTION)/)) {
      if (currentOpp) {
        opportunities.push(currentOpp);
      }
      
      const typeMatch = line.match(/(UNDERBOOK|OVERBOOK|CONTRADICTION)/);
      const edgeMatch = line.match(/Edge: ([\d.]+)%/);
      
      currentOpp = {
        type: typeMatch ? typeMatch[1] : 'UNKNOWN',
        edge: edgeMatch ? parseFloat(edgeMatch[1]) : 0,
        event: '',
        probability: 0,
        volume: 0,
        markets: []
      };
    }
    
    // Event line
    if (line.trim().startsWith('Event:')) {
      if (currentOpp) {
        currentOpp.event = line.replace('Event:', '').trim();
      }
    }
    
    // Total Probability
    if (line.trim().startsWith('Total Probability:')) {
      if (currentOpp) {
        const probMatch = line.match(/([\d.]+)%/);
        if (probMatch) {
          currentOpp.probability = parseFloat(probMatch[1]);
        }
      }
    }
    
    // Combined Volume
    if (line.trim().startsWith('Combined Volume:')) {
      if (currentOpp) {
        const volMatch = line.match(/\$([\d,]+\.?\d*)/);
        if (volMatch) {
          currentOpp.volume = parseFloat(volMatch[1].replace(/,/g, ''));
        }
      }
    }
    
    // Market lines (starts with "- ")
    if (line.trim().startsWith('- Will') || line.trim().startsWith('- Does')) {
      if (currentOpp) {
        const marketMatch = line.match(/- (.+?): ([\d.]+)%/);
        if (marketMatch) {
          currentOpp.markets.push({
            question: marketMatch[1],
            probability: parseFloat(marketMatch[2])
          });
        }
      }
    }
  }
  
  // Push last opportunity
  if (currentOpp) {
    opportunities.push(currentOpp);
  }
  
  return opportunities;
}

/**
 * Format opportunities for Discord message
 */
function formatDiscordMessage(opportunities) {
  let msg = '🎯 **Polymarket Arbitrage Alert**\n\n';
  msg += `Found ${opportunities.length} high-value opportunit${opportunities.length === 1 ? 'y' : 'ies'}!\n\n`;
  
  opportunities.forEach((opp, idx) => {
    msg += `**${idx + 1}. ${opp.type}** - ${opp.event}\n`;
    msg += `• **Edge:** ${opp.edge.toFixed(1)}% | **Volume:** $${opp.volume.toLocaleString()}\n`;
    msg += `• **Total Probability:** ${opp.probability.toFixed(1)}%\n`;
    msg += `• **Markets:** ${opp.markets.length} related markets\n`;
    
    // Show top 3 markets
    const topMarkets = opp.markets.slice(0, 3);
    topMarkets.forEach(m => {
      // Truncate long market names
      const question = m.question.length > 60 ? m.question.slice(0, 57) + '...' : m.question;
      msg += `  - ${question} (${m.probability.toFixed(1)}%)\n`;
    });
    
    if (opp.markets.length > 3) {
      msg += `  - ...and ${opp.markets.length - 3} more\n`;
    }
    
    msg += '\n';
  });
  
  msg += '*Check Polymarket Scanner for details*';
  
  return msg;
}

main();
