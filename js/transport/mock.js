// ===== transport/mock.js — Mock transport (klawiatura symuluje buzzery) =====

import { Transport } from './transport.js';

export class MockTransport extends Transport {
  constructor() {
    super();
    this.tryb = 'mock';
    this.polaczony = true; // zawsze "połączony"
  }

  async polacz() {
    this.polaczony = true;
    return true;
  }

  async rozlacz() {
    this.polaczony = false;
  }

  async wyslij(komenda) {
    // Mock — nic nie wysyłaj naprawdę, tylko loguj
    console.log(`[MOCK] → ${komenda}`);
  }

  /** Symuluj buzz z klawiatury */
  symulujBuzz(druzyna) {
    this._emitBuzz(druzyna);
  }
}
