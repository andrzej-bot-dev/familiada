# Architektura — Familiada web app

## Przegląd

```
┌─────────────────────────────────────────────┐
│  Laptop (Chrome)                            │
│                                             │
│  ┌──────────────┐   ┌──────────────────┐    │
│  │   Panel      │──►│    Plansza       │    │
│  │ (mózg gry)   │BC │ (głupi ekran)    │    │
│  │              │   │                  │    │
│  │  stan.js     │   │  plansza.js      │    │
│  │  zasady.js   │   │  (render only)   │    │
│  │  audio.js    │   └──────────────────┘    │
│  │  transport   │                           │
│  └──────┬───────┘                           │
│         │ Web Serial                        │
│         ▼                                   │
│  ┌──────────────┐                           │
│  │  Host ESP32  │                           │
│  │  (USB)       │                           │
│  └──────────────┘                           │
└─────────────────────────────────────────────┘
```

## Panel = jedyne źródło prawdy

Panel trzyma cały stan gry:
- Pytanie, odpowiedzi, co odsłonięte
- Bank rundy, iksy, sumy drużyn
- Faza gry, stan buzera

Wszystkie zmiany przez `dispatch(akcja)` → reducer → nowy stan → broadcast.

## Plansza = głupi renderer

Plansza nasłuchuje `BroadcastChannel` i rysuje to co dostanie.
Nie ma logiki. Nie trzyma stanu. Tylko renderuje.

## Synchronizacja

1. **BroadcastChannel** (główny) — natychmiastowa, między oknami
2. **localStorage + storage event** (fallback) — gdy BC niedostępny

## Transport (buzzery)

1. **MockTransport** (domyślny) — klawiatura symuluje buzz
2. **WebSerialTransport** — realne połączenie USB z hostem ESP32

## Persistencja

- Stan zapisywany w `localStorage` po każdej zmianie
- F5 nie kasuje wyników
- Przy starcie: "Wznów / Nowa gra"

## Moduły JS

| Plik | Odpowiedzialność |
|------|-----------------|
| `stan.js` | Model stanu gry + reducer |
| `zasady.js` | Reguły (bank, iksy, przejęcie, walidacja) |
| `historia.js` | Undo/redo (min 50 akcji) |
| `konfiguracja.js` | Profile wydarzenia |
| `sync.js` | BroadcastChannel + fallback |
| `audio.js` | Odtwarzanie dźwięków |
| `pytania.js` | Wczytywanie/eksport zestawów |
| `panel.js` | Logika panelu prowadzącego |
| `plansza.js` | Render planszy |
| `debug.js` | Moduł debug (F9) |
| `transport/*.js` | Mock + Web Serial |
