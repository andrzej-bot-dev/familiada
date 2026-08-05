// ===== panel.js — Panel prowadzącego (mózg gry) =====

import { STAN_GRY, STAN_BUZZERA, nowaGra, reducer } from './stan.js';
import { Historia } from './historia.js';
import { Sync } from './sync.js';
import { wczytajProfil, listaProfili, DOMYSLNY_PROFIL, eksportujProfil } from './konfiguracja.js';
import { wczytajZestaw, wczytajIndeks, dajPytania, losujPytania } from './pytania.js';
import { MockTransport } from './transport/mock.js';
import { WebSerialTransport } from './transport/webserial.js';
import { graj, ustawGlosnosc, ustawWlaczone, odblokujAudio, preload } from './audio.js';
import { Debug } from './debug.js';
import { mnoznikDlaRundy, czyPrzejecie, czyWszystkoOdslonięte } from './zasady.js';

// === Główna klasa Panel ===
class Panel {
  constructor() {
    this.stan = null;
    this.konfiguracja = DOMYSLNY_PROFIL;
    this.historia = new Historia();
    this.sync = new Sync();
    this.transport = new MockTransport();
    this.zestawy = [];
    this.pytania = [];
    this.biezacePytanieIdx = -1;
    this.trybPrezentera = false;
    this.debug = new Debug(this);

    this._init();
  }

  async _init() {
    // Wczytaj konfigurację
    const profilNazwa = new URLSearchParams(location.search).get('profil') || 'domyslny';
    this.konfiguracja = await wczytajProfil(profilNazwa);

    // Wczytaj listę profili
    const profile = await listaProfili();
    this._wypelnijProfile(profile, profilNazwa);

    // Wczytaj zestawy pytań
    const indeksZestawow = await wczytajIndeks();
    this._wypelnijZestawy(indeksZestawow);

    // Załaduj pierwszy zestaw
    if (indeksZestawow.length > 0) {
      await wczytajZestaw(indeksZestawow[0].plik);
      this.pytania = dajPytania();
      this._wypelnijPytania();
    }

    // Stwórz nową grę
    this.stan = nowaGra(this.konfiguracja);

    // Spróbuj wznowić
    this._sprobujWznow();

    // Podłącz transport
    this.transport.onBuzz((druzyna) => this._buzz(druzyna));

    // Sync — odpowiadaj na żądanie stanu
    this.sync.on((msg) => {
      if (msg.typ === 'ZADANIE_STANU' && this.stan) {
        this._wyslijStan();
      }
    });

    // Preload audio
    preload(this.konfiguracja.audio?.mapowanie);

    // Eventy UI
    this._podlaczUI();

    // Render
    this._render();

    // Auto-otwórz planszę (opcjonalnie)
    // Nie otwieramy automatycznie — prowadzący klika "Otwórz planszę"
  }

  // === Dispatch (centrum akcji) ===
  dispatch(akcja) {
    if (!this.stan) return;

    // Zapisz historię (oprócz override i wczytaj)
    if (akcja.typ !== 'OVERRIDE' && akcja.typ !== 'WCZYTAJ_STAN') {
      this.historia.zapisz(this.stan);
    }

    this.stan = reducer(this.stan, akcja);
    this._render();
    this._wyslijStan();
    this._zapiszLocal();
  }

  // === Wysyłka stanu z dodatkowymi danymi ===
  _wyslijStan() {
    if (!this.stan) return;
    const stanDlaPlanszy = {
      ...this.stan,
      _konfiguracjaTytul: this.konfiguracja.wydarzenie?.tytul || 'Familiada',
      _pokazujBank: this.konfiguracja.zasady?.pokazujBank !== false
    };
    this.sync.wyslijStan(stanDlaPlanszy);
  }

  // === Zapis/odczyt localStorage ===
  _zapiszLocal() {
    try {
      localStorage.setItem('familiada-stan', JSON.stringify(this.stan));
    } catch {}
  }

  _sprobujWznow() {
    try {
      const zapisany = localStorage.getItem('familiada-stan');
      if (zapisany) {
        const stan = JSON.parse(zapisany);
        if (stan && stan.druzyny && stan.druzyny.length > 0) {
          // Pokaż dialog wznów
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
        }
      }
    } catch {}
  }

  // === Buzz! ===
  _buzz(druzyna) {
    if (this.stan.stanBuzzera !== STAN_BUZZERA.ARMED) return;

    this.dispatch({ typ: 'BUZZ', druzyna });

    // Dźwięk
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.buzz);

    this.debug.log(`BUZZ:${druzyna}`);
  }

  // === Akcje UI ===
  uzbroj() {
    this.dispatch({ typ: 'UZBROJ' });
    this.transport.wyslij('ARM');
    this.debug.log('ARM wysłane');
  }

  resetBuzzer() {
    this.dispatch({ typ: 'RESET_BUZZER' });
    this.transport.wyslij('RESET');
    this.debug.log('RESET wysłany');
  }

  wybierzPytanie(idx) {
    this.biezacePytanieIdx = idx;
    const p = this.pytania[idx];
    if (!p) return;

    const rundIndex = this.stan.runda;
    const mnoznik = mnoznikDlaRundy(this.konfiguracja, rundIndex);

    this.dispatch({
      typ: 'WYBIERZ_PYTANIE',
      pytanie: p,
      runda: rundIndex,
      mnoznik
    });

    // Oznacz jako użyte
    this.dispatch({ typ: 'OZNACZ_PYTANIE_UZYTE', pytanieId: p.id });
  }

  odslonOdpowiedz(id) {
    this.dispatch({ typ: 'ODSLON_ODPOWIEDZ', id });
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.poprawna);
  }

  dodajIks() {
    this.dispatch({ typ: 'DODAJ_IKS' });
    const audioMap = this.konfiguracja.audio?.mapowanie || {};
    graj(audioMap.iks);

    // Sprawdź przejęcie
    setTimeout(() => {
      if (czyPrzejecie(this.stan)) {
        graj(audioMap.trzyIksy);
        // Zmień fazę na przejęcie
        const [d1, d2] = this.stan.druzyny;
        const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;
        this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.PRZEJECIE });
      }
    }, 600);
  }

  cofnijIks() {
    this.dispatch({ typ: 'USUN_IKS' });
  }

  bankDlaDruzyny(druzynaId) {
    this.dispatch({ typ: 'PRZEJMIX_BANK', druzynaId });

    // Sprawdź czy wszystkie odsłonięte (koniec rundy)
    if (czyWszystkoOdslonięte(this.stan)) {
      this.dispatch({ typ: 'ZMIEN_FAZE', faza: STAN_GRY.KONIEC_RUNDY });
    }
  }

  nastepnaRunda() {
    this.dispatch({ typ: 'NASTEPNA_RUNDA' });

    // Wybierz następne pytanie
    const nastepny = this.biezacePytanieIdx + 1;
    if (nastepny < this.pytania.length) {
      this.wybierzPytanie(nastepny);
    }
  }

  nowaGra() {
    this.historia.reset();
    this.stan = nowaGra(this.konfiguracja);
    this.biezacePytanieIdx = -1;
    localStorage.removeItem('familiada-stan');
    this._render();
    this._wyslijStan();
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

  // === Transport ===
  async polacz() {
    odblokujAudio();

    if (!WebSerialTransport.dostepny()) {
      alert('Web Serial API niedostępne.\nUżyj Chrome lub Edge.\n\nDziałasz w trybie demonstracyjnym — buzzery symuluj klawiszami F2 i F3.');
      return;
    }

    try {
      const t = new WebSerialTransport();
      await t.polacz();
      this.transport.rozlacz();
      this.transport = t;
      t.onBuzz((d) => this._buzz(d));
      this._render();
    } catch (e) {
      alert(`Nie udało się połączyć: ${e.message}`);
    }
  }

  // === Render ===
  _render() {
    this._renderCoTeraz();
    this._renderStatus();
    this._renderPytania();
    this._renderOdpowiedzi();
    this._renderBank();
    this._renderDruzyny();
    this._renderBuzzerBtn();
    this._renderPrzejecie();
    this._renderAudio();
    this._renderHistoria();
    this.debug._render?.();
  }

  _renderCoTeraz() {
    const el = document.getElementById('coteraz-tekst');
    const elIkona = document.getElementById('coteraz-ikona');
    if (!this.stan) return;

    let txt = '', ikona = '🎯';
    switch (this.stan.fazaGry) {
      case STAN_GRY.IDLE:
        if (this.stan.pytanieTekst) { txt = 'Uzbrój buzzery — pojedynek!'; ikona = '⚔'; }
        else { txt = 'Wybierz pytanie aby rozpocząć'; ikona = '🎯'; }
        break;
      case STAN_GRY.POJEDYNEK:
        if (this.stan.stanBuzzera === STAN_BUZZERA.ARMED) { txt = 'Czekam na buzz...'; ikona = '⏳'; }
        else if (this.stan.ktoBuzznal) { txt = `Buzznąła Drużyna ${this.stan.ktoBuzznal}!`; ikona = '🔔'; }
        break;
      case STAN_GRY.GRA:
        txt = `Gra — odsłaniaj odpowiedzi (1-${this.stan.odpowiedzi.length})`; ikona = '🎮';
        break;
      case STAN_GRY.PRZEJECIE:
        txt = 'Przejęcie! Przeciwnik podaje odpowiedź.'; ikona = '🤑';
        break;
      case STAN_GRY.KONIEC_RUNDY:
        txt = 'Koniec rundy — przydziel bank drużynie (Q/W).'; ikona = '💰';
        break;
      case STAN_GRY.KONIEC_GRY:
        txt = 'Koniec gry!'; ikona = '🏆';
        break;
    }
    el.textContent = txt;
    elIkona.textContent = ikona;
  }

  _renderStatus() {
    const dot = document.getElementById('status-dot');
    const txt = document.getElementById('status-tekst');
    if (this.transport?.polaczony && this.transport.tryb === 'webserial') {
      dot.textContent = '🟢'; txt.textContent = 'Host połączony (USB)';
    } else {
      dot.textContent = '🟡'; txt.textContent = 'Tryb demonstracyjny (mock)';
    }

    document.getElementById('status-stan-buzzera').textContent = this.stan?.stanBuzzera || 'LOCKED';
    document.getElementById('status-kto-buzznal').textContent = this.stan?.ktoBuzznal ? `→ D${this.stan.ktoBuzznal}` : '';

    document.getElementById('status-runda').textContent = (this.stan?.runda ?? 0) + 1;
    document.getElementById('status-mnoznik').textContent = this.stan?.mnoznikRundy ?? 1;
  }

  _renderPytania() {
    const sel = document.getElementById('wybor-pytania');
    // Nie przebudowuj jeśli nie trzeba
    if (sel.dataset.liczba == String(this.pytania.length)) {
      // zaznacz bieżący
      sel.value = String(this.biezacePytanieIdx);
      return;
    }
    sel.dataset.liczba = String(this.pytania.length);
    sel.innerHTML = '<option value="">— wybierz —</option>' +
      this.pytania.map((p, i) => {
        const uzyte = this.stan?.pytaniaUzyte?.includes(p.id) ? ' ✓' : '';
        return `<option value="${i}">${i + 1}. ${p.pytanie}${uzyte}</option>`;
      }).join('');
    sel.value = String(this.biezacePytanieIdx);
  }

  _renderOdpowiedzi() {
    const el = document.getElementById('lista-odpowiedzi');
    if (!this.stan?.odpowiedzi?.length) {
      el.innerHTML = '<div class="puste-info">Wybierz pytanie aby zobaczyć odpowiedzi</div>';
      return;
    }

    el.innerHTML = this.stan.odpowiedzi.map((o, i) => `
      <div class="odpowiedz-wiersz ${o.odslonieta ? 'odslonieta' : ''}" data-id="${o.id}">
        <div class="odpowiedz-numer">${i + 1}</div>
        <div class="odpowiedz-tekst">${o.tekst}</div>
        <div class="odpowiedz-punkty">${o.punkty}</div>
        <div class="odpowiedz-akcja">${o.odslonieta ? '✓ odsłonięte' : 'odsłoń →'}</div>
      </div>
    `).join('');

    // Podłącz klik
    el.querySelectorAll('.odpowiedz-wiersz').forEach(w => {
      w.addEventListener('click', () => {
        const id = parseInt(w.dataset.id, 10);
        const odp = this.stan.odpowiedzi[id];
        if (odp.odslonieta) {
          this.dispatch({ typ: 'UKRYJ_ODPOWIEDZ', id });
        } else {
          this.odslonOdpowiedz(id);
        }
      });
    });
  }

  _renderBank() {
    document.getElementById('bank-wyswietlacz').textContent = this.stan?.bank ?? 0;

    const d1 = this.stan?.druzyny?.[0];
    const d2 = this.stan?.druzyny?.[1];
    document.getElementById('bank-d1-nazwa').textContent = d1?.skrot || 'D1';
    document.getElementById('bank-d2-nazwa').textContent = d2?.skrot || 'D2';
  }

  _renderDruzyny() {
    const d1 = this.stan?.druzyny?.[0];
    const d2 = this.stan?.druzyny?.[1];

    const elD1Nazwa = document.getElementById('input-d1-nazwa');
    const elD2Nazwa = document.getElementById('input-d2-nazwa');
    if (elD1Nazwa && elD1Nazwa.value === '' && d1) elD1Nazwa.value = d1.nazwa;
    if (elD2Nazwa && elD2Nazwa.value === '' && d2) elD2Nazwa.value = d2.nazwa;

    document.getElementById('suma-d1').textContent = d1?.suma ?? 0;
    document.getElementById('suma-d2').textContent = d2?.suma ?? 0;
  }

  _renderBuzzerBtn() {
    const btnUzbroj = document.getElementById('btn-uzbroj');
    const btnReset = document.getElementById('btn-reset');
    const btnIks = document.getElementById('btn-iks');
    const btnIksCofnij = document.getElementById('btn-iks-cofnij');

    if (!this.stan) return;

    const armed = this.stan.stanBuzzera === STAN_BUZZERA.ARMED;
    btnUzbroj.disabled = armed || !this.stan.pytanieTekst;
    btnUzbroj.classList.toggle('armed', armed);
    btnReset.disabled = this.stan.stanBuzzera === STAN_BUZZERA.LOCKED;

    btnIks.disabled = this.stan.iksy.length >= 3 || ![STAN_GRY.GRA, STAN_GRY.PRZEJECIE].includes(this.stan.fazaGry);
    btnIksCofnij.disabled = this.stan.iksy.length === 0;

    // Następne / poprzednie
    const btnNastepne = document.getElementById('btn-nastepne');
    btnNastepne.disabled = this.biezacePytanieIdx >= this.pytania.length - 1;
    document.getElementById('btn-poprzednie').disabled = this.biezacePytanieIdx <= 0;
  }

  _renderPrzejecie() {
    const el = document.getElementById('przejecie-kontrola');
    el.style.display = czyPrzejecie(this.stan) ? 'block' : 'none';
  }

  _renderAudio() {
    // Tylko odśwież disabled
  }

  _renderHistoria() {
    document.getElementById('btn-cofnij').disabled = !this.historia.canUndo();
    document.getElementById('btn-przywroc').disabled = !this.historia.canRedo();
  }

  // === Wypełnianie opcji ===
  _wypelnijProfile(profile, aktywny) {
    const sel = document.getElementById('wybor-profilu');
    sel.innerHTML = profile.map(p =>
      `<option value="${p.plik}" ${p.plik === aktywny ? 'selected' : ''}>${p.nazwa}</option>`
    ).join('');
  }

  _wypelnijZestawy(zestawy) {
    this.zestawy = zestawy;
  }

  _wypelnijPytania() {
    // Tylko triggeruje _renderPytania
  }

  // === Podłączanie UI ===
  _podlaczUI() {
    const $ = (id) => document.getElementById(id);

    // Przyciski główne
    $('btn-uzbroj').onclick = () => this.uzbroj();
    $('btn-reset').onclick = () => this.resetBuzzer();
    $('btn-iks').onclick = () => this.dodajIks();
    $('btn-iks-cofnij').onclick = () => this.cofnijIks();
    $('btn-nastepne').onclick = () => {
      if (this.biezacePytanieIdx < this.pytania.length - 1) {
        this.wybierzPytanie(this.biezacePytanieIdx + 1);
      }
    };
    $('btn-poprzednie').onclick = () => {
      if (this.biezacePytanieIdx > 0) {
        this.wybierzPytanie(this.biezacePytanieIdx - 1);
      }
    };

    // Symulacja buzz
    $('btn-buzz1').onclick = () => this._buzz(1);
    $('btn-buzz2').onclick = () => this._buzz(2);

    // Bank
    $('btn-bank-d1').onclick = () => this.bankDlaDruzyny(this.stan.druzyny[0].id);
    $('btn-bank-d2').onclick = () => this.bankDlaDruzyny(this.stan.druzyny[1].id);

    // Pytanie select
    $('wybor-pytania').onchange = (e) => {
      const idx = parseInt(e.target.value, 10);
      if (!isNaN(idx)) this.wybierzPytanie(idx);
    };

    // Profil select
    $('wybor-profilu').onchange = async (e) => {
      location.href = `panel.html?profil=${e.target.value}`;
    };

    // Mnożnik
    document.querySelectorAll('.mnoznik-btn').forEach(btn => {
      btn.onclick = () => {
        const m = parseInt(btn.dataset.m, 10);
        this.dispatch({ typ: 'USTAW_MNOZNIK', mnoznik: m });
        document.querySelectorAll('.mnoznik-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    // Połączenie
    $('btn-polacz').onclick = () => this.polacz();

    // Debug
    $('btn-debug-toggle').onclick = () => this.debug.toggle();

    // Pomoc
    $('btn-pomoc').onclick = () => $('overlay-pomoc').style.display = 'flex';

    // Nowa gra
    $('btn-nowa-gra').onclick = () => this.nowaGra();
    $('btn-zakoncz').onclick = () => {
      this.dispatch({ typ: 'ZAKONCZ_GRE' });
    };

    // Otwórz planszę
    $('btn-otworz-plansze').onclick = () => {
      window.open('plansza.html', 'plansza', 'width=1920,height=1080');
      this._wyslijStan();
    };

    // Historia
    $('btn-cofnij').onclick = () => this.cofnij();
    $('btn-przywroc').onclick = () => this.przywroc();

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

    // Przejęcie
    $('btn-przejecie').onclick = () => {
      // Po przejęciu wszystkie pola się odsłaniają i bank idzie do przejmującej
      const [d1, d2] = this.stan.druzyny;
      const przejmujaca = this.stan.kontrola === d1?.id ? d2 : d1;

      // Odsłoń wszystkie
      this.stan.odpowiedzi.forEach(o => {
        if (!o.odslonieta) {
          this.dispatch({ typ: 'ODSLON_ODPOWIEDZ', id: o.id });
        }
      });
      // Bank dla przejmującej
      this.bankDlaDruzyny(przejmujaca.id);
    };

    // === Klawisze ===
    document.addEventListener('keydown', (e) => {
      // Nie działaj w inputach
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      const klucz = e.code;

      // F1 — pomoc
      if (klucz === 'F1') { e.preventDefault(); $('overlay-pomoc').style.display = 'flex'; return; }
      // F9 — debug
      if (klucz === 'F9') { e.preventDefault(); this.debug.toggle(); return; }
      // F2 — symuluj buzz 1
      if (klucz === 'F2') { e.preventDefault(); this._buzz(1); return; }
      // F3 — symuluj buzz 2
      if (klucz === 'F3') { e.preventDefault(); this._buzz(2); return; }

      // Ctrl+Z — cofnij
      if (e.ctrlKey && klucz === 'KeyZ') { e.preventDefault(); this.cofnij(); return; }
      // Ctrl+Y — przywróć
      if (e.ctrlKey && (klucz === 'KeyY' || (e.shiftKey && klucz === 'KeyZ'))) { e.preventDefault(); this.przywroc(); return; }

      // Spacja — uzbrój
      if (klucz === 'Space') { e.preventDefault(); if (!$('btn-uzbroj').disabled) this.uzbroj(); return; }
      // R — reset
      if (klucz === 'KeyR') { e.preventDefault(); this.resetBuzzer(); return; }
      // X — iks
      if (klucz === 'KeyX') { e.preventDefault(); if (!$('btn-iks').disabled) this.dodajIks(); return; }

      // 1-8 — odsłoń odpowiedź
      if (klucz.startsWith('Digit')) {
        const n = parseInt(klucz.replace('Digit', ''), 10);
        if (n >= 1 && n <= 8 && this.stan.odpowiedzi[n - 1]) {
          e.preventDefault();
          const o = this.stan.odpowiedzi[n - 1];
          if (!o.odslonieta) this.odslonOdpowiedz(n - 1);
          return;
        }
      }

      // Q/W — bank
      if (klucz === 'KeyQ') { e.preventDefault(); this.bankDlaDruzyny(this.stan.druzyny[0].id); return; }
      if (klucz === 'KeyW') { e.preventDefault(); this.bankDlaDruzyny(this.stan.druzyny[1].id); return; }

      // → / PgDn — następne
      if (klucz === 'ArrowRight' || klucz === 'PageDown') {
        e.preventDefault();
        if (this.stan.fazaGry === STAN_GRY.KONIEC_RUNDY) {
          this.nastepnaRunda();
        } else if (this.biezacePytanieIdx < this.pytania.length - 1) {
          this.wybierzPytanie(this.biezacePytanieIdx + 1);
        }
        return;
      }
      // ← / PgUp — poprzednie
      if (klucz === 'ArrowLeft' || klucz === 'PageUp') {
        e.preventDefault();
        if (this.biezacePytanieIdx > 0) {
          this.wybierzPytanie(this.biezacePytanieIdx - 1);
        }
        return;
      }

      // Esc — zamknij overlay
      if (klucz === 'Escape') {
        document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
        return;
      }
    });

    // Odblokuj audio przy pierwszym kliknięciu
    document.addEventListener('click', () => odblokujAudio(), { once: true });
  }

  // Dla debug
  dajStan() { return this.stan; }
}

// === Start ===
window.addEventListener('DOMContentLoaded', () => {
  window.panel = new Panel();

  // Debug hooks
  window.__debugBuzz = (n) => window.panel._buzz(n);
  window.__debugForceState = (faza) => {
    window.panel.dispatch({ typ: 'ZMIEN_FAZE', faza });
  };
  window.__debugDisconnect = () => {
    window.panel.debug.log('SYMULACJA AWARII: rozłączenie');
    if (window.panel.transport?.tryb === 'webserial') {
      window.panel.transport.rozlacz();
      window.panel._render();
    }
  };
  window.__debugDemo = () => {
    // Auto-demo: wybierz pytanie, uzbrój, buzz, odsłoń
    const p = window.panel;
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
