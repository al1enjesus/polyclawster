#!/usr/bin/env node
/**
 * PolyClawster Link — connect agent to a TMA account
 *
 * Usage:
 *   node link.js PC-A3F7K9
 */
'use strict';
const { loadConfig, postJSON, API_BASE } = require('./setup');

async function linkAgent(claimCode) {
  const config = loadConfig();
  if (!config?.apiKey) {
    throw new Error('Not configured. Run: node scripts/setup.js --auto');
  }

  console.log(`🔗 Linking agent with code ${claimCode}...`);

  const result = await postJSON(`${API_BASE}/api/agents`, {
    action: 'link',
    claimCode,
    apiKey: config.apiKey,
  });

  if (!result.ok) {
    throw new Error(result.error || 'Link failed');
  }

  console.log('✅', result.message);
  console.log('   Your agent is now visible in the PolyClawster TMA under "Мои агенты".');
}

module.exports = { linkAgent };

if (require.main === module) {
  const claimCode = process.argv[2];
  if (!claimCode) {
    console.log('Usage: node link.js PC-XXXXXX');
    console.log('');
    console.log('Get your claim code in the PolyClawster app → Agents → "+ Подключить"');
    process.exit(0);
  }

  linkAgent(claimCode).catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  });
}
