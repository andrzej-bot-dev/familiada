# Testy — Familiada

## Test manualny: pełna runda

1. ✅ Odpal serwer: `./start.sh`
2. ✅ Otwórz `http://localhost:8123/panel.html` w Chrome
3. ✅ Kliknij "Otwórz planszę" — plansza się otwiera
4. ✅ Wybierz profil "Wesele"
5. ✅ Wybierz pytanie → plansza pokazuje pytanie + zakryte pola
6. ✅ Kliknij UZBRÓJ → status ARMED
7. ✅ Naciśnij F2 → "Drużyna 1!" na planszy, dźwięk buzz
8. ✅ Kliknij odpowiedź 1 → odsłania się na planszy, dolicza do banku
9. ✅ Naciśnij X → iks pojawia się na planszy, dźwięk
10. ✅ Naciśnij X 3 razy → przejęcie aktywowane
11. ✅ Kliknij "Przejęcie" → bank idzie do drużyny 2
12. ✅ Naciśnij Q → bank → drużyna 1
13. ✅ Ctrl+Z → cofa ostatnią akcję

## Test: trwałość stanu

1. Rozpocznij grę, odsłoń kilka pól
2. Odśwież stronę (F5)
3. ✅ Pojawia się "Wznów grę?"
4. ✅ Kliknij Wznów → stan jest zachowany

## Test: plansza bez panelu

1. Otwórz plansza.html bezpośrednio
2. ✅ Pokazuje intro
3. ✅ Po chwili pokazuje zapisany stan z localStorage

## Test: klawiologia

| Klawisz | Oczekiwane |
|---------|-----------|
| Spacja | Uzbrój |
| F2 | Buzz D1 |
| F3 | Buzz D2 |
| 1-8 | Odsłoń odpowiedź |
| X | Dodaj iks |
| Q | Bank → D1 |
| W | Bank → D2 |
| → | Następne pytanie |
| Ctrl+Z | Cofnij |
| F1 | Pomoc overlay |
| F9 | Debug panel |

## Test: Web Serial (wymaga ESP32)

1. Podłącz host ESP32
2. Kliknij "Połącz" → wybierz port
3. ✅ Status: 🟢 Host połączony
4. Wyślij ARM → host odpowiada ACK:ARM
5. Naciśnij buzzer → BUZZ:1 lub BUZZ:2
6. ✅ Panel pokazuje drużynę

## Test: awarie

- Odłącz kabel USB → ✅ status 🔴, gra toczy się na klawiaturze
- Zamknij planszę → ✅ panel działa dalej
- Zamknij panel → ✅ plansza zatrzymana (ostatni stan)
