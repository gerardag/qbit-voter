const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const CONFIG_PATH = path.join(__dirname, 'config.json');

let migratedFromEnv = false;

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return { ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')), configured: true };
    } catch {}
  }

  const fromEnv = !!(process.env.QBIT_URL || process.env.QBIT_USER || process.env.QBIT_PASS);
  const cfg = {
    qbitUrl: process.env.QBIT_URL || 'http://localhost:8080',
    qbitUser: process.env.QBIT_USER || 'admin',
    qbitPass: process.env.QBIT_PASS || 'adminadmin',
    votedTag: process.env.VOTED_TAG || 'Liked',
    configured: fromEnv
  };

  if (fromEnv) {
    try {
      const { configured, ...toSave } = cfg;
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf8');
      migratedFromEnv = true;
      console.log('Migrated configuration from environment variables to config.json');
    } catch (err) {
      console.warn('Could not migrate env vars to config.json:', err.message);
    }
  }

  return cfg;
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

let config = loadConfig();
let sessionCookie = null;

async function qbitLogin() {
  const res = await fetch(`${config.qbitUrl}/api/v2/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `username=${encodeURIComponent(config.qbitUser)}&password=${encodeURIComponent(config.qbitPass)}`
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    sessionCookie = setCookie.split(';')[0];
  }
  return sessionCookie;
}

async function qbitRequest(endpoint, options = {}) {
  if (!sessionCookie) await qbitLogin();

  let res = await fetch(`${config.qbitUrl}${endpoint}`, {
    ...options,
    headers: { 'Cookie': sessionCookie, ...(options.headers || {}) }
  });

  if (res.status === 403) {
    await qbitLogin();
    res = await fetch(`${config.qbitUrl}${endpoint}`, {
      ...options,
      headers: { 'Cookie': sessionCookie, ...(options.headers || {}) }
    });
  }

  return res;
}

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// API: get app config (excludes password)
app.get('/api/config', (req, res) => {
  res.json({
    qbitUrl: config.qbitUrl,
    qbitUser: config.qbitUser,
    votedTag: config.votedTag,
    configured: config.configured ?? false,
    migratedFromEnv
  });
});

// API: test connection with provided credentials
app.post('/api/config/test', async (req, res) => {
  const { qbitUrl, qbitUser, qbitPass } = req.body;

  if (!qbitUrl || !qbitUser) {
    return res.status(400).json({ ok: false, error: 'qbitUrl and qbitUser are required' });
  }

  try {
    const loginRes = await fetch(`${qbitUrl.trim().replace(/\/$/, '')}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `username=${encodeURIComponent(qbitUser)}&password=${encodeURIComponent(qbitPass || config.qbitPass)}`
    });
    const text = await loginRes.text();
    if (!loginRes.ok) {
      res.json({ ok: false, error: `HTTP ${loginRes.status}` });
    } else if (text.trim().toLowerCase().includes('fail')) {
      res.json({ ok: false, error: 'Invalid credentials' });
    } else {
      res.json({ ok: true });
    }
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// API: update app config
app.put('/api/config', (req, res) => {
  const { qbitUrl, qbitUser, qbitPass, votedTag } = req.body;

  if (!qbitUrl || !qbitUser || !votedTag) {
    return res.status(400).json({ error: 'qbitUrl, qbitUser and votedTag are required' });
  }

  config = {
    qbitUrl: qbitUrl.trim().replace(/\/$/, ''),
    qbitUser: qbitUser.trim(),
    qbitPass: qbitPass || config.qbitPass,
    votedTag: votedTag.trim(),
    configured: true
  };

  saveConfig(config);
  sessionCookie = null; // force re-login with new credentials

  res.json({ success: true });
});

// API: list available locales
app.get('/api/locales', (req, res) => {
  const localesDir = path.join(__dirname, 'public', 'locales');
  try {
    const files = fs.readdirSync(localesDir);
    const langs = files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
    res.json(langs);
  } catch (err) {
    res.json(['en']);
  }
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
      body: `hashes=${hash}&tags=${encodeURIComponent(config.votedTag)}`
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
