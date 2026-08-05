// ===== audio.js — Odtwarzanie dźwięków z panelu =====
// Preload, brakujący plik = ostrzeżenie. Folder wlasne/ ma pierwszeństwo.

const AUDIO_CACHE = new Map();

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

/** Odtwórz plik dźwiękowy */
export async function graj(nazwaPliku) {
  if (!wlaczone || !nazwaPliku) return;

  let audio = AUDIO_CACHE.get(nazwaPliku);

  if (!audio) {
    // Spróbuj wlasne/ najpierw, potem główny folder — bez HEAD, po prostu twórz Audio
    for (const sciezka of [`assets/audio/wlasne/${nazwaPliku}`, `assets/audio/${nazwaPliku}`]) {
      audio = new Audio(sciezka);
      audio.volume = glosnosc;
      // Sprawdź czy plik istnieje (error event = brak pliku)
      const ok = await new Promise((resolve) => {
        audio.addEventListener('error', () => resolve(false), { once: true });
        audio.addEventListener('canplay', () => resolve(true), { once: true });
        // Timeout fallback
        setTimeout(() => resolve(true), 500);
      });
      if (ok) {
        AUDIO_CACHE.set(nazwaPliku, audio);
        break;
      }
      audio = null;
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

/** Preload wszystkich dźwięków z mapowania */
export function preload(mapowanie) {
  if (!mapowanie) return;
  const unikalne = [...new Set(Object.values(mapowanie))];
  unikalne.forEach(nazwa => {
    if (!nazwa) return;
    // Próbuj wlasne/ najpierw
    const sciezka = `assets/audio/${nazwa}`;
    const audio = new Audio(sciezka);
    audio.preload = 'auto';
    audio.volume = glosnosc;
    // Nie czekamy — Audio przeglądarki ładuje w tle
    AUDIO_CACHE.set(nazwa, audio);
  });
}
