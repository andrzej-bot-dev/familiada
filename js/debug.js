// ===== debug.js — Moduł debug (F9) =====
// Symulator buzzerów, log szeregowy, inspektor stanu, demo autoplay

export class Debug {
  constructor(store) {
    this.widoczny = false;
    this.store = store;
    this.logi = [];
    this.maxLogi = 100;
  }

  toggle() {
    this.widoczny = !this.widoczny;
    this._render();
  }

  log(komunikat) {
    const czas = new Date().toLocaleTimeString('pl-PL');
    this.logi.push(`[${czas}] ${komunikat}`);
    if (this.logi.length > this.maxLogi) this.logi.shift();
    if (this.widoczny) this._render();
  }

  _render() {
    let el = document.getElementById('debug-panel');
    if (!this.widoczny) {
      el?.remove();
      return;
    }

    if (!el) {
      el = document.createElement('div');
      el.id = 'debug-panel';
      el.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;max-height:50vh;overflow:auto;background:#111;color:#0f0;font:11px monospace;padding:8px;border:1px solid #333;z-index:9999;border-radius:8px 0 0 0';
      document.body.appendChild(el);
    }

    const stan = this.store?.dajStan?.() || {};
    el.innerHTML = `
      <div style="border-bottom:1px solid #333;padding-bottom:4px;margin-bottom:4px;font-weight:bold">🔍 DEBUG (F9 = zamknij)</div>
      <div style="margin-bottom:8px">
        <b>Faza:</b> ${stan.fazaGry || '?'} |
        <b>Buzzer:</b> ${stan.stanBuzzera || '?'} |
        <b>Buzz:</b> ${stan.ktoBuzznal || '-'} |
        <b>Bank:</b> ${stan.bank ?? 0} |
        <b>Iksy:</b> ${stan.iksy?.length || 0} |
        <b>Kontrola:</b> ${stan.kontrola || '-'}
      </div>
      <div style="margin-bottom:8px">
        <b>Drużyny:</b> ${(stan.druzyny||[]).map(d => `${d.nazwa}=${d.suma}`).join(' | ')}
      </div>
      <div style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap">
        <button onclick="window.__debugBuzz(1)" style="font:10px monospace;padding:2px 6px">BUZZ:1</button>
        <button onclick="window.__debugBuzz(2)" style="font:10px monospace;padding:2px 6px">BUZZ:2</button>
        <button onclick="window.__debugForceState('GRA')" style="font:10px monospace;padding:2px 6px">→ GRA</button>
        <button onclick="window.__debugForceState('PRZEJECIE')" style="font:10px monospace;padding:2px 6px">→ PRZEJECIE</button>
        <button onclick="window.__debugDisconnect()" style="font:10px monospace;padding:2px 6px">⚠ AWARIA</button>
        <button onclick="window.__debugDemo()" style="font:10px monospace;padding:2px 6px">▶ DEMO</button>
      </div>
      <div style="border-top:1px solid #333;padding-top:4px;max-height:200px;overflow:auto">
        ${this.logi.slice(-20).map(l => `<div>${l}</div>`).join('')}
      </div>
    `;
  }
}
