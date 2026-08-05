# Plan B — procedury awaryjne

## Scenariusz 1: Buzzery nie działają

**Objaw:** Buzzery nie świecą, nie reagują.

**Rozwiązanie:**
- Apka działa dalej na klawiaturze: **F2 = buzz 1, F3 = buzz 2**
- Prowadzący sam ogłasza kto pierwszy (na oko / sędziuje)
- Kliknij "Połącz" w panelu (może trzeba ponownie)

## Scenariusz 2: Chrome się zawiesił

**Objaw:** Panel lub plansza nie reaguje.

**Rozwiązanie:**
- Zamknij kartę, otwórz ponownie
- Pojawi się "Wznów grę" — kliknij
- Stan jest zapisany w localStorage

## Scenariusz 3: Rzutnik nie działa

**Objaw:** Plansza nie wyświetla się na rzutniku.

**Rozwiązanie:**
- Użyj laptopa jako planszy (F11 = pełny ekran)
- Lub drugiego monitora (HDMI)
- Panel na smartfonie przez Chrome (zastępczo)

## Scenariusz 4: Brak dźwięku

**Objaw:** Dźwięki nie grają.

**Rozwiązanie:**
- Kliknij cokolwiek na stronie (odblokowuje audio)
- Sprawdź głośność systemu
- Sprawdź suwak w panelu
- Dźwięk to dodatek — gra działa bez niego

## Scenariusz 5: Zły wynik / pomyłka

**Objaw:** Odsłonięte złe pole, zły iks, zły bank.

**Rozwiązanie:**
- **Ctrl+Z** cofa akcje (do 50!)
- Kliknij pole ponownie aby ukryć
- Wpisz punkty ręcznie w polu "+/- punkty"

## Scenariusz 6: Komputer padł

**Objaw:** Laptop nie działa.

**Rozwiązanie:**
- Zapisz stan: wyeksportuj z panelu (jeśli działa)
- Na innym laptopie: `git clone` + `./start.sh`
- Importuj stan
- Albo: wydrukuj pytania i graj "analogowo" (tablica + flamaster)

## Scenariusz 7: Brak internetu

**Nie potrzebne.** Apka działa w 100% offline po uruchomieniu serwera.

## Scenariusz 8: Web Serial nie działa

**Objaw:** Przycisk "Połącz" nie działa.

**Rozwiązanie:**
- Sprawdź czy to Chrome/Edge (nie Firefox/Safari)
- `chrome://flags/#enable-experimental-web-platform-features` → Enabled
- Użyj trybu demonstracyjnego (F2/F3)
