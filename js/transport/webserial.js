// ===== transport/webserial.js — Web Serial API transport =====

import { Transport } from './transport.js';

export class WebSerialTransport extends Transport {
  constructor() {
    super();
    this.tryb = 'webserial';
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.keepReading = false;
    this.buffer = '';
  }

  /** Sprawdź czy Web Serial jest dostępny */
  static dostepny() {
    return 'serial' in navigator;
  }

  async polacz() {
    if (!WebSerialTransport.dostepny()) {
      throw new Error('Web Serial API niedostępne. Użyj Chrome lub Edge.');
    }

    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.polaczony = true;
      this.keepReading = true;
      this._czytaj();
      return true;
    } catch (e) {
      this.polaczony = false;
      throw e;
    }
  }

  async rozlacz() {
    this.keepReading = false;
    if (this.reader) {
      await this.reader.cancel().catch(() => {});
      this.reader = null;
    }
    if (this.writer) {
      await this.writer.releaseLock().catch(() => {});
      this.writer = null;
    }
    if (this.port) {
      await this.port.close().catch(() => {});
    }
    this.polaczony = false;
  }

  async wyslij(komenda) {
    if (!this.port || !this.polaczony) return;
    try {
      if (!this.writer) {
        this.writer = this.port.writable.getWriter();
      }
      const dane = new TextEncoder().encode(komenda + '\n');
      await this.writer.write(dane);
    } catch (e) {
      console.error('Błąd wysyłania:', e);
      this.writer = null;
    }
  }

  async _czytaj() {
    if (!this.port) return;
    const decoder = new TextDecoderStream();
    this.port.readable.pipeTo(decoder.writable).catch(() => {});
    this.reader = decoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { done, value } = await this.reader.read();
        if (done) break;
        this.buffer += value;
        this._parsuj();
      }
    } catch (e) {
      console.error('Błąd czytania serial:', e);
    } finally {
      this.polaczony = false;
      this.reader = null;
    }
  }

  _parsuj() {
    let idx;
    while ((idx = this.buffer.indexOf('\n')) >= 0) {
      const linia = this.buffer.substring(0, idx).trim();
      this.buffer = this.buffer.substring(idx + 1);
      if (!linia) continue;
      this._obslozLinie(linia);
    }
  }

  _obslozLinie(linia) {
    // Toleruj hosta który wysyła cokolwiek
    if (linia.startsWith('BUZZ:')) {
      const n = parseInt(linia.substring(5), 10);
      if (!isNaN(n) && n > 0) {
        this._emitBuzz(n);
      }
    } else if (linia === 'READY') {
      console.log('[Serial] Host gotowy');
    } else if (linia.startsWith('ACK:')) {
      // potwierdzenie — ignorujemy
    } else if (linia === 'PONG') {
      // ping response — ignorujemy
    } else {
      console.log('[Serial] Nieznana linia:', linia);
    }
  }
}
