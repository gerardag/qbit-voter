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

```bash
docker run -d \
  --name qbit-voter \
  -p 3000:3000 \
  -e QBIT_URL=http://your-qbittorrent:8080 \
  -e QBIT_USER=admin \
  -e QBIT_PASS=adminadmin \
  ghcr.io/YOUR_USERNAME/qbit-voter:latest
```

Then open `http://localhost:3000` in your browser.

## Docker Compose

```yaml
services:
  qbit-voter:
    image: ghcr.io/YOUR_USERNAME/qbit-voter:latest
    ports:
      - "3000:3000"
    environment:
      - QBIT_URL=http://qbittorrent:8080
      - QBIT_USER=admin
      - QBIT_PASS=adminadmin
      - CONFIG_PATH=/app/data/config.json
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Settings saved through the UI (connection, notifications, language) are stored in `config.json`. Mount a volume at `/app/data` and set `CONFIG_PATH=/app/data/config.json` so they survive container restarts.

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QBIT_URL` | No | `http://localhost:8080` | qBittorrent Web UI URL |
| `QBIT_USER` | No | `admin` | qBittorrent username |
| `QBIT_PASS` | No | `adminadmin` | qBittorrent password |
| `VOTED_TAG` | No | `Liked` | Tag applied to torrents after voting |
| `PORT` | No | `3000` | Port the app listens on |
| `CONFIG_PATH` | No | `/app/config.json` | Path where settings are persisted. Mount a volume here to survive restarts. |

## Development

```bash
npm install
QBIT_URL=http://localhost:8080 QBIT_USER=admin QBIT_PASS=admin node server.js
```

## License

MIT
