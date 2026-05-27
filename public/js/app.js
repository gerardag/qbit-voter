const app = (() => {
  let torrents = [];
  let votedTag = 'Liked';
  let view = 'list'; // 'list' | 'settings'
  let settings = null;

  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const idx = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, idx)).toFixed(1) + ' ' + units[idx];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderLangSwitcher() {
    const container = document.getElementById('lang-switcher');
    if (!container) return;
    container.innerHTML = i18n.getLangs().map(lang =>
      `<button class="lang-btn ${lang === i18n.getLang() ? 'active' : ''}"
              onclick="app.switchLang('${lang}')">${lang}</button>`
    ).join('');
  }

  function renderStaticUI() {
    const pendingLabel = document.getElementById('pending-label');
    const refreshBtn = document.getElementById('refresh-btn');
    if (pendingLabel) pendingLabel.innerHTML = `${i18n.t('pending')} <strong id="count">—</strong>`;
    if (refreshBtn) refreshBtn.textContent = i18n.t('refresh');
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) settingsBtn.title = i18n.t('settings');
  }

  function setStatsVisible(visible) {
    const stats = document.getElementById('stats-bar');
    if (stats) stats.style.display = visible ? '' : 'none';
  }

  function render() {
    if (view !== 'list') return;
    const appEl = document.getElementById('app');
    const count = document.getElementById('count');

    if (!torrents.length && !count) return;

    const pending = torrents.filter(t => !t.voted);
    if (count) count.textContent = pending.length;

    if (torrents.length === 0) {
      appEl.innerHTML = `
        <div class="empty">
          <div class="icon">✓</div>
          <p>${i18n.t('allTagged')}</p>
        </div>`;
      return;
    }

    appEl.innerHTML = `
      <div class="torrent-list">
        ${torrents.map((torrent, idx) => `
          <div class="torrent-item ${torrent.voted ? 'voted' : ''}" id="torrent-${idx}">
            <div class="torrent-info">
              <div class="torrent-name">${escapeHtml(torrent.name)}</div>
              <div class="torrent-meta">
                <span class="size">${formatSize(torrent.size)}</span>
              </div>
            </div>
            <div class="torrent-actions">
              ${torrent.voted
                ? `<span class="btn btn-voted">✓ ${escapeHtml(votedTag)}</span>`
                : torrent.url
                  ? `<a class="btn btn-vote" href="${escapeHtml(torrent.url)}" target="_blank" rel="noopener">${i18n.t('vote')}</a>
                     <button class="btn btn-done" onclick="app.markVoted(${idx})">${i18n.t('done')}</button>`
                  : `<span class="btn btn-no-url">${i18n.t('noUrl')}</span>`
              }
            </div>
          </div>
        `).join('')}
      </div>`;
  }

  function renderSettings() {
    const appEl = document.getElementById('app');
    const s = settings || { qbit: {}, telegram: {}, alerts: {} };
    const q = s.qbit || {};
    const tg = s.telegram || {};
    const al = s.alerts || {};

    appEl.innerHTML = `
      <div class="settings-page">
        <div class="settings-topbar">
          <button class="btn btn-secondary" onclick="app.showList()">${i18n.t('back')}</button>
          <h2>${i18n.t('settingsTitle')}</h2>
        </div>

        <section class="settings-section">
          <h3>${i18n.t('connection')}</h3>
          <label class="field">
            <span>${i18n.t('qbitUrl')}</span>
            <input type="text" id="s-qbit-url" value="${escapeHtml(q.url || '')}" autocomplete="off">
          </label>
          <label class="field">
            <span>${i18n.t('qbitUser')}</span>
            <input type="text" id="s-qbit-user" value="${escapeHtml(q.user || '')}" autocomplete="off">
          </label>
          <label class="field">
            <span>${i18n.t('qbitPassword')}</span>
            <input type="password" id="s-qbit-pass" value="" placeholder="${escapeHtml(i18n.t('qbitPasswordPlaceholder'))}" autocomplete="new-password">
          </label>
          <label class="field">
            <span>${i18n.t('votedTag')}</span>
            <input type="text" id="s-voted-tag" value="${escapeHtml(q.votedTag || '')}" autocomplete="off">
          </label>
          <div class="row section-actions">
            <button class="btn btn-secondary" onclick="app.testQbit()">${i18n.t('testConnection')}</button>
            <button class="btn btn-primary" onclick="app.saveQbit()">${i18n.t('save')}</button>
            <span class="settings-msg" id="conn-msg"></span>
          </div>
        </section>

        <section class="settings-section">
          <h3>${i18n.t('notifications')}</h3>
          <label class="field checkbox-field">
            <input type="checkbox" id="s-tg-enabled" ${tg.enabled ? 'checked' : ''}>
            <span>${i18n.t('telegramEnabled')}</span>
          </label>
          <label class="field">
            <span>${i18n.t('telegramToken')}</span>
            <input type="text" id="s-tg-token" value="${escapeHtml(tg.botToken || '')}" autocomplete="off">
          </label>
          <label class="field">
            <span>${i18n.t('telegramChat')}</span>
            <input type="text" id="s-tg-chat" value="${escapeHtml(tg.chatId || '')}" autocomplete="off">
          </label>
          <label class="field">
            <span>${i18n.t('alertThreshold')}</span>
            <input type="number" id="s-alert-threshold" min="1" value="${escapeHtml(String(al.threshold ?? 5))}">
          </label>
          <label class="field">
            <span>${i18n.t('alertInterval')}</span>
            <input type="number" id="s-alert-interval" min="1" value="${escapeHtml(String(al.checkIntervalMinutes ?? 15))}">
          </label>
          <p class="hint">${i18n.t('alertHint')}</p>
          <div class="row section-actions">
            <button class="btn btn-secondary" onclick="app.testTelegram()">${i18n.t('testTelegram')}</button>
            <button class="btn btn-primary" onclick="app.saveTelegram()">${i18n.t('save')}</button>
            <span class="settings-msg" id="tg-msg"></span>
          </div>
        </section>
      </div>`;
  }

  function readSettingsForm() {
    return {
      qbit: {
        url: document.getElementById('s-qbit-url').value.trim(),
        user: document.getElementById('s-qbit-user').value.trim(),
        password: document.getElementById('s-qbit-pass').value,
        votedTag: document.getElementById('s-voted-tag').value.trim()
      },
      telegram: {
        enabled: document.getElementById('s-tg-enabled').checked,
        botToken: document.getElementById('s-tg-token').value.trim(),
        chatId: document.getElementById('s-tg-chat').value.trim()
      },
      alerts: {
        threshold: parseInt(document.getElementById('s-alert-threshold').value, 10) || 5,
        checkIntervalMinutes: parseInt(document.getElementById('s-alert-interval').value, 10) || 15
      }
    };
  }

  function showMsg(id, text, ok) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'settings-msg ' + (ok ? 'ok' : 'err');
  }

  async function showSettings() {
    view = 'settings';
    setStatsVisible(false);
    try {
      const res = await fetch('/api/settings');
      settings = await res.json();
    } catch (err) {
      settings = { qbit: {}, telegram: {}, alerts: {} };
    }
    renderSettings();
  }

  function showList() {
    view = 'list';
    setStatsVisible(true);
    loadTorrents();
  }

  async function testQbit() {
    showMsg('conn-msg', '...', true);
    try {
      const form = readSettingsForm();
      const res = await fetch('/api/qbit/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.qbit)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showMsg('conn-msg', '✓ ' + i18n.t('testOk'), true);
    } catch (err) {
      showMsg('conn-msg', i18n.t('error') + err.message, false);
    }
  }

  async function testTelegram() {
    showMsg('tg-msg', '...', true);
    try {
      const form = readSettingsForm();
      const res = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botToken: form.telegram.botToken, chatId: form.telegram.chatId, lang: i18n.getLang() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showMsg('tg-msg', '✓ ' + i18n.t('testOk'), true);
    } catch (err) {
      showMsg('tg-msg', i18n.t('error') + err.message, false);
    }
  }

  async function saveQbit() {
    showMsg('conn-msg', '...', true);
    try {
      const form = readSettingsForm();
      const res = await fetch('/api/settings/qbit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form.qbit)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showMsg('conn-msg', '✓ ' + i18n.t('saved'), true);
    } catch (err) {
      showMsg('conn-msg', i18n.t('error') + err.message, false);
    }
  }

  async function saveTelegram() {
    showMsg('tg-msg', '...', true);
    try {
      const form = readSettingsForm();
      const res = await fetch('/api/settings/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram: form.telegram, alerts: form.alerts })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      showMsg('tg-msg', '✓ ' + i18n.t('saved'), true);
    } catch (err) {
      showMsg('tg-msg', i18n.t('error') + err.message, false);
    }
  }

  async function markVoted(index) {
    const torrent = torrents[index];
    try {
      const res = await fetch(`/api/torrents/${torrent.hash}/voted`, { method: 'POST' });
      if (res.ok) {
        torrent.voted = true;
        render();
      }
    } catch (err) {
      console.error('Error marking as voted:', err);
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const config = await res.json();
        votedTag = config.votedTag;
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
  }

  async function loadTorrents() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        ${i18n.t('connecting')}
      </div>`;

    try {
      await loadConfig();
      const res = await fetch('/api/torrents');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      torrents = await res.json();
      torrents.forEach(t => t.voted = false);
      render();
    } catch (err) {
      appEl.innerHTML = `
        <div class="error">
          ${i18n.t('errorConnecting')}<br>
          <small>${escapeHtml(err.message)}</small>
        </div>`;
    }
  }

  async function switchLang(lang) {
    await i18n.setLang(lang);
    try {
      await fetch('/api/language', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang })
      });
    } catch (err) {
      console.error('Error saving language:', err);
    }
  }

  async function init() {
    await i18n.init();

    i18n.onChange(() => {
      renderLangSwitcher();
      renderStaticUI();
      if (view === 'settings') renderSettings();
      else render();
    });

    renderLangSwitcher();
    renderStaticUI();
    await loadTorrents();
  }

  return {
    init, loadTorrents, markVoted, switchLang,
    showSettings, showList, saveQbit, saveTelegram, testQbit, testTelegram
  };
})();

document.addEventListener('DOMContentLoaded', () => app.init());
