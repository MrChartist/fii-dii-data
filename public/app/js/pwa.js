/* PWA: service-worker registration, install prompt, push-notification opt-in. */
  const VAPID_PUBLIC_KEY = 'BDM4u63dFxAAA68MTP3W4mTxV3MZk7unyFQufGv6j3DhCFqf7T5lsp85zvQSSqX2sVrcLsrMhRvyiTZhS8BnsJw';

  let swRegistration = null;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        swRegistration = await navigator.serviceWorker.register('/sw.js');
        console.log('[PWA] ✅ Service Worker registered, scope:', swRegistration.scope);
        // Check if already subscribed and update button
        updateNotifyButton();
      } catch (err) {
        console.warn('[PWA] Service Worker failed:', err);
      }
    });
  }

  // ── Install App (PWA) ──────────────────────────────────────────────────────
  let deferredPrompt;
  const btnInstall = document.getElementById('btnInstall');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (btnInstall) btnInstall.style.display = 'flex';
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed');
    if (btnInstall) btnInstall.style.display = 'none';
  });

  async function installPWA() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    if (btnInstall) btnInstall.style.display = 'none';
  }

  // ── Push Notifications (Category-Based) ──────────────────────────────────────
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Track current alert categories locally
  let _alertCategories = ['cash', 'fao', 'sectors'];

  async function updateNotifyButton() {
    const label = document.getElementById('notifyLabel');
    const btn = document.getElementById('btnNotify');
    if (!label || !btn) return;

    if (!('PushManager' in window)) {
      btn.style.display = 'none';
      return;
    }

    if (!swRegistration) return;

    const sub = await swRegistration.pushManager.getSubscription();
    if (sub) {
      // Fetch current preferences from server
      try {
        const res = await fetch('/api/subscribe-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        const data = await res.json();
        if (data.subscribed && data.categories) {
          _alertCategories = data.categories;
        }
      } catch (e) { console.warn('[PUSH] Could not fetch preferences:', e); }

      const count = _alertCategories.length;
      label.textContent = `Alerts: ${count}/3`;
      btn.style.color = count > 0 ? 'var(--green)' : 'var(--orange)';
      btn.title = `${count} alert categories active — click to manage`;
    } else {
      label.textContent = 'Get Alerts';
      btn.style.color = '';
      btn.title = 'Get push alerts when new FII/DII data arrives';
    }
  }

  // ── Alert Settings Modal ─────────────────────────────────────────────────
  async function togglePushNotifications() {
    if (!swRegistration) {
      alert('Service Worker not ready yet. Please refresh and try again.');
      return;
    }
    if (!('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.');
      return;
    }

    const modal = document.getElementById('alert-settings-modal');
    const subscribedView = document.getElementById('alert-subscribed-view');
    const subscribeView = document.getElementById('alert-subscribe-view');
    const existingSub = await swRegistration.pushManager.getSubscription();

    if (existingSub) {
      // Already subscribed — show settings modal with toggle cards
      subscribedView.style.display = '';
      subscribeView.style.display = 'none';
      // Set toggle states from current categories
      ['cash', 'fao', 'sectors'].forEach(cat => {
        const toggle = document.getElementById(`alert-toggle-${cat}`);
        if (toggle) {
          toggle.checked = _alertCategories.includes(cat);
        }
        // Update card active state
        const card = toggle?.closest('.alert-cat-card');
        if (card) card.classList.toggle('active', toggle.checked);
      });
      updateAlertCount();
    } else {
      // Not subscribed — show first-time subscribe prompt
      subscribedView.style.display = 'none';
      subscribeView.style.display = '';
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeAlertModal() {
    const modal = document.getElementById('alert-settings-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Close modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAlertModal();
  });

  function toggleAlertCard(category) {
    const toggle = document.getElementById(`alert-toggle-${category}`);
    if (toggle) {
      toggle.checked = !toggle.checked;
      const card = toggle.closest('.alert-cat-card');
      if (card) card.classList.toggle('active', toggle.checked);
      updateAlertCount();
    }
  }

  function updateAlertCount() {
    const cats = ['cash', 'fao', 'sectors'];
    const active = cats.filter(c => document.getElementById(`alert-toggle-${c}`)?.checked);
    const display = document.getElementById('alert-count-display');
    if (display) display.textContent = `${active.length}/3`;
    // Update card active states
    cats.forEach(c => {
      const toggle = document.getElementById(`alert-toggle-${c}`);
      const card = toggle?.closest('.alert-cat-card');
      if (card) card.classList.toggle('active', toggle?.checked);
    });
  }

  async function saveAlertPreferences() {
    const cats = ['cash', 'fao', 'sectors'].filter(c => document.getElementById(`alert-toggle-${c}`)?.checked);
    
    try {
      const sub = await swRegistration.pushManager.getSubscription();
      if (!sub) return;

      await fetch('/api/subscribe-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, categories: cats })
      });

      _alertCategories = cats;
      console.log('[PUSH] Preferences saved:', cats);
      updateNotifyButton();
      closeAlertModal();
    } catch (err) {
      console.error('[PUSH] Save preferences failed:', err);
      alert('Failed to save preferences. Please try again.');
    }
  }

  async function disableAllAlerts() {
    try {
      const sub = await swRegistration.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      _alertCategories = [];
      console.log('[PUSH] All alerts disabled');
      updateNotifyButton();
      closeAlertModal();
    } catch (err) {
      console.error('[PUSH] Disable error:', err);
    }
  }

  async function enableAlertsFirstTime() {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      alert('Notification permission denied. Please enable notifications in your browser settings.');
      return;
    }

    try {
      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      const categories = ['cash', 'fao', 'sectors']; // Enable all by default
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON(), categories })
      });

      _alertCategories = categories;
      console.log('[PUSH] Subscribed with all categories');
      updateNotifyButton();

      // Switch to the settings view so user can customize
      document.getElementById('alert-subscribe-view').style.display = 'none';
      document.getElementById('alert-subscribed-view').style.display = '';
      ['cash', 'fao', 'sectors'].forEach(cat => {
        const toggle = document.getElementById(`alert-toggle-${cat}`);
        if (toggle) toggle.checked = true;
        const card = toggle?.closest('.alert-cat-card');
        if (card) card.classList.add('active');
      });
      updateAlertCount();
    } catch (err) {
      console.error('[PUSH] Subscribe error:', err);
      alert('Failed to enable notifications. Please try again.');
    }
  }

  /* ── AI AGENTS & GROQ LOGIC ── */
  let agentDataLoadedAt = 0;
  const AGENT_REFRESH_COOLDOWN = 30000; // 30s cooldown between refreshes
  async function renderAgentData() {
    const now = Date.now();
    if(agentDataLoadedAt > 0 && (now - agentDataLoadedAt) < AGENT_REFRESH_COOLDOWN) return;
    try {
      const res = await fetch('/api/agents/status');
      const data = await res.json();
      
      let html = '';
      data.agents.forEach(a => {
        const isRunning = a.state?._updated_at || a.state?.last_run_date || Object.keys(a.state || {}).length > 0;
        const color = isRunning ? 'var(--green)' : 'var(--orange)';
        const statTxt = isRunning ? 'Active' : 'Standby';
        
        // Rich info strings for ALL 6 agents
        let infoStr = '';
        switch(a.name) {
          case 'fii-streak':
            if(a.state.current_sell_streak > 0) infoStr = `🔴 ${a.state.current_sell_streak} Day Sell Streak | DII Absorb: ${a.state.sell_absorption_pct || 0}%`;
            else if(a.state.current_buy_streak > 0) infoStr = `🟢 ${a.state.current_buy_streak} Day Buy Streak`;
            else infoStr = 'No active streak';
            break;
          case 'regime-classifier':
            const regimeEmoji = {'STRONG_BULLISH':'🟢','MILD_BULLISH':'🟡','NEUTRAL':'⚪','MILD_BEARISH':'🟠','STRONG_BEARISH':'🔴'};
            infoStr = `${regimeEmoji[a.state.regime]||'⚪'} ${(a.state.regime||'NEUTRAL').replace(/_/g,' ')} | VIX: ${a.state.vix||'—'}`;
            break;
          case 'flow-strength':
            const evts = a.state.last_alerted_events || [];
            infoStr = evts.length ? `⚡ ${evts.length} event(s): ${evts.map(e=>e.replace(/_/g,' ')).join(', ')}` : 'No extreme events';
            break;
          case 'flow-divergence':
            const sig = a.state.last_signal || 'NONE';
            const sigEmoji = {'CONTRARIAN_BULLISH':'🟢','PANIC_MODE':'🔴','EUPHORIA_CHECK':'🟡','NONE':'⚪'};
            infoStr = sig !== 'NONE' ? `${sigEmoji[sig]||'⚪'} ${sig.replace(/_/g,' ')} | P${a.state.divergence_percentile||0}th` : 'Normal flow pattern';
            break;
          case 'sector-rotation':
            infoStr = a.state.top_inflow ? `📈 ${a.state.top_inflow} | 📉 ${a.state.top_outflow} | ${a.state.significant_moves||0} moves` : 'Awaiting NSDL data';
            break;
          case 'weekly-digest':
            infoStr = a.state.date_range ? `📋 ${a.state.date_range} | ${a.state.trading_days||0} days` : 'No digest yet';
            break;
          default:
            infoStr = 'Monitoring...';
        }
        
        let shareBtn = '';
        // Only show share button if there's actual signal data
        const genericStrs = ['Monitoring...', 'No active streak', 'No extreme events', 'Normal flow pattern', 'Awaiting NSDL data', 'No digest yet'];
        if (!genericStrs.includes(infoStr)) {
          const cleanStr = infoStr.replace(/<[^>]*>?/gm, ''); // strip HTML if any
          const tweetText = encodeURIComponent(`${a.name.toUpperCase()} Signal 📊\n\n${cleanStr}\n\nTrack institutional flow live:\nhttps://mrchartist.com/fii-dii-data`);
          shareBtn = `<a href="https://twitter.com/intent/tweet?text=${tweetText}" target="_blank" title="Share on 𝕏" style="color:var(--t3); text-decoration:none; margin-right:10px; opacity:0; transition:opacity 0.2s;" class="agent-share-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg></a>`;
        }
        
        // Wrap the div to show the share button on hover
        html += `
          <div class="agent-row" style="background:var(--l1); padding:10px 14px; border-radius:8px; border:1px solid var(--sep2); display:flex; justify-content:space-between; align-items:center;">
             <div style="flex:1; min-width:0;">
               <div style="font-weight:700; font-size:12px; color:var(--t2);">${escapeHtml(a.name.toUpperCase())}</div>
               <div style="font-size:10px; color:var(--t4); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(infoStr)}</div>
             </div>
             <div style="display:flex; align-items:center; flex-shrink:0;">
               ${shareBtn}
               <div style="display:flex; align-items:center; gap:6px; font-size:10px; font-weight:700; color:${color};">
                 <div style="width:6px; height:6px; border-radius:50%; background:${color}; box-shadow:0 0 6px ${color};"></div> ${statTxt}
               </div>
             </div>
          </div>
        `;
      });
      document.getElementById('agent-array-status').innerHTML = html;
      
      const rRes = await fetch('/api/agents/regime');
      const rData = await rRes.json();
      if(rData && rData.regime) {
        const regimeEmoji = {'STRONG_BULLISH':'🟢','MILD_BULLISH':'🟡','NEUTRAL':'⚪','MILD_BEARISH':'🟠','STRONG_BEARISH':'🔴'};
        document.getElementById('ai-active-regime').innerText = `${regimeEmoji[rData.regime]||''} ${rData.regime.replace(/_/g,' ')}`;
        document.getElementById('ai-regime-desc').innerText = `VIX: ${rData.vix} | ${rData.recommendation || ''}`;
      }
      
      agentDataLoadedAt = Date.now();
    } catch(e) {
      document.getElementById('agent-array-status').innerHTML = '<div style="color:var(--red); font-size:11px;">Agent array unreachable locally.</div>';
    }
  }

  async function synthesizeMarket() {
    const btn = document.getElementById('btnSynth');
    const loader = document.getElementById('synth-loader');
    const content = document.getElementById('synth-content');
    
    btn.disabled = true;
    btn.style.opacity = '0.5';
    content.style.display = 'none';
    loader.style.display = 'block';
    
    try {
      const res = await fetch('/api/agents/synthesis');
      const data = await res.json();
      
      if(data.success) {
        // Escape first (LLM output is untrusted), then apply markdown transforms
        let txt = escapeHtml(data.synthesis).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Convert Markdown newlines to br
        txt = txt.replace(/\n/g, '<br>');

        content.innerHTML = txt;
      } else {
        content.innerHTML = `<div style="color:var(--red);">Error: ${escapeHtml(data.error)}</div>`;
      }
    } catch(e) {
      content.innerHTML = `<div style="color:var(--red);">Failed to connect to LLM: ${escapeHtml(e.message)}</div>`;
    }
    
    loader.style.display = 'none';
    content.style.display = 'block';
    btn.disabled = false;
    btn.style.opacity = '1';
  }

  // ── PHASE 3: AI Sniper Briefing ──────────────────────────────────────────────
  async function loadSniperBriefing() {
    const loading = document.getElementById('sniperLoading');
    const content = document.getElementById('sniperContent');
    const headline = document.getElementById('sniperHeadline');
    const body = document.getElementById('sniperBody');
    const timestamp = document.getElementById('sniperTimestamp');

    // Cache keyed to the latest SESSION date, not the calendar day — data
    // publishes ~6:30 PM IST, so a calendar-day key caches the morning's
    // (yesterday's-data) briefing and hides the evening update all day.
    // Falls back to the IST calendar day before data has loaded.
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
    const istDay = `${ist.getFullYear()}-${String(ist.getMonth()+1).padStart(2,'0')}-${String(ist.getDate()).padStart(2,'0')}`;
    const todayKey = `sniper_${(typeof dailyData !== 'undefined' && dailyData[0]?.d) || istDay}`;

    // Check localStorage for today's cached synthesis
    const cached = localStorage.getItem(todayKey);
    if (cached) {
      try {
        const c = JSON.parse(cached);
        headline.textContent = c.headline;
        body.innerHTML = c.body;
        timestamp.textContent = c.time;
        loading.style.display = 'none';
        content.style.display = 'block';
        console.log('[SYNTHESIS] Using daily cached briefing for', todayKey);
        return;
      } catch {}
    }

    loading.style.display = 'block';
    content.style.display = 'none';

    try {
      const res = await fetch('/api/agents/synthesis');
      const data = await res.json();

      if (data.success && data.synthesis) {
        const lines = data.synthesis.trim().split('\n').filter(l => l.trim());
        const headlineText = lines[0].replace(/\*\*/g, '').replace(/^#+\s*/, '').trim();
        // Escape before the bold transform — this string is LLM output and is
        // persisted to localStorage, so injected markup would replay on every visit
        const bodyText = escapeHtml(lines.slice(1).join(' ')).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').trim();
        const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

        headline.textContent = headlineText;
        body.innerHTML = bodyText || headlineText;
        timestamp.textContent = timeStr + (data.cached ? ' (cached)' : '');

        // Persist in localStorage keyed to today — won't regenerate until tomorrow
        localStorage.setItem(todayKey, JSON.stringify({
          headline: headlineText,
          body: bodyText || headlineText,
          time: timeStr
        }));

        // Clean up old entries (collect keys first — removing while iterating
        // forward shifts indices and skips keys)
        const staleKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('sniper_') && k !== todayKey) staleKeys.push(k);
        }
        staleKeys.forEach(k => localStorage.removeItem(k));
      } else {
        headline.textContent = 'Market intelligence loading...';
        body.innerHTML = escapeHtml(data.error) || 'AI synthesis temporarily unavailable. Data feeds are active.';
      }
    } catch (e) {
      headline.textContent = 'Institutional flow data active';
      body.innerHTML = 'AI synthesis is warming up. Live data feeds are operational.';
    }

    loading.style.display = 'none';
    content.style.display = 'block';
  }

  // Load briefing after initial data fetch
  setTimeout(() => { loadNsdlConfirm(); }, 3000); // bulk and block deals now load on /deals.html

  // ── PHASE 4: SSE Live Connection ─────────────────────────────────────────────
  function initSSE() {
    const sseDot = document.getElementById('sseDot');
    let evtSource;
    try {
      evtSource = new EventSource('/api/stream');
    } catch { return; }

    evtSource.onopen = () => {
      if (sseDot) sseDot.classList.remove('disconnected');
    };

    evtSource.addEventListener('data-update', (e) => {
      try {
        const d = JSON.parse(e.data);
        // Flash the KPI values (the live KPI elements are #lFii / #lDii)
        const fiiEl = document.getElementById('lFii');
        const diiEl = document.getElementById('lDii');
        if (fiiEl) {
          fiiEl.classList.remove('kpi-flash-green', 'kpi-flash-red');
          void fiiEl.offsetWidth; // force reflow
          fiiEl.classList.add(d.fii_net >= 0 ? 'kpi-flash-green' : 'kpi-flash-red');
        }
        if (diiEl) {
          diiEl.classList.remove('kpi-flash-green', 'kpi-flash-red');
          void diiEl.offsetWidth;
          diiEl.classList.add(d.dii_net >= 0 ? 'kpi-flash-green' : 'kpi-flash-red');
        }
        // Trigger a data refresh
        if (typeof fetchLiveNSE === 'function') fetchLiveNSE(false);
      } catch {}
    });

    evtSource.addEventListener('agent-update', () => {
    });

    evtSource.onerror = () => {
      if (sseDot) sseDot.classList.add('disconnected');
      // Auto-reconnect handled by EventSource
    };
  }
  setTimeout(initSSE, 3000);

  // ── PHASE 6: Smooth Number Count-Up Animation ───────────────────────────────
  function animateValue(element, start, end, duration) {
    if (!element || isNaN(end)) return;
    const startTs = performance.now();
    const isNeg = end < 0;
    const absEnd = Math.abs(end);

    function step(ts) {
      const elapsed = ts - startTs;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (absEnd - start) * ease);
      element.textContent = (isNeg ? '-' : '+') + '\u20B9' + current.toLocaleString('en-IN') + ' Cr';
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  // ── PHASE 7: Live Market Ticker (Nifty 50 + India VIX) ────────────────────
  let _lastMarketData = null;
  let _marketTimerId = null;

  function getVixZone(vixPrice) {
    if (vixPrice < 14) return { label: 'Low Fear', cls: 'low' };
    if (vixPrice < 20) return { label: 'Normal', cls: 'normal' };
    if (vixPrice < 30) return { label: 'Elevated', cls: 'elevated' };
    return { label: 'High Fear', cls: 'high' };
  }

  function isMarketHours() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
    const day = ist.getDay();
    if (day === 0 || day === 6) return false;
    const h = ist.getHours(), m = ist.getMinutes();
    const mins = h * 60 + m;
    return mins >= 555 && mins <= 930; // 9:15 AM - 3:30 PM IST
  }

  async function fetchMarketData() {
    try {
      const res = await fetch('/api/market', { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      _lastMarketData = data;

      // Nifty 50
      const nEl = document.getElementById('tickerNiftyPrice');
      const ncEl = document.getElementById('tickerNiftyChange');
      if (nEl && data.nifty) {
        nEl.textContent = data.nifty.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pct = data.nifty.pct;
        const arrow = pct >= 0 ? '▲' : '▼';
        ncEl.textContent = `${arrow} ${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
        ncEl.className = 'ticker-change ' + (pct > 0.05 ? 'up' : pct < -0.05 ? 'down' : 'flat');
      }

      // India VIX
      const vEl = document.getElementById('tickerVixPrice');
      const vcEl = document.getElementById('tickerVixChange');
      const vzEl = document.getElementById('tickerVixZone');
      if (vEl && data.vix) {
        vEl.textContent = data.vix.price.toFixed(2);
        const vpct = data.vix.pct;
        const varrow = vpct >= 0 ? '▲' : '▼';
        vcEl.textContent = `${varrow} ${vpct >= 0 ? '+' : ''}${vpct.toFixed(2)}%`;
        // VIX rising is bearish (red), VIX falling is bullish (green)
        vcEl.className = 'ticker-change ' + (vpct > 0.5 ? 'down' : vpct < -0.5 ? 'up' : 'flat');

        const zone = getVixZone(data.vix.price);
        vzEl.textContent = zone.label;
        vzEl.className = 'vix-zone ' + zone.cls;
      }

      // Update timestamp
      const tsEl = document.getElementById('tickerUpdatedAt');
      const dotEl = document.getElementById('tickerDot');
      if (tsEl) {
        const now = new Date();
        tsEl.textContent = 'Updated ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      if (dotEl) dotEl.className = 'ticker-live-dot';

      console.log('[TICKER] ✅ Market data loaded — Nifty:', data.nifty?.price, 'VIX:', data.vix?.price);
    } catch (e) {
      console.warn('[TICKER] Market data fetch failed:', e.message);
      const tsEl = document.getElementById('tickerUpdatedAt');
      const dotEl = document.getElementById('tickerDot');
      if (tsEl && !_lastMarketData) tsEl.textContent = 'Market data unavailable';
      // Set, don't append — consecutive failures otherwise stack " (stale) (stale)…"
      if (tsEl && _lastMarketData && !tsEl.textContent.endsWith('(stale)')) tsEl.textContent += ' (stale)';
      if (dotEl) dotEl.className = 'ticker-live-dot stale';
    }

    // Schedule next refresh
    const interval = isMarketHours() ? 60000 : 300000; // 60s during market, 5min otherwise
    if (_marketTimerId) clearTimeout(_marketTimerId);
    _marketTimerId = setTimeout(fetchMarketData, interval);
  }

  // Market ticker polling now lives in js/mc-ui.js (single shared poll for Nifty, Sensex and VIX)

