// ===== stan.js — Model stanu gry + reducer =====
// Jedno źródło prawdy o stanie gry. Wszystkie zmiany przez dispatch().

export const STAN_GRY = {
  IDLE: 'idle',           // przed grą / menu
  POJEDYNEK: 'pojedynek',  // uzbrojone, czeka na buzz
  GRA: 'gra',              // drużyna gra, odsłania odpowiedzi
  PRZEJECIE: 'przejecie',  // przeciwna drużyna próbuje ukraść
  KONIEC_RUNDY: 'koniec_rundy',
  KONIEC_GRY: 'koniec_gry'
};

export const STAN_BUZZERA = {
  LOCKED: 'LOCKED',
  ARMED: 'ARMED',
  BUZZED: 'BUZZED'
};

/** Tworzy świeży, pusty stan gry */
export function nowaGra(konfiguracja) {
  const druzyny = konfiguracja.druzyny.map((d, i) => ({
    id: d.id || `d${i+1}`,
    nazwa: d.nazwa,
    skrot: d.skrot || d.nazwa.substring(0, 3).toUpperCase(),
    kolor: d.kolor || (i === 0 ? '#3b82f6' : '#ef4444'),
    suma: 0
  }));

  return {
    wersja: 1,
    fazaGry: STAN_GRY.IDLE,
    stanBuzzera: STAN_BUZZERA.LOCKED,
    ktoBuzznal: null,        // nr drużyny 1|2|null
    runda: 0,                // index 0-based
    liczbaRund: konfiguracja.zasady.liczbaRund || 5,
    mnoznikRundy: 1,
    pytanieId: null,
    pytanieTekst: '',
    odpowiedzi: [],          // [{id, tekst, punkty, odslonieta}]
    bank: 0,                 // pula punktów bieżącej rundy
    iksy: [],                // [false, false, false] — max 3
    kontrola: null,          // id drużyny która ma kontrolę
    druzyny,
    pytaniaUzyte: [],        // ids pytań już użytych
    timestamp: Date.now()
  };
}

/** Reducer — czysta funkcja, (stan, akcja) → nowy stan */
export function reducer(stan, akcja) {
  switch (akcja.typ) {
    case 'NOWA_GRA':
      return akcja.payload;

    case 'ZMIEN_FAZE':
      return { ...stan, fazaGry: akcja.faza };

    case 'UZBROJ':
      return { ...stan, stanBuzzera: STAN_BUZZERA.ARMED, ktoBuzznal: null, fazaGry: STAN_GRY.POJEDYNEK };

    case 'RESET_BUZZER':
      return { ...stan, stanBuzzera: STAN_BUZZERA.LOCKED, ktoBuzznal: null };

    case 'BUZZ': {
      if (stan.stanBuzzera !== STAN_BUZZERA.ARMED) return stan;
      return {
        ...stan,
        stanBuzzera: STAN_BUZZERA.BUZZED,
        ktoBuzznal: akcja.druzyna,
        fazaGry: STAN_GRY.GRA,
        kontrola: stan.druzyny[akcja.druzyna - 1]?.id || stan.kontrola
      };
    }

    case 'WYBIERZ_PYTANIE':
      if (!akcja.pytanie) return stan;
      return {
        ...stan,
        pytanieId: akcja.pytanie.id,
        pytanieTekst: akcja.pytanie.pytanie,
        odpowiedzi: akcja.pytanie.odpowiedzi.map((o, i) => ({
          id: i,
          tekst: o.tekst,
          punkty: o.punkty,
          odslonieta: false
        })),
        bank: 0,
        iksy: [],
        kontrola: null,
        ktoBuzznal: null,
        stanBuzzera: STAN_BUZZERA.LOCKED,
        fazaGry: STAN_GRY.IDLE,
        runda: akcja.runda ?? stan.runda,
        mnoznikRundy: akcja.mnoznik ?? stan.mnoznikRundy
      };

    case 'ODSLON_ODPOWIEDZ': {
      const odpowiedzi = stan.odpowiedzi.map(o =>
        o.id === akcja.id ? { ...o, odslonieta: true } : o
      );
      const odp = odpowiedzi.find(o => o.id === akcja.id);
      const punkty = odp ? odp.punkty : 0;
      return { ...stan, odpowiedzi, bank: stan.bank + (punkty * stan.mnoznikRundy) };
    }

    case 'UKRYJ_ODPOWIEDZ': {
      const odpowiedzi = stan.odpowiedzi.map(o =>
        o.id === akcja.id ? { ...o, odslonieta: false } : o
      );
      const odp = stan.odpowiedzi.find(o => o.id === akcja.id);
      const punkty = odp && odp.odslonieta ? odp.punkty : 0;
      return { ...stan, odpowiedzi, bank: Math.max(0, stan.bank - (punkty * stan.mnoznikRundy)) };
    }

    case 'DODAJ_IKS': {
      if (stan.iksy.length >= 3) return stan;
      return { ...stan, iksy: [...stan.iksy, true] };
    }

    case 'USUN_IKS': {
      if (stan.iksy.length === 0) return stan;
      return { ...stan, iksy: stan.iksy.slice(0, -1) };
    }

    case 'WYCZYSC_IKSY':
      return { ...stan, iksy: [] };

    case 'PRZEKAZ_KONTROLE':
      return { ...stan, kontrola: akcja.druzynaId, fazaGry: akcja.faza || stan.fazaGry };

    case 'PRZEJMIX_BANK': {
      const druzyny = stan.druzyny.map(d =>
        d.id === akcja.druzynaId ? { ...d, suma: d.suma + stan.bank } : d
      );
      return { ...stan, druzyny, bank: 0 };
    }

    case 'DODAJ_PUNKTY': {
      const druzyny = stan.druzyny.map(d =>
        d.id === akcja.druzynaId ? { ...d, suma: d.suma + akcja.punkty } : d
      );
      return { ...stan, druzyny };
    }

    case 'USTAW_MNOZNIK':
      return { ...stan, mnoznikRundy: akcja.mnoznik };

    case 'NASTEPNA_RUNDA':
      return {
        ...stan,
        runda: stan.runda + 1,
        fazaGry: STAN_GRY.IDLE,
        bank: 0,
        iksy: [],
        odpowiedzi: [],
        pytanieId: null,
        pytanieTekst: '',
        kontrola: null,
        ktoBuzznal: null,
        stanBuzzera: STAN_BUZZERA.LOCKED
      };

    case 'ZAKONCZ_GRE':
      return { ...stan, fazaGry: STAN_GRY.KONIEC_GRY };

    case 'OZNACZ_PYTANIE_UZYTE':
      return { ...stan, pytaniaUzyte: [...stan.pytaniaUzyte, akcja.pytanieId] };

    case 'ZMIEN_DRUZYNE': {
      const druzyny = stan.druzyny.map(d =>
        d.id === akcja.druzynaId ? { ...d, nazwa: akcja.nazwa, skrot: akcja.skrot || d.skrot, kolor: akcja.kolor || d.kolor } : d
      );
      return { ...stan, druzyny };
    }

    case 'OVERRIDE':
      return { ...stan, ...akcja.payload };

    case 'WCZYTAJ_STAN':
      return { ...akcja.payload, timestamp: Date.now() };

    default:
      return stan;
  }
}
