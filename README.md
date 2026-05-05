# qbit-voter

Web app to list untagged torrents from qBittorrent and vote on them directly from the browser.

![qbit-voter](https://img.shields.io/badge/docker-ghcr.io-blue)

## What it does

1. Connects to your qBittorrent instance
2. Lists all torrents that have **no tags**
3. Extracts the voting URL from each torrent's comment field
4. Lets you open the voting page directly and mark torrents as voted
5. Once marked as voted, the torrent gets tagged as `votat` in qBittorrent

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
    container_port: 3000
    ports:
      - "3000:3000"
    environment:
      - QBIT_URL=http://qbittorrent:8080
      - QBIT_USER=admin
      - QBIT_PASS=adminadmin
    restart: unless-stopped
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `QBIT_URL` | Yes | `http://localhost:8080` | qBittorrent Web UI URL |
| `QBIT_USER` | Yes | `admin` | qBittorrent username |
| `QBIT_PASS` | Yes | `adminadmin` | qBittorrent password |
| `VOTED_TAG` | No | `Liked` | Tag applied to torrents after voting |
| `PORT` | No | `3000` | Port the app listens on |

## Development

```bash
npm install
QBIT_URL=http://localhost:8080 QBIT_USER=admin QBIT_PASS=admin node server.js
```

## License

MIT
