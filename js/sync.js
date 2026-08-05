// ===== sync.js — Synchronizacja Panel → Plansza =====
// BroadcastChannel (główny) + localStorage event (fallback)

const NAZWA_KANALU = 'familiada-sync';
const KLUCZ_STANU = 'familiada-stan';
const KLUCZ_KOMENDY = 'familiada-komenda';

export class Sync {
  constructor() {
    this.kanal = null;
    this.uzytkownicy = [];  // callbacks
    this.trybFallback = false;

    try {
      this.kanal = new BroadcastChannel(NAZWA_KANALU);
      this.kanal.onmessage = (e) => this._obsloz(e.data);
    } catch {
      this.trybFallback = true;
      console.warn('BroadcastChannel niedostępny — fallback na localStorage');
    }

    // Nasłuchuj storage events jako fallback
    window.addEventListener('storage', (e) => {
      if (e.key === KLUCZ_STANU && e.newValue) {
        this._obsloz({ typ: 'STAN', payload: JSON.parse(e.newValue) });
      } else if (e.key === KLUCZ_KOMENDY && e.newValue) {
        this._obsloz(JSON.parse(e.newValue));
      }
    });
  }

  on(callback) {
    this.uzytkownicy.push(callback);
  }

  off(callback) {
    this.uzytkownicy = this.uzytkownicy.filter(c => c !== callback);
  }

  /** Wyślij pełny stan do planszy */
  wyslijStan(stan) {
    const msg = { typ: 'STAN', payload: stan };
    this._wyslij(msg);
  }

  /** Wyślij komendę (np. odtwórz dźwięk, pokaż komunikat) */
  wyslijKomende(komenda, dane) {
    const msg = { typ: 'KOMENDA', komenda, dane };
    this._wyslij(msg);
  }

  /** Poproś o pełny stan (plansza → panel) */
  poproszStan() {
    const msg = { typ: 'ZADANIE_STANU' };
    this._wyslij(msg);
  }

  _wyslij(msg) {
    if (this.kanal) {
      this.kanal.postMessage(msg);
    }
    // Zawsze też zapisz do localStorage jako backup
    if (msg.typ === 'STAN') {
      localStorage.setItem(KLUCZ_STANU, JSON.stringify(msg.payload));
    } else {
      localStorage.setItem(KLUCZ_KOMENDY, JSON.stringify(msg));
      // natychmiast usuń żeby event się wywołał przy kolejnym wysłaniu
      setTimeout(() => localStorage.removeItem(KLUCZ_KOMENDY), 100);
    }
  }

  _obsloz(msg) {
    this.uzytkownicy.forEach(cb => cb(msg));
  }
}
