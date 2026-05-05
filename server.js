const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const QBIT_URL = process.env.QBIT_URL || 'http://localhost:8080';
const QBIT_USER = process.env.QBIT_USER || 'admin';
const QBIT_PASS = process.env.QBIT_PASS || 'adminadmin';
const VOTED_TAG = process.env.VOTED_TAG || 'Liked';

let sessionCookie = null;

async function qbitLogin() {
  const res = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(QBIT_USER)}&password=${encodeURIComponent(QBIT_PASS)}`
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
  return sessionCookie;
}

async function qbitRequest(endpoint, options = {}) {
  if (!sessionCookie) await qbitLogin();

  let res = await fetch(`${QBIT_URL}${endpoint}`, {
    ...options,
    headers: { 'Cookie': sessionCookie, ...(options.headers || {}) }
  });

  if (res.status === 403) {
    await qbitLogin();
    res = await fetch(`${QBIT_URL}${endpoint}`, {
      ...options,
      headers: { 'Cookie': sessionCookie, ...(options.headers || {}) }
    });
  }

  return res;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: get app config
app.get('/api/config', (req, res) => {
  res.json({ votedTag: VOTED_TAG });
});

// API: get untagged torrents
app.get('/api/torrents', async (req, res) => {
  try {
    const torrentsRes = await qbitRequest('/api/v2/torrents/info');
    const torrents = await torrentsRes.json();

    const untagged = torrents.filter(t => !t.tags || t.tags.trim() === '');

    const results = [];
    for (const torrent of untagged) {
      const propsRes = await qbitRequest(`/api/v2/torrents/properties?hash=${torrent.hash}`);
      const props = await propsRes.json();

      const urlMatch = (props.comment || '').match(/https?:\/\/[^\s"'<>]+/);

      results.push({
        name: torrent.name,
        url: urlMatch ? urlMatch[0] : null,
        hash: torrent.hash,
        size: torrent.size,
        progress: torrent.progress,
        state: torrent.state
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Error fetching torrents:', err);
    res.status(500).json({ error: err.message });
  }
});

// API: tag torrent as voted
app.post('/api/torrents/:hash/voted', async (req, res) => {
  try {
    const { hash } = req.params;
    await qbitRequest('/api/v2/torrents/addTags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `hashes=${hash}&tags=${encodeURIComponent(VOTED_TAG)}`
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error tagging torrent:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`qbit-voter running on port ${PORT}`);
});
