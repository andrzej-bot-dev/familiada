// ===== konfiguracja.js — Wczytywanie/walidacja/zapis profilu wydarzenia =====

import { walidujProfil } from './zasady.js';

const DOMYSLNY_PROFIL = {
  nazwaProfilu: 'Domyślny',
  wydarzenie: {
    tytul: 'Familiada',
    podtytul: 'Kto pierwszy ten lepszy',
    tekstIntro: 'Witamy w Familiadzie!',
    motyw: 'klasyczny'
  },
  druzyny: [
    { id: 'd1', nazwa: 'Drużyna A', skrot: 'A', kolor: '#3b82f6' },
    { id: 'd2', nazwa: 'Drużyna B', skrot: 'B', kolor: '#ef4444' }
  ],
  zasady: {
    maxIksow: 3,
    liczbaRund: 5,
    mnoznikiRund: [1, 1, 2, 2, 3],
    przejecieWlaczone: true,
    pokazujBank: true,
    pokazujPunktyNaPlanszy: true
  },
  audio: {
    wlaczone: true,
    glosnosc: 0.7,
    mapowanie: {
      buzz: 'us_buzzer.mp3',
      poprawna: 'pl_correct_answer.mp3',
      bledna: 'pl_wrong_answer.mp3',
      iks: 'us_strike.mp3',
      trzyIksy: 'us_three_strikes.mp3',
      intro: 'pl_intro.mp3',
      koniecRundy: 'compilation_pl_seg03_jingle.mp3'
    }
  },
  klawisze: {
    uzbroj: 'Space',
    reset: 'KeyR',
    odsлон1: 'Digit1',
    odsłon2: 'Digit2',
    odsłon3: 'Digit3',
    odsłon4: 'Digit4',
    odsłon5: 'Digit5',
    odsłon6: 'Digit6',
    odsłon7: 'Digit7',
    odsłon8: 'Digit8',
    iks: 'KeyX',
    nastepny: 'ArrowRight',
    poprzedni: 'ArrowLeft',
    bankD1: 'KeyQ',
    bankD2: 'KeyW',
    help: 'F1',
    debug: 'F9',
    buzz1: 'F2',
    buzz2: 'F3'
  }
};

/** Pobierz profil z data/profile/ — zwraca domyślny przy błędzie */
export async function wczytajProfil(nazwa) {
  try {
    const res = await fetch(`data/profile/${nazwa}.json`);
    if (!res.ok) throw new Error(`Nie znaleziono profilu: ${nazwa}`);
    const profil = await res.json();
    const bledy = walidujProfil(profil);
    if (bledy.length) console.warn('Profil ma ostrzeżenia:', bledy);
    return scalZDomyslnym(profil);
  } catch (e) {
    console.error('Błąd wczytywania profilu:', e);
    return DOMYSLNY_PROFIL;
  }
}

/** Pobierz listę dostępnych profili z data/indeks.json */
export async function listaProfili() {
  try {
    const res = await fetch('data/indeks.json');
    if (!res.ok) return [{ plik: 'domyslny', nazwa: 'Domyślny' }];
    const indeks = await res.json();
    return indeks.profile || [{ plik: 'domyslny', nazwa: 'Domyślny' }];
  } catch {
    return [{ plik: 'domyslny', nazwa: 'Domyślny' }];
  }
}

/** Scalenie profilu z domyślnym (dopełnienie brakujących pól) */
function scalZDomyslnym(profil) {
  return {
    ...JSON.parse(JSON.stringify(DOMYSLNY_PROFIL)),
    ...profil,
    wydarzenie: { ...DOMYSLNY_PROFIL.wydarzenie, ...(profil.wydarzenie || {}) },
    zasady: { ...DOMYSLNY_PROFIL.zasady, ...(profil.zasady || {}) },
    audio: { ...DOMYSLNY_PROFIL.audio, ...(profil.audio || {}),
      mapowanie: { ...DOMYSLNY_PROFIL.audio.mapowanie, ...((profil.audio || {}).mapowanie || {}) }
    },
    klawisze: { ...DOMYSLNY_PROFIL.klawisze, ...(profil.klawisze || {}) },
    druzyny: profil.druzyny || DOMYSLNY_PROFIL.druzyny
  };
}

/** Eksport profilu do pliku JSON */
export function eksportujProfil(profil) {
  const blob = new Blob([JSON.stringify(profil, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${profil.nazwaProfilu || 'profil'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export { DOMYSLNY_PROFIL };
