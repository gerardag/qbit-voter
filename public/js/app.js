const app = (() => {
  let torrents = [];
  let votedTag = 'Liked';

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
    const settingsBtn = document.getElementById('settings-btn');
    if (pendingLabel) pendingLabel.innerHTML = `${i18n.t('pending')} <strong id="count">—</strong>`;
    if (refreshBtn) refreshBtn.textContent = i18n.t('refresh');
    if (settingsBtn) settingsBtn.title = i18n.t('settings');

    document.getElementById('modal-title').textContent = i18n.t('settingsTitle');
    document.getElementById('label-qbitUrl').textContent = i18n.t('qbitUrl');
    document.getElementById('label-qbitUser').textContent = i18n.t('qbitUser');
    document.getElementById('label-qbitPass').textContent = i18n.t('qbitPass');
    document.getElementById('input-qbitPass').placeholder = i18n.t('qbitPassPlaceholder');
    document.getElementById('label-votedTag').textContent = i18n.t('votedTag');
    document.getElementById('btn-cancel').textContent = i18n.t('cancel');
    document.getElementById('btn-save').textContent = i18n.t('save');
    document.getElementById('btn-test').textContent = i18n.t('testConnection');
  }

  function render() {
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

  function showNotification(text) {
    const bar = document.getElementById('notification-bar');
    document.getElementById('notification-text').textContent = text;
    bar.removeAttribute('hidden');
  }

  function dismissNotification() {
    document.getElementById('notification-bar').setAttribute('hidden', '');
  }

  async function loadConfig() {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        votedTag = cfg.votedTag;
        if (cfg.migratedFromEnv) {
          showNotification(i18n.t('migratedFromEnv'));
        }
        return cfg;
      }
    } catch (err) {
      console.error('Error loading config:', err);
    }
    return null;
  }

  async function loadTorrents() {
    const appEl = document.getElementById('app');
    appEl.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        ${i18n.t('connecting')}
      </div>`;

    try {
      const cfg = await loadConfig();
      if (!cfg || !cfg.configured) {
        appEl.innerHTML = `
          <div class="empty">
            <div class="icon">⚙</div>
            <p>${i18n.t('notConfigured')}</p>
          </div>`;
        return;
      }
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
  }

  function openSettings() {
    const overlay = document.getElementById('modal-overlay');

    document.getElementById('modal-title').textContent = i18n.t('settingsTitle');
    document.getElementById('label-qbitUrl').textContent = i18n.t('qbitUrl');
    document.getElementById('label-qbitUser').textContent = i18n.t('qbitUser');
    document.getElementById('label-qbitPass').textContent = i18n.t('qbitPass');
    document.getElementById('input-qbitPass').placeholder = i18n.t('qbitPassPlaceholder');
    document.getElementById('label-votedTag').textContent = i18n.t('votedTag');
    document.getElementById('btn-cancel').textContent = i18n.t('cancel');
    document.getElementById('btn-save').textContent = i18n.t('save');
    document.getElementById('btn-test').textContent = i18n.t('testConnection');
    document.getElementById('btn-test').className = 'btn-modal-test';
    document.getElementById('modal-feedback').textContent = '';

    fetch('/api/config').then(r => r.json()).then(cfg => {
      document.getElementById('input-qbitUrl').value = cfg.qbitUrl || '';
      document.getElementById('input-qbitUser').value = cfg.qbitUser || '';
      document.getElementById('input-qbitPass').value = '';
      document.getElementById('input-votedTag').value = cfg.votedTag || '';
    });

    overlay.classList.add('open');
  }

  function closeSettings() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  async function testConnection() {
    const btn = document.getElementById('btn-test');
    btn.disabled = true;
    btn.className = 'btn-modal-test';
    btn.textContent = '…';

    const body = {
      qbitUrl: document.getElementById('input-qbitUrl').value.trim(),
      qbitUser: document.getElementById('input-qbitUser').value.trim(),
      qbitPass: document.getElementById('input-qbitPass').value
    };

    const label = i18n.t('testConnection');
    try {
      const res = await fetch('/api/config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        btn.className = 'btn-modal-test success';
        btn.textContent = `✓ ${label}`;
      } else {
        btn.className = 'btn-modal-test error';
        btn.textContent = `✕ ${label}`;
      }
    } catch {
      btn.className = 'btn-modal-test error';
      btn.textContent = `✕ ${label}`;
    } finally {
      btn.disabled = false;
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const feedback = document.getElementById('modal-feedback');
    const saveBtn = document.getElementById('btn-save');

    const body = {
      qbitUrl: document.getElementById('input-qbitUrl').value.trim(),
      qbitUser: document.getElementById('input-qbitUser').value.trim(),
      qbitPass: document.getElementById('input-qbitPass').value,
      votedTag: document.getElementById('input-votedTag').value.trim()
    };

    saveBtn.disabled = true;
    feedback.textContent = '';
    feedback.className = 'modal-feedback';

    try {
      const res = await fetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      feedback.textContent = i18n.t('settingsSaved');
      feedback.classList.add('success');
      setTimeout(() => closeSettings(), 1000);
      loadTorrents();
    } catch (err) {
      feedback.textContent = i18n.t('settingsError');
      feedback.classList.add('error');
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function init() {
    await i18n.init();

    i18n.onChange(() => {
      renderLangSwitcher();
      renderStaticUI();
      render();
    });

    renderLangSwitcher();
    renderStaticUI();
    await loadTorrents();
  }

  return { init, loadTorrents, markVoted, switchLang, openSettings, closeSettings, saveSettings, testConnection, dismissNotification };
})();

document.addEventListener('DOMContentLoaded', () => app.init());
