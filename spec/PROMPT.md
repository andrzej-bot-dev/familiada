# PROMPT DLA AGENTA — web-apka "Familiada"

## 0. Kim jesteś i jak pracujesz

Jesteś autonomicznym inżynierem frontendu. Masz Linuksa, Chrome, konto GitHub, dostęp do sieci i możliwość researchu. Pracujesz samodzielnie — nie pytaj o zgodę na każdy krok. Decyzje projektowe podejmuj sam i zapisuj je w docs/DECYZJE.md.

Zaczynasz od utworzenia repozytorium na GitHubie. Nazwa: familiada. Prywatne. Pierwszy commit = README + plan pracy.

Na koniec wszystko zacommitowane i wypchnięte na main, git status czysty, repo w pełni działa po świeżym git clone.

Weryfikujesz swoją pracę realnie w Chrome: odpalasz lokalny serwer, otwierasz oba widoki, klikasz przez pełną rundę, robisz screenshoty.

## 1. Kontekst

Buduję fizyczną grę Familiada (polska wersja Family Feud): dwa bezprzewodowe buzzery na ESP32 + host ESP32 wpięty w laptopa po USB. Sprzęt już działa i jest poza zakresem tego zadania. Twoim zadaniem jest wyłącznie aplikacja webowa na laptopie.

Pierwsze użycie to wesele, ale aplikacja nie ma być apką weselną. Ma być uniwersalną Familiadą — zmieniając wyłącznie konfigurację i zestaw pytań, bez dotykania kodu.

W katalogu spec/ masz:
- familiada_opis_projektu.md — pełny opis systemu, architektura, zasady gry, przykładowe pytania. To jest źródło prawdy o zasadach i o protokole.
- host_original.ino — aktualny firmware hosta ESP32 (wersja testowa, sterowana pojedynczymi znakami a/r).

Twardy termin. Wszystko wybieramy proste, lokalne i sprawdzone.

## 2. TWARDE OGRANICZENIA (nienegocjowalne)

1. Zero zależności sieciowych w runtime. Żadnych CDN-ów, Google Fonts, zewnętrznych API. Wszystko (fonty, biblioteki, dźwięki) leży w repo.
2. Zero backendu. Statyczne pliki przez python3 -m http.server.
3. Zero build-stepu. Vanilla HTML/CSS/JS + ES modules. Bez React/Vue/Svelte, bez npm install, bez Vite, bez TypeScriptu.
4. Chrome/Edge only (Web Serial API). Wykryj i pokaż komunikat na innej przeglądarce.
5. Cały interfejs po polsku. Dokumentacja po polsku.
6. Aplikacja musi być w pełni grywalna BEZ podłączonego sprzętu. Klawiszologia zastępuje buzzery.
7. Zero hardkodowanych treści. Wszystko z konfiguracji.

## 3. Architektura

familiada/
├── index.html          # rozdroże: [Panel] [Plansza] [Edytor pytań] [Ustawienia]
├── panel.html          # operator (mózg gry)
├── plansza.html        # rzutnik (głupi wyświetlacz)
├── edytor.html         # edytor zestawów pytań
├── css/
│   ├── tokens.css      # kolory/rozmiary/fonty jako CSS custom properties
│   ├── motywy/         # gotowe motywy (klasyczny, ciemny, pastelowy)
│   ├── plansza.css
│   ├── panel.css
│   └── edytor.css
├── js/
│   ├── stan.js         # model stanu gry + reducer
│   ├── zasady.js       # bank, iksy, przejęcie, mnożnik
│   ├── konfiguracja.js # wczytywanie/walidacja/zapis profilu
│   ├── historia.js     # undo/redo
│   ├── transport/
│   │   ├── transport.js
│   │   ├── webserial.js
│   │   └── mock.js
│   ├── sync.js          # BroadcastChannel + localStorage fallback
│   ├── audio.js
│   ├── pytania.js
│   ├── panel.js
│   ├── plansza.js
│   └── debug.js
├── data/
│   ├── profile/         # domyslny.json, wesele.json, urodziny.json, firmowa.json
│   ├── zestawy/         # ogolny.json, wesele.json, testowy.json
│   └── indeks.json
├── assets/
│   ├── audio/           # dźwięki + ZRODLA.md
│   │   └── wlasne/      # .gitignore
│   └── fonts/
├── firmware/
│   └── host.ino
├── docs/
├── start.command / start.sh / start.bat
└── README.md

Panel = jedyne źródło prawdy. Trzyma stan, gada z hostem po Web Serial, rozgłasza.
Plansza = głupi renderer. Nasłuchuje BroadcastChannel, rysuje.
Fallback przez localStorage + storage event.
Plansza otwiera się window.open z panelu.

## 4. Kontrakt: protokół szeregowy

115200 baud, 8N1, linie zakończone \n.
Laptop → host: ARM, RESET, PING
Host → laptop: READY, BUZZ:1, BUZZ:2, ACK:ARM, ACK:RESET, PONG

Wymagania:
- Toleruj hosta który wysyła tylko READY i BUZZ:n. Nieznane linie → loguj i ignoruj.
- Parsowanie liniowe: TextDecoderStream + bufor.
- Odłączenie kabla: czerwony komunikat, przycisk połącz ponownie, stan gry nietknięty.
- Liczba buzzerów jako parametr (BUZZ:n), nie sztywno 1/2.

Dodatkowo dostarcz firmware/host.ino: weź host_original.ino i zmień TYLKO parsowanie serial z a/r na pełne linie ARM/RESET/PING oraz wypisuj BUZZ:1/BUZZ:2 zamiast ZWYCIEZCA. Zachowaj READY. Reszty nie ruszaj.

## 5. WIDOK A — PLANSZA (na rzutnik)

- 1920×1080, skaluj vw/vh/clamp(). Ma wyglądać dobrze w 1280×720.
- Czytelność z 15 metrów. Ciemne tło, wysoki kontrast, grube kroje, ogromne cyfry.
- Zmienna liczba pól (3–8), układ dostosowuje się automatycznie.
- Stany: intro/idle, pojedynek, buzz, gra, przejęcie, koniec rundy, koniec gry.
- Nieodsłonięte odpowiedzi nigdy nie mogą mignąć (zero FOUC).
- Kursor ukryty po 3s bezruchu.
- Paleta w tokens.css, motywy w css/motywy/.

## 6. WIDOK B — PANEL PROWADZĄCEGO

Najważniejsza część. Wodzirej widzi apkę pierwszy raz, na imprezie, z 80 osobami.

- Pasek "CO TERAZ" na górze, zawsze widoczny. Wielki tekst z instrukcją.
- Sterowanie stanem: nieaktualne przyciski wyszarzone.
- Wielkie przyciski (min 60px). Wszystko na 13" bez scrollowania.
- Lista odpowiedzi z widocznymi treściami. Klik = odsłonięcie + doliczenie do banku.
- COFNIJ (Ctrl+Z) — historia min 20 akcji.
- Bez okienek "na pewno?" poza nowa grą i zakończeniem.
- Tryb ręczny/override: ustaw dowolnie sumy, iksy, bank, stan.
- Status połączenia: 🟢/🔴/🟡 + stan + kto buzznął.
- Zakładka Ustawienia — edycja profilu na żywo.
- Pomoc pod F1.

Skróty klawiszowe:
Spacja=UZBRÓJ, R=RESET, 1-8=odsłoń odpowiedź, X=IKS, →/PgDn=następne, ←/PgUp=poprzednie, Q/W=bank→drużyna 1/2, Ctrl+Z=cofnij, F1=pomoc, F9=debug, F2/F3=symuluj BUZZ:1/2.

Tryb prezentera: mapowanie pod bezprzewodowy prezenter BT (PageUp/PageDown/Esc/F5/./b).

## 7. Konfiguracja wydarzenia

Cała "osobowość" apki w profilu JSON:
- nazwaProfilu, wydarzenie (tytul, podtytul, tekstIntro, motyw)
- druzyny (id, nazwa, skrot, kolor)
- zasady (maxIksow, liczbaRund, mnoznikiRund, przejecieWlaczone, pokazujBank, pokazujPunktyNaPlanszy)
- audio (wlaczone, glosnosc, mapowanie)
- klawisze

Wymagania: edycja w panelu, zmiana nazw drużyn w trakcie gry bez utraty punktów, gotowe profile, eksport/import JSON, walidacja z komunikatami po polsku.

## 8. Pytania i zestawy

Format JSON z metadanymi. Wiele zestawów, przełączane w locie. Wczytanie z pliku. Edytor pytań (edytor.html). Zmienna liczba odpowiedzi (3-8). Walidacja. Znacznik "użyte". Opcja losowej kolejności.

Zseeduj: wesele.json (6 pytań z opisu), ogolny.json (10-12 uniwersalnych), testowy.json (2-3 krótkie).

## 9. Moduł DEBUG (F9)

Symulator buzzerów, log szeregowy, inspektor stanu, wymuś stan, symulacja awarii, demo/autoplay, pomiar opóźnienia, reset all.

## 10. Dźwięk

Pliki mp3 już są pobrane w ~/projekty/familiada-sounds/final/. Skopiuj je do assets/audio/ i wypełnij ZRODLA.md.
Dźwięk gra tylko z panelu. Preload. Brakujący plik = ostrzeżenie, nie crash.
Odblokowanie audio przy pierwszym kliknięciu. Suwak głośności + wyciszenie.
Folder assets/audio/wlasne/ (gitignore) ma pierwszeństwo.

Dostępne pliki dźwiękowe:
- pl_correct_answer.mp3 (0.6s) — polski Familiada "poprawna odpowiedź"
- pl_wrong_answer.mp3 (1.1s) — polski Familiada "błędna odpowiedź"
- pl_intro.mp3 (4.9s) — polski Familiada intro fanfara
- pl_full_theme.mp3 (156s) — pełna czołówka
- us_correct_answer.mp3 (3.3s) — US Family Feud correct
- us_strike.mp3 (2.3s) — US Family Feud strike/X
- us_buzzer.mp3 (2.4s) — US Family Feud buzzer
- us_intro.mp3 (17.7s) — US Family Feud intro
- us_three_strikes.mp3 (4.1s) — US Family Feud three strikes

Źródła: YouTube (familiada TVP, Family Feud). Pobrano via yt-dlp.

## 11. Trwałość stanu

Stan w localStorage po każdej zmianie. F5 nie kasuje wyników. Przy starcie: "Znaleziono przerwaną grę — [Wznów] [Nowa gra]". Eksport/import stanu. Globalny onerror. Plansza prosi o pełny stan przy otwarciu.

## 12. Dokumentacja

README.md, docs/INSTRUKCJA_PROWADZACEGO.md, docs/KONFIGURACJA.md, docs/PYTANIA.md, docs/PROTOKOL.md, docs/ARCHITEKTURA.md, docs/PLAN_B.md, docs/DECYZJE.md, docs/TESTY.md, assets/audio/ZRODLA.md.

## 13. Kolejność budowania

1. Repo + szkielet + start.*
2. Model stanu, zasady, historia
3. Konfiguracja / profile
4. Plansza (wszystkie stany wizualne)
5. Panel + synchronizacja → tu apka jest już grywalna
6. Transport: mock + Web Serial
7. Pytania + edytor
8. Debug + audio + trwałość stanu
9. firmware/host.ino
10. Dokumentacja, screenshoty, git push

## 14. GitHub

Konto: andrzej-bot-dev
Token: TOKEN_USUNIETY
Repo: familiada (prywatne)

## 15. Anty-cele

- Nie buduj backendu, bazy, logowania.
- Nie używaj frameworka ani niczego co wymaga npm install.
- Nie podpinaj CDN-a.
- Nie hardkoduj żadnych nazw, imion, kolorów, liczb.
- Nie ruszaj logiki ESP-NOW w host.ino.
- Nie implementuj gry finałowej ani trybu 6-buzzerowego.
- Nie rób animacji dłuższych niż ~600ms.
- Nie over-engineeruj.
