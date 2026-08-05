# Konfiguracja — profile wydarzenia

Cała "osobowość" apki jest w plikach JSON w `data/profile/`.

## Struktura profilu

```json
{
  "nazwaProfilu": "Wesele",
  "wydarzenie": {
    "tytul": "Familiada Weselna",
    "podtytul": "Para Młoda vs Goście",
    "tekstIntro": "Zapytaliśmy 100 osób...",
    "motyw": "klasyczny"
  },
  "druzyny": [
    { "id": "d1", "nazwa": "Strona Pana", "skrot": "PAN", "kolor": "#3b82f6" },
    { "id": "d2", "nazwa": "Strona Pani", "skrot": "PANI", "kolor": "#ef4444" }
  ],
  "zasady": {
    "maxIksow": 3,
    "liczbaRund": 5,
    "mnoznikiRund": [1, 1, 2, 2, 3],
    "przejecieWlaczone": true,
    "pokazujBank": true,
    "pokazujPunktyNaPlanszy": true
  },
  "audio": {
    "wlaczone": true,
    "glosnosc": 0.7,
    "mapowanie": {
      "buzz": "us_buzzer.mp3",
      "poprawna": "pl_correct_answer.mp3",
      "bledna": "pl_wrong_answer.mp3",
      "iks": "us_strike.mp3",
      "trzyIksy": "us_three_strikes.mp3",
      "intro": "pl_intro.mp3"
    }
  }
}
```

## Motywy

Dostępne: `klasyczny` (niebieski), `ciemny` (czarny/złoty), `pastelowy` (fioletowy/różowy).

## Dodawanie profilu

1. Stwórz plik JSON w `data/profile/` (np. `urodziny.json`)
2. Dodaj wpis w `data/indeks.json` → `profile`
3. Wybierz w panelu z listy "Profil gry"

## Mnożniki rund

Tablica `mnoznikiRund` określa mnożnik punktów dla każdej rundy (index 0-based):
- `[1, 1, 2, 2, 3]` = rundy 1-2 normalnie, rundy 3-4 ×2, runda 5 ×3
- `[1, 1, 1, 1, 1]` = brak mnożników
- `[2, 2, 2]` = wszystko podwojne (krótka gra)

## Kolory drużyn

Kolory w formacie hex. Polecane pary:
- Niebieski + Czerwony: `#3b82f6` / `#ef4444`
- Zielony + Pomarańczowy: `#22c55e` / `#f97316`
- Złoty + Fioletowy: `#fbbf24` / `#a855f7`
