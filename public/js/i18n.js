const i18n = (() => {
  const STORAGE_KEY = 'qbit-voter-lang';
  const FALLBACK_LANG = 'en';

  let currentLang = FALLBACK_LANG;
  let translations = {};
  let supportedLangs = [];
  let onChangeCallbacks = [];

  async function init() {
    supportedLangs = await fetchSupportedLangs();
    currentLang = detectLang();
    await loadLang(currentLang);
  }

  async function fetchSupportedLangs() {
    try {
      const res = await fetch('/api/locales');
      if (res.ok) return await res.json();
    } catch (e) {}
    return [FALLBACK_LANG];
  }

  async function loadLang(lang) {
    try {
      const res = await fetch(`/locales/${lang}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      translations = await res.json();
      currentLang = lang;
      document.documentElement.lang = lang;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
      onChangeCallbacks.forEach(cb => cb(lang));
    } catch (e) {
      console.error(`Failed to load language: ${lang}`, e);
      if (lang !== FALLBACK_LANG) await loadLang(FALLBACK_LANG);
    }
  }

  function detectLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && supportedLangs.includes(saved)) return saved;
    } catch (e) {}

    const browserLang = (navigator.language || '').split('-')[0].toLowerCase();
    return supportedLangs.includes(browserLang) ? browserLang : FALLBACK_LANG;
  }

  function t(key) {
    return translations[key] || key;
  }

  async function setLang(lang) {
    if (lang === currentLang) return;
    await loadLang(lang);
  }

  function getLang() {
    return currentLang;
  }

  function getLangs() {
    return supportedLangs;
  }

  function onChange(callback) {
    onChangeCallbacks.push(callback);
  }

  return { init, t, setLang, getLang, getLangs, onChange };
})();
