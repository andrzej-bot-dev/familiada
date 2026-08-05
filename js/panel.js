// ===== panel.js — Panel prowadzącego (mózg gry) — wizard 3-krokowy =====

import { STAN_GRY, STAN_BUZZERA, nowaGra, reducer } from './stan.js';
import { Historia } from './historia.js';
import { Sync } from './sync.js';
import { wczytajProfil, listaProfili, DOMYSLNY_PROFIL } from './konfiguracja.js';
import { wczytajZestaw, wczytajIndeks, dajPytania, losujPytania } from './pytania.js';
import { WebSerialTransport } from './transport/webserial.js';
import { graj, ustawGlosnosc, ustawWlaczone, odblokujAudio, preload } from './audio.js';
import { Debug } from './debug.js';
import { mnoznikDlaRundy, czyPrzejecie, czyWszystkoOdslonięte } from './zasady.js';

class Panel {
  constructor() {
    this.stan = null;
    this.konfiguracja = DOMYSLNY_PROFIL;
    this.historia = new Historia();
    this.sync = new Sync();
    this.transport = null;       // Brak trybu demo — najpierw trzeba połączyć
    this.zestawy = [];
    this.pytania = [];            // Pytania po przetasowaniu
    this.biezacePytanieIdx = -1;
    this.aktywnyZestawIdx = -1;
    this.debug = new Debug(this);

    // Pojedynek (face-off) tracking
    this.pojedynek = null;  // null = brak, { tura: 1|2, d1: null|{id,punkty}, d2: null|{id,punkty} }
    // Przejęcie — czy odpowiedź była już kliknięta
    this.przejecieOdpowiedz = null;  // null = czeka, int = id odsłonionej odpowiedzi

    this._init();
  }

  async _init() {
    const profilNazwa = new URLSearchParams(location.search).get('profil') || 'domyslny';
    this.konfiguracja = await wczytajProfil(profilNazwa);

    const profile = await listaProfili();
    this._wypelnijProfile(profile, profilNazwa);

    const indeksZestawow = await wczytajIndeks();
    this._wypelnijZestawy(indeksZestawow);

    this.stan = nowaGra(this.konfiguracja);

    this.sync.on((msg) => {
      if (msg.typ === 'ZADANIE_STANU' && this.stan) this._wyslijStan();
    });

    preload(this.konfiguracja.audio?.mapowanie);
    this._podlaczUI();
    this._render();

    // USB disconnect handler
    if ('serial' in navigator) {
      navigator.serial.addEventListener('disconnect', (e) => {
        if (this.transport?.port === e.target) {
          console.warn('[USB] Host odłączony!');
          this.debug.log('USB DISCONNECT!');
          this.transport.polaczony = false;
          this.transport = null;
          this._render();
          alert('Połączenie USB zostało przerwane! Podłącz hosta ponownie i kliknij Połącz.');
        }
      });
    }
  }

  // ===== Połączenie =====
  async polacz() {
    odblokujAudio();
    if (!WebSerialTransport.dostepny()) {
      alert('Web Serial API niedostępne.\nUżyj Chrome lub Edge.');
      return;
    }
    try {
      const t = new WebSerialTransport();
      await t.polacz();
      if (this.transport) this.transport.rozlacz();
      this.transport = t;
      t.onBuzz((d) => this._buzz(d));
      this._render();
      this._sprobujWznow();
    } catch (e) {
      alert(`Nie udało się połączyć: ${e.message}`);
    }
  }

  // ===== Wybór zestawu → losowa kolejność → auto-start =====
  async wybierzZestaw(idx) {
    const zestaw = this.zestawy[idx];
    if (!zestaw) return;
    this.aktywnyZestawIdx = idx;
    await wczytajZestaw(zestaw.plik);
    this.pytania = losujPytania(dajPytania());
    this.biezacePytanieIdx = -1;

    // Reset gry i ładuj pierwsze pytanie
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this._wyslijStan();
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this.wybierzPytanie(0);
    this._render();
  }

  // ===== Dispatch =====
  dispatch(akcja) {
    if (!this.stan) return;
    if (akcja.typ !== 'OVERRIDE' && akcja.typ !== 'WCZYTAJ_STAN') {
      this.historia.zapisz(this.stan);
    }
    this.stan = reducer(this.stan, akcja);
    this._render();
    this._wyslijStan();
    this._zapiszLocal();

    // Auto-detekcja: po odsłonięciu odpowiedzi sprawdź stan
    if (akcja.typ === 'ODSLON_ODPOWIEDZ' && czyWszystkoOdslonięte(this.stan)) {
      setTimeout(() => {
        if (this.stan.fazaGry !== STAN_GRY.KONIEC_RUNDY && this.stan.fazaGry !== STAN_GRY.KONIEC_GRY) {
          this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.KONIEC_RUNDY });
        }
      }, 300);
    }
  }

  _wyslijStan() {
    if (!this.stan) return;
    const stanDlaPlanszy = {
      ...this.stan,
      _konfiguracjaTytul: this.konfiguracja.wydarzenie?.tytul || 'Familiada',
      _pokazujBank: this.konfiguracja.zasady?.pokazujBank !== false
    };
    this.sync.wyslijStan(stanDlaPlanszy);
  }

  _zapiszLocal() {
    try { localStorage.setItem('familiada-stan', JSON.stringify(this.stan)); } catch {}
  }

  _sprobujWznow() {
    try {
      const zapisany = localStorage.getItem('familiada-stan');
      if (!zapisany) return;
      const stan = JSON.parse(zapisany);
      if (!stan?.druzyny?.length || !stan?.pytanieTekst) return;

      const overlay = document.getElementById('overlay-wznow');
      overlay.style.display = 'flex';

      document.getElementById('btn-wznow').onclick = () => {
        this.stan = stan;
        this.historia.reset();
        this._render();
        this._wyslijStan();
        overlay.style.display = 'none';
      };
      document.getElementById('btn-nowa-zamiast').onclick = () => {
        localStorage.removeItem('familiada-stan');
        overlay.style.display = 'none';
      };
    } catch {}
  }

  // ===== Buzz =====
  _buzz(druzyna) {
    if (!this.stan || this.stan.stanBuzzera !== STAN_BUZZERA.ARMED) return;
    this.dispatch({ typ: 'BUZZ', druzyna });
    // Rozpocznij pojedynek
    this.pojedynek = { tura: 1, d1: null, d2: null, pierwszyBuzz: druzyna };
    this.przejecieOdpowiedz = null;
    this.debug.log(`BUZZ:${druzyna}`);
  }

  // ===== Akcje gry =====
  uzbroj() {
    if (!this.stan?.pytanieTekst) return;
    this.pojedynek = null;
    this.przejecieOdpowiedz = null;
    this.dispatch({ typ: 'UZBROJ' });
    if (this.transport?.polaczony) this.transport.wyslij('a');
    this.debug.log('a wysłane (arm)');
  }

  resetBuzzer() {
    this.pojedynek = null;
    this.dispatch({ typ: 'RESET_BUZZER' });
    if (this.transport?.polaczony) this.transport.wyslij('r');
    this.debug.log('r wysłane (reset)');
    this._render();
  }

  wybierzPytanie(idx) {
    if (idx < 0 || idx >= this.pytania.length) return;
    this.biezacePytanieIdx = idx;
    const p = this.pytania[idx];
    if (!p) return;
    const rundIndex = this.stan.runda;
    const mnoznik = mnoznikDlaRundy(this.konfiguracja, rundIndex);
    // Połącz oba dispatche w jeden — OZNACZ bez zapisu historii
    this.historia.zapisz(this.stan);
    this.stan = reducer(this.stan, { typ: 'WYBIERZ_PYTANIE', pytanie: p, runda: rundIndex, mnoznik });
    this.stan = reducer(this.stan, { typ: 'OZNACZ_PYTANIE_UZYTE', pytanieId: p.id });
    this._render();
    this._wyslijStan();
    this._zapiszLocal();
  }

  odslonOdpowiedz(id) {
    this.dispatch({ typ: 'ODSLON_ODPOWIEDZ', id });
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.poprawna);
  }

  dodajIks() {
    const audioMap = this.konfiguracja.audio?.mapowanie || {};

    // Pojedynek — IKS oznacza pudło w face-off
    if (this.pojedynek) {
      const pierwszyBuzz = this.pojedynek.pierwszyBuzz;
      const drugiBuzz = pierwszyBuzz === 1 ? 2 : 1;

      if (this.pojedynek.tura === 1) {
        // Pierwsza drużyna spudłowała — druga odpowiada
        this.pojedynek.d1 = null;
        this.pojedynek.tura = 2;
        this.dispatch({ typ: 'DODAJ_IKS' });
        graj(audioMap.iks);
        this._render();
        return;
      } else if (this.pojedynek.tura === 2) {
        // Druga drużyna spudłowała
        const d1punkty = this.pojedynek.d1?.punkty ?? -1;
        // Jeśli D1 trafiła (> -1) → D1 wygrywa (D2 spudłowała)
        // Jeśli D1 też spudłowała (-1) → D1 wygrywa bo buzznęła pierwsza
        this.pojedynek = null;
        this.dispatch({ typ: 'DODAJ_IKS' });
        this.dispatch({ typ: 'PRZEKAZ_KONTROLE', druzynaId: this.stan.druzyny[pierwszyBuzz - 1].id });
        graj(audioMap.iks);
        this._render();
        return;
      }
    }

    this.dispatch({ typ: 'DODAJ_IKS' });
    graj(audioMap.iks);

    // Auto-przejście po 3 iksach
    setTimeout(() => {
      if (czyPrzejecie(this.stan)) {
        graj(audioMap.trzyIksy);
        this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.PRZEJECIE });
        this.przejecieOdpowiedz = null;
      }
    }, 600);
  }

  cofnijIks() {
    this.dispatch({ typ: 'USUN_IKS' });
    if (this.stan.fazaGry === STAN_GRY.PRZEJECIE && this.stan.iksy.length < 3) {
      this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.GRA });
    }
  }

  bankDlaDruzyny(druzynaId) {
    this.dispatch({ typ: 'PRZEJMIX_BANK', druzynaId });
    if (czyWszystkoOdslonięte(this.stan) || this.stan.fazaGry === STAN_GRY.PRZEJECIE) {
      this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.KONIEC_RUNDY });
    }
  }

  nastepnaRunda() {
    const nastepny = this.biezacePytanieIdx + 1;
    if (nastepny >= this.pytania.length) {
      // Koniec pytań → koniec gry
      this.dispatch({ typ: 'ZAKONCZ_GRE' });
      return;
    }
    this.dispatch({ typ: 'NASTEPNA_RUNDA' });
    this.wybierzPytanie(nastepny);
  }

  nowaGra() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;

    // Re-shuffle pytań przy nowej grze
    if (this.pytania.length > 0) {
      this.pytania = losujPytania(this.pytania);
    }

    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this._wyslijStan();
    this.sync.wyslijKomende('RESET_PLANSZY', {});

    // Wróć do wyboru zestawu
    this.aktywnyZestawIdx = -1;
    this._render();
  }

  cofnij() {
    const nowy = this.historia.undo(this.stan);
    if (nowy) {
      this.stan = nowy;
      this._render();
      this._wyslijStan();
      this._zapiszLocal();
    }
  }

  przywroc() {
    const nowy = this.historia.redo(this.stan);
    if (nowy) {
      this.stan = nowy;
      this._render();
      this._wyslijStan();
      this._zapiszLocal();
    }
  }

  przejecieAkcja() {
    const [d1, d2] = this.stan.druzyny;
    const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;
    // Jeden zapis historii, jeden dispatch — odsłoń wszystko + bank
    this.historia.zapisz(this.stan);
    const nowyStan = { ...this.stan };
    nowyStan.odpowiedzi = this.stan.odpowiedzi.map(o => ({ ...o, odslonieta: true }));
    // Policz bank z nowo odsłoniętych
    const dodatkowe = this.stan.odpowiedzi.filter(o => !o.odslonieta).reduce((s, o) => s + (o.punkty || 0) * (nowyStan.mnoznikRundy || 1), 0);
    nowyStan.bank = this.stan.bank + dodatkowe;
    nowyStan.fazaGry = STAN_GRY.KONIEC_RUNDY;
    // Daj bank drużynie przejmującej
    nowyStan.druzyny = nowyStan.druzyny.map(d =>
      d.id === przejmujaca.id ? { ...d, suma: d.suma + nowyStan.bank } : d
    );
    nowyStan.bank = 0;
    this.stan = nowyStan;
    this._render();
    this._wyslijStan();
    this._zapiszLocal();
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.poprawna);
  }

  obronaAkcja() {
    // Pudło w przejęciu → bank dla drużyny broniącej (kontrola)
    this.historia.zapisz(this.stan);
    const nowyStan = { ...this.stan, fazaGry: STAN_GRY.KONIEC_RUNDY };
    const broniaca = this.stan.druzyny.find(d => d.id === this.stan.kontrola) || this.stan.druzyny[0];
    nowyStan.druzyny = nowyStan.druzyny.map(d =>
      d.id === broniaca.id ? { ...d, suma: d.suma + this.stan.bank } : d
    );
    nowyStan.bank = 0;
    this.stan = nowyStan;
    this.przejecieOdpowiedz = null;
    this._render();
    this._wyslijStan();
    this._zapiszLocal();
  }

  przejecieTrafiona() {
    // Drużyna przejmująca trafiła — odsłoń resztę odpowiedzi + bank
    const [d1, d2] = this.stan.druzyny;
    const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;
    this.historia.zapisz(this.stan);
    const nowyStan = { ...this.stan };
    nowyStan.odpowiedzi = this.stan.odpowiedzi.map(o => ({ ...o, odslonieta: true }));
    const dodatkowe = this.stan.odpowiedzi.filter(o => !o.odslonieta).reduce((s, o) => s + (o.punkty || 0) * (nowyStan.mnoznikRundy || 1), 0);
    nowyStan.bank = this.stan.bank + dodatkowe;
    nowyStan.fazaGry = STAN_GRY.KONIEC_RUNDY;
    nowyStan.druzyny = nowyStan.druzyny.map(d =>
      d.id === przejmujaca.id ? { ...d, suma: d.suma + nowyStan.bank } : d
    );
    nowyStan.bank = 0;
    this.stan = nowyStan;
    this.przejecieOdpowiedz = null;
    this._render();
    this._wyslijStan();
    this._zapiszLocal();
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.poprawna);
  }

  zmienZestaw() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;
    this.aktywnyZestawIdx = -1;
    this.pytania = [];
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this._wyslijStan();
    this.sync.wyslijKomende('RESET_PLANSZY', {});
    document.getElementById('wybor-zestawu').value = '';
    this._render();
  }

  // ============================================================
  //  RENDER
  // ============================================================

  _render() {
    this._renderCoTeraz();
    this._renderStatus();
    this._renderMainArea();
    this._renderFooter();
    this._renderSettings();
    this.debug._render?.();
  }

  _renderCoTeraz() {
    const el = document.getElementById('coteraz-text');
    const elIkona = document.getElementById('coteraz-icon');
    const elSub = document.getElementById('coteraz-sub');

    if (!this.transport?.polaczony) {
      el.textContent = 'Podłącz hosta ESP32 przez USB aby rozpocząć';
      elIkona.textContent = '🔌';
      elSub.textContent = '';
      return;
    }
    if (!this.stan?.pytanieTekst) {
      el.textContent = 'Wybierz zestaw pytań, aby rozpocząć grę';
      elIkona.textContent = '📋';
      elSub.textContent = '';
      return;
    }

    let txt = '', ikona = '🎯';
    const armed = this.stan.stanBuzzera === STAN_BUZZERA.ARMED;
    const faza = this.stan.fazaGry;
    const d1 = this.stan.druzyny[0];
    const d2 = this.stan.druzyny[1];

    switch (faza) {
      case STAN_GRY.IDLE:
        txt = 'Przeczytaj pytanie i kliknij UZBRÓJ';
        ikona = '📖';
        break;

      case STAN_GRY.POJEDYNEK:
        if (armed) {
          txt = 'Buzzery uzbrojone — czekam na buzz...';
          ikona = '⏳';
        }
        break;

      case STAN_GRY.GRA: {
        const ktoGra = this.stan.druzyny.find(d => d.id === this.stan.kontrola) || d1;
        if (czyWszystkoOdslonięte(this.stan)) {
          txt = 'Wszystko odsłonięte! Przydziel bank';
          ikona = '💰';
        } else if (ktoGra) {
          txt = `Gra: ${ktoGra.nazwa}`;
          ikona = '🎮';
        }
        break;
      }

      case STAN_GRY.PRZEJECIE: {
        const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;
        txt = `PRZEJĘCIE — ${przejmujaca?.nazwa} zgaduje`;
        ikona = '🤑';
        break;
      }

      case STAN_GRY.KONIEC_RUNDY:
        txt = this.stan.bank > 0 ? 'Przydziel bank zwycięzcy rundy' : 'Następna runda';
        ikona = '💰';
        break;

      case STAN_GRY.KONIEC_GRY:
        txt = 'Koniec gry!';
        ikona = '🏆';
        break;
    }
    el.textContent = txt;
    elIkona.textContent = ikona;
    elSub.textContent = ''; // podtekst idzie do action zone
  }

  _renderStatus() {
    const dot = document.getElementById('conn-dot');
    const txt = document.getElementById('conn-text');
    if (this.transport?.polaczony) {
      dot.textContent = '🟢'; txt.textContent = 'Host połączony (USB)';
    } else {
      dot.textContent = '🔴'; txt.textContent = 'Nie połączono';
    }
    document.getElementById('buzzer-state').textContent = this.stan?.stanBuzzera || 'LOCKED';
    document.getElementById('buzzer-who').textContent = this.stan?.ktoBuzznal ? ` → D${this.stan.ktoBuzznal}` : '';
    document.getElementById('round-num').textContent = (this.stan?.runda ?? 0) + 1;
    document.getElementById('mnoznik-num').textContent = this.stan?.mnoznikRundy ?? 1;
  }

  _renderMainArea() {
    const connected = this.transport?.polaczony;
    const maPytanie = !!this.stan?.pytanieTekst;

    // Krok 1: Połącz
    if (!connected) {
      document.getElementById('wizard-connect').style.display = '';
      document.getElementById('wizard-choose').style.display = 'none';
      document.getElementById('wizard-game').style.display = 'none';
      return;
    }

    // Krok 2: Wybierz zestaw
    if (!maPytanie) {
      document.getElementById('wizard-connect').style.display = 'none';
      document.getElementById('wizard-choose').style.display = '';
      document.getElementById('wizard-game').style.display = 'none';
      return;
    }

    // Krok 3: Gra
    document.getElementById('wizard-connect').style.display = 'none';
    document.getElementById('wizard-choose').style.display = 'none';
    document.getElementById('wizard-game').style.display = '';

    document.getElementById('question-text').textContent = this.stan.pytanieTekst;
    document.getElementById('question-set-name').textContent = this.pytania.length
      ? `Pytanie ${this.biezacePytanieIdx + 1} / ${this.pytania.length}`
      : '';
    this._renderAnswers();
    this._renderInfoBar();
    this._renderActionZone();
  }

  _renderAnswers() {
    const el = document.getElementById('answers-list');
    if (!this.stan?.odpowiedzi?.length) {
      el.innerHTML = '<div class="puste-info">Brak odpowiedzi</div>';
      return;
    }

    // Czy można klikać odpowiedzi?
    const faza = this.stan.fazaGry;
    const buzzed = this.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
    const canClick = (faza === STAN_GRY.GRA && buzzed) || faza === STAN_GRY.PRZEJECIE;

    el.innerHTML = this.stan.odpowiedzi.map((o, i) => {
      const cls = o.odslonieta ? 'odslonieta' : (canClick ? 'klikalna' : 'zablokowana');
      const akcja = o.odslonieta ? '✓ na planszy' : (canClick ? '📁 odsłoń' : '🔒');
      return `
        <div class="odpowiedz-wiersz ${cls}" data-id="${o.id}">
          <div class="odpowiedz-numer">${i + 1}</div>
          <div class="odpowiedz-tekst">${o.tekst}</div>
          <div class="odpowiedz-punkty">${o.punkty} pkt</div>
          <div class="odpowiedz-akcja">${akcja}</div>
        </div>`;
    }).join('');

    if (canClick) {
      el.querySelectorAll('.odpowiedz-wiersz:not(.odslonieta)').forEach(w => {
        w.addEventListener('click', () => {
          const id = parseInt(w.dataset.id, 10);
          this._klikOdpowiedz(id);
        });
      });
    }
  }

  _klikOdpowiedz(id) {
    const faza = this.stan.fazaGry;

    // ===== PRZEJĘCIE — krok po kroku =====
    if (faza === STAN_GRY.PRZEJECIE) {
      if (this.przejecieOdpowiedz !== null) return;
      this.przejecieOdpowiedz = id;
      this.odslonOdpowiedz(id);
      this._render();
      return;
    }

    // ===== POJEDYNEK (face-off) =====
    if (this.pojedynek) {
      this.odslonOdpowiedz(id);
      const odp = this.stan.odpowiedzi[id];
      const najwyzsza = Math.max(...this.stan.odpowiedzi.map(o => o.punkty));
      const pierwszyBuzz = this.pojedynek.pierwszyBuzz; // 1 lub 2
      const drugiBuzz = pierwszyBuzz === 1 ? 2 : 1;

      if (this.pojedynek.tura === 1) {
        // Pierwsza drużyna odpowiedziała
        this.pojedynek.d1 = { druzyna: pierwszyBuzz, punkty: odp.punkty };
        if (odp.punkty >= najwyzsza) {
          // Najwyższa — wygrywa pojedynek
          this.pojedynek = null;
          // kontrola już ustawiona przez BUZZ na pierwszą
        } else {
          // Nie najwyższa — druga drużyna odpowiada
          this.pojedynek.tura = 2;
        }
      } else if (this.pojedynek.tura === 2) {
        // Druga drużyna odpowiedziała — porównaj punkty
        this.pojedynek.d2 = { druzyna: drugiBuzz, punkty: odp.punkty };
        const d1punkty = this.pojedynek.d1?.punkty ?? -1;  // -1 = spudłowała
        const d2punkty = this.pojedynek.d2.punkty;

        let wygrana;
        if (d2punkty > d1punkty) {
          // Druga drużyna wygrywa — przejmij kontrolę
          wygrana = drugiBuzz;
        } else {
          // Pierwsza wygrywa (remis = pierwszy wygrywa, bo buzznął pierwszy)
          wygrana = pierwszyBuzz;
        }
        this.pojedynek = null;
        // Ustaw kontrolę na zwycięzcę pojedynku
        this.dispatch({ typ: 'PRZEKAZ_KONTROLE', druzynaId: this.stan.druzyny[wygrana - 1].id });
      }
      this._render();
      return;
    }

    // ===== NORMALNA GRA =====
    this.odslonOdpowiedz(id);
  }

  _renderInfoBar() {
    document.getElementById('bank-value').textContent = this.stan?.bank ?? 0;
    const elIksy = document.getElementById('info-iksy');
    const n = this.stan?.iksy.length ?? 0;
    let html = '';
    for (let i = 0; i < 3; i++) {
      html += `<span class="iks-symbol ${i < n ? '' : 'empty'}">✕</span>`;
    }
    elIksy.innerHTML = html;
  }

  _renderActionZone() {
    const el = document.getElementById('action-zone');
    if (!this.stan) { el.innerHTML = ''; return; }

    const faza = this.stan.fazaGry;
    const maPytanie = !!this.stan.pytanieTekst;
    if (!maPytanie) { el.innerHTML = ''; return; }

    const armed = this.stan.stanBuzzera === STAN_BUZZERA.ARMED;
    const buzzed = this.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
    const iksy = this.stan.iksy.length;
    const allRevealed = czyWszystkoOdslonięte(this.stan);
    const d1 = this.stan.druzyny[0];
    const d2 = this.stan.druzyny[1];

    // Helper: podtekst wyjaśniający (mały szary tekst nad guzikami)
    const sub = (txt) => `<div class="action-sub">${txt}</div>`;

    // ===== KONIEC GRY =====
    if (faza === STAN_GRY.KONIEC_GRY) {
      el.innerHTML = `<div class="action-msg">🏆 Gra zakończona!</div>`;
      return;
    }

    // ===== KONIEC RUNDY =====
    if (faza === STAN_GRY.KONIEC_RUNDY || allRevealed) {
      const bankRozdany = this.stan.bank === 0;
      if (!bankRozdany) {
        el.innerHTML = `
          ${sub('Punkty z banku przejdą na konto drużyny która wygrała rundę.')}
          <div class="action-row">
            <button class="btn-big btn-bank-big" id="az-bank-d1">
              <span>${d1?.nazwa || 'D1'}</span>
              <span class="btn-sub">← ${this.stan.bank} pkt</span>
            </button>
            <button class="btn-big btn-bank-big" id="az-bank-d2">
              <span>${d2?.nazwa || 'D2'}</span>
              <span class="btn-sub">← ${this.stan.bank} pkt</span>
            </button>
          </div>`;
        document.getElementById('az-bank-d1').onclick = () => this.bankDlaDruzyny(d1.id);
        document.getElementById('az-bank-d2').onclick = () => this.bankDlaDruzyny(d2.id);
      } else {
        el.innerHTML = `
          <div class="action-msg">Bank rozdany ✓</div>
          <button class="btn-big btn-next-round" id="az-next-round">Następna runda →</button>`;
        document.getElementById('az-next-round').onclick = () => this.nastepnaRunda();
      }
      return;
    }

    // ===== PRZEJĘCIE =====
    if (faza === STAN_GRY.PRZEJECIE) {
      const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;
      const broniaca = this.stan.kontrola === d1?.id ? d1 : d2;

      if (this.przejecieOdpowiedz === null) {
        el.innerHTML = `
          ${sub(`${przejmujaca?.nazwa} podaje jedną odpowiedź. Kliknij ją powyżej jeśli trafiona. Pudło → bank dla ${broniaca?.nazwa}.`)}
          <div class="action-row">
            <button class="btn-big btn-bank-big" id="az-obrona">
              ✕ ${przejmujaca?.nazwa} spudłowała → Bank dla ${broniaca?.nazwa}
            </button>
          </div>`;
        document.getElementById('az-obrona').onclick = () => this.obronaAkcja();
      } else {
        el.innerHTML = `
          <div class="action-msg" style="color: var(--kolor-akcent);">✅ ${przejmujaca?.nazwa} trafia! Przejmuje bank!</div>
          ${sub('Odsłonimy pozostałe odpowiedzi na planszy.')}
          <button class="btn-big btn-next-round" id="az-pokaz-reszte">
            Pokaż pozostałe odpowiedzi →
          </button>`;
        document.getElementById('az-pokaz-reszte').onclick = () => this.przejecieTrafiona();
      }
      return;
    }

    // ===== ARMED (czeka na buzz) =====
    if (armed) {
      el.innerHTML = `
        ${sub('Po jednej osobie z drużyny przy buzzerach. Kto pierwszy wciśnie — ten odpowiada pierwszy.')}
        <button class="btn-big btn-reset-big" id="az-reset">↻ RESET buzzera</button>`;
      document.getElementById('az-reset').onclick = () => this.resetBuzzer();
      return;
    }

    // ===== GRA / BUZZED =====
    if (buzzed || faza === STAN_GRY.GRA) {
      const iksDisabled = iksy >= 3;

      // --- Pojedynek (face-off) ---
      if (this.pojedynek) {
        const pierwszyBuzz = this.pojedynek.pierwszyBuzz;
        const aktualnaDruzyna = this.pojedynek.tura === 1
          ? pierwszyBuzz
          : (pierwszyBuzz === 1 ? 2 : 1);
        const d = this.stan.druzyny[aktualnaDruzyna - 1];

        let subTxt = '';
        if (this.pojedynek.tura === 1) {
          subTxt = `Kliknij odpowiedź którą podała ${d?.nazwa}. Jeśli to #1 — ${d?.nazwa} wygrywa pojedynek. Jeśli nie — przeciwnik odpowiada.`;
        } else {
          const pierwszyD = this.stan.druzyny[pierwszyBuzz - 1];
          if (this.pojedynek.d1) {
            subTxt = `${pierwszyD?.nazwa}: ${this.pojedynek.d1.punkty} pkt. Kliknij odpowiedź ${d?.nazwa}. Kto ma więcej — ten gra dalej.`;
          } else {
            subTxt = `${pierwszyD?.nazwa} spudłowała. Kliknij odpowiedź ${d?.nazwa} — jeśli trafi, gra dalej.`;
          }
        }

        el.innerHTML = `
          ${sub(subTxt)}
          <div class="action-row">
            <button class="btn-big btn-iks" id="az-iks">
              ✕ ${d?.nazwa} spudłowała
            </button>
          </div>`;
        document.getElementById('az-iks').onclick = () => this.dodajIks();
        return;
      }

      // --- Normalna gra (po pojedynku) ---
      const ktoGra = this.stan.druzyny.find(d => d.id === this.stan.kontrola) || d1;
      const pozostale = this.stan.odpowiedzi.filter(o => !o.odslonieta).length;
      el.innerHTML = `
          ${sub(`${ktoGra?.nazwa} zgaduje. Pozostało ${pozostałe} odpowiedzi. ${iksy}/3 IKS — po 3 przejęcie.`)}
          <div class="action-row">
            <button class="btn-big btn-iks" id="az-iks" ${iksDisabled ? 'disabled' : ''}>
              ✕ IKS (${iksy}/3)
            </button>
          </div>`;
      document.getElementById('az-iks').onclick = () => this.dodajIks();
      return;
    }

    // ===== IDLE z pytaniem — UZBRÓJ =====
    el.innerHTML = `
      ${sub('Odpowiedzi są ukryte na planszy. Po uzbrojeniu drużyny będą buzować.')}
      <button class="btn-big btn-uzbroj" id="az-uzbroj">⚔ UZBRÓJ</button>`;
    document.getElementById('az-uzbroj').onclick = () => this.uzbroj();
  }

  _renderFooter() {
    const d1 = this.stan?.druzyny?.[0];
    const d2 = this.stan?.druzyny?.[1];

    const elD1Nazwa = document.getElementById('input-d1-nazwa');
    const elD2Nazwa = document.getElementById('input-d2-nazwa');
    if (elD1Nazwa && elD1Nazwa.value === '' && d1) elD1Nazwa.value = d1.nazwa;
    if (elD2Nazwa && elD2Nazwa.value === '' && d2) elD2Nazwa.value = d2.nazwa;

    document.getElementById('suma-d1').textContent = d1?.suma ?? 0;
    document.getElementById('suma-d2').textContent = d2?.suma ?? 0;
    document.getElementById('btn-cofnij').disabled = !this.historia.canUndo();

    const btnNextRound = document.getElementById('btn-nastepna-runda');
    btnNextRound.style.display = (this.stan?.fazaGry === STAN_GRY.KONIEC_RUNDY) ? 'inline-block' : 'none';
  }

  _renderSettings() {
    document.querySelectorAll('.mnoznik-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.m, 10) === (this.stan?.mnoznikRundy ?? 1));
    });
    const btnPrzywroc = document.getElementById('btn-przywroc');
    if (btnPrzywroc) btnPrzywroc.disabled = !this.historia.canRedo();
    const btnIksCofnij = document.getElementById('btn-iks-cofnij');
    if (btnIksCofnij) btnIksCofnij.disabled = (this.stan?.iksy.length ?? 0) === 0;
  }

  // ===== Wypełnianie opcji =====
  _wypelnijProfile(profile, aktywny) {
    const sel = document.getElementById('wybor-profilu');
    if (!sel) return;
    sel.innerHTML = profile.map(p =>
      `<option value="${p.plik}" ${p.plik === aktywny ? 'selected' : ''}>${p.nazwa}</option>`
    ).join('');
  }

  _wypelnijZestawy(zestawy) {
    this.zestawy = zestawy;
    const sel = document.getElementById('wybor-zestawu');
    if (sel) {
      sel.innerHTML = '<option value="">— wybierz zestaw —</option>' +
        zestawy.map((z, i) => `<option value="${i}">${z.nazwa}</option>`).join('');
    }
  }

  // ===== Podłączanie UI =====
  _podlaczUI() {
    const $ = (id) => document.getElementById(id);

    // Wizard — połącz
    $('btn-wizard-connect').onclick = () => this.polacz();

    // Wizard — start
    $('btn-wizard-start').onclick = () => {
      const sel = $('wybor-zestawu');
      const idx = parseInt(sel.value, 10);
      if (isNaN(idx)) return;
      this.wybierzZestaw(idx);
    };

    // Wizard — zmień zestaw
    $('link-change-set').onclick = () => this.zmienZestaw();

    // Profil
    $('wybor-profilu').onchange = (e) => {
      location.href = `panel.html?profil=${e.target.value}`;
    };

    // Mnożnik
    document.querySelectorAll('.mnoznik-btn').forEach(btn => {
      btn.onclick = () => this.dispatch({ typ: 'USTAW_MNOZNIK', mnoznik: parseInt(btn.dataset.m, 10) });
    });

    // Footer
    $('btn-cofnij').onclick = () => this.cofnij();
    $('btn-nastepna-runda').onclick = () => this.nastepnaRunda();

    // Settings overlay
    $('btn-settings').onclick = () => $('overlay-settings').style.display = 'flex';
    $('btn-close-settings').onclick = () => $('overlay-settings').style.display = 'none';

    // Debug
    $('btn-debug-toggle').onclick = () => this.debug.toggle();

    // Pomoc
    $('btn-pomoc').onclick = () => $('overlay-pomoc').style.display = 'flex';
    $('btn-close-pomoc').onclick = () => $('overlay-pomoc').style.display = 'none';

    // Nowa gra / koniec
    $('btn-nowa-gra').onclick = () => this.nowaGra();
    $('btn-zakoncz').onclick = () => this.dispatch({ typ: 'ZAKONCZ_GRE' });

    // Plansza
    $('btn-otworz-plansze').onclick = () => {
      window.open('plansza.html', 'plansza', 'width=1920,height=1080');
      this._wyslijStan();
    };

    // Przywróć
    $('btn-przywroc').onclick = () => this.przywroc();

    // Buzz symulacja
    $('btn-buzz1').onclick = () => this._buzz(1);
    $('btn-buzz2').onclick = () => this._buzz(2);

    // Iks cofnij
    $('btn-iks-cofnij').onclick = () => this.cofnijIks();

    // Drużyny — edycja nazw
    $('input-d1-nazwa').onchange = (e) => {
      const d = this.stan.druzyny[0];
      this.dispatch({ typ: 'ZMIEN_DRUZYNE', druzynaId: d.id, nazwa: e.target.value });
    };
    $('input-d2-nazwa').onchange = (e) => {
      const d = this.stan.druzyny[1];
      this.dispatch({ typ: 'ZMIEN_DRUZYNE', druzynaId: d.id, nazwa: e.target.value });
    };

    // Drużyny — punkty ręcznie
    $('btn-d1-dodaj').onclick = () => {
      const v = parseInt($('input-d1-punkty').value, 10);
      if (!isNaN(v)) {
        this.dispatch({ typ: 'DODAJ_PUNKTY', druzynaId: this.stan.druzyny[0].id, punkty: v });
        $('input-d1-punkty').value = '';
      }
    };
    $('btn-d2-dodaj').onclick = () => {
      const v = parseInt($('input-d2-punkty').value, 10);
      if (!isNaN(v)) {
        this.dispatch({ typ: 'DODAJ_PUNKTY', druzynaId: this.stan.druzyny[1].id, punkty: v });
        $('input-d2-punkty').value = '';
      }
    };

    // Audio
    $('audio-wlaczone').onchange = (e) => {
      ustawWlaczone(e.target.checked);
      this.konfiguracja.audio.wlaczone = e.target.checked;
    };
    $('audio-glosnosc').oninput = (e) => {
      const v = parseFloat(e.target.value);
      ustawGlosnosc(v);
      $('audio-glosnosc-wartosc').textContent = Math.round(v * 100) + '%';
      this.konfiguracja.audio.glosnosc = v;
    };

    // Check Web Serial support
    if (!('serial' in navigator)) {
      $('warn-no-serial').style.display = '';
    }

    // === Klawisze ===
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const klucz = e.code;

      if (klucz === 'F1') { e.preventDefault(); $('overlay-pomoc').style.display = 'flex'; return; }
      if (klucz === 'F9') { e.preventDefault(); this.debug.toggle(); return; }
      if (klucz === 'F2') { e.preventDefault(); if (this.transport?.polaczony) this._buzz(1); return; }
      if (klucz === 'F3') { e.preventDefault(); if (this.transport?.polaczony) this._buzz(2); return; }

      if (e.ctrlKey && klucz === 'KeyZ') { e.preventDefault(); this.cofnij(); return; }
      if (e.ctrlKey && (klucz === 'KeyY' || (e.shiftKey && klucz === 'KeyZ'))) { e.preventDefault(); this.przywroc(); return; }

      // Nie blokuj skrótów przeglądarki (Ctrl+R, Ctrl+F5, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Poniższe tylko gdy jesteśmy w grze
      if (!this.transport?.polaczony || !this.stan?.pytanieTekst) return;

      if (klucz === 'Space') { e.preventDefault(); this.uzbroj(); return; }
      if (klucz === 'KeyR') { e.preventDefault(); this.resetBuzzer(); return; }
      if (klucz === 'KeyX') { e.preventDefault(); this.dodajIks(); return; }

      if (klucz.startsWith('Digit')) {
        const n = parseInt(klucz.replace('Digit', ''), 10);
        if (n >= 1 && n <= 8 && this.stan?.odpowiedzi?.[n - 1]) {
          const faza = this.stan.fazaGry;
          const buzzed = this.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
          const canClick = (faza === STAN_GRY.GRA && buzzed) || faza === STAN_GRY.PRZEJECIE;
          if (!canClick) return;
          e.preventDefault();
          const o = this.stan.odpowiedzi[n - 1];
          if (!o.odslonieta) this._klikOdpowiedz(n - 1);
          return;
        }
      }

      if (klucz === 'KeyQ') { e.preventDefault(); if (this.stan?.druzyny?.[0]) this.bankDlaDruzyny(this.stan.druzyny[0].id); return; }
      if (klucz === 'KeyW') { e.preventDefault(); if (this.stan?.druzyny?.[1]) this.bankDlaDruzyny(this.stan.druzyny[1].id); return; }

      if (klucz === 'Escape') {
        document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
        return;
      }
    });

    // Odblokuj audio
    document.addEventListener('click', () => odblokujAudio(), { once: true });
  }

  dajStan() { return this.stan; }
}

// === Start ===
window.addEventListener('DOMContentLoaded', () => {
  window.panel = new Panel();

  window.__debugBuzz = (n) => window.panel._buzz(n);
  window.__debugForceState = (faza) => window.panel.dispatch({ typ: 'ZMIEN_FAZE', faza });
  window.__debugDisconnect = () => {
    window.panel.debug.log('SYMULACJA AWARII: rozłączenie');
    if (window.panel.transport?.tryb === 'webserial') {
      window.panel.transport.rozlacz();
      window.panel.transport = null;
      window.panel._render();
    }
  };
  window.__debugDemo = () => {
    const p = window.panel;
    if (!p.pytania.length) return;
    if (p.biezacePytanieIdx < 0) p.wybierzPytanie(0);
    setTimeout(() => p.uzbroj(), 500);
    setTimeout(() => p._buzz(1), 1500);
    setTimeout(() => {
      p.stan.odpowiedzi.forEach((o, i) => {
        if (i < 2) setTimeout(() => p.odslonOdpowiedz(o.id), i * 800);
      });
    }, 2000);
  };
});
