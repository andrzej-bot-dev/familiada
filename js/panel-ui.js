// ===== panel-ui.js — Renderowanie DOM panelu prowadzącego =====
// Klasa PanelUI odpowiada za całe renderowanie interfejsu.
// Czyta dane z panel.stan, panel.flow, panel.transport itd.
// Używa funkcji z teksty.js do generowania tekstów.
// NIE zawiera logiki gry — tylko wyświetla stan i podłącza eventy.

import { STAN_GRY, STAN_BUZZERA } from './stan.js';
import { czyWszystkoOdslonięte } from './zasady.js';
import {
  coTeraz, actionSub, actionSubIdle, odpowiedzAkcja,
  btnIksPojedynek, btnIksGra, btnBank,
  przejecieTrafioneMsg, btnPrzejeciePudlo,
  BTN, statusText, statusDot, pytanieInfo, BRAK_ODPOWIEDZI
} from './teksty.js';

const $ = (id) => document.getElementById(id);

export class PanelUI {
  /**
   * @param {object} panel — referencja do instancji Panel (this)
   */
  constructor(panel) {
    this.p = panel; // skrót do panelu
  }

  // ===================================================================
  // GŁÓWNY RENDER
  // ===================================================================
  render() {
    this.renderCoTeraz();
    this.renderStatus();
    this.renderMainArea();
    this.renderFooter();
    this.renderSettings();
    this.p.debug?._render?.();
  }

  // ===================================================================
  // CO TERAZ — górny pasek
  // ===================================================================
  renderCoTeraz() {
    const el = $('coteraz-text');
    const elIkona = $('coteraz-icon');
    const elSub = $('coteraz-sub');

    const connected = this.p.transport?.polaczony;
    const maPytanie = !!this.p.stan?.pytanieTekst;
    const { ikona, tytul } = coTeraz(connected, maPytanie, this.p.stan, this.p.flow?.pojedynek);

    el.textContent = tytul;
    elIkona.textContent = ikona;
    elSub.textContent = '';
  }

  // ===================================================================
  // STATUS BAR
  // ===================================================================
  renderStatus() {
    const connected = this.p.transport?.polaczony;
    $('conn-dot').textContent = statusDot(connected);
    $('conn-text').textContent = statusText(connected);
    $('buzzer-state').textContent = this.p.stan?.stanBuzzera || 'LOCKED';
    $('buzzer-who').textContent = this.p.stan?.ktoBuzznal ? ` → D${this.p.stan.ktoBuzznal}` : '';
    $('round-num').textContent = (this.p.stan?.runda ?? 0) + 1;
    $('mnoznik-num').textContent = this.p.stan?.mnoznikRundy ?? 1;
  }

  // ===================================================================
  // MAIN AREA — 3-krokowy wizard
  // ===================================================================
  renderMainArea() {
    const connected = this.p.transport?.polaczony;
    const maPytanie = !!this.p.stan?.pytanieTekst;

    // Krok 1: Połącz
    if (!connected) {
      $('wizard-connect').style.display = '';
      $('wizard-choose').style.display = 'none';
      $('wizard-game').style.display = 'none';
      return;
    }

    // Krok 2: Wybierz zestaw
    if (!maPytanie) {
      $('wizard-connect').style.display = 'none';
      $('wizard-choose').style.display = '';
      $('wizard-game').style.display = 'none';
      return;
    }

    // Krok 3: Gra
    $('wizard-connect').style.display = 'none';
    $('wizard-choose').style.display = 'none';
    $('wizard-game').style.display = '';

    $('question-text').textContent = this.p.stan.pytanieTekst;
    $('question-set-name').textContent = pytanieInfo(this.p.biezacePytanieIdx, this.p.pytania.length);

    this.renderAnswers();
    this.renderInfoBar();
    this.renderActionZone();
  }

  // ===================================================================
  // LISTA ODPOWIEDZI
  // ===================================================================
  renderAnswers() {
    const el = $('answers-list');
    if (!this.p.stan?.odpowiedzi?.length) {
      el.innerHTML = `<div class="puste-info">${BRAK_ODPOWIEDZI}</div>`;
      return;
    }

    const faza = this.p.stan.fazaGry;
    const buzzed = this.p.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
    // W przejęciu: blokuj po wybraniu odpowiedzi
    const przejecieZablokowane = faza === STAN_GRY.PRZEJECIE && this.p.flow?.przejecieOdpowiedz !== null;
    // Blokuj klikanie odpowiedzi po 3 IKS (czekamy na auto-przejęcie 600ms)
    const iksyZablokowane = faza === STAN_GRY.GRA && this.p.stan.iksy.length >= 3;
    const canClick = ((faza === STAN_GRY.GRA && buzzed) || faza === STAN_GRY.PRZEJECIE) && !przejecieZablokowane && !iksyZablokowane;

    el.innerHTML = this.p.stan.odpowiedzi.map((o, i) => {
      const cls = o.odslonieta ? 'odslonieta' : (canClick ? 'klikalna' : 'zablokowana');
      const akcja = odpowiedzAkcja(o.odslonieta, canClick);
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
          this.p.klikOdpowiedz(id);
        });
      });
    }
  }

  // ===================================================================
  // INFO BAR — bank + IKS-y
  // ===================================================================
  renderInfoBar() {
    $('bank-value').textContent = this.p.stan?.bank ?? 0;
    const elIksy = $('info-iksy');
    // Podczas pojedynku nie pokazuj IKS-ów — nie liczą się do gry
    const wPojedynku = !!this.p.flow?.pojedynek;
    const n = wPojedynku ? 0 : (this.p.stan?.iksy.length ?? 0);
    let html = '';
    for (let i = 0; i < 3; i++) {
      html += `<span class="iks-symbol ${i < n ? '' : 'empty'}">✕</span>`;
    }
    elIksy.innerHTML = html;
  }

  // ===================================================================
  // ACTION ZONE — przyciski akcji (dynamiczne)
  // ===================================================================
  renderActionZone() {
    const el = $('action-zone');
    if (!this.p.stan) { el.innerHTML = ''; return; }

    const faza = this.p.stan.fazaGry;
    const maPytanie = !!this.p.stan.pytanieTekst;
    if (!maPytanie) { el.innerHTML = ''; return; }

    const armed = this.p.stan.stanBuzzera === STAN_BUZZERA.ARMED;
    const buzzed = this.p.stan.stanBuzzera === STAN_BUZZERA.BUZZED;
    const iksy = this.p.stan.iksy.length;
    const allRevealed = czyWszystkoOdslonięte(this.p.stan);
    const d1 = this.p.stan.druzyny[0];
    const d2 = this.p.stan.druzyny[1];

    const sub = (txt) => txt ? `<div class="action-sub">${txt}</div>` : '';

    // --- KONIEC GRY ---
    if (faza === STAN_GRY.KONIEC_GRY) {
      el.innerHTML = `
        <div class="action-msg">${BTN.KONIEC_GRY}</div>
        ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
        <button class="btn-big btn-uzbroj" id="az-nowa-gra">${BTN.NOWA_GRA}</button>`;
      $('az-nowa-gra').onclick = () => this.p.nowaGra();
      return;
    }

    // --- KONIEC RUNDY lub wszystko odsłonięte ---
    if (faza === STAN_GRY.KONIEC_RUNDY || allRevealed) {
      const bankRozdany = this.p.stan.bank === 0;
      if (!bankRozdany) {
        const b1 = btnBank(d1?.nazwa || 'D1', this.p.stan.bank);
        const b2 = btnBank(d2?.nazwa || 'D2', this.p.stan.bank);
        el.innerHTML = `
          ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
          <div class="action-row">
            <button class="btn-big btn-bank-big" id="az-bank-d1">
              <span>${b1.nazwa}</span>
              <span class="btn-sub">${b1.punkty}</span>
            </button>
            <button class="btn-big btn-bank-big" id="az-bank-d2">
              <span>${b2.nazwa}</span>
              <span class="btn-sub">${b2.punkty}</span>
            </button>
          </div>`;
        $('az-bank-d1').onclick = () => this.p.bankDlaDruzyny(d1.id);
        $('az-bank-d2').onclick = () => this.p.bankDlaDruzyny(d2.id);
      } else {
        el.innerHTML = `
          <div class="action-msg">${BTN.BANK_ROZDANY}</div>
          <button class="btn-big btn-next-round" id="az-next-round">${BTN.NEXT_ROUND}</button>`;
        $('az-next-round').onclick = () => this.p.nastepnaRunda();
      }
      return;
    }

    // --- PRZEJĘCIE ---
    if (faza === STAN_GRY.PRZEJECIE) {
      const przejmujaca = this.p.stan.kontrola === d1?.id ? d2 : d1;
      const broniaca = this.p.stan.kontrola === d1?.id ? d1 : d2;

      if (this.p.flow?.przejecieOdpowiedz === null) {
        el.innerHTML = `
          ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
          <div class="action-row">
            <button class="btn-big btn-bank-big" id="az-obrona">
              ${btnPrzejeciePudlo(przejmujaca?.nazwa, broniaca?.nazwa)}
            </button>
          </div>`;
        $('az-obrona').onclick = () => this.p.przejeciePudlo();
      } else {
        el.innerHTML = `
          <div class="action-msg" style="color: var(--kolor-akcent);">${przejecieTrafioneMsg(przejmujaca?.nazwa)}</div>
          ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
          <button class="btn-big btn-next-round" id="az-pokaz-reszte">
            ${BTN.POKAZ_RESZTE}
          </button>`;
        $('az-pokaz-reszte').onclick = () => this.p.przejecieTrafiona();
      }
      return;
    }

    // --- ARMED (czeka na buzz) ---
    if (armed) {
      el.innerHTML = `
        ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
        <button class="btn-big btn-reset-big" id="az-reset">${BTN.RESET}</button>`;
      $('az-reset').onclick = () => this.p.resetBuzzer();
      return;
    }

    // --- GRA / BUZZED ---
    if (buzzed || faza === STAN_GRY.GRA) {
      const iksDisabled = iksy >= 3;

      // Pojedynek
      if (this.p.flow?.pojedynek) {
        const pierwszyBuzz = this.p.flow.pojedynek.pierwszyBuzz;
        const aktualnaDruzyna = this.p.flow.pojedynek.tura === 1
          ? pierwszyBuzz
          : (pierwszyBuzz === 1 ? 2 : 1);
        const d = this.p.stan.druzyny[aktualnaDruzyna - 1];

        el.innerHTML = `
          ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
          <div class="action-row">
            <button class="btn-big btn-iks" id="az-iks">
              ${btnIksPojedynek(d?.nazwa)}
            </button>
          </div>`;
        $('az-iks').onclick = () => this.p.dodajIks();
        return;
      }

      // Normalna gra
      el.innerHTML = `
          ${sub(actionSub(this.p.stan, this.p.flow?.pojedynek, this.p.flow?.przejecieOdpowiedz))}
          <div class="action-row">
            <button class="btn-big btn-iks" id="az-iks" ${iksDisabled ? 'disabled' : ''}>
              ${btnIksGra(iksy)}
            </button>
          </div>`;
      $('az-iks').onclick = () => this.p.dodajIks();
      return;
    }

    // --- IDLE z pytaniem — UZBRÓJ ---
    el.innerHTML = `
      ${sub(actionSubIdle())}
      <button class="btn-big btn-uzbroj" id="az-uzbroj">${BTN.UZBROJ}</button>`;
    $('az-uzbroj').onclick = () => this.p.uzbroj();
  }

  // ===================================================================
  // FOOTER — drużyny, cofnij, następna runda
  // ===================================================================
  renderFooter() {
    const d1 = this.p.stan?.druzyny?.[0];
    const d2 = this.p.stan?.druzyny?.[1];

    const elD1Nazwa = $('input-d1-nazwa');
    const elD2Nazwa = $('input-d2-nazwa');
    if (elD1Nazwa && elD1Nazwa.value === '' && d1) elD1Nazwa.value = d1.nazwa;
    if (elD2Nazwa && elD2Nazwa.value === '' && d2) elD2Nazwa.value = d2.nazwa;

    $('suma-d1').textContent = d1?.suma ?? 0;
    $('suma-d2').textContent = d2?.suma ?? 0;
    $('btn-cofnij').disabled = !this.p.historia?.canUndo();

    const btnNextRound = $('btn-nastepna-runda');
    btnNextRound.style.display = (this.p.stan?.fazaGry === STAN_GRY.KONIEC_RUNDY) ? 'inline-block' : 'none';
  }

  // ===================================================================
  // SETTINGS OVERLAY
  // ===================================================================
  renderSettings() {
    document.querySelectorAll('.mnoznik-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.m, 10) === (this.p.stan?.mnoznikRundy ?? 1));
    });
    const btnPrzywroc = $('btn-przywroc');
    if (btnPrzywroc) btnPrzywroc.disabled = !this.p.historia?.canRedo();
    const btnIksCofnij = $('btn-iks-cofnij');
    if (btnIksCofnij) btnIksCofnij.disabled = (this.p.stan?.iksy.length ?? 0) === 0;
  }

  // ===================================================================
  // WYPEŁNIANIE OPCJI (profile, zestawy)
  // ===================================================================
  wypelnijProfile(profile, aktywny) {
    const sel = $('wybor-profilu');
    if (!sel) return;
    sel.innerHTML = profile.map(p =>
      `<option value="${p.plik}" ${p.plik === aktywny ? 'selected' : ''}>${p.nazwa}</option>`
    ).join('');
  }

  wypelnijZestawy(zestawy) {
    const sel = $('wybor-zestawu');
    if (sel) {
      sel.innerHTML = '<option value="">— wybierz zestaw —</option>' +
        zestawy.map((z, i) => `<option value="${i}">${z.nazwa}</option>`).join('');
    }
  }

  // ===================================================================
  // PODŁĄCZANIE STATYCZNYCH EVENTÓW (raz przy init)
  // ===================================================================
  wireEvents() {
    // Wizard — połącz
    $('btn-wizard-connect').onclick = () => this.p.polacz();

    // Wizard — start gry
    $('btn-wizard-start').onclick = () => {
      const sel = $('wybor-zestawu');
      const idx = parseInt(sel.value, 10);
      if (isNaN(idx)) return;
      this.p.wybierzZestaw(idx);
    };

    // Wizard — zmień zestaw
    $('link-change-set').onclick = () => this.p.zmienZestaw();

    // Profil
    $('wybor-profilu').onchange = (e) => {
      location.href = `panel.html?profil=${e.target.value}`;
    };

    // Mnożnik
    document.querySelectorAll('.mnoznik-btn').forEach(btn => {
      btn.onclick = () => this.p.dispatch({ typ: 'USTAW_MNOZNIK', mnoznik: parseInt(btn.dataset.m, 10) });
    });

    // Footer
    $('btn-cofnij').onclick = () => this.p.cofnij();
    $('btn-nastepna-runda').onclick = () => this.p.nastepnaRunda();

    // Settings overlay
    $('btn-settings').onclick = () => { $('overlay-settings').style.display = 'flex'; };
    $('btn-close-settings').onclick = () => { $('overlay-settings').style.display = 'none'; };

    // Debug
    $('btn-debug-toggle').onclick = () => this.p.debug?.toggle();

    // Pomoc
    $('btn-pomoc').onclick = () => { $('overlay-pomoc').style.display = 'flex'; };
    $('btn-close-pomoc').onclick = () => { $('overlay-pomoc').style.display = 'none'; };

    // Nowa gra / koniec
    $('btn-nowa-gra').onclick = () => this.p.nowaGra();
    $('btn-zakoncz').onclick = () => this.p.dispatch({ typ: 'ZAKONCZ_GRE' });

    // Plansza
    $('btn-otworz-plansze').onclick = () => {
      window.open('plansza.html', 'plansza', 'width=1920,height=1080');
      this.p._wyslijStan();
    };

    // Przywróć
    $('btn-przywroc').onclick = () => this.p.przywroc();

    // Buzz symulacja
    $('btn-buzz1').onclick = () => this.p.buzz(1);
    $('btn-buzz2').onclick = () => this.p.buzz(2);

    // Iks cofnij
    $('btn-iks-cofnij').onclick = () => this.p.cofnijIks();

    // Drużyny — edycja nazw
    $('input-d1-nazwa').onchange = (e) => {
      const d = this.p.stan.druzyny[0];
      this.p.dispatch({ typ: 'ZMIEN_DRUZYNE', druzynaId: d.id, nazwa: e.target.value });
    };
    $('input-d2-nazwa').onchange = (e) => {
      const d = this.p.stan.druzyny[1];
      this.p.dispatch({ typ: 'ZMIEN_DRUZYNE', druzynaId: d.id, nazwa: e.target.value });
    };

    // Drużyny — punkty ręcznie
    $('btn-d1-dodaj').onclick = () => {
      const v = parseInt($('input-d1-punkty').value, 10);
      if (!isNaN(v)) {
        this.p.dispatch({ typ: 'DODAJ_PUNKTY', druzynaId: this.p.stan.druzyny[0].id, punkty: v });
        $('input-d1-punkty').value = '';
      }
    };
    $('btn-d2-dodaj').onclick = () => {
      const v = parseInt($('input-d2-punkty').value, 10);
      if (!isNaN(v)) {
        this.p.dispatch({ typ: 'DODAJ_PUNKTY', druzynaId: this.p.stan.druzyny[1].id, punkty: v });
        $('input-d2-punkty').value = '';
      }
    };

    // Audio
    $('audio-wlaczone').onchange = (e) => {
      this.p.setAudioEnabled(e.target.checked);
    };
    $('audio-glosnosc').oninput = (e) => {
      this.p.setAudioVolume(parseFloat(e.target.value));
    };

    // Check Web Serial support
    if (!('serial' in navigator)) {
      $('warn-no-serial').style.display = '';
    }

    // Odblokuj audio
    document.addEventListener('click', () => this.p.odblokujAudio?.(), { once: true });
  }
}
