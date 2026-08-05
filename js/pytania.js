// ===== pytania.js — Wczytywanie i zarządzanie zestawami pytań =====

import { walidujPytanie } from './zasady.js';

let biezacyZestaw = null;
let wszystkiePytania = [];

/** Wczytaj indeks zestawów */
export async function wczytajIndeks() {
  try {
    const res = await fetch('data/indeks.json');
    if (!res.ok) return [{ plik: 'testowy', nazwa: 'Testowy' }];
    const indeks = await res.json();
    return indeks.zestawy || [{ plik: 'testowy', nazwa: 'Testowy' }];
  } catch {
    return [{ plik: 'testowy', nazwa: 'Testowy' }];
  }
}

/** Wczytaj zestaw pytań z pliku JSON */
export async function wczytajZestaw(nazwaPliku) {
  try {
    const res = await fetch(`data/zestawy/${nazwaPliku}.json`);
    if (!res.ok) throw new Error(`Nie znaleziono zestawu: ${nazwaPliku}`);
    const zestaw = await res.json();
    biezacyZestaw = zestaw;
    wszystkiePytania = zestaw.pytania || [];
    return zestaw;
  } catch (e) {
    console.error('Błąd wczytywania zestawu:', e);
    return { nazwa: 'Błąd', pytania: [] };
  }
}

/** Pobierz listę pytań z bieżącego zestawu */
export function dajPytania() {
  return wszystkiePytania;
}

/** Losuj kolejność pytań */
export function losujPytania(pytania) {
  const kopie = [...pytania];
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie;
}

/** Wczytaj pytania z pliku (upload) */
export function wczytajZPliku(plik) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dane = JSON.parse(e.target.result);
        if (!dane.pytania || !Array.isArray(dane.pytania)) {
          throw new Error('Nieprawidłowy format pliku (brak tablicy "pytania")');
        }
        // Waliduj każde pytanie
        const bledy = [];
        dane.pytania.forEach((p, i) => {
          const b = walidujPytanie(p);
          if (b.length) bledy.push(`Pytanie ${i+1}: ${b.join(', ')}`);
        });
        if (bledy.length) {
          console.warn('Ostrzeżenia walidacji:', bledy);
        }
        resolve(dane);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(new Error('Nie udało się wczytać pliku'));
    reader.readAsText(plik);
  });
}

/** Eksport zestawu do pliku JSON */
export function eksportujZestaw(zestaw) {
  const blob = new Blob([JSON.stringify(zestaw, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zestaw.nazwa || 'zestaw'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
