// ===== audio.js — Odtwarzanie dźwięków z panelu =====
// Wszystkie pliki ładują się przy starcie (preload).
// graj() jest SYNCHRONICZNE — zero opóźnień, zero await.
// Folder wlasne/ ma pierwszeństwo.

const AUDIO_CACHE = new Map();   // nazwa → Audio (już załadowany)
const PRELOAD_PROMISES = new Map(); // nazwa → Promise (ładowanie w tle)

let glosnosc = 0.7;
let wlaczone = true;
let odblokowane = false;

/** Odblokuj audio (wymaga interakcji użytkownika) */
export function odblokujAudio() {
  if (odblokowane) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    odblokowane = true;
  } catch {
    odblokowane = true;
  }
}

export function ustawGlosnosc(v) {
  glosnosc = Math.max(0, Math.min(1, v));
  // Aktualizuj głośność wszystkich cached audio
  AUDIO_CACHE.forEach(a => { a.volume = glosnosc; });
}

export function ustawWlaczone(v) {
  wlaczone = v;
}

/**
 * Odtwórz plik — SYNCHRONICZNIE.
 * Zero await, zero opóźnień. Audio MUSI być preloaded.
 * Jeśli nie jest (edge case), ładuje w tle i próbuje odtworzyć ASAP.
 */
export function graj(nazwaPliku) {
  if (!wlaczone || !nazwaPliku) return;

  const audio = AUDIO_CACHE.get(nazwaPliku);

  if (audio) {
    // HIT — odtwórz natychmiast, w tej samej klatce co click
    audio.volume = glosnosc;
    audio.currentTime = 0;
    // play() zwraca Promise ale nie czekamy na nie — fire & forget
    audio.play().catch(() => {});
    return;
  }

  // MISS — spróbuj załadować w tle (edge case, normalnie preload łapie wszystko)
  if (!PRELOAD_PROMISES.has(nazwaPliku)) {
    _ladujTlo(nazwaPliku);
  }
  // Spróbuj odtworzyć jak tylko się załaduje
  PRELOAD_PROMISES.get(nazwaPliku)?.then(() => {
    const a = AUDIO_CACHE.get(nazwaPliku);
    if (a) {
      a.volume = glosnosc;
      a.currentTime = 0;
      a.play().catch(() => {});
    }
  });
}

/** Ładuj pojedynczy plik w tle */
function _ladujTlo(nazwa) {
  const promise = (async () => {
    for (const sciezka of [`assets/audio/wlasne/${nazwa}`, `assets/audio/${nazwa}`]) {
      try {
        const audio = new Audio(sciezka);
        audio.preload = 'auto';
        audio.volume = glosnosc;
        await new Promise((res, rej) => {
          const t = setTimeout(() => rej(), 3000);
          audio.addEventListener('canplaythrough', () => { clearTimeout(t); res(); }, { once: true });
          audio.addEventListener('error', () => { clearTimeout(t); rej(); }, { once: true });
          if (audio.readyState >= 3) { clearTimeout(t); res(); }
        });
        AUDIO_CACHE.set(nazwa, audio);
        return;
      } catch {}
    }
    console.warn(`[audio] Nie znaleziono: ${nazwa}`);
  })();
  PRELOAD_PROMISES.set(nazwa, promise);
  promise.finally(() => PRELOAD_PROMISES.delete(nazwa));
}

/**
 * Preload wszystkich dźwięków z mapowania.
 * Ładuje w tle, nie blokuje UI.
 * Po zakończeniu wszystkie Audio są gotowe do natychmiastowego odtworzenia.
 */
export function preload(mapowanie) {
  if (!mapowanie) return;
  const unikalne = [...new Set(Object.values(mapowanie))].filter(Boolean);
  unikalne.forEach(nazwa => {
    if (AUDIO_CACHE.has(nazwa) || PRELOAD_PROMISES.has(nazwa)) return;
    _ladujTlo(nazwa);
  });
}
