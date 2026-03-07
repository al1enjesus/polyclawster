'use strict';
/**
 * lib/analytics.js — PostHog analytics wrapper
 * Never throws — analytics must not break the main flow.
 * distinct_id convention: tg_<chatId>
 */
const https = require('https');

const PH_KEY  = process.env.POSTHOG_KEY || 'phc_VHVdzWU7sO9QZ9SFFvGnrl2ap0ykEUn7nsVLCmV3YlF';
const PH_HOST = 'app.posthog.com';

function _post(payload) {
  return new Promise((resolve) => {
    try {
      const body = JSON.stringify(payload);
      const req = https.request({
        hostname: PH_HOST,
        path: '/capture/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 5000,
      }, (res) => { res.resume(); resolve(); });
      req.on('error', () => resolve());
      req.on('timeout', () => { req.destroy(); resolve(); });
      req.write(body);
      req.end();
    } catch { resolve(); }
  });
}

/**
 * Track an event.
 * @param {string|number} distinctId - e.g. chatId (will be prefixed tg_)
 * @param {string} event
 * @param {object} properties
 */
function track(distinctId, event, properties = {}) {
  return _post({
    api_key: PH_KEY,
    event,
    distinct_id: `tg_${distinctId}`,
    properties: { $lib: 'polyclawster-bot', source: 'backend', ...properties },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Identify a user (set person properties in PostHog).
 */
function identify(distinctId, properties = {}) {
  return _post({
    api_key: PH_KEY,
    event: '$identify',
    distinct_id: `tg_${distinctId}`,
    properties: { $set: properties },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { track, identify };
