/**
 * edge-runner.js — pm2 daemon
 * Runs edge/index.js every 20 minutes + exports state to data.json
 */
'use strict';
require('dotenv').config({ path: '/workspace/.env' });
const { execFile } = require('child_process');
const fs  = require('fs');
const path = require('path');

const INTERVAL = 20 * 60 * 1000; // 20 min
const EDGE     = path.join(__dirname, 'edge', 'index.js');
const DATA_OUT = path.join(__dirname, 'data.json');

let running = false;

async function runEdge() {
  if (running) { console.log('[runner] still running, skip'); return; }
  running = true;
  console.log('[runner] starting edge scan at', new Date().toISOString());

  execFile('node', [EDGE], { timeout: 5 * 60 * 1000, cwd: __dirname }, (err, stdout, stderr) => {
    running = false;
    if (err) {
      console.error('[runner] edge error:', err.message?.slice(0, 120));
    } else {
      console.log('[runner] edge done');
      if (stdout) console.log(stdout.slice(-300));
    }
    // Update data.json + push to GitHub for Vercel
    (async () => {
      try {
        const d = JSON.parse(fs.readFileSync(DATA_OUT));
        d._runAt = new Date().toISOString();
        // Preserve signals: keep old ones if new run found none
        if ((!d.signals || d.signals.length === 0)) {
          try {
            const stateRaw = require('fs').readFileSync('/tmp/edge_state.json', 'utf8');
            const state = JSON.parse(stateRaw);
            if (state.lastSignals && state.lastSignals.length > 0) {
              d.signals = state.lastSignals;
              console.log('[runner] kept', d.signals.length, 'cached signals');
            }
          } catch {}
        }
        fs.writeFileSync(DATA_OUT, JSON.stringify(d, null, 2));

        const https = require('https');
        const GH_TOKEN = process.env.GH_TOKEN || '';
        const GH_REPO  = 'al1enjesus/polyclawster-app';

        const sha = await new Promise((resolve) => {
          const r = https.request({
            hostname:'api.github.com', path:`/repos/${GH_REPO}/contents/data.json`,
            method:'GET', headers:{'Authorization':'token '+GH_TOKEN,'User-Agent':'edge-runner'}, timeout:8000
          }, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>{ try{resolve(JSON.parse(d).sha);}catch{resolve(null);} }); });
          r.on('error',()=>resolve(null)); r.on('timeout',()=>{r.destroy();resolve(null);}); r.end();
        });

        const content = Buffer.from(fs.readFileSync(DATA_OUT)).toString('base64');
        const body = JSON.stringify({ message: 'data: runner update ' + new Date().toISOString().slice(0,16), content, ...(sha ? {sha} : {}) });
        await new Promise((resolve) => {
          const r = https.request({
            hostname:'api.github.com', path:`/repos/${GH_REPO}/contents/data.json`,
            method:'PUT', headers:{'Authorization':'token '+GH_TOKEN,'User-Agent':'edge-runner','Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}, timeout:12000
          }, res => { res.resume(); res.on('end', resolve); });
          r.on('error',()=>resolve()); r.on('timeout',()=>{r.destroy();resolve();});
          r.write(body); r.end();
        });
        console.log('[runner] data.json pushed to GitHub ✅');
      } catch(e) { console.log('[runner] GitHub push failed:', e.message); }
    })();
  });
}

// Run immediately, then every 20 min
runEdge();
setInterval(runEdge, INTERVAL);

console.log('[runner] started, interval 20min');
