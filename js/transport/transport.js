// ===== transport/transport.js — Interfejs transportu (mock / webserial) =====

export class Transport {
  constructor() {
    this.callbacki = [];
    this.polaczony = false;
    this.tryb = 'mock'; // 'mock' | 'webserial'
  }

  onBuzz(cb) { this.callbacki.push(cb); }

  _emitBuzz(druzyna) {
    this.callbacki.forEach(cb => cb(druzyna));
  }

  async polacz() { /* override */ }
  async rozlacz() { /* override */ }
  async wyslij(komenda) { /* override */ }
}
