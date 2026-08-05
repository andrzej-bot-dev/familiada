// ===== edytor.js — Edytor zestawów pytań =====

import { wczytajIndeks, wczytajZestaw, wczytajZPliku, eksportujZestaw } from './pytania.js';
import { walidujPytanie } from './zasady.js';

let biezacyZestaw = null;
let biezacePytanieIdx = -1;
let wszystkieZestawy = [];

const $ = (id) => document.getElementById(id);

async function init() {
  wszystkieZestawy = await wczytajIndeks();
  wypelnijZestawy();

  $('wybor-zestawu').onchange = async (e) => {
    biezacyZestaw = await wczytajZestaw(e.target.value);
    biezacePytanieIdx = -1;
    renderListe();
    renderEdycje();
  };

  // Załaduj pierwszy
  if (wszystkieZestawy.length > 0) {
    biezacyZestaw = await wczytajZestaw(wszystkieZestawy[0].plik);
    renderListe();
  }

  $('btn-nowe-pytanie').onclick = () => {
    if (!biezacyZestaw) return;
    const nowe = {
      id: `p${Date.now()}`,
      pytanie: 'Nowe pytanie',
      odpowiedzi: [
        { tekst: '', punkty: 0 },
        { tekst: '', punkty: 0 },
        { tekst: '', punkty: 0 }
      ]
    };
    biezacyZestaw.pytania.push(nowe);
    biezacePytanieIdx = biezacyZestaw.pytania.length - 1;
    renderListe();
    renderEdycje();
  };

  $('btn-nowy-zestaw').onclick = () => {
    const nazwa = prompt('Nazwa nowego zestawu:');
    if (!nazwa) return;
    biezacyZestaw = { nazwa, opis: '', pytania: [] };
    biezacePytanieIdx = -1;
    renderListe();
    renderEdycje();
  };

  $('btn-eksportuj').onclick = () => {
    if (biezacyZestaw) eksportujZestaw(biezacyZestaw);
  };

  $('btn-importuj').onclick = () => $('file-input').click();
  $('file-input').onchange = async (e) => {
    const plik = e.target.files[0];
    if (!plik) return;
    try {
      const dane = await wczytajZPliku(plik);
      biezacyZestaw = dane;
      biezacePytanieIdx = -1;
      renderListe();
      renderEdycje();
    } catch (err) {
      alert(`Błąd: ${err.message}`);
    }
  };
}

function wypelnijZestawy() {
  $('wybor-zestawu').innerHTML = wszystkieZestawy.map(z =>
    `<option value="${z.plik}">${z.nazwa}</option>`
  ).join('');
}

function renderListe() {
  const el = $('pytania-lista');
  if (!biezacyZestaw?.pytania?.length) {
    el.innerHTML = '<div class="puste-info">Brak pytań. Dodaj pierwsze!</div>';
    return;
  }

  el.innerHTML = biezacyZestaw.pytania.map((p, i) => `
    <div class="pytanie-wiersz ${i === biezacePytanieIdx ? 'aktywne' : ''}" data-idx="${i}">
      <div class="pwt-tekst">${i + 1}. ${p.pytanie || '(bez treści)'}</div>
      <div class="pwt-info">${p.odpowiedzi?.length || 0} odpowiedzi</div>
    </div>
  `).join('');

  el.querySelectorAll('.pytanie-wiersz').forEach(w => {
    w.onclick = () => {
      biezacePytanieIdx = parseInt(w.dataset.idx, 10);
      renderListe();
      renderEdycje();
    };
  });
}

function renderEdycje() {
  const el = $('edycja-panel');
  if (biezacePytanieIdx < 0 || !biezacyZestaw?.pytania?.[biezacePytanieIdx]) {
    el.innerHTML = '<div class="puste-info">Wybierz pytanie z listy lub dodaj nowe</div>';
    return;
  }

  const p = biezacyZestaw.pytania[biezacePytanieIdx];
  const bledy = walidujPytanie(p);

  el.innerHTML = `
    <div class="form-grupa">
      <label>Treść pytania</label>
      <input type="text" id="edit-pytanie" value="${escHtml(p.pytanie)}">
    </div>
    <div class="form-grupa">
      <label>Odpowiedzi <span style="font-weight:normal;color:var(--kolor-tekst-dim)">(sortuj od najwyższej)</span></label>
      <div class="odpowiedzi-edycja" id="odpowiedzi-edycja">
        ${p.odpowiedzi.map((o, i) => `
          <div class="odpowiedz-edycja-wiersz">
            <span class="numer">${i + 1}.</span>
            <input type="text" class="odp-tekst" data-idx="${i}" value="${escHtml(o.tekst)}" placeholder="Treść odpowiedzi">
            <input type="number" class="odp-punkty" data-idx="${i}" value="${o.punkty}" placeholder="Punkty" min="0" max="100">
            <button class="btn-usun" data-idx="${i}" title="Usuń">✕</button>
          </div>
        `).join('')}
      </div>
      <button class="przycisk-maly" id="btn-dodaj-odpowiedz" style="margin-top:6px">+ Dodaj odpowiedź</button>
    </div>
    <div class="bledy-walidacji">${bledy.map(b => `<div>⚠ ${escHtml(b)}</div>`).join('')}</div>
    <div class="form-akcje">
      <button class="przycisk" id="btn-zapisz-pytanie">💾 Zapisz zmiany</button>
      <button class="przycisk-maly" id="btn-duplikuj" style="background:var(--kolor-akcent-2)">📋 Duplikuj</button>
      <button class="przycisk-maly" id="btn-usun-pytanie" style="background:var(--kolor-zle)">🗑 Usuń</button>
    </div>
    <div class="muted" style="margin-top:12px;font-size:0.8rem">
      Uwaga: zmiany są lokalne (w pamięci). Eksportuj do pliku aby zachować.
    </div>
  `;

  // Eventy edycji
  $('btn-zapisz-pytanie').onclick = () => zapiszPytanie();
  $('btn-usun-pytanie').onclick = () => {
    if (confirm('Usunąć to pytanie?')) {
      biezacyZestaw.pytania.splice(biezacePytanieIdx, 1);
      biezacePytanieIdx = -1;
      renderListe();
      renderEdycje();
    }
  };
  $('btn-duplikuj').onclick = () => {
    const kopia = JSON.parse(JSON.stringify(p));
    kopia.id = `p${Date.now()}`;
    biezacyZestaw.pytania.splice(biezacePytanieIdx + 1, 0, kopia);
    biezacePytanieIdx++;
    renderListe();
    renderEdycje();
  };
  $('btn-dodaj-odpowiedz').onclick = () => {
    p.odpowiedzi.push({ tekst: '', punkty: 0 });
    renderEdycje();
  };
  document.querySelectorAll('.btn-usun').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx, 10);
      p.odpowiedzi.splice(idx, 1);
      renderEdycje();
    };
  });
}

function zapiszPytanie() {
  if (biezacePytanieIdx < 0) return;
  const p = biezacyZestaw.pytania[biezacePytanieIdx];

  p.pytanie = $('edit-pytanie').value;

  document.querySelectorAll('.odp-tekst').forEach(inp => {
    const idx = parseInt(inp.dataset.idx, 10);
    p.odpowiedzi[idx].tekst = inp.value;
  });
  document.querySelectorAll('.odp-punkty').forEach(inp => {
    const idx = parseInt(inp.dataset.idx, 10);
    p.odpowiedzi[idx].punkty = parseInt(inp.value, 10) || 0;
  });

  // Sortuj malejąco po punktach
  p.odpowiedzi.sort((a, b) => b.punkty - a.punkty);

  renderListe();
  renderEdycje();
}

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

init();
