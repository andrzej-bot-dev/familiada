// ===== teksty.js — Wszystkie teksty UI panelu prowadzącego =====
// Czyste funkcje zwracające stringi i obiekty. Zero logiki gry.
// Wszystko po polsku, konkretne nazwy drużyn.
// Łatwe do edycji — zmiana tekstów nie wymaga dotykania logiki ani UI.

import { STAN_GRY, STAN_BUZZERA } from './stan.js';
import { czyWszystkoOdslonięte } from './zasady.js';

// --------------- CO TERAZ (górny pasek) ---------------

/**
 * Tekst i ikona w górnym pasku "CO TERAZ".
 * @returns {{ ikona: string, tytul: string }}
 */
export function coTeraz(connected, maPytanie, stan, pojedynek) {
  if (!connected) {
    return { ikona: '🔌', tytul: 'Podłącz hosta ESP32 przez USB aby rozpocząć' };
  }
  if (!maPytanie) {
    return { ikona: '📋', tytul: 'Wybierz zestaw pytań, aby rozpocząć grę' };
  }

  const armed = stan.stanBuzzera === STAN_BUZZERA.ARMED;
  const faza = stan.fazaGry;

  switch (faza) {
    case STAN_GRY.IDLE:
      return { ikona: '📖', tytul: 'Przeczytaj pytanie i kliknij UZBRÓJ' };

    case STAN_GRY.POJEDYNEK:
      if (armed) {
        return { ikona: '⏳', tytul: 'Buzzery uzbrojone — czekam na buzz...' };
      }
      break;

    case STAN_GRY.GRA: {
      if (pojedynek) {
        const druzynaIdx = pojedynek.tura === 1
          ? pojedynek.pierwszyBuzz
          : (pojedynek.pierwszyBuzz === 1 ? 2 : 1);
        const d = stan.druzyny[druzynaIdx - 1];
        return { ikona: '🔔', tytul: `🔔 Pojedynek — ${d?.nazwa || ''} odpowiada` };
      }
      const ktoGra = stan.druzyny.find(d => d.id === stan.kontrola) || stan.druzyny[0];
      if (czyWszystkoOdslonięte(stan)) {
        return { ikona: '💰', tytul: 'Wszystko odsłonięte! Przydziel bank' };
      } else if (ktoGra) {
        return { ikona: '🎮', tytul: `Gra: ${ktoGra.nazwa}` };
      }
      break;
    }

    case STAN_GRY.PRZEJECIE: {
      const d1 = stan.druzyny[0];
      const d2 = stan.druzyny[1];
      const przejmujaca = stan.kontrola === d1?.id ? d2 : d1;
      return { ikona: '🤑', tytul: `PRZEJĘCIE — ${przejmujaca?.nazwa} zgaduje` };
    }

    case STAN_GRY.KONIEC_RUNDY:
      return {
        ikona: '💰',
        tytul: stan.bank > 0 ? 'Przydziel bank zwycięzcy rundy' : 'Następna runda'
      };

    case STAN_GRY.KONIEC_GRY:
      return { ikona: '🏆', tytul: 'Koniec gry!' };
  }

  return { ikona: '🎯', tytul: '' };
}

// --------------- ACTION ZONE (podtekst + przyciski) ---------------

/**
 * Podtekst wyjaśniający nad guzikami w action zone.
 * Wyświetlany jako szary tekst pomagający prowadzącemu zrozumieć co robić.
 */
export function actionSub(stan, pojedynek, przejecieOdpowiedz) {
  const faza = stan.fazaGry;
  const armed = stan.stanBuzzera === STAN_BUZZERA.ARMED;
  const iksy = stan.iksy.length;
  const allRevealed = czyWszystkoOdslonięte(stan);
  const d1 = stan.druzyny[0];
  const d2 = stan.druzyny[1];

  if (faza === STAN_GRY.KONIEC_GRY) {
    return 'Kliknij "Nowa gra" aby zagrać ponownie z tym samym zestawem.';
  }

  if (faza === STAN_GRY.KONIEC_RUNDY || allRevealed) {
    if (stan.bank !== 0) {
      return 'Punkty z banku przejdą na konto drużyny która wygrała rundę.';
    }
    return '';
  }

  if (faza === STAN_GRY.PRZEJECIE) {
    const przejmujaca = stan.kontrola === d1?.id ? d2 : d1;
    const broniaca = stan.kontrola === d1?.id ? d1 : d2;
    if (przejecieOdpowiedz === null) {
      return `${przejmujaca?.nazwa} podaje jedną odpowiedź. Kliknij ją powyżej jeśli trafiona. Pudło → bank dla ${broniaca?.nazwa}.`;
    }
    return `Odsłoń pozostałe odpowiedzi. Bank (${stan.bank} pkt) przejdzie na konto ${przejmujaca?.nazwa}.`;
  }

  if (armed) {
    return 'Po jednej osobie z drużyny przy buzzerach. Kto pierwszy wciśnie — ten odpowiada pierwszy.';
  }

  // Pojedynek
  if (pojedynek) {
    const aktualnaDruzyna = pojedynek.tura === 1
      ? pojedynek.pierwszyBuzz
      : (pojedynek.pierwszyBuzz === 1 ? 2 : 1);
    const d = stan.druzyny[aktualnaDruzyna - 1];

    if (pojedynek.tura === 1) {
      return `Kliknij odpowiedź którą podała ${d?.nazwa}. Jeśli to #1 — ${d?.nazwa} wygrywa pojedynek. Jeśli nie — przeciwnik odpowiada.`;
    } else {
      const pierwszyD = stan.druzyny[pojedynek.pierwszyBuzz - 1];
      if (pojedynek.d1) {
        return `${pierwszyD?.nazwa}: ${pojedynek.d1.punkty} pkt. Kliknij odpowiedź ${d?.nazwa}. Kto ma więcej — ten gra dalej.`;
      } else {
        return `${pierwszyD?.nazwa} spudłowała. Kliknij odpowiedź ${d?.nazwa} — jeśli trafi, gra dalej.`;
      }
    }
  }

  // Normalna gra
  const ktoGra = stan.druzyny.find(d => d.id === stan.kontrola) || d1;
  const pozostale = stan.odpowiedzi.filter(o => !o.odslonieta).length;
  return `${ktoGra?.nazwa} zgaduje. Pozostało ${pozostale} odpowiedzi. ${iksy}/3 IKS — po 3 przejęcie.`;
}

/**
 * Podtekst dla stanu IDLE (przed uzbrojeniem).
 */
export function actionSubIdle() {
  return 'Odpowiedzi są ukryte na planszy. Po uzbrojeniu drużyny będą buzować.';
}

// --------------- WIERSZ ODPOWIEDZI ---------------

/**
 * Tekst akcji w wierszu odpowiedzi (prawa kolumna).
 */
export function odpowiedzAkcja(odslonieta, canClick) {
  if (odslonieta) return '✓ na planszy';
  if (canClick) return '📁 odsłoń';
  return '🔒';
}

// --------------- PRZYCISKI I KOMUNIKATY ---------------

/**
 * Tekst guzika IKS w trakcie pojedynku.
 */
export function btnIksPojedynek(druzynaNazwa) {
  return `✕ ${druzynaNazwa} spudłowała`;
}

/**
 * Tekst guzika IKS w normalnej grze.
 */
export function btnIksGra(iksy) {
  return `✕ IKS (${iksy}/3)`;
}

/**
 * Tekst guzika banku dla drużyny — zwraca { nazwa, punkty } dla dwuwierszowego guzika.
 */
export function btnBank(druzynaNazwa, bankPunkty) {
  return { nazwa: druzynaNazwa, punkty: `← ${bankPunkty} pkt` };
}

/**
 * Komunikat trafienia w przejęciu.
 */
export function przejecieTrafioneMsg(przejmujacaNazwa) {
  return `✅ ${przejmujacaNazwa} trafia! Przejmuje bank!`;
}

/**
 * Tekst guzika pudła w przejęciu.
 */
export function btnPrzejeciePudlo(przejmujacaNazwa, broniacaNazwa) {
  return `✕ ${przejmujacaNazwa} spudłowała → Bank dla ${broniacaNazwa}`;
}

// --------------- STAŁE TEKSTY ---------------

export const BTN = {
  UZBROJ: '⚔ UZBRÓJ',
  NOWA_GRA: '🔄 Nowa gra',
  RESET: '↻ RESET buzzera',
  NEXT_ROUND: 'Następna runda →',
  BANK_ROZDANY: 'Bank rozdany ✓',
  POKAZ_RESZTE: 'Pokaż pozostałe odpowiedzi →',
  KONIEC_GRY: '🏆 Gra zakończona!',
};

// --------------- STATUS / INFO ---------------

export function statusText(connected) {
  return connected ? 'Host połączony (USB)' : 'Nie połączono';
}

export function statusDot(connected) {
  return connected ? '🟢' : '🔴';
}

export function pytanieInfo(idx, total) {
  return total ? `Pytanie ${idx + 1} / ${total}` : '';
}

export const BRAK_ODPOWIEDZI = 'Brak odpowiedzi';
