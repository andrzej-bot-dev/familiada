// ===== panel.js — Panel prowadzącego (cienki orkiestrator) =====
// Łączy Flow (logika gry), PanelUI (renderowanie) i transport (USB).
// Wszystkie akcje gry przechodzą przez Flow → Panel je wykonuje.
// UI tylko renderuje stan — nie zawiera logiki.

import { STAN_GRY, STAN_BUZZERA, nowaGra, reducer } from './stan.js';
import { Historia } from './historia.js';
import { Sync } from './sync.js';
import { wczytajProfil, listaProfili, DOMYSLNY_PROFIL } from './konfiguracja.js';
import { wczytajZestaw, wczytajIndeks, dajPytania, losujPytania } from './pytania.js';
import { czyPrzejecie, czyWszystkoOdslonięte } from './zasady.js';
import { WebSerialTransport } from './transport/webserial.js';
import { graj, ustawGlosnosc, ustawWlaczone, odblokujAudio, preload } from './audio.js';
import { Debug } from './debug.js';
import { mnoznikDlaRundy, czyWszystkoOdslonięte } from './zasady.js';
import { Flow } from './flow.js';
import { PanelUI } from './panel-ui.js';

class Panel {
  constructor() {
    this.stan = null;
    this.konfiguracja = DOMYSLNY_PROFIL;
    this.historia = new Historia();
    this.sync = new Sync();
    this.transport = null;
    this.zestawy = [];
    this.pytania = [];
    this.biezacePytanieIdx = -1;
    this.aktywnyZestawIdx = -1;

    // Nowe: Flow (logika gry) i PanelUI (renderowanie)
    this.flow = new Flow();
    this.ui = new PanelUI(this);
    this.debug = new Debug(this);

    this._init();
  }

  async _init() {
    const profilNazwa = new URLSearchParams(location.search).get('profil') || 'domyslny';
    this.konfiguracja = await wczytajProfil(profilNazwa);

    const profile = await listaProfili();
    this.ui.wypelnijProfile(profile, profilNazwa);

    const indeksZestawow = await wczytajIndeks();
    this.zestawy = indeksZestawow;
    this.ui.wypelnijZestawy(indeksZestawow);

    this.stan = nowaGra(this.konfiguracja);

    this.sync.on((msg) => {
      if (msg.typ === 'ZADANIE_STANU' && this.stan) this._wyslijStan();
    });

    preload(this.konfiguracja.audio?.mapowanie);
    this.ui.wireEvents();
    this.ui.render();

    // Keyboard shortcuts
    this._wireKeyboard();

    // USB disconnect handler
    if ('serial' in navigator) {
      navigator.serial.addEventListener('disconnect', (e) => {
        if (this.transport?.port === e.target) {
          console.warn('[USB] Host odłączony!');
          this.debug.log('USB DISCONNECT!');
          this.transport.polaczony = false;
          this.transport = null;
          this.ui.render();
          alert('Połączenie USB zostało przerwane! Podłącz hosta ponownie i kliknij Połącz.');
        }
      });
    }
  }

  // ===================================================================
  // POŁĄCZENIE USB
  // ===================================================================
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
      t.onBuzz((d) => this.buzz(d));
      this.ui.render();
      this._sprobujWznow();
    } catch (e) {
      alert(`Nie udało się połączyć: ${e.message}`);
    }
  }

  // ===================================================================
  // WYBÓR ZESTAWU → losowa kolejność → pierwsze pytanie
  // ===================================================================
  async wybierzZestaw(idx) {
    const zestaw = this.zestawy[idx];
    if (!zestaw) return;
    this.aktywnyZestawIdx = idx;
    await wczytajZestaw(zestaw.plik);
    this.pytania = losujPytania(dajPytania());
    this.biezacePytanieIdx = -1;

    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this._wyslijStan();
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this.wybierzPytanie(0);
    this.ui.render();
  }

  // ===================================================================
  // DISPATCH — akcja na stanie (przez reducer)
  // ===================================================================
  dispatch(akcja) {
    if (!this.stan) return;
    if (akcja.typ !== 'OVERRIDE' && akcja.typ !== 'WCZYTAJ_STAN') {
      this.historia.zapisz(this.stan);
    }
    this.stan = reducer(this.stan, akcja);
    this.ui.render();
    if (!this._batchSync) {
      this._wyslijStan();
      this._zapiszLocal();
    }

    // Auto-detekcja: po odsłonięciu sprawdź czy wszystko odsłonięte
    if (akcja.typ === 'ODSLON_ODPOWIEDZ') {
      const autoKoniec = this.flow.sprawdzAutoKoniecRundy(this.stan);
      if (autoKoniec.length > 0) {
        setTimeout(() => {
          if (this.stan.fazaGry !== STAN_GRY.KONIEC_RUNDY && this.stan.fazaGry !== STAN_GRY.KONIEC_GRY) {
            this.dispatch(autoKoniec[0]);
          }
        }, 300);
      }
    }
  }

  // ===================================================================
  // WYKONAJ WYNIK Z FLOW — stosuje dispatche, audio, transport
  // ===================================================================
  _wykonaj(result) {
    if (!result) return;

    // Batch sync — nie wysyłaj stanu do planszy przy każdym dispatch
    if (result.dispatches?.length > 1) {
      this._batchSync = true;
    }

    // Dispatche
    if (result.dispatches?.length) {
      for (const akcja of result.dispatches) {
        this.dispatch(akcja);
      }
    }

    // Flush batch — wyślij stan raz po wszystkich dispatchach
    if (this._batchSync) {
      this._batchSync = false;
      this._wyslijStan();
      this._zapiszLocal();
    }

    // Bezpośrednia zmiana stanu (przejecieTrafiona, przejeciePudlo)
    if (result.newStan) {
      this.historia.zapisz(this.stan);
      this.stan = result.newStan;
      this.ui.render();
      this._wyslijStan();
      this._zapiszLocal();
    }

    // Transport
    if (result.transport && this.transport?.polaczony) {
      this.transport.wyslij(result.transport);
    }

    // Audio
    if (result.audio) {
      const audioMap = this.konfiguracja.audio?.mapowanie || {};
      graj(audioMap[result.audio] || result.audio);
    }

    // Debug log
    if (result.log) {
      this.debug.log(result.log);
    }

    // Dodatkowy render jeśli potrzebny
    if (result.needsRender) {
      this.ui.render();
    }

    // Auto-transition po IKS (3 IKS → przejęcie)
    if (result.autoTransition) {
      setTimeout(() => {
        const przejecie = this.flow.sprawdzAutoPrzejecie(this.stan);
        if (przejecie) {
          if (przejecie.audio) {
            const audioMap = this.konfiguracja.audio?.mapowanie || {};
            graj(audioMap[przejecie.audio] || przejecie.audio);
          }
          for (const akcja of przejecie.dispatches) {
            this.dispatch(akcja);
          }
        }
      }, 600);
    }

    // Koniec pytania → następna runda
    if (result.koniecGry) {
      // dispatch already handled ZAKONCZ_GRE
    }

    // Wybór następnego pytania
    if (result.nastepnyIndeks !== undefined) {
      this.wybierzPytanie(result.nastepnyIndeks);
    }

    // Reset wszystkiego
    if (result.resetAll) {
      this._resetGry();
    }
  }

  // ===================================================================
  // AKCJE GRY — delegują do Flow, potem wykonują wynik
  // ===================================================================

  uzbroj() {
    if (!this.stan?.pytanieTekst) return;
    const result = this.flow.uzbroj();
    if (result.transport && this.transport?.polaczony) {
      this.transport.wyslij(result.transport);
    }
    if (result.log) this.debug.log(result.log);
    for (const akcja of result.dispatches) {
      this.dispatch(akcja);
    }
  }

  buzz(druzyna) {
    if (!this.stan || this.stan.stanBuzzera !== STAN_BUZZERA.ARMED) return;
    const result = this.flow.buzz(druzyna);
    this._wykonaj(result);
  }

  resetBuzzer() {
    const result = this.flow.resetBuzzer();
    this._wykonaj(result);
  }

  klikOdpowiedz(id) {
    const result = this.flow.klikOdpowiedz(this.stan, id);
    if (result.blocked) return;
    this._wykonaj(result);
  }

  dodajIks() {
    const result = this.flow.dodajIks(this.stan);
    this._wykonaj(result);
  }

  cofnijIks() {
    const result = this.flow.cofnijIks(this.stan);
    this._wykonaj(result);
  }

  bankDlaDruzyny(druzynaId) {
    const result = this.flow.bankDlaDruzyny(this.stan, druzynaId);
    this._wykonaj(result);
  }

  przejecieTrafiona() {
    const result = this.flow.przejecieTrafiona(this.stan);
    this._wykonaj(result);
  }

  przejeciePudlo() {
    const result = this.flow.przejeciePudlo(this.stan);
    this._wykonaj(result);
  }

  nastepnaRunda() {
    const result = this.flow.nastepnaRunda(this.stan, this.biezacePytanieIdx, this.pytania.length);
    this._wykonaj(result);
  }

  nowaGra() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;

    if (this.pytania.length > 0) {
      this.pytania = losujPytania(this.pytania);
    }

    this.flow.reset();
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this._wyslijStan();
    this.sync.wyslijKomende('RESET_PLANSZY', {});
    this.aktywnyZestawIdx = -1;
    this.ui.render();
  }

  zmienZestaw() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;
    this.aktywnyZestawIdx = -1;
    this.pytania = [];
    this.flow.reset();
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this._wyslijStan();
    this.sync.wyslijKomende('RESET_PLANSZY', {});
    document.getElementById('wybor-zestawu').value = '';
    this.ui.render();
  }

  wybierzPytanie(idx) {
    if (idx < 0 || idx >= this.pytania.length) return;
    this.biezacePytanieIdx = idx;
    const p = this.pytania[idx];
    if (!p) return;
    const rundIndex = this.stan.runda;
    const mnoznik = mnoznikDlaRundy(this.konfiguracja, rundIndex);
    this.historia.zapisz(this.stan);
    this.stan = reducer(this.stan, { typ: 'WYBIERZ_PYTANIE', pytanie: p, runda: rundIndex, mnoznik });
    this.stan = reducer(this.stan, { typ: 'OZNACZ_PYTANIE_UZYTE', pytanieId: p.id });
    this.ui.render();
    this._wyslijStan();
    this._zapiszLocal();
  }

  cofnij() {
    // Blokuj undo podczas aktywnego pojedynku — flow.reset() zniszczyłby stan pojedynku
    if (this.flow?.pojedynek) {
      console.warn('Undo zablokowane podczas pojedynku');
      return;
    }
    const nowy = this.historia.undo(this.stan);
    if (nowy) {
      this.stan = nowy;
      this.flow.reset();
      // Re-fire auto-transitions jeśli undo przywróciło stan z 3 IKS
      if (this.stan.fazaGry === STAN_GRY.GRA && czyPrzejecie(this.stan)) {
        this.stan = reducer(this.stan, { typ: 'ZMIEN_FAZE', faza: STAN_GRY.PRZEJECIE });
      }
      this.ui.render();
      this._wyslijStan();
      this._zapiszLocal();
    }
  }

  przywroc() {
    const nowy = this.historia.redo(this.stan);
    if (nowy) {
      this.stan = nowy;
      this.ui.render();
      this._wyslijStan();
      this._zapiszLocal();
    }
  }

  // ===================================================================
  // AUDIO
  // ===================================================================
  setAudioEnabled(v) {
    ustawWlaczone(v);
    this.konfiguracja.audio.wlaczone = v;
  }

  setAudioVolume(v) {
    ustawGlosnosc(v);
    document.getElementById('audio-glosnosc-wartosc').textContent = Math.round(v * 100) + '%';
    this.konfiguracja.audio.glosnosc = v;
  }

  odblokujAudio() {
    odblokujAudio();
  }

  // ===================================================================
  // WEWNĘTRZNE
  // ===================================================================

  _resetGry() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;
    if (this.pytania.length > 0) {
      this.pytania = losujPytania(this.pytania);
    }
    this.flow.reset();
    localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    this._wyslijStan();
    this.sync.wyslijKomende('RESET_PLANSZY', {});
    this.aktywnyZestawIdx = -1;
    this.ui.render();
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
        this.ui.render();
        this._wyslijStan();
        overlay.style.display = 'none';
      };
      document.getElementById('btn-nowa-zamiast').onclick = () => {
        localStorage.removeItem('familiada-stan');
        overlay.style.display = 'none';
      };
    } catch {}
  }

  // ===================================================================
  // KLAWIATURA
  // ===================================================================
  _wireKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const klucz = e.code;

      if (klucz === 'F1') { e.preventDefault(); document.getElementById('overlay-pomoc').style.display = 'flex'; return; }
      if (klucz === 'F9') { e.preventDefault(); this.debug.toggle(); return; }
      if (klucz === 'F2') { e.preventDefault(); if (this.transport?.polaczony) this.buzz(1); return; }
      if (klucz === 'F3') { e.preventDefault(); if (this.transport?.polaczony) this.buzz(2); return; }

      if (e.ctrlKey && klucz === 'KeyZ') { e.preventDefault(); this.cofnij(); return; }
      if (e.ctrlKey && (klucz === 'KeyY' || (e.shiftKey && klucz === 'KeyZ'))) { e.preventDefault(); this.przywroc(); return; }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (!this.transport?.polaczony || !this.stan?.pytanieTekst) return;

      if (klucz === 'Space') {
        e.preventDefault();
        // Space = UZBRÓJ tylko w IDLE
        if (this.stan.fazaGry === STAN_GRY.IDLE) this.uzbroj();
        return;
      }
      if (klucz === 'KeyR') {
        e.preventDefault();
        // RESET buzera tylko w IDLE lub ARMED — nie w trakcie gry
        if (this.stan.fazaGry === STAN_GRY.IDLE || this.stan.stanBuzzera === STAN_BUZZERA.ARMED) this.resetBuzzer();
        return;
      }
      if (klucz === 'KeyX') {
        e.preventDefault();
        // IKS tylko w GRA (po pojedynku) lub POJEDYNEK, max 3 w normalnej grze
        if (this.stan.iksy.length >= 3 && !this.flow?.pojedynek) return;
        if (this.stan.fazaGry === STAN_GRY.GRA || this.flow?.pojedynek) this.dodajIks();
        return;
      }
      if (klucz === 'KeyP') {
        e.preventDefault();
        // P = Pudło w przejęciu
        if (this.stan?.fazaGry === STAN_GRY.PRZEJECIE && !this.flow?.przejecieOdpowiedz) this.przejeciePudlo();
        return;
      }

      if (klucz.startsWith('Digit')) {
        const n = parseInt(klucz.replace('Digit', ''), 10);
        if (n >= 1 && n <= 8 && this.stan?.odpowiedzi?.[n - 1]) {
          const faza = this.stan.fazaGry;
          const buzzed = this.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
          const canClick = (faza === STAN_GRY.GRA && buzzed) || faza === STAN_GRY.PRZEJECIE;
          if (!canClick) return;
          e.preventDefault();
          const o = this.stan.odpowiedzi[n - 1];
          if (!o.odslonieta) this.klikOdpowiedz(n - 1);
          return;
        }
      }

      if (klucz === 'KeyQ') {
        e.preventDefault();
        // Bank w KONIEC_RUNDY lub gdy wszystkie odsłoniete (300ms okno przed auto-transition)
        if ((this.stan?.fazaGry === STAN_GRY.KONIEC_RUNDY || czyWszystkoOdslonięte(this.stan)) && this.stan?.druzyny?.[0]) this.bankDlaDruzyny(this.stan.druzyny[0].id);
        return;
      }
      if (klucz === 'KeyW') {
        e.preventDefault();
        if ((this.stan?.fazaGry === STAN_GRY.KONIEC_RUNDY || czyWszystkoOdslonięte(this.stan)) && this.stan?.druzyny?.[1]) this.bankDlaDruzyny(this.stan.druzyny[1].id);
        return;
      }

      if (klucz === 'Escape') {
        document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
        return;
      }
    });
  }

  dajStan() { return this.stan; }
}

// === Start ===
window.addEventListener('DOMContentLoaded', () => {
  window.panel = new Panel();

  window.__debugBuzz = (n) => window.panel.buzz(n);
  window.__debugForceState = (faza) => window.panel.dispatch({ typ: 'ZMIEN_FAZE', faza });
  window.__debugDisconnect = () => {
    window.panel.debug.log('SYMULACJA AWARII: rozłączenie');
    if (window.panel.transport?.tryb === 'webserial') {
      window.panel.transport.rozlacz();
      window.panel.transport = null;
      window.panel.ui.render();
    }
  };
  window.__debugDemo = () => {
    const p = window.panel;
    if (!p.pytania.length) return;
    if (p.biezacePytanieIdx < 0) p.wybierzPytanie(0);
    setTimeout(() => p.uzbroj(), 500);
    setTimeout(() => p.buzz(1), 1500);
    setTimeout(() => {
      p.stan.odpowiedzi.forEach((o, i) => {
        if (i < 2) setTimeout(() => {
          p.dispatch({ typ: 'ODSLON_ODPOWIEDZ', id: o.id });
          p.ui.render();
          p._wyslijStan();
          p._zapiszLocal();
        }, i * 800);
      });
    }, 2000);
  };
});
