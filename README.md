# qbit-voter

Web app to list untagged torrents from qBittorrent and vote on them directly from the browser.

![qbit-voter](https://img.shields.io/badge/docker-ghcr.io-blue)

## What it does

1. Connects to your qBittorrent instance
2. Lists all torrents that have **no tags**
3. Extracts the voting URL from each torrent's comment field
4. Lets you open the voting page directly and mark torrents as voted
5. Once marked as voted, the torrent gets tagged as `Liked` in qBittorrent

## Quick start

### Option A — Configure via the UI (recommended)

```bash
mkdir -p data

docker run -d \
  --name qbit-voter \
  -p 3000:3000 \
  ghcr.io/YOUR_USERNAME/qbit-voter:latest
```

Open `http://localhost:3000`, click the ⚙ icon in the header, fill in your qBittorrent details and save. Settings are persisted to `data/config.json` and shared across all browsers and devices.

### Option B — Configure via environment variables

```bash
docker run -d \
  --name qbit-voter \
  -p 3000:3000 \
  -e QBIT_URL=http://your-qbittorrent:8080 \
  -e QBIT_USER=admin \
  -e QBIT_PASS=adminadmin \
  -e VOTED_TAG=Liked \
  ghcr.io/YOUR_USERNAME/qbit-voter:latest
```

On first boot the values are automatically migrated to `data/config.json`. A notification bar confirms the migration. After that you can manage settings from the UI and remove the environment variables if you wish.

## Docker Compose

```yaml
services:
  qbit-voter:
    image: ghcr.io/YOUR_USERNAME/qbit-voter:latest
    ports:
      - "3000:3000"
    restart: unless-stopped
```

Create the data directory before starting:

```bash
mkdir -p data
```

## Configuration

Settings are stored in `data/config.json` on the server and are shared across all browsers and devices. You can edit them at any time from the ⚙ settings menu in the app — no restart required.

| Field | Default | Description |
|-------|---------|-------------|
| qBittorrent URL | `http://localhost:8080` | URL of your qBittorrent Web UI |
| Username | `admin` | qBittorrent username |
| Password | `adminadmin` | qBittorrent password |
| Voted tag | `Liked` | Tag applied to torrents after voting |

## Environment variables

Environment variables are supported for backwards compatibility and initial setup. If `config.json` already exists they are ignored.

| Variable | Default | Description |
|----------|---------|-------------|
| `QBIT_URL` | `http://localhost:8080` | qBittorrent Web UI URL |
| `QBIT_USER` | `admin` | qBittorrent username |
| `QBIT_PASS` | `adminadmin` | qBittorrent password |
| `VOTED_TAG` | `Liked` | Tag applied to torrents after voting |
| `PORT` | `3000` | Port the app listens on |

## Migrating from environment variables

If you were using environment variables and want to switch to UI-managed config:

1. Start the app as usual with your existing env vars
2. On first boot, values are automatically written to `data/config.json` and a notification appears in the UI
3. Optionally remove the environment variables — `data/config.json` takes precedence

## Development

```bash
npm install
node server.js
```

To seed an initial configuration without using the UI:

```bash
QBIT_URL=http://localhost:8080 QBIT_USER=admin QBIT_PASS=admin node server.js
```

If you want to run a local dummy data:

```bash
DUMMY_MODE=true node server.js
```

This will write a `data/config.json` on first run.

## License

MIT
