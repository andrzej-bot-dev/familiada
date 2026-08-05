# Instrukcja prowadzącego

## Przed imprezą (10 min przed)

1. **Uruchom serwer:** `./start.sh` (lub `start.bat` na Windows)
2. **Otwórz Chrome:** `http://localhost:8123`
3. **Panel:** Kliknij "Panel prowadzącego"
4. **Plansza:** Kliknij "Otwórz planszę" w panelu
5. **Rzutnik:** Przeciągnij okno planszy na ekran rzutnika → F11 (pełny ekran)
6. **Test:** Wybierz pytanie, uzbrój, buzz (F2), odsłoń odpowiedź (1)
7. **Sprzęt:** Podłącz host ESP32 → "Połącz" (jeśli masz buzzery)

## Prowadzenie rundy — krok po kroku

### 1. Wybierz pytanie
- Z listy "Pytanie" wybierz kolejne pytanie
- Plansza pokazuje pytanie + zakryte pola

### 2. Uzbrój buzzery
- Kliknij **UZBRÓJ** (lub naciśnij Spację)
- Status: ARMED (buzzery żywe)
- Prowadzący czyta pytanie na głos

### 3. Pojedynek
- Gracz łupie buzzer → ekran: "Drużyna X!"
- Jeśli **bez sprzętu**: naciśnij F2 lub F3

### 4. Odpowiedź w pojedynku
- Gracz podaje odpowiedź
- Jeśli **trafił najwyższą** → odsłoń pole (klik lub 1-8), drużyna decyduje grać/oddąć
- Jeśli **nie trafił** → kliknij drugiej drużynie żeby grała, lub następną próbę
- **Uwaga:** w pojedynku nie ma iksów — tylko kto pierwszy ten decyduje

### 5. Gra (odsłanianie planszy)
- Drużyna grająca podaje odpowiedzi po kolei
- **Trafiona:** kliknij pole (lub 1-8) → odsłania się + dolicza do banku
- **Nietrafiona:** kliknij **IKS** (lub X) → duży czerwony ✕

### 6. Trzy iksy → Przejęcie
- Po 3 iksach: przeciwnik dostaje jedną szansę
- Naradzają się, podają odpowiedź
- **Trafiona:** kliknij "Przejęcie!" → wszystkie pola się odsłaniają, bank idzie do przejmującej
- **Nietrafiona:** kliknij bank → grająca drużyna zachowuje bank

### 7. Koniec rundy
- Kliknij **Bank → Drużyna X** (Q lub W)
- Punkty trafiają do sumy drużyny
- Kliknij **Następne →** (→) dla kolejnej rundy

## Na wypadek problemów

### Buzzery nie działają
- F2 = buzz drużyny 1, F3 = buzz drużyny 2 (zawsze działa)
- Sprawdź połączenie USB → odłącz i połącz ponownie
- Kliknij "Połącz" w panelu

### Coś się zepsuło
- **Ctrl+Z** cofa ostatnią akcję (do 50 kroków!)
- F9 otwiera panel debug (symuluj buzz, wymuś stan)
- F5 odświeża — stan jest zapisany (localStorage)

### Audio nie gra
- Kliknij cokolwiek na stronie (odblokowuje audio w Chrome)
- Sprawdź suwak głośności w panelu
- Sprawdź czy "Dźwięk" jest zaznaczony

## Tryb prezentera

Jeśli masz bezprzewodowy pilot (Logitech etc.):
- **PageDown / →** = następne pytanie
- **PageUp / ←** = poprzednie
- **Esc** = zamknij overlay

## Przerwanie gry

Stan jest zapisywany automatycznie. Jak zamkniesz Chrome i otworzysz ponownie:
- Pojawi się "Znaleziono przerwaną grę — Wznów / Nowa gra"
