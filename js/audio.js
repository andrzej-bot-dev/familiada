// ===== audio.js — Odtwarzanie dźwięków z panelu =====
// Preload ładuje pliki naprawdę (canplaythrough), graj() odtwarza bez opóźnień.
// Folder wlasne/ ma pierwszeństwo.

const AUDIO_CACHE = new Map();
const PRELOAD_PROMISES = new Map(); // nazwa → Promise<Audio|null>

let glosnosc = 0.7;
let wlaczone = true;
let odblokowane = false;

/** Odblokuj audio (wymaga interakcji użytkownika) */
export function odblokujAudio() {
  if (odblokowane) return;
  // Stwórz cichy buffer żeby odblokować kontekst
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume();
    odblokowane = true;
  } catch {
    // IE etc — nie ma AudioContext, ale <audio> też działa
    odblokowane = true;
  }
}

/** Ustaw głośność (0..1) */
export function ustawGlosnosc(v) {
  glosnosc = Math.max(0, Math.min(1, v));
}

/** Włącz/wyłącz dźwięk */
export function ustawWlaczone(v) {
  wlaczone = v;
}

/** Odtwórz plik dźwiękowy — bez opóźnień, cache już załadowany przez preload */
export async function graj(nazwaPliku) {
  if (!wlaczone || !nazwaPliku) return;

  // Jeśli preload jeszcze trwa, poczekaj
  if (PRELOAD_PROMISES.has(nazwaPliku)) {
    await PRELOAD_PROMISES.get(nazwaPliku);
  }

  let audio = AUDIO_CACHE.get(nazwaPliku);

  if (!audio) {
    // Fallback: spróbuj załadować teraz (jeśli preload nie objął tego pliku)
    for (const sciezka of [`assets/audio/wlasne/${nazwaPliku}`, `assets/audio/${nazwaPliku}`]) {
      try {
        audio = new Audio(sciezka);
        audio.volume = glosnosc;
        // Czekaj aż będzie gotowe (canplaythrough = można grać bez buforowania)
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('timeout')), 3000);
          audio.addEventListener('canplaythrough', () => { clearTimeout(timeout); resolve(); }, { once: true });
          audio.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('error')); }, { once: true });
          if (audio.readyState >= 3) { clearTimeout(timeout); resolve(); }
        });
        AUDIO_CACHE.set(nazwaPliku, audio);
        break;
      } catch {
        audio = null;
      }
    }
  }

  if (!audio) {
    console.warn(`Brak pliku dźwiękowego: ${nazwaPliku}`);
    return;
  }

  audio.volume = glosnosc;
  audio.currentTime = 0;
  try {
    await audio.play();
  } catch (e) {
    console.warn(`Nie udało się odtworzyć: ${nazwaPliku}`, e);
  }
}

/** Preload wszystkich dźwięków z mapowania — ładuje naprawdę, czeka na canplaythrough */
export function preload(mapowanie) {
  if (!mapowanie) return;
  const unikalne = [...new Set(Object.values(mapowanie))];
  unikalne.forEach(nazwa => {
    if (!nazwa || AUDIO_CACHE.has(nazwa)) return;
    // Odpal ładowanie i zapisz promise — graj() może na niego poczekać
    const promise = new Promise(async (resolve) => {
      for (const sciezka of [`assets/audio/wlasne/${nazwa}`, `assets/audio/${nazwa}`]) {
        try {
          const audio = new Audio(sciezka);
          audio.preload = 'auto';
          audio.volume = glosnosc;
          await new Promise((res, rej) => {
            const timeout = setTimeout(() => rej(new Error('timeout')), 5000);
            audio.addEventListener('canplaythrough', () => { clearTimeout(timeout); res(); }, { once: true });
            audio.addEventListener('error', () => { clearTimeout(timeout); rej(new Error('error')); }, { once: true });
            if (audio.readyState >= 3) { clearTimeout(timeout); res(); }
          });
          AUDIO_CACHE.set(nazwa, audio);
          PRELOAD_PROMISES.delete(nazwa);
          resolve();
          return;
        } catch { /* próbuj następną ścieżkę */ }
      }
      console.warn(`Preload: nie znaleziono ${nazwa}`);
      PRELOAD_PROMISES.delete(nazwa);
      resolve();
    });
    PRELOAD_PROMISES.set(nazwa, promise);
  });
}
