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
    if (pendingLabel) pendingLabel.innerHTML = `${i18n.t('pending')} <strong id="count">—</strong>`;
    if (refreshBtn) refreshBtn.textContent = i18n.t('refresh');
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

  return { init, loadTorrents, markVoted, switchLang };
})();

document.addEventListener('DOMContentLoaded', () => app.init());
