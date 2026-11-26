// ==UserScript==
// @name         Quiz Helper
// @namespace    quiz-helper
// @version      2.0.0
// @description  Quiz Helper panel, can be triggered from the Quiz Helper site on any device
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_xmlhttpRequest
// @connect      __HOST__
// @run-at       document-end
// @noframes
// ==/UserScript==

(function () {
  'use strict';
  const SERVER = '__SERVER__';

  // Don't run the panel on the Quiz Helper site itself
  if (location.origin === SERVER) return;

  // ---------- UI ----------
  const panel = document.createElement('div');
  panel.id = 'qh-panel';
  panel.innerHTML = `
    <style>
      #qh-panel{position:fixed;bottom:18px;left:18px;z-index:2147483647;width:250px;
        background:#171b22;color:#e8ecf2;border:1px solid #262c36;border-radius:12px;
        font:13px system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.4)}
      #qh-head{padding:10px 12px;font-weight:700;border-bottom:1px solid #262c36;display:flex;justify-content:space-between;cursor:pointer}
      #qh-body{padding:12px;display:flex;flex-direction:column;gap:8px}
      #qh-body.min{display:none}
      #qh-panel input{background:#0e1116;color:#e8ecf2;border:1px solid #262c36;border-radius:8px;padding:8px}
      #qh-panel button{background:#4f8cff;color:#fff;border:0;border-radius:8px;padding:8px;font-weight:600;cursor:pointer}
      #qh-status{color:#8a94a3;min-height:16px}
      #qh-link{font-size:11px;color:#8a94a3}
      #qh-panel.flash{border-color:#3ecf8e}
    </style>
    <div id="qh-head"><span>Quiz Helper</span><span id="qh-toggle">–</span></div>
    <div id="qh-body">
      <input id="qh-key" type="password" placeholder="API key">
      <input id="qh-code" type="text" placeholder="Pair code (same as site)">
      <button id="qh-save">Save</button>
      <button id="qh-run">Run</button>
      <div id="qh-status">Ready</div>
      <div id="qh-link">Connecting…</div>
    </div>`;
  document.body.appendChild(panel);

  const $ = id => panel.querySelector('#' + id);
  const setStatus = t => { $('qh-status').textContent = t; };
  const setLink = t => { $('qh-link').textContent = t; };

  let deviceId = GM_getValue('deviceId', '');
  if (!deviceId) { deviceId = Math.random().toString(36).slice(2, 10); GM_setValue('deviceId', deviceId); }

  $('qh-key').value = GM_getValue('apiKey', '');
  $('qh-code').value = GM_getValue('pairCode', 'default');
  $('qh-save').onclick = () => {
    GM_setValue('apiKey', $('qh-key').value.trim());
    GM_setValue('pairCode', $('qh-code').value.trim() || 'default');
    setStatus('Saved');
    restartListening();
  };
  $('qh-head').onclick = () => {
    const b = $('qh-body'); b.classList.toggle('min');
    $('qh-toggle').textContent = b.classList.contains('min') ? '+' : '–';
  };

  // ---------- Main action ----------
  async function run(source) {
    const apiKey = GM_getValue('apiKey', '');
    setStatus('Running' + (source === 'remote' ? ' (from site)' : '') + '…');
    panel.classList.add('flash');
    setTimeout(() => panel.classList.remove('flash'), 600);

    // >>> Put what the helper should actually do here. <<<
    // `apiKey` holds the saved key.

    setStatus('Quiz Helper ran ✓');
  }
  $('qh-run').onclick = () => run('panel');

  // ---------- Listen for the site's secret box (any device) ----------
  let session = 0;
  function poll(since, mySession) {
    if (mySession !== session) return;
    const code = encodeURIComponent(GM_getValue('pairCode', 'default'));
    GM_xmlhttpRequest({
      method: 'GET',
      url: `${SERVER}/api/poll?code=${code}&device=${deviceId}&since=${since}&t=${Date.now()}`,
      timeout: 30000,
      onload: r => {
        if (mySession !== session) return;
        let id = since;
        try { id = JSON.parse(r.responseText).id; } catch {}
        setLink('Linked to site ✓');
        if (since >= 0 && id > since) run('remote');
        poll(id, mySession);
      },
      onerror: () => { setLink('Can’t reach site, retrying…'); setTimeout(() => poll(since, mySession), 3000); },
      ontimeout: () => poll(since, mySession),
    });
  }
  function restartListening() { session++; poll(-1, session); }
  restartListening();
})();
