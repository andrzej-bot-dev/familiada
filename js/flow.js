// ===== flow.js — Logika gry Familiada =====
//
// ZASADY FAMILIADY (wyjaśnienie krok po kroku):
//
// 1. POJEDYNEK (face-off):
//    - Prowadzący uzbraja buzzery (UZBROJ)
//    - Po jednej osobie z każdej drużyny podchodzi do buzzerów
//    - Kto pierwszy wciśnie — ten odpowiada pierwszy
//    - Jeśli trafi odpowiedź #1 (najwyżej punktowaną) → jego drużyna wygrywa
//      pojedynek od razu i przechodzi do normalnej gry
//    - Jeśli nie trafi #1 → druga drużyna dostaje szansę odpowiedzieć
//    - Druga drużyna podaje jedną odpowiedź. Prowadzący klika ją w panelu.
//    - Porównanie: czyja odpowiedź ma więcej punktów — ta drużyna wygrywa
//      pojedynek i gra dalej. Przy remisie wygrywa pierwsza drużyna.
//    - Jeśli obie drużyny spudłują (IKS) → nikt nie wygrywa pojedynku,
//      kontrola wraca do pierwszej drużyny. IKS-y z pojedynku NIE liczą się
//      do normalnej gry — są czyszczone (WYCZYSC_IKSY).
//
// 2. NORMALNA GRA:
//    - Drużyna która wygrała pojedynek zgaduje kolejne odpowiedzi
//    - Każda trafiona → punkty do banku, odsłonięcie na planszy
//    - Każde pudło → IKS (max 3)
//    - Po 3 IKS-ach → PRZEJĘCIE
//
// 3. PRZEJĘCIE:
//    - Drużyna przeciwna ma szansę przejąć bank
//    - Podaje JEDNĄ odpowiedź (prowadzący klika ją w panelu)
//    - Jeśli trafi → zgarnia CAŁY bank (włącznie z punktami z nieodsłoniętych
//      odpowiedzi) + odsłaniamy wszystkie pozostałe odpowiedzi
//    - Jeśli spudłuje → bank wraca do drużyny broniącej (tej która grała)
//
// 4. KONIEC RUNDY:
//    - Wszystkie odpowiedzi odsłonięte → koniec rundy
//    - Bank przydzielany zwycięskiej drużynie przez prowadzącego
//    - Następna runda → nowe pytanie, nowy pojedynek
//
// 5. KONIEC GRY:
//    - Po wyczerpaniu wszystkich pytań → koniec gry
//    - Wygrywa drużyna z wyższą sumą punktów

import { STAN_GRY, reducer } from './stan.js';
import { czyPrzejecie, czyWszystkoOdslonięte } from './zasady.js';

export class Flow {
  constructor() {
    // --- Stan pojedynku (face-off) ---
    // null = brak aktywnego pojedynku
    // { tura: 1|2, d1: null|{druzyna, punkty}, d2: null|{druzyna, punkty}, pierwszyBuzz: 1|2 }
    // d1/d2 = null oznacza że drużyna jeszcze nie odpowiedziała (lub spudłowała)
    this.pojedynek = null;

    // --- Stan przejęcia ---
    // null = czeka na kliknięcie odpowiedzi
    // number = id odpowiedzi która została kliknięta (czeka na "pokaż resztę")
    this.przejecieOdpowiedz = null;
  }

  // ===================================================================
  // UZBROJENIE BUZZERÓW
  // Resetuje pojedynek i przejęcie, uzbraja buzzery do face-offu.
  // ===================================================================
  uzbroj() {
    this.pojedynek = null;
    this.przejecieOdpowiedz = null;
    return {
      dispatches: [{ typ: 'UZBROJ' }],
      transport: 'a',
      log: 'a wysłane (arm)'
    };
  }

  // ===================================================================
  // BUZZ — drużyna wcisnęła buzzer
  // Rozpoczyna pojedynek. Pierwsza drużyna która zabuzzowała
  // dostaje pierwszą turę (odpowiada jako pierwsza).
  // ===================================================================
  buzz(druzyna) {
    this.pojedynek = { tura: 1, d1: null, d2: null, pierwszyBuzz: druzyna };
    this.przejecieOdpowiedz = null;
    return {
      dispatches: [{ typ: 'BUZZ', druzyna }],
      log: `BUZZ:${druzyna}`
    };
  }

  // ===================================================================
  // RESET BUZZERA — anulowanie uzbrojenia
  // ===================================================================
  resetBuzzer() {
    this.pojedynek = null;
    return {
      dispatches: [{ typ: 'RESET_BUZZER' }],
      transport: 'r',
      log: 'r wysłane (reset)'
    };
  }

  // ===================================================================
  // KLIKNIĘCIE ODPOWIEDZI — najbardziej złożona metoda
  //
  // Trzy ścieżki w zależności od fazy gry:
  //   A) PRZEJĘCIE — drużyna przejmująca podaje jedną odpowiedź
  //   B) POJEDYNEK — face-off, porównanie punktów między drużynami
  //   C) NORMALNA GRA — po prostu odsłoń odpowiedź
  //
  // UWAGA: wykorzystuje reducer do SYMULACJI stanu po ODSLON_ODPOWIEDZ,
  // żeby zdecydować co zrobić dalej BEZ modyfikowania rzeczywistego stanu.
  // Wszystkie dispatche są wykonywane przez Panel sekwencyjnie.
  // ===================================================================
  klikOdpowiedz(stan, id) {
    const faza = stan.fazaGry;

    // --- A) PRZEJĘCIE — jedna odpowiedź, potem pokaż resztę ---
    if (faza === STAN_GRY.PRZEJECIE) {
      if (this.przejecieOdpowiedz !== null) {
        return { dispatches: [], blocked: true };
      }
      this.przejecieOdpowiedz = id;
      return {
        dispatches: [{ typ: 'ODSLON_ODPOWIEDZ', id }],
        audio: 'poprawna',
        needsRender: true
      };
    }

    // --- B) POJEDYNEK (face-off) ---
    if (this.pojedynek) {
      // Symulujemy stan po odsłonięciu odpowiedzi, żeby poznać punkty
      const simulated = reducer(stan, { typ: 'ODSLON_ODPOWIEDZ', id });
      const odp = simulated.odpowiedzi[id];
      const najwyzsza = Math.max(...stan.odpowiedzi.map(o => o.punkty));
      const pierwszyBuzz = this.pojedynek.pierwszyBuzz;
      const drugiBuzz = pierwszyBuzz === 1 ? 2 : 1;
      const dispatches = [{ typ: 'ODSLON_ODPOWIEDZ', id }];

      if (this.pojedynek.tura === 1) {
        // --- Pierwsza drużyna odpowiedziała ---
        this.pojedynek.d1 = { druzyna: pierwszyBuzz, punkty: odp.punkty };

        if (odp.punkty >= najwyzsza) {
          // Trafiła odpowiedź z najwyższą punktacją → wygrywa pojedynek od razu
          // Nie musi być DOSŁOWNIE #1 — wystarczy że ma >= punkty najwyższej
          this.pojedynek = null;
          // IKS-y z pojedynku NIE liczą się do normalnej gry
          dispatches.push({ typ: 'WYCZYSC_IKSY' });
        } else {
          // Nie trafiła najwyższej → druga drużyna dostaje szansę
          this.pojedynek.tura = 2;
        }
      } else {
        // --- Druga drużyna odpowiedziała — porównanie punktów ---
        this.pojedynek.d2 = { druzyna: drugiBuzz, punkty: odp.punkty };
        const d1punkty = this.pojedynek.d1?.punkty ?? -1; // -1 = pierwsza spudłowała

        // Kto ma więcej punktów — ten wygrywa. Przy remisie wygrywa pierwsza.
        const wygrana = odp.punkty > d1punkty ? drugiBuzz : pierwszyBuzz;

        this.pojedynek = null;
        // IKS-y z pojedynku NIE liczą się
        dispatches.push({ typ: 'WYCZYSC_IKSY' });
        // Przekaż kontrolę zwycięzcy pojedynku
        dispatches.push({ typ: 'PRZEKAZ_KONTROLE', druzynaId: stan.druzyny[wygrana - 1].id });
      }

      return { dispatches, audio: 'poprawna', needsRender: true };
    }

    // --- C) NORMALNA GRA — po prostu odsłoń ---
    return {
      dispatches: [{ typ: 'ODSLON_ODPOWIEDZ', id }],
      audio: 'poprawna'
    };
  }

  // ===================================================================
  // DODAJ IKS — pudło drużyny
  //
  // W pojedynku: IKS przełącza turę (tura 1→2) lub kończy pojedynek
  //   (tura 2 — obie spudłowały, kontrola do pierwszej drużyny).
  //   IKS-y z pojedynku są czyszczone — nie przechodzą do normalnej gry.
  //
  // W normalnej grze: dodaje IKS, a po 3 IKS-ach → automatyczne przejęcie.
  // ===================================================================
  dodajIks(stan) {
    const dispatches = [];

    if (this.pojedynek) {
      const pierwszyBuzz = this.pojedynek.pierwszyBuzz;

      if (this.pojedynek.tura === 1) {
        // Pierwsza drużyna spudłowała — druga odpowiada
        this.pojedynek.d1 = null;
        this.pojedynek.tura = 2;
        dispatches.push({ typ: 'DODAJ_IKS' });
        return { dispatches, audio: 'iks', needsRender: true };
      }

      // Tura 2 — druga drużyna zakończyła pojedynek (spudłowała)
      // Koniec pojedynku, IKS-y są czyszczone, kontrola do pierwszej drużyny
      this.pojedynek = null;
      dispatches.push({ typ: 'DODAJ_IKS' });
      // IKS-y z pojedynku NIE liczą się do normalnej gry
      dispatches.push({ typ: 'WYCZYSC_IKSY' });
      dispatches.push({ typ: 'PRZEKAZ_KONTROLE', druzynaId: stan.druzyny[pierwszyBuzz - 1].id });
      return { dispatches, audio: 'iks', needsRender: true };
    }

    // Normalna gra — dodaj IKS
    dispatches.push({ typ: 'DODAJ_IKS' });

    // Sprawdź czy po dodaniu IKS-a nastąpi przejęcie
    const simulated = reducer(stan, { typ: 'DODAJ_IKS' });
    const autoTransition = czyPrzejecie(simulated);

    return { dispatches, audio: 'iks', autoTransition };
  }

  // ===================================================================
  // COFNIJ IKS — ostatni IKS do wycofania
  // Jeśli byliśmy w przejęciu a IKS-ów jest mniej niż 3, wróć do gry.
  // ===================================================================
  cofnijIks(stan) {
    const dispatches = [{ typ: 'USUN_IKS' }];
    if (stan.fazaGry === STAN_GRY.PRZEJECIE && stan.iksy.length < 3) {
      dispatches.push({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.GRA });
    }
    return { dispatches };
  }

  // ===================================================================
  // BANK DLA DRUŻYNY — przydziel punkty z banku wybranej drużynie
  // Jeśli wszystkie odpowiedzi odsłonięte lub faza przejęcia → koniec rundy.
  // ===================================================================
  bankDlaDruzyny(stan, druzynaId) {
    const dispatches = [{ typ: 'PRZEJMIX_BANK', druzynaId }];
    if (czyWszystkoOdslonięte(stan) || stan.fazaGry === STAN_GRY.PRZEJECIE) {
      dispatches.push({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.KONIEC_RUNDY });
    }
    return { dispatches };
  }

  // ===================================================================
  // PRZEJĘCIE TRAFIONE — drużyna przejmująca trafiła odpowiedź
  //
  // Zgarnia CAŁY bank (włącznie z punktami z jeszcze nieodsłoniętych
  // odpowiedzi — to kluczowa zasada Familiady!). Odsłania wszystkie
  // pozostałe odpowiedzi. Runda się kończy.
  //
  // Zwraca bezpośrednio nowy stan (newStan) — tak jak w oryginalnym kodzie,
  // bo potrzebujemy złożonej transformacji: odsłonięcie wszystkich odpowiedzi,
  // dodanie punktów z nieodsłoniętych do banku, przelanie banku do drużyny.
  // ===================================================================
  przejecieTrafiona(stan) {
    const [d1, d2] = stan.druzyny;
    const przejmujaca = stan.kontrola === d1?.id ? d2 : d1;

    // Odsłoń wszystkie odpowiedzi
    const odpowiedzi = stan.odpowiedzi.map(o => ({ ...o, odslonieta: true }));

    // Punkty z dotąd nieodsłoniętych odpowiedzi (× mnożnik) dodajemy do banku
    const dodatkowe = stan.odpowiedzi
      .filter(o => !o.odslonieta)
      .reduce((s, o) => s + (o.punkty || 0) * (stan.mnoznikRundy || 1), 0);

    const bank = stan.bank + dodatkowe;
    const druzyny = stan.druzyny.map(d =>
      d.id === przejmujaca.id ? { ...d, suma: d.suma + bank } : d
    );

    this.przejecieOdpowiedz = null;

    return {
      newStan: { ...stan, odpowiedzi, bank: 0, druzyny, fazaGry: STAN_GRY.KONIEC_RUNDY },
      audio: 'poprawna'
    };
  }

  // ===================================================================
  // PRZEJĘCIE PUDŁO — drużyna przejmująca spudłowała
  //
  // Bank wraca do drużyny broniącej (tej która aktualnie ma kontrolę).
  // Runda się kończy.
  // ===================================================================
  przejeciePudlo(stan) {
    const broniaca = stan.druzyny.find(d => d.id === stan.kontrola) || stan.druzyny[0];
    const druzyny = stan.druzyny.map(d =>
      d.id === broniaca.id ? { ...d, suma: d.suma + stan.bank } : d
    );
    // Odsłoń wszystkie odpowiedzi dla publiczności (jak w prawdziwej Familiadzie)
    const odpowiedzi = stan.odpowiedzi.map(o => ({ ...o, odslonieta: true }));
    this.przejecieOdpowiedz = null;
    return {
      newStan: { ...stan, odpowiedzi, bank: 0, druzyny, fazaGry: STAN_GRY.KONIEC_RUNDY }
    };
  }

  // ===================================================================
  // NASTĘPNA RUNDA — przejście do kolejnego pytania
  // Jeśli to było ostatnie pytanie → koniec gry.
  // ===================================================================
  nastepnaRunda(stan, biezacyIdx, pytaniaCount) {
    const nastepny = biezacyIdx + 1;
    if (nastepny >= pytaniaCount) {
      return { dispatches: [{ typ: 'ZAKONCZ_GRE' }], koniecGry: true };
    }
    return {
      dispatches: [{ typ: 'NASTEPNA_RUNDA' }],
      nastepnyIndeks: nastepny
    };
  }

  // ===================================================================
  // NOWA GRA — reset wszystkiego
  // ===================================================================
  nowaGra() {
    return { dispatches: [], resetAll: true };
  }

  // ===================================================================
  // AUTO-DETEKCJA — sprawdza czy po ODSLON_ODPOWIEDZ
  // wszystkie odpowiedzi są już odsłonięte → automatyczny koniec rundy
  // ===================================================================
  sprawdzAutoKoniecRundy(stan) {
    if (czyWszystkoOdslonięte(stan) &&
        stan.fazaGry !== STAN_GRY.KONIEC_RUNDY &&
        stan.fazaGry !== STAN_GRY.KONIEC_GRY) {
      return [{ typ: 'ZMIEN_FAZE', faza: STAN_GRY.KONIEC_RUNDY }];
    }
    return [];
  }

  // ===================================================================
  // AUTO-PRZEJĘCIE — sprawdza czy po DODAJ_IKS
  // są 3 IKS-y i są jeszcze zakryte odpowiedzi → automatyczne przejęcie
  // ===================================================================
  sprawdzAutoPrzejecie(stan) {
    if (czyPrzejecie(stan) && stan.fazaGry !== STAN_GRY.PRZEJECIE) {
      this.przejecieOdpowiedz = null;
      return {
        dispatches: [{ typ: 'ZMIEN_FAZE', faza: STAN_GRY.PRZEJECIE }],
        audio: 'trzyIksy'
      };
    }
    return null;
  }

  // ===================================================================
  // RESET — wyczyść stan pojedynku i przejęcia
  // ===================================================================
  reset() {
    this.pojedynek = null;
    this.przejecieOdpowiedz = null;
  }
}
