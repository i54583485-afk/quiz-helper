// Quiz Helper relay: serves the site + script and passes "trigger" from one device to others.
// No dependencies. Run: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const counters = {};   // code -> trigger id
const waiters = {};    // code -> [{res, device, timer}]
const seen = {};       // code -> {device: lastSeenMs}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const cleanCode = c => String(c || 'default').slice(0, 64);

function devicesOnline(code) {
  const now = Date.now(), s = seen[code] || {};
  const open = new Set((waiters[code] || []).map(w => w.device));
  for (const [d, t] of Object.entries(s)) if (now - t < 35000) open.add(d);
  return open.size;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // --- Site ---
  if (p === '/' || p === '/index.html') {
    return send(res, 200, fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8'), 'text/html; charset=utf-8');
  }

  // --- Userscript (server URL injected automatically) ---
  if (p === '/quiz-helper.user.js') {
    const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0];
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const js = fs.readFileSync(path.join(__dirname, 'public/quiz-helper.user.js'), 'utf8')
      .replaceAll('__SERVER__', `${proto}://${host}`)
      .replaceAll('__HOST__', host.split(':')[0]);
    return send(res, 200, js, 'text/javascript; charset=utf-8');
  }

  // --- Script waits here until a trigger arrives (long-poll) ---
  if (p === '/api/poll') {
    const code = cleanCode(url.searchParams.get('code'));
    const device = String(url.searchParams.get('device') || 'unknown').slice(0, 64);
    const since = Number(url.searchParams.get('since'));
    const current = counters[code] || 0;
    (seen[code] ||= {})[device] = Date.now();

    if (since < 0 || current > since) return send(res, 200, { id: current });

    const w = { res, device };
    w.timer = setTimeout(() => {
      waiters[code] = (waiters[code] || []).filter(x => x !== w);
      send(res, 200, { id: counters[code] || 0 });
    }, 25000);
    (waiters[code] ||= []).push(w);
    req.on('close', () => { clearTimeout(w.timer); waiters[code] = (waiters[code] || []).filter(x => x !== w); });
    return;
  }

  // --- Site's secret box fires this ---
  if (p === '/api/trigger' && req.method === 'POST') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      let code = 'default';
      try { code = cleanCode(JSON.parse(body || '{}').code); } catch {}
      const id = (counters[code] = (counters[code] || 0) + 1);
      const list = waiters[code] || [];
      waiters[code] = [];
      for (const w of list) { clearTimeout(w.timer); send(w.res, 200, { id }); }
      send(res, 200, { ok: true, sentTo: list.length });
    });
    return;
  }

  // --- Site shows how many devices are connected ---
  if (p === '/api/status') {
    return send(res, 200, { devices: devicesOnline(cleanCode(url.searchParams.get('code'))) });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => console.log('Quiz Helper relay on port ' + PORT));
