# 🎪 Familiada — polski Family Feud

Webowa aplikacja do prowadzenia gry Familiada. Działa lokalnie w Chrome/Edge, bez internetu, bez backendu, bez instalacji.

## Szybki start

```bash
# 1. Odpal serwer
./start.sh        # Linux/macOS
start.bat         # Windows

# 2. Otwórz w Chrome
http://localhost:8123
```

## Widoki

| Widok | URL | Opis |
|-------|-----|------|
| **Panel** | `panel.html` | Mózg gry. Sterujesz stąd rozgrywką. |
| **Plansza** | `plansza.html` | Ekran na rzutnik. Głupi wyświetlacz. |
| **Edytor** | `edytor.html` | Tworzenie/edycja zestawów pytań. |
| **Start** | `index.html` | Menu główne. |

## Jak grać (w skrócie)

1. Otwórz **Panel** w Chrome
2. Kliknij **Otwórz planszę** (otworzy się osobne okno)
3. Planszę wrzuć na rzutnik (F11 = pełny ekran)
4. Wybierz **pytanie** z listy
5. Kliknij **UZBRÓJ** (lub Spacja)
6. Kto buzznie pierwszy → jego drużyna gra
7. Odsłaniaj odpowiedzi (1-8 lub klik), stawiaj iksy (X)
8. Przydziel bank drużynie (Q lub W)
9. Następne pytanie (→)

## Bez sprzętu (tryb demonstracyjny)

Apka działa od razu bez buzzerów:
- **F2** = symuluj buzz drużyny 1
- **F3** = symuluj buzz drużyny 2
- Wszystko sterowane z klawiatury

## Ze sprzętem (ESP32)

1. Podłącz host ESP32 kablem USB
2. W panelu kliknij **Połącz** (Web Serial API)
3. Wybierz port → 🟢 połączony
4. Buzzery fizyczne wysyłają BUZZ przez ESP-NOW → host → USB → apka

## Skróty klawiszowe

| Klawisz | Akcja |
|---------|-------|
| Spacja | Uzbrój buzzery |
| R | Reset buzzerów |
| 1-8 | Odsłoń odpowiedź |
| X | Dodaj iks |
| → / PgDn | Następne pytanie |
| ← / PgUp | Poprzednie pytanie |
| Q | Bank → Drużyna 1 |
| W | Bank → Drużyna 2 |
| Ctrl+Z | Cofnij |
| Ctrl+Y | Przywróć |
| F1 | Pomoc |
| F2 | Symuluj buzz 1 |
| F3 | Symuluj buzz 2 |
| F9 | Debug |
| F11 | Pełny ekran (plansza) |

## Struktura projektu

```
familiada/
├── index.html          # Menu główne
├── panel.html          # Panel prowadzącego
├── plansza.html        # Plansza na rzutnik
├── edytor.html         # Edytor pytań
├── css/                # Style
├── js/                 # Logika (ES modules)
├── data/               # Profile + zestawy pytań
├── assets/audio/       # Dźwięki
├── firmware/host.ino   # Firmware hosta ESP32
├── docs/               # Dokumentacja
└── start.sh            # Start serwera
```

## Dokumentacja

- [Instrukcja prowadzącego](docs/INSTRUKCJA_PROWADZACEGO.md)
- [Konfiguracja](docs/KONFIGURACJA.md)
- [Tworzenie pytań](docs/PYTANIA.md)
- [Protokół serial](docs/PROTOKOL.md)
- [Architektura](docs/ARCHITEKTURA.md)
- [Plan B (awarie)](docs/PLAN_B.md)

## Wymagania

- Chrome 89+ lub Edge 89+ (Web Serial API)
- Python 3 (dla lokalnego serwera)
- Opcjonalnie: ESP32 host + 2× buzery ESP32

## Licencja

Prywatny projekt. Dźwięki z YouTube (fair use — impreza prywatna).
