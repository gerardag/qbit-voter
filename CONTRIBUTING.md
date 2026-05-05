# Contributing to qbit-voter

Thanks for your interest in contributing! This project is small and straightforward, so the process is kept simple.

## Getting started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Start the dev server: `QBIT_URL=http://localhost:8080 QBIT_USER=admin QBIT_PASS=admin node server.js`
5. Open `http://localhost:3000` in your browser

## Project structure

```
public/
├── index.html          # HTML shell (no logic here)
├── css/style.css       # All styles
├── js/
│   ├── i18n.js         # Language detection, loading and switching
│   └── app.js          # App logic, rendering, API calls
└── locales/
    ├── en.json          # English translations
    └── ca.json          # Catalan translations
server.js               # Express backend, qBittorrent API proxy
Dockerfile
```

## How to contribute

### Reporting bugs

Open an [issue](https://github.com/gerardag/qbit-voter/issues) with:

- A clear description of the problem
- Steps to reproduce it
- What you expected vs what happened
- Your environment (browser, Docker version, qBittorrent version)

### Suggesting features

Open an [issue](https://github.com/gerardag/qbit-voter/issues) describing the feature and why it would be useful.

### Submitting code

1. Create a branch from `main` with a descriptive name (`feat/dark-mode`, `fix/login-error`)
2. Make your changes
3. Test locally with `node server.js` or `docker build -t qbit-voter:test . && docker run --rm -p 3000:3000 qbit-voter:test`
4. Submit a pull request to `main`

### Adding a new language

This is one of the easiest ways to contribute:

1. Copy `public/locales/en.json` to `public/locales/xx.json` (where `xx` is the [ISO 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes) language code)
2. Translate all values (keep the keys in English)
3. The backend detects new locale files automatically — no other changes needed
4. Submit a pull request

## Commit messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automatic versioning:

- `fix: description` → patch release (v1.0.0 → v1.0.1)
- `feat: description` → minor release (v1.0.0 → v1.1.0)
- `feat!: description` → major release (v1.0.0 → v2.0.0)
- `docs: description` → no release, no build
- `chore: description` → patch release

Examples:
```
fix: handle expired qBittorrent session
feat: add Spanish translations
feat!: change API response format
docs: update README with new env variables
```

## Code style

- Keep it simple — this is a small project
- No frameworks on the frontend (vanilla JS)
- Backend is plain Express with no ORM or middleware beyond what's needed
- CSS uses custom properties (variables) for theming

## Pull request checklist

- [ ] Code works locally
- [ ] Commit messages follow Conventional Commits
- [ ] New environment variables are documented in README.md
- [ ] New translatable strings are added to **all** locale files in `public/locales/`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).