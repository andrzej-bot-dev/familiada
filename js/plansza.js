// ===== plansza.js — Głupi renderer, nasłuchuje BroadcastChannel =====

import { Sync } from './sync.js';
import { STAN_GRY } from './stan.js';

const sync = new Sync();

// Elementy DOM
const $ = (id) => document.getElementById(id);
const elPola = $('pola-container');
const elPytanie = $('pytanie-tekst');
const elBank = $('bank-wartosc');
const elBankContainer = $('bank-container');
const elIksy = $('iksy-container');
const elKomunikat = $('komunikat-overlay');
const elKomunikatTresc = $('komunikat-tresc');
const elD1Nazwa = $('d1-nazwa');
const elD2Nazwa = $('d2-nazwa');
const elD1Suma = $('d1-suma');
const elD2Suma = $('d2-suma');
const elDruzyna1 = $('druzyna-1');
const elDruzyna2 = $('druzyna-2');
const elRundaTekst = $('runda-tekst');
const elMnoznikTekst = $('mnoznik-tekst');
const elEkranIntro = $('ekran-intro');
const elIntroTytul = $('intro-tytul');
const elIntroPodtytul = $('intro-podtytul');
const elEkranKoniec = $('ekran-koniec');
const elKoniecZwyciezca = $('koniec-zwyciezca');
const elTytulWydarzenia = $('tytul-wydarzenia');

let ostatniStan = null;
let ostatniaLiczbaIksow = -1;  // Track do animacji IKS
let _animowaneSloty = new Set(); // Sloty X które już dostały animację w tej rundzie
let czasownikKursora = null;

// === Render planszy na podstawie stanu ===
function renderuj(stan) {
  if (!stan) return;
  ostatniStan = stan;

  // Tytuł wydarzenia
  const tytul = stan._konfiguracjaTytul || 'Familiada';
  elTytulWydarzenia.textContent = tytul;

  // Nazwy drużyn i sumy
  const [d1, d2] = stan.druzyny || [];
  if (d1) {
    elD1Nazwa.textContent = d1.nazwa;
    elD1Suma.textContent = d1.suma;
    document.documentElement.style.setProperty('--kolor-d1', d1.kolor || '#3b82f6');
    elDruzyna1.classList.toggle('kontrola', stan.kontrola === d1.id);
  }
  if (d2) {
    elD2Nazwa.textContent = d2.nazwa;
    elD2Suma.textContent = d2.suma;
    document.documentElement.style.setProperty('--kolor-d2', d2.kolor || '#ef4444');
    elDruzyna2.classList.toggle('kontrola', stan.kontrola === d2.id);
  }

  // Runda i mnożnik
  elRundaTekst.textContent = stan.runda != null ? `Runda ${stan.runda + 1}` : '';
  elMnoznikTekst.textContent = stan.mnoznikRundy > 1 ? `×${stan.mnoznikRundy}` : '';

  // Pytanie
  if (stan.pytanieTekst) {
    elPytanie.textContent = stan.pytanieTekst;
    elPytanie.classList.add('aktywna');
  } else {
    elPytanie.classList.remove('aktywna');
    elPytanie.textContent = '';
  }

  // Pola odpowiedzi
  renderujPola(stan.odpowiedzi || []);

  // Bank
  elBank.textContent = stan.bank ?? 0;
  elBankContainer.style.display = stan._pokazujBank === false ? 'none' : '';

  // Iksy
  renderujIksy(stan.iksy || []);

  // Faza gry
  renderujFaze(stan);

  // Ekran końcowy
  if (stan.fazaGry === STAN_GRY.KONIEC_GRY) {
    pokazKoniec(stan);
  } else {
    elEkranKoniec.style.display = 'none';
  }
}

function renderujPola(odpowiedzi) {
  const liczba = odpowiedzi.length;
  if (liczba === 0) {
    elPola.innerHTML = '';
    elPola.removeAttribute('data-liczba');
    return;
  }

  // Sprawdź czy trzeba przebudować (liczba pól się zmieniła)
  const obecnaLiczba = elPola.children.length;
  if (obecnaLiczba !== liczba) {
    elPola.setAttribute('data-liczba', String(liczba));
    elPola.innerHTML = '';
    for (let i = 0; i < liczba; i++) {
      const pole = document.createElement('div');
      pole.className = 'pole zakryta';
      pole.innerHTML = `
        <div class="pole-numer">${i + 1}</div>
        <div class="pole-tekst"></div>
        <div class="pole-punkty"></div>
      `;
      elPola.appendChild(pole);
    }
  }

  // Aktualizuj zawartość — NIE mignij odsłoniętym tekstem!
  odpowiedzi.forEach((odp, i) => {
    const pole = elPola.children[i];
    if (!pole) return;
    const tekstEl = pole.querySelector('.pole-tekst');
    const punktyEl = pole.querySelector('.pole-punkty');

    if (odp.odslonieta) {
      // Odsłoń dopiero gdy tekst jest gotowy, żeby nie mignął
      tekstEl.textContent = odp.tekst;
      punktyEl.textContent = odp.punkty;
      if (!pole.classList.contains('odslonieta')) {
        pole.classList.remove('zakryta');
        pole.classList.add('odslonieta');
      }
    } else {
      // Zakryj — najpierw ukryj tekst, potem pokaż zakryte
      tekstEl.textContent = '';
      punktyEl.textContent = '';
      pole.classList.remove('odslonieta');
      pole.classList.add('zakryta');
    }
  });
}

function renderujIksy(iksy) {
  const liczba = iksy.length;

  // Jeśli mniej X niż było — rundy się zmieniły, przebuduj
  if (liczba < ostatniaLiczbaIksow || liczba === 0) {
    elIksy.innerHTML = '';
    ostatniaLiczbaIksow = -1;
    _animowaneSloty.clear();
  }

  // Dodaj brakujące X (tylko nowe, bez przebudowy starych)
  while (elIksy.children.length < 3) {
    const iks = document.createElement('div');
    iks.className = 'iks';
    iks.textContent = '✕';
    elIksy.appendChild(iks);
  }

  // Oznacz aktywne — animuj tylko RAZ na slot, nawet przy re-renderze
  for (let i = 0; i < 3; i++) {
    const el = elIksy.children[i];
    if (i < liczba) {
      if (!el.classList.contains('aktywny')) {
        el.classList.add('aktywny');
        // Animuj tylko jeśli slot nie był jeszcze animowany w tej rundzie
        if (!_animowaneSloty.has(i)) {
          _animowaneSloty.add(i);
          el.classList.add('iks-animacja');
          setTimeout(() => el.classList.remove('iks-animacja'), 600);
        }
      }
    } else {
      el.classList.remove('aktywny', 'iks-animacja');
      _animowaneSloty.delete(i);
    }
  }

  ostatniaLiczbaIksow = liczba;
}

function renderujFaze(stan) {
  // Komunikat o buzzowaniu — pokazuj gdy GRA + BUZZED (faza zmienia się z POJEDYNEK na GRA przy buzz)
  if (stan.fazaGry === STAN_GRY.GRA && stan.stanBuzzera === 'BUZZED' && stan.ktoBuzznal) {
    const druzyna = stan.druzyny?.[stan.ktoBuzznal - 1];
    pokazKomunikat(`${druzyna?.nazwa || 'Drużyna ' + stan.ktoBuzznal}!`, `druzyna-${stan.ktoBuzznal}`, 3000);
  } else if (stan.fazaGry === STAN_GRY.PRZEJECIE) {
    const [d1, d2] = stan.druzyny || [];
    const przejmujaca = stan.kontrola === d1?.id ? d2 : d1;
    pokazKomunikat(`Przejęcie — ${przejmujaca?.nazwa || ''}!`, 'przejecie', 3000);
  } else if (stan.fazaGry === STAN_GRY.IDLE && stan.pytanieTekst) {
    // Pytanie widoczne, ale bez komunikatu
    ukryjKomunikat();
  } else if (stan.fazaGry === STAN_GRY.IDLE && !stan.pytanieTekst) {
    // Idle — pokaż intro jeśli pierwsza runda
    if (stan.runda === 0) {
      elEkranIntro.classList.remove('ukryty');
    }
  } else {
    ukryjKomunikat();
    elEkranIntro.classList.add('ukryty');
  }
}

function pokazKomunikat(tresc, klasa, autoUkryjMs) {
  // Nie re-triggeruj jeśli ten sam komunikat już jest pokazany
  if (elKomunikat.classList.contains('aktywny') && elKomunikatTresc.textContent === tresc) return;
  elKomunikatTresc.textContent = tresc;
  elKomunikatTresc.className = `komunikat-tresc ${klasa || ''}`;
  elKomunikat.classList.add('aktywny');
  if (autoUkryjMs) {
    clearTimeout(pokazKomunikat._timer);
    pokazKomunikat._timer = setTimeout(() => elKomunikat.classList.remove('aktywny'), autoUkryjMs);
  }
}

function ukryjKomunikat() {
  elKomunikat.classList.remove('aktywny');
}

function pokazKoniec(stan) {
  const [d1, d2] = stan.druzyny || [];
  if (!d1 || !d2) return;
  let tekst = '';
  if (d1.suma > d2.suma) tekst = `🏆 ${d1.nazwa} wygrywa!`;
  else if (d2.suma > d1.suma) tekst = `🏆 ${d2.nazwa} wygrywa!`;
  else tekst = `🤝 Remis!`;
  elKoniecZwyciezca.textContent = tekst;
  elEkranKoniec.style.display = 'flex';
}

// === Obsługa komend z panelu ===
sync.on((msg) => {
  if (msg.typ === 'STAN') {
    renderuj(msg.payload);
    // Zapisz hash odebranego stanu, żeby localStorage polling
    // nie przetworzył tego samego jeszcze raz (fix double render)
    _zapiszHashDlaStanu(msg.payload);
  } else if (msg.typ === 'KOMENDA') {
    if (msg.komenda === 'INTRO') {
      elIntroTytul.textContent = msg.dane?.tytul || 'Familiada';
      elIntroPodtytul.textContent = msg.dane?.podtytul || '';
      elEkranIntro.classList.remove('ukryty');
      setTimeout(() => elEkranIntro.classList.add('ukryty'), 4000);
    } else if (msg.komenda === 'UKRYJ_INTRO') {
      elEkranIntro.classList.add('ukryty');
    } else if (msg.komenda === 'RESET_PLANSZY') {
      elPytanie.textContent = '';
      elPytanie.classList.remove('aktywna');
      elPola.innerHTML = '';
      elBank.textContent = '0';
      elIksy.innerHTML = '';
      ukryjKomunikat();
      elEkranKoniec.style.display = 'none';
      elEkranIntro.classList.remove('ukryty');
    }
  } else if (msg.typ === 'ZADANIE_STANU') {
    // Plansza dopiero otwarta — panel odpowie
  }
});

// Poproś o stan przy starcie
sync.poproszStan();

// Próba wczytania z localStorage (fallback)
try {
  const zapisany = localStorage.getItem('familiada-stan');
  if (zapisany) {
    renderuj(JSON.parse(zapisany));
  }
} catch {}

// === Auto-sync: sprawdzaj localStorage co 1.5s ===
// (fallback gdy BroadcastChannel nie dotrze między oknami)
// WAŻNE: BroadcastChannel handler aktualizuje _ostatniHash,
// więc polling nie przetworzy drugi raz tego samego stanu.
let _ostatniHash = '';
function _zapiszHashDlaStanu(stan) {
  try {
    const s = JSON.stringify(stan);
    _ostatniHash = s.length + ':' + s.substring(0, 120);
  } catch {}
}
setInterval(() => {
  try {
    const zapisany = localStorage.getItem('familiada-stan');
    if (!zapisany) return;
    const hash = zapisany.length + ':' + zapisany.substring(0, 60);
    if (hash !== _ostatniHash) {
      _ostatniHash = hash;
      renderuj(JSON.parse(zapisany));
    }
  } catch {}
}, 1500);

// === Kursor auto-ukryj ===
function resetKursor() {
  document.body.classList.add('kursor-widoczny');
  clearTimeout(czasownikKursora);
  czasownikKursora = setTimeout(() => {
    document.body.classList.remove('kursor-widoczny');
  }, 3000);
}
document.addEventListener('mousemove', resetKursor);
resetKursor();

// === F11 = pełny ekran ===
document.addEventListener('keydown', (e) => {
  if (e.key === 'F11') {
    e.preventDefault();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
});
