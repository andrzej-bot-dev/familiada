// ===== zasady.js — Reguły gry: bank, iksy, przejęcie, mnożnik =====

import { STAN_GRY } from './stan.js';

/** Czy drużyna może odsłaniać odpowiedzi w tej fazie? */
export function czyMoznaOdslaniac(stan) {
  return [STAN_GRY.GRA, STAN_GRY.POJEDYNEK, STAN_GRY.PRZEJECIE].includes(stan.fazaGry);
}

/** Czy można dodać iks? */
export function czyMoznaIks(stan) {
  return stan.iksy.length < 3 && czyMoznaOdslaniac(stan);
}

/** Czy drużyna przegrała rundę (3 iksy)? */
export function czyTrzyIksy(stan) {
  return stan.iksy.length >= 3;
}

/** Czy wszystkie odpowiedzi są odsłonięte? */
export function czyWszystkoOdslonięte(stan) {
  return stan.odpowiedzi.length > 0 && stan.odpowiedzi.every(o => o.odslonieta);
}

/** Czy możliwe jest przejęcie? (3 iksy i są jeszcze zakryte) */
export function czyPrzejecie(stan) {
  return czyTrzyIksy(stan) && !czyWszystkoOdslonięte(stan);
}

/** Suma punktów wszystkich odpowiedzi × mnożnik */
export function maksymalnyBank(stan) {
  const suma = stan.odpowiedzi.reduce((s, o) => s + o.punkty, 0);
  return suma * stan.mnoznikRundy;
}

/** Kto wygrywa grę? */
export function zwyciezca(stan) {
  if (stan.druzyny.length < 2) return null;
  const [d1, d2] = stan.druzyny;
  if (d1.suma === d2.suma) return null; // remis
  return d1.suma > d2.suma ? d1 : d2;
}

/** Pobierz mnożnik dla danej rundy z konfiguracji */
export function mnoznikDlaRundy(konfiguracja, rundIndex) {
  const mnozniki = konfiguracja?.zasady?.mnoznikiRund;
  if (!mnozniki || !Array.isArray(mnozniki)) return 1;
  return mnozniki[rundIndex] || 1;
}

/** Walidacja profilu konfiguracyjnego — zwraca listę błędów (pusta = OK) */
export function walidujProfil(profil) {
  const bledy = [];
  if (!profil.nazwaProfilu) bledy.push('Brak nazwy profilu');
  if (!profil.wydarzenie?.tytul) bledy.push('Brak tytułu wydarzenia');
  if (!Array.isArray(profil.druzyny) || profil.druzyny.length < 2) {
    bledy.push('Wymagane co najmniej 2 drużyny');
  }
  if (profil.druzyny) {
    profil.druzyny.forEach((d, i) => {
      if (!d.nazwa) bledy.push(`Drużyna ${i+1}: brak nazwy`);
    });
  }
  if (!profil.zasady) bledy.push('Brak sekcji "zasady"');
  return bledy;
}

/** Walidacja pytania — zwraca listę błędów */
export function walidujPytanie(p) {
  const bledy = [];
  if (!p.pytanie) bledy.push('Brak treści pytania');
  if (!Array.isArray(p.odpowiedzi) || p.odpowiedzi.length < 3) {
    bledy.push('Wymagane co najmniej 3 odpowiedzi');
  }
  if (p.odpowiedzi) {
    let suma = 0;
    p.odpowiedzi.forEach((o, i) => {
      if (!o.tekst) bledy.push(`Odpowiedź ${i+1}: brak treści`);
      if (typeof o.punkty !== 'number' || o.punkty < 0) bledy.push(`Odpowiedź ${i+1}: nieprawidłowa liczba punktów`);
      suma += o.punkty || 0;
    });
    // Suma powinna być blisko 100, ale nie twardy błąd
    if (suma > 0 && (suma < 80 || suma > 120)) {
      bledy.push(`Uwaga: suma punktów = ${suma} (zazwyczaj ~100)`);
    }
  }
  return bledy;
}
