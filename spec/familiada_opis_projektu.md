# 🎪 Familiada na wesele — pełny opis projektu (zarys)

Dokument referencyjny: co budujemy, dlaczego tak, jak całość działa, każde połączenie, cała apka i pełne zasady gry.

---

## 1. W jednym zdaniu

Budujemy fizyczną grę Familiada na wesele: dwa bezprzewodowe buzzery (kto pierwszy walnie, ten odpowiada), sędziujące przez małe radio ESP-NOW, plus web apkę na laptopie, która pokazuje planszę na rzutniku i którą prowadzący steruje rozgrywką.

---

## 2. Co robimy i dlaczego

Chcemy atrakcji na wesele, która wciągnie gości: teleturniej Familiada prowadzony na żywo, z prawdziwymi "slam" guzikami, planszą na rzutniku i dźwiękiem. Kluczowy element rozgrywki — pojedynek "kto pierwszy" — wymaga niezawodnego, szybkiego i sprawiedliwego wykrycia, kto nacisnął pierwszy. To jest serce projektu i wokół tego zbudowana jest cała reszta.

Twarde ograniczenie: **to jest event z twardym terminem, bez opcji poślizgu.** Dlatego wszędzie wybieramy rozwiązania proste, lokalne i sprawdzone zamiast efektownych-ale-ryzykownych. Zasada przewodnia: **im bliżej lokalnie i po kablu/własnym radiu, tym pewniej.**

---

## 3. Jak działa Familiada (pełne zasady)

Familiada to polska wersja "Family Feud". Grają dwie drużyny (u nas np. strona pana i strona pani młodej). Pytania pochodzą z sondy: "Zapytaliśmy 100 osób...". Najczęstsze odpowiedzi są ukryte na planszy, a **liczba punktów każdej odpowiedzi = ile osób ze 100 tak odpowiedziało.** Odpowiedzi są uszeregowane od najpopularniejszej (najwięcej punktów) do najrzadszej.

### 3.1. Plansza
Na planszy jest kilka ponumerowanych pól (zwykle 4–6), po jednym na odpowiedź. Na starcie wszystkie są **zakryte** (widać tylko numery). W miarę gry odsłaniają się odpowiedzi wraz z ich punktami.

### 3.2. Pojedynek (start rundy)
Po jednej osobie z każdej drużyny staje przy pulpicie z buzzerami. Prowadzący czyta pytanie. **Kto pierwszy naciśnie buzzer, ten odpowiada pierwszy** (to robi nasza elektronika). Ta osoba podaje odpowiedź:
- Jeśli to **najwyższa** (najpopularniejsza) odpowiedź → jej drużyna przejmuje kontrolę i decyduje: **gramy** czy **oddajemy** drugiej drużynie.
- Jeśli to odpowiedź z planszy, ale nie najwyższa → druga osoba (z przeciwnej drużyny) też podaje jedną odpowiedź. Kontrolę przejmuje drużyna tej osoby, której odpowiedź stoi **wyżej** (ma więcej punktów).
- Jeśli pierwsza odpowiedź jest **poza planszą** (błędna) → szansę dostaje druga osoba; jeśli trafi na planszę, jej drużyna przejmuje kontrolę.

### 3.3. Gra (odsłanianie planszy)
Drużyna, która przejęła kontrolę, podaje odpowiedzi **po kolei** (jeden zawodnik po drugim). Każda odpowiedź:
- **Trafiona (jest na planszy)** → pole się odsłania, punkty lecą do **banku rundy** (wspólnej puli tej rundy).
- **Nietrafiona (poza planszą)** → **IKS** (błąd / X).

### 3.4. Iksy (błędy)
Za każdą błędną odpowiedź drużyna dostaje jeden iks. **Trzy iksy** = drużyna traci kontrolę i bank rundy staje pod znakiem zapytania (patrz: przejęcie). Iks to pojedynczy, jasny sygnał — na ekranie pojawia się duży czerwony X.

### 3.5. Przejęcie (steal)
Gdy drużyna grająca zbierze **trzy iksy**, przeciwna drużyna dostaje **jedną szansę na przejęcie**: naradza się i podaje **jedną** odpowiedź.
- Trafiona (dowolna z pozostałych na planszy) → przeciwna drużyna **kradnie CAŁY bank** rundy.
- Nietrafiona → bank zostaje przy drużynie, która grała.

### 3.6. Zdobycie banku bez przejęcia
Jeśli drużyna grająca **odsłoni wszystkie odpowiedzi** przed trzecim iksem → zgarnia cały bank rundy, bez szansy na przejęcie.

### 3.7. Punktacja i rundy
- **Bank rundy** = suma punktów odsłoniętych odpowiedzi. Trafia do sumy tej drużyny, która rundę "zbankowała" (grająca albo przejmująca).
- Gra toczy się przez kilka rund (na wesele proponuję **5–6**). W późniejszych rundach można włączyć **mnożnik**: gra podwójna (×2) lub potrójna (×3) — punkty liczą się podwójnie/potrójnie. To buduje napięcie pod koniec.
- Wygrywa drużyna z **wyższą sumą** po wszystkich rundach.
- (Opcjonalnie) **Gra finałowa**: dwóch zawodników zwycięskiej drużyny odpowiada szybko na 5 pytań na czas — miły dodatek, ale niekonieczny.

### 3.8. Przykładowa runda krok po kroku
1. Plansza pokazuje pytanie "Co robi się na weselu?" i 5 zakrytych pól.
2. Ania (Drużyna 1) i Piotr (Drużyna 2) stają przy buzzerach. Prowadzący czyta pytanie, klika **Uzbrój**.
3. Ania wali pierwsza → jej buzzer świeci + dźwięk, ekran: "Drużyna 1!".
4. Ania mówi "tańczy się". To najwyższa odpowiedź (38 pkt) → prowadzący odsłania pole 1, bank = 38. Drużyna 1 decyduje: **gramy**.
5. Drużyna 1 podaje dalej: "je się" (24) → odsłonięte, bank 62. "śpiewa się" → poza planszą → **IKS 1**. "pije się" (18) → odsłonięte, bank 80. "coś tam" → poza → **IKS 2**. "życzenia" (8) → odsłonięte, bank 88.
6. Zostało jedno pole ("bawi się", 12). Kolejna błędna → **IKS 3** → Drużyna 1 traci kontrolę.
7. Drużyna 2 dostaje jedną szansę na przejęcie, naradza się, mówi "bawi się" → trafione! → **Drużyna 2 kradnie cały bank 88 pkt.**
8. 88 pkt trafia do sumy Drużyny 2. Prowadzący klika "następne pytanie", nowa runda.

---

## 4. Przykładowe pytania (z odpowiedziami i punktami)

Suma punktów każdej sondy ≈ 100. Odpowiedzi od najwyższej.

**Pytanie 1 — "Co robi się na weselu?"**
- Tańczy się — 38
- Je się — 24
- Pije się — 18
- Bawi się / śpiewa — 12
- Składa życzenia — 8

**Pytanie 2 — "Podaj typowy prezent ślubny."**
- Pieniądze / koperta — 45
- Sprzęt AGD do domu — 20
- Wazon / porcelana — 14
- Voucher / podróż — 12
- Pościel / ręczniki — 9

**Pytanie 3 — "Co panna młoda robi przed ślubem?"**
- Fryzjer / makijaż — 40
- Stresuje się — 22
- Ubiera suknię — 18
- Pije lampkę na odwagę — 11
- Płacze ze wzruszenia — 9

**Pytanie 4 — "Bez czego nie ma dobrej imprezy weselnej?"**
- Bez dobrej muzyki / DJ-a — 35
- Bez jedzenia — 25
- Bez alkoholu — 20
- Bez dobrego towarzystwa — 13
- Bez wodzireja — 7

**Pytanie 5 — "Co goście krzyczą do pary młodej?"**
- Gorzko, gorzko! — 34
- Sto lat — 26
- Gratulacje — 22
- Wszystkiego najlepszego — 12
- Kiedy dzieci? — 6

**Pytanie 6 — "Gdzie państwo młodzi jadą w podróż poślubną?"**
- Egzotyka / nad morze — 30
- Włochy — 20
- Grecja — 18
- Zostają w domu — 16
- W góry — 16

---

## 5. Architektura systemu

Cały system to **cztery urządzenia**:

```
Buzzer 1 (ESP32 + bateria) ┐
  ├─ ESP-NOW (radio) ─→ HOST (ESP32) ─ USB ─→ Laptop (apka) ─ HDMI ─→ Rzutnik
Buzzer 2 (ESP32 + bateria) ┘
```

- **Buzzery (2× ESP32)** — na pulpicie, bezprzewodowe, na 8×AA. "Głupie": wykrywają łupnięcie, wysyłają je, a świecą/wyją dopiero na komendę hosta.
- **Host (osobne ESP32)** — leży przy laptopie, wpięty w niego kablem USB. Sędzia: słucha buzzerów po radiu, decyduje kto pierwszy, tłumaczy to laptopowi. Nie liczy punktów, nie rysuje planszy.
- **Laptop** — odpala web apkę (plansza + panel), wyrzuca planszę na rzutnik. Mózg gry.
- **Rzutnik** — pokazuje planszę gościom.

**Dlaczego host to osobne ESP32, a nie sam laptop?** Bo laptop nie umie w ESP-NOW — to protokół chodzący na radiu ESP32. Potrzebny jest jeden ESP32, który łapie pakiety z buzzerów przez powietrze i podaje je do laptopa kablem USB. Efekt uboczny bardzo na plus: **na weselu nie potrzeba żadnego internetu ani routera.**

---

## 6. Kluczowe decyzje projektowe (i dlaczego)

**ESP-NOW zamiast WiFi/Bluetooth.** ESP-NOW używa radia WiFi ESP32, ale bez sieci, routera, hasła i parowania — connectionless, pakiet peer-to-peer po adresie MAC. Latencja ~1–3 ms, po włączeniu po prostu działa. WiFi wymagałoby routera i "łączenia się"; BLE ma większy narzut i parowanie. Dla buzzerów ESP-NOW jest najprostszy i najszybszy.

**Centralny arbiter (host), nie rozproszony.** Cała logika "kto pierwszy" siedzi w jednym miejscu — w hoście. Buzzery nie "dogadują się" między sobą. Pierwszy pakiet, który dotrze do hosta w stanie ARMED, wygrywa; reszta zablokowana. Dzięki temu nie ma problemu synchronizacji zegarów ani wyścigu między buzzerami. Tak robią to wszystkie prawdziwe teleturnieje.

**Buzzer "głupi", host decyduje o świeceniu.** Buzzer po naciśnięciu NIE zapala się sam — wysyła "wcisnięto" i czeka na komendę hosta. Gdyby zapalał lokalnie, przy prawie równoczesnym naciśnięciu mrugnęłyby oba i jeden musiałby zgasnąć (wygląda jak glitch). Gdy decyduje host, świeci tylko zwycięzca, czysto.

**Maszyna stanów LOCKED → ARMED → BUZZED.** LOCKED = między pytaniami, naciśnięcia ignorowane. ARMED = runda uzbrojona, czeka na pierwszy. BUZZED = pierwszy wygrał, reszta zablokowana do resetu. Jedna zmienna, jedno miejsce, nie ma jak się rozjechać.

**8×AA = 12V + jeden step-down, zamiast 4×AA + boost.** 8 paluszków daje 12V prosto do active buzzera (zero step-upa) i podwójny zapas energii. Jeden step-down 12V→5V zasila ESP32 (przez VIN) i pierścień LED. Uwaga o prądzie: baterie w szereg dodają **napięcie, nie prąd** — "więcej prądu" na 5V zapewnia step-down (obniżając napięcie oddaje proporcjonalnie więcej prądu).

**ESP32 zasilany 5V ze step-downa (nie 3×AA na VIN).** Na płytce siedzi regulator (AMS1117) z dropoutem — potrzebuje stabilnego ~5V, żeby dać czyste 3,3V, zwłaszcza przy skokach prądu podczas nadawania radia. 3×AA (spadające do ~3,6V) powodowałyby resety. Dlatego stabilne 5V ze step-downa.

**IRLZ24N (logic-level MOSFET), nie IRFZ.** Active buzzer 12V ma dużo większy pobór, niż udźwignie pin ESP32, a i tak pin daje tylko 3,3V. Więc pin steruje MOSFET-em, a MOSFET przełącza 12V z baterii. Musi być **logic-level** ("L" w nazwie) — otwiera się w pełni z 3,3V. Zwykły IRFZ chce ~10V na bramce i z 3,3V ledwo drgnie + się grzeje.

**Active buzzer 12V + dźwięk z apki (dwa źródła).** Active buzzer sam robi dźwięk po podaniu napięcia (MOSFET tylko włącza/wyłącza). Daje lokalny sygnał "to ten buzzer!". A fanfarę na całą salę gra apka przez nagłośnienie — bo mały buzzer na baterii nie wypełni sali. Oba na raz = lokalizacja + głośność.

**Dioda 1N4007 (flyback) w poprzek buzzera.** Cewka buzzera przy wyłączeniu "kopie" wstecz skokiem napięcia, który uszkodziłby MOSFET. Dioda daje temu kopnięciu bezpieczne ujście. Katodą (pasek) do +12V.

**Pierścień WS2812B (adresowalny), nie zwykły LED.** Każda dioda sterowana osobno = animacje, dowolny kolor, wirowanie. Steruje się z jednego pinu danych. Zwykły ring 12V tylko świeci na sztywno. To komplikuje tylko kod, nie sprzęt (3 przewody: 5V, masa, dane).

**Web apka + Web Serial, nie backend/sieć.** Apka to zwykła strona w Chrome; gada z hostem przez Web Serial API (USB), bez serwera i bez sieci. Rzutnik i sterowanie działają lokalnie. Backend online uzależniłby grę od internetu sali (najsłabsze ogniwo).

**Laptop + prosty pilot, nie telefon-panel (na wesele).** Plansza i tak musi lecieć z apki na komputerze (trzyma stan i rysuje). Prowadzącemu wystarczy bezprzewodowy pilot do "uzbrój/następne/iks", a odsłanianie konkretnej odpowiedzi robi się przy ekranie. Telefon-panel (z synchronizacją przez sieć/dongiel) to fajny upgrade, ale to warstwa sieci w sercu systemu tuż przed termininem — dlatego backlog.

---

## 7. Przepływ danych (end-to-end)

### 7.1. Protokoły

**ESP-NOW (buzzer ↔ host), pakiet 2 bajty:**
- `{type, id}` gdzie type: `BUZZ=1` (buzzer→host), `WIN=2` (host→buzzer), `OFF=3` (host→buzzer); id = numer buzzera.

**Serial przez USB (host ↔ laptop), linie tekstowe:**
- laptop → host: `ARM`, `RESET`
- host → laptop: `READY` (na starcie), `BUZZ:1`, `BUZZ:2`

### 7.2. Sekwencja jednej rundy przez cały system

1. Prowadzący klika **Uzbrój** → apka wysyła `ARM` po USB → host: stan **ARMED**, wysyła `OFF` do obu buzzerów (gasi pierścienie).
2. Gracz łupie pierwszy → buzzer wysyła `{BUZZ, id}` po ESP-NOW → host (callback) zapisuje pierwszego (`pendingWinner`).
3. Host (pętla): stan **BUZZED**, wysyła `{WIN}` do MAC zwycięzcy, wysyła `BUZZ:1` po USB.
4. Buzzer zwycięzcy odbiera `WIN` → odpala animację pierścienia + dźwięk active buzzera.
5. Apka odbiera `BUZZ:1` → pokazuje "Drużyna 1", gra fanfarę przez nagłośnienie.
6. Prowadzący odsłania odpowiedzi / stawia iksy w panelu → plansza na rzutniku się aktualizuje.
7. Prowadzący klika **Reset** → apka wysyła `RESET` → host: stan **LOCKED**, `OFF` do obu → pierścienie gasną. Gotowe na kolejną rundę.

### 7.3. Latencja
Łupnięcie → ESP-NOW (~1–3 ms) → host flip + serial (<1 ms) → reakcja apki (kilkadziesiąt ms w przeglądarce). Od guzika do "Drużyna 1!" na rzutniku grubo poniżej 50 ms — dla oka natychmiast.

---

## 8. Połączenia elektryczne (każde)

### 8.1. Buzzer (na każdy z dwóch identycznie)

Przyjęte piny ESP32: **guzik = GPIO4**, **dane pierścienia = GPIO18**, **bramka MOSFET = GPIO19**. (Unikamy pinów tylko-wejściowych 34–39 i boot-strap 0/2/12/15.)

**Zasilanie:**
- Koszyk 8×AA (+) → wyłącznik rocker SPST → szyna **12V (+)**
- Koszyk 8×AA (−) → **wspólna masa (GND)**
- Szyna 12V → wejście step-downa (+); GND step-downa → wspólna masa
- Wyjście step-downa **5V** → **VIN ESP32** oraz **5V pierścienia WS2812B**

**Guzik (arcade microswitch):**
- Styk 1 → **GPIO4**
- Styk 2 → **wspólna masa**
- (w kodzie `INPUT_PULLUP`, bez zewnętrznego rezystora; nóżki po przekątnej)

**Pierścień WS2812B:**
- 5V → wyjście 5V step-downa
- GND → **wspólna masa**
- DIN → **rezystor ~330Ω** → **GPIO18**

**Audio (active buzzer 12V przez MOSFET IRLZ24N):**
- GPIO19 → **rezystor ~220Ω** → Gate (bramka) IRLZ24N
- Source (źródło) → **wspólna masa**
- Drain (dren) → active buzzer (−)
- Active buzzer (+) → szyna **12V**
- Dioda **1N4007** w poprzek buzzera: katoda (pasek) → 12V/(+), anoda → Drain/(−)

**Podświetlenie guzika (opcjonalne):**
- LED guzika (+) → 12V (z rezystorem, jeśli LED tego wymaga), (−) → wspólna masa (stały glow)

**⚠️ Wspólna masa — najważniejsze:** GND ESP32, GND step-downa, (−) koszyka 8×AA, masa buzzera, masa pierścienia i Source MOSFET-a **muszą być spięte razem**. Sygnał danych pierścienia i przełączanie MOSFET-a liczą się względem tej samej masy — bez tego nic nie zadziała poprawnie.

### 8.2. Host
- Host ESP32 → **kabel USB** → laptop. Tyle. Zasilany z USB, komunikacja przez USB-serial. Bez guzików i diod.

---

## 9. Aplikacja webowa

### 9.1. Architektura apki
- Zwykła strona (HTML/JS), odpalana z **lokalnego serwera** na laptopie (`python -m http.server`) — `localhost` spełnia wymóg Web Serial i działa offline. Przeglądarka: **Chrome/Edge** (Web Serial nie działa w Safari/Firefox).
- **Dwa widoki** (dwa okna tej samej strony):
  - **Plansza** — na rzutnik, pełny ekran.
  - **Panel operatora** — na ekranie laptopa (prowadzący).
- **Panel operatora jest mózgiem:** trzyma stan gry (pytania, bank, iksy, odsłonięte pola, sumy drużyn), utrzymuje połączenie **Web Serial** z hostem, i rozgłasza stan do Planszy przez **BroadcastChannel** (działa między oknami tej samej strony, offline). Plansza to "głupi wyświetlacz" — rysuje to, co dostanie.

### 9.2. Widok: PLANSZA (na rzutnik)

Co pokazuje:
- Nagłówek rundy + ewentualny mnożnik (×2/×3).
- Pytanie (gdy runda aktywna).
- Siatkę pól: zakryte pokazują numer (albo `???`), odsłonięte pokazują tekst odpowiedzi + punkty.
- Bank rundy (rosnąca pula).
- Iksy: gdy błąd — duży czerwony ✕ (do trzech).
- Sumy obu drużyn na dole.
- Po pojedynku: podświetlenie "Drużyna 1!".

### 9.3. Widok: PANEL OPERATORA (na laptopie)

Przyciski / click areas:
- **Połącz z hostem** — otwiera port USB (Web Serial), wybór portu hosta.
- **Status** — połączenie + stan (LOCKED / ARMED / BUZZED), kto buzznął.
- **Wybór pytania** (lista) — ustawia bieżące pytanie na planszy.
- **Mnożnik** — ×1 / ×2 / ×3 dla tej rundy.
- **UZBRÓJ** — wysyła `ARM` (buzzery żywe).
- **RESET** — wysyła `RESET` (gasi buzzery, nowa runda).
- **Lista odpowiedzi** — każdy wiersz klikalny; prowadzący **widzi ukryte odpowiedzi** (żeby wiedzieć, czy gracz trafił), klik **odsłania** je na planszy i **dolicza punkty do banku**.
- **+ IKS** — dodaje błąd; po trzecim sygnalizuje przejęcie.
- **Bank → Drużyna 1 / 2** — przypisuje bank rundy właściwej drużynie (po wygranej / przejęciu).
- **Sumy drużyn** — bieżący wynik.

### 9.4. Skąd pytania i jak je dodać
Pytania siedzą w pliku JSON. Format: pytanie + lista odpowiedzi z punktami, posortowana malejąco.

### 9.5. Jak prowadzić rozgrywkę w apce (workflow)
1. Na starcie: **Połącz z hostem**, sprawdź `Status: połączony`.
2. Wybierz pytanie z listy, ustaw mnożnik jeśli to późniejsza runda.
3. Gracze przy buzzerach → kliknij **UZBRÓJ**.
4. Ktoś buzznie → panel/plansza pokazują drużynę. Ogłoś ją.
5. Gracz odpowiada → jeśli trafił, kliknij jego odpowiedź na **liście** (odsłoni się + doliczy do banku). Jeśli nie — **+ IKS**.
6. Prowadź rundę wg zasad (kontrola, iksy, ewentualne przejęcie).
7. Po rundzie: **Bank → Drużyna X** przypisuje pulę zwycięzcy.
8. **RESET** i wybierz kolejne pytanie.

---

## 10. Co jest na ekranie w każdym momencie gry

- **Przed rundą / przerwa:** plansza z tytułem albo logo, bez pytania, pola zakryte.
- **Pojedynek (po Uzbrój):** widoczne pytanie, wszystkie pola zakryte, buzzery żywe. Po buzznięciu — "Drużyna X!" (podświetlenie strony).
- **Gra:** stopniowo odsłaniane pola z odpowiedziami i punktami, rosnący bank rundy. Przy błędzie — duży czerwony ✕ (1, 2 lub 3).
- **Przejęcie:** komunikat "Przejęcie — Drużyna X", jedna szansa; jeśli trafią, wszystkie pozostałe pola się odsłaniają i bank przechodzi do nich.
- **Koniec rundy:** bank doliczony do sumy drużyny, zaktualizowane liczniki na dole.
- **Koniec gry:** ekran wyniku końcowego, zwycięska drużyna wyróżniona.

---

## 11. Zasada spinająca / filozofia budowy

- **Jeden centralny sędzia** (host) trzyma całą logikę "kto pierwszy" — reszta urządzeń jest głupia i tylko wykonuje. To sprawia, że system jest prosty i nie ma jak się rozjechać.
- **Lokalnie i po kablu/radiu, nie przez sieć.** Buzzery po ESP-NOW, host po USB, apka lokalnie — zero zależności od internetu czy WiFi sali. To jest źródło niezawodności na evencie.
- **Ruthless scoping pod twardy termin.** Najpierw pewny rdzeń (buzzery + arbitraż + apka na laptopie), potem sprzęt (audio, ring, obudowy), a efektowne dodatki (telefon-panel, pilot z ekranem, wersja 6-buzzerowa) świadomie do backlogu po weselu.
- **Buduj pionowymi plasterkami, najbardziej ryzykowne najpierw.** Radio i "kto pierwszy" — czyli jedyne prawdziwe niewiadome — rozwiązane na starcie. Wszystko po nich to przewidywalna robota do odklepania.
