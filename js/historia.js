// ===== historia.js — Undo/Redo (min 20 akcji) =====

const MAX_HISTORIA = 50;

export class Historia {
  constructor() {
    this.przeszlosc = [];  // stack stanów przed akcjami
    this.przyszlosc = [];  // stack dla redo
  }

  zapisz(stan) {
    this.przeszlosc.push(JSON.parse(JSON.stringify(stan)));
    if (this.przeszlosc.length > MAX_HISTORIA) {
      this.przeszlosc.shift();
    }
    this.przyszlosc = []; // nowa akcja czyści redo
  }

  canUndo() {
    return this.przeszlosc.length > 0;
  }

  canRedo() {
    return this.przyszlosc.length > 0;
  }

  undo(obecnyStan) {
    if (this.przeszlosc.length === 0) return null;
    this.przyszlosc.push(JSON.parse(JSON.stringify(obecnyStan)));
    return this.przeszlosc.pop();
  }

  redo(obecnyStan) {
    if (this.przyszlosc.length === 0) return null;
    this.przeszlosc.push(JSON.parse(JSON.stringify(obecnyStan)));
    return this.przyszlosc.pop();
  }

  reset() {
    this.przeszlosc = [];
    this.przyszlosc = [];
  }
}
