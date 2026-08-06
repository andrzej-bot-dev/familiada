// ===== BUZZER - Familiada (v6: MAC na serialu + dynamiczne sloty druzyn) =====
//
// SPRZET (bez zmian vs v5):
//   Guzik:   GPIO4 -> GND (styki COM + NO), INPUT_PULLUP.
//   Ring:    5V + GND ze step-downa, DIN przez ~330R -> GPIO21, masy spiete.
//   Buzzer:  GPIO18 -> 220R -> Gate IRLZ; 10k Gate->GND; Source->GND;
//            Drain -> buzzer(-), buzzer(+) -> 12V, dioda 1N4007 katoda do +12V.
//   Dioda WIN: GPIO12 -> 330R -> anoda LED -> katoda -> GND.
//
// ------------------------------------------------------------------
// CO NOWEGO vs v5
// ------------------------------------------------------------------
// 1) MAC ADDRESS NA SERIAL MONITORZE
//    - MAC czytany DOPIERO po WiFi.mode(WIFI_STA) + krotkim delay.
//      Przed inicjalizacja stosu WiFi macAddress() potrafi zwrocic zera/smieci,
//      dlatego nie wypisujemy go od razu po #include.
//    - baner w setup() ORAZ linia statusu co 3 s w loop() -> nie musisz lapac
//      pierwszej sekundy po resecie. Podlacz USB, otworz Serial Monitor
//      (115200) i poczekaj chwile.
//    - wcisniecie Enter w monitorze = natychmiastowy wydruk.
//
// 2) DYNAMICZNE DRUZYNY (dowolne 2 z 3 buzzerow)
//    Buzzer NIE wie z gory, czy jest "druzyna 1" czy "druzyna 2".
//    Wysyla HELLO do hosta (heartbeat), host odsyla ASSIGN ze slotem:
//      slot 1 = DRUZYNA 1 -> ring CZERWONY
//      slot 2 = DRUZYNA 2 -> ring NIEBIESKI
//      slot 0 = REZERWA  -> ring BURSZTYNOWY, przygaszony (poza gra)
//      brak hosta        -> ring BIALY (szukam hosta)
//    Po kolorze ringu od razu widzisz, ktory buzzer jest ktora druzyna.
//
// 3) MY_ID sluzy juz TYLKO do etykiety i do KOLEJNOSCI przydzialu:
//    host sortuje wlaczone buzzery po MY_ID rosnaco -> najnizszy dostaje
//    druzyne 1. Ustaw 1 / 2 / 3 na trzech egzemplarzach i podpisz obudowy.
//
// !! UWAGA DO GPIO12: pin boot-strapowy (MTDI). Bezpieczny uklad to
//    GPIO12 -> 330R -> anoda LED -> katoda -> GND (WIN_LED_ACTIVE_LOW 0).
//    Jak plytka przestanie sie bootowac - przenies diode na GPIO23/22/27/33.
// !! Wspolna masa: GND zasilania ringa MUSI byc spiete z GND ESP32.

#include <WiFi.h>
#include <esp_now.h>
#include <Adafruit_NeoPixel.h>

#define MY_ID 3 // <<< 1 / 2 / 3 - UNIKALNY numer egzemplarza

// >>> MAC HOSTA (identyczny na wszystkich buzzerach) <<<
uint8_t hostMac[] = {0x8C, 0x94, 0xDF, 0x58, 0xD7, 0xA0};

#define BTN_PIN 4
#define RING_PIN 21
#define BUZZER_PIN 18
#define WIN_LED_PIN 12
#define NUM_LEDS 45

#define WIN_LED_ACTIVE_LOW 0 // 1 = dioda zapala sie stanem LOW

#define BRIGHT_READY 45  // przydzielony do druzyny
#define BRIGHT_SPARE 18  // rezerwa / brak hosta
#define BRIGHT_WIN   255

// ---- protokol ESP-NOW ----
#define MSG_BUZZ   1  // buzzer -> host: wcisnieto
#define MSG_WIN    2  // host -> buzzer: swiec
#define MSG_OFF    3  // host -> buzzer: gas
#define MSG_HELLO  4  // buzzer -> host: zyje, jestem MY_ID
#define MSG_ASSIGN 5  // host -> buzzer: twoj slot (0/1/2)

#define SLOT_NONE 255 // jeszcze nie gadalem z hostem

#define HELLO_SEARCH_MS 1000 // czestotliwosc HELLO gdy brak hosta
#define HELLO_ALIVE_MS  2000 // heartbeat gdy juz przydzielony (host: timeout 6 s)
#define HOST_LOST_MS    8000 // brak ASSIGN tak dlugo = stracilem hosta
#define MAC_PRINT_MS    3000 // linia statusu na serialu

Adafruit_NeoPixel ring(NUM_LEDS, RING_PIN, NEO_GRB + NEO_KHZ800);

String myMac = "??:??:??:??:??:??";

volatile uint8_t mySlot = SLOT_NONE;
volatile unsigned long lastAssignMs = 0;
uint8_t shownSlot = 254; // do wykrycia zmiany slotu
unsigned long lastHello = 0;
unsigned long lastMacPrint = 0;

// =============== SYGNAL WYGRANEJ (~440 ms) ===============
#define SOFT_BUZZER 1    // 0 = twarde wl/wyl, jesli PWM brzydko charczy
#define BUZZ_PWM_FREQ 20000
#define BUZZ_PWM_BITS 8
#define BUZZ_LEDC_CH  4   // tylko core 2.x

struct SoundSeg { uint16_t ms; uint8_t from; uint8_t to; };
const SoundSeg WIN_SOUND[] = {
  {  50, 255, 255 },
  {  45,   0,   0 },
  {  50, 255, 255 },
  {  45,   0,   0 },
  { 100, 255, 255 },
  { 150, 255,   0 }
};
const uint8_t WIN_SOUND_N = sizeof(WIN_SOUND) / sizeof(WIN_SOUND[0]);
#define SOUND_HARD_LIMIT 1500

int8_t sndIdx = -1;
unsigned long sndStart = 0, sndSegStart = 0;

// =============== ANIMACJA WYGRANEJ ===============
#define WIN_STROBE_MS 700
#define COMETS 5
#define TAIL 8
#define BG_LEVEL 55

const uint16_t PALETTE[] = {
  2500, 8000, 20000, 30000, 38000, 46000, 54000, 62000
};
const uint8_t PAL_N = sizeof(PALETTE) / sizeof(PALETTE[0]);

typedef struct {
  uint8_t type;
  uint8_t id;
} Packet;

enum { S_READY = 0, S_WIN = 1 };
volatile uint8_t wantState = S_READY;
uint8_t curState = 255;
unsigned long stateStart = 0;
unsigned long lastFrame = 0;

bool wasPressed = false;
bool btnHeld = false;
unsigned long lastPress = 0;

long readyPhase = 0;

// ---------- SLOT / KOLORY ----------

const char* slotName() {
  switch (mySlot) {
    case 1:  return "DRUZYNA 1 (czerwony)";
    case 2:  return "DRUZYNA 2 (niebieski)";
    case 0:  return "REZERWA (poza gra)";
    default: return "BRAK HOSTA (szukam...)";
  }
}

uint16_t teamHue() {
  switch (mySlot) {
    case 1:  return 0;      // czerwony
    case 2:  return 43000;  // niebieski
    case 0:  return 6000;   // bursztyn
    default: return 0;
  }
}

uint8_t teamSat() {
  return (mySlot == SLOT_NONE) ? 0 : 255; // brak hosta = biale
}

uint8_t readyBright() {
  return (mySlot == 1 || mySlot == 2) ? BRIGHT_READY : BRIGHT_SPARE;
}

// ---------- SERIAL ----------

void printStatusLine() {
  Serial.printf("MAC %s | MY_ID=%d | %s\n", myMac.c_str(), MY_ID, slotName());
}

void printBanner() {
  Serial.println();
  Serial.println("==========================================");
  Serial.println(" BUZZER FAMILIADA");
  Serial.printf (" MY_ID     : %d\n", MY_ID);
  Serial.printf (" MOJ MAC   : %s <<< TO WKLEJ DO HOSTA/NOTATEK\n", myMac.c_str());
  Serial.printf (" MAC HOSTA : %02X:%02X:%02X:%02X:%02X:%02X\n",
    hostMac[0], hostMac[1], hostMac[2],
    hostMac[3], hostMac[4], hostMac[5]);
  Serial.printf (" KANAL WiFi: %d\n", WiFi.channel());
  Serial.println("==========================================");
  Serial.println(" (linia statusu leci co 3 s, Enter = odswiez)");
  Serial.println();
}

// ---------- DIODA ZWYCIESTWA ----------

void winLed(bool on) {
#if WIN_LED_ACTIVE_LOW
  digitalWrite(WIN_LED_PIN, on ? LOW : HIGH);
#else
  digitalWrite(WIN_LED_PIN, on ? HIGH : LOW);
#endif
}

void winLedUpdate(unsigned long t) {
  if (t < WIN_STROBE_MS) winLed(((t / 55) % 2) == 0); // miga w rytm strobo
  else winLed(true); // potem swieci ciagle
}

// ---------- BUZZER ----------

void buzzerBegin() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
#if SOFT_BUZZER
  #if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(BUZZER_PIN, BUZZ_PWM_FREQ, BUZZ_PWM_BITS);
    ledcWrite(BUZZER_PIN, 0);
  #else
    ledcSetup(BUZZ_LEDC_CH, BUZZ_PWM_FREQ, BUZZ_PWM_BITS);
    ledcAttachPin(BUZZER_PIN, BUZZ_LEDC_CH);
    ledcWrite(BUZZ_LEDC_CH, 0);
  #endif
#endif
}

void buzzerLevel(uint8_t v) {
#if SOFT_BUZZER
  #if ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(BUZZER_PIN, v);
  #else
    ledcWrite(BUZZ_LEDC_CH, v);
  #endif
#else
  digitalWrite(BUZZER_PIN, v > 0 ? HIGH : LOW);
#endif
}

void soundStop() {
  sndIdx = -1;
  buzzerLevel(0);
}

void soundStart() {
  sndIdx = 0;
  sndStart = millis();
  sndSegStart = sndStart;
  buzzerLevel(WIN_SOUND[0].from);
}

void soundTick() {
  if (sndIdx < 0) return;
  unsigned long now = millis();

  if (now - sndStart > SOUND_HARD_LIMIT) { soundStop(); return; }

  const SoundSeg &s = WIN_SOUND[sndIdx];
  unsigned long e = now - sndSegStart;

  if (e >= s.ms) {
    sndIdx++;
    sndSegStart = now;
    if (sndIdx >= (int8_t)WIN_SOUND_N) { soundStop(); return; }
    buzzerLevel(WIN_SOUND[sndIdx].from);
    return;
  }
  if (s.from != s.to) {
    int v = (int)s.from + (((int)s.to - (int)s.from) * (int)e) / (int)s.ms;
    buzzerLevel((uint8_t)v);
  }
}

// ---------- ANIMACJE ----------

void showReady() {
  readyPhase += btnHeld ? -1 : 1;

  long raw = readyPhase / 2;
  int head = (int)(((raw % NUM_LEDS) + NUM_LEDS) % NUM_LEDS);
  int tailOff = btnHeld ? 1 : (NUM_LEDS - 1);
  int tail = (head + tailOff) % NUM_LEDS;

  uint16_t hue = teamHue();
  uint8_t  sat = teamSat();

  ring.clear();
  ring.setPixelColor(head, ring.ColorHSV(hue, sat, 255));
  ring.setPixelColor(tail, ring.ColorHSV(hue, sat, 60));
  ring.show();
}

void showWin(unsigned long t) {
  uint16_t hue = teamHue();
  uint8_t  sat = teamSat();

  if (t < WIN_STROBE_MS) {
    bool white = ((t / 55) % 2) == 0;
    ring.fill(white ? ring.Color(255, 255, 255) : ring.ColorHSV(hue, sat, 255));

  } else {
    unsigned long e = t - WIN_STROBE_MS;

    long pos = e / 11;
    int head = (int)(pos % NUM_LEDS);
    long rot = pos / NUM_LEDS;

    // 1) tlo: pelzajace bloki kolorow
    int bgShift = (int)((e / 60) % NUM_LEDS);
    int blockLen = NUM_LEDS / PAL_N; if (blockLen < 3) blockLen = 3;
    for (int i = 0; i < NUM_LEDS; i++) {
      int idx = ((i + bgShift) / blockLen) % PAL_N;
      ring.setPixelColor(i, ring.ColorHSV(PALETTE[idx], 255, BG_LEVEL));
    }

    // 2) komety do przodu
    for (int c = 0; c < COMETS; c++) {
      uint16_t h = PALETTE[(rot * 3 + c * 5) % PAL_N];
      int base = (head + c * (NUM_LEDS / COMETS)) % NUM_LEDS;
      for (int i = 0; i < TAIL; i++) {
        int p = (base - i + 4 * NUM_LEDS) % NUM_LEDS;
        uint8_t v = 255 - (uint8_t)(i * (215 / TAIL));
        ring.setPixelColor(p, ring.ColorHSV(h, 255, v));
      }
    }

    // 3) biale komety pod prad
    int rhead = (int)((NUM_LEDS - (long)((e / 17) % NUM_LEDS)) % NUM_LEDS);
    for (int c = 0; c < 2; c++) {
      int base = (rhead + c * (NUM_LEDS / 2)) % NUM_LEDS;
      for (int i = 0; i < 4; i++) {
        uint8_t v = 255 >> i;
        ring.setPixelColor((base + i) % NUM_LEDS, ring.Color(v, v, v));
      }
    }

    // 4) iskry
    for (int s = 0; s < 3; s++) {
      if (random(4) == 0) ring.setPixelColor(random(NUM_LEDS), ring.Color(255, 255, 255));
    }

    // 5) "bang" calym ringiem
    if ((e % 900) < 35) {
      ring.fill(ring.ColorHSV(PALETTE[(e / 900) % PAL_N], 255, 255));
    }
  }
  ring.show();
}

// ---------- ESP-NOW ----------

void sendBuzz() {
  Packet p = { MSG_BUZZ, MY_ID };
  esp_err_t r = esp_now_send(hostMac, (uint8_t*)&p, sizeof(p));
  if (r == ESP_OK) Serial.println("buzz -> send OK (zakolejkowany)");
  else Serial.printf("buzz -> send BLAD: %d (%s)\n", r, esp_err_to_name(r));
}

void sendHello() {
  Packet p = { MSG_HELLO, MY_ID };
  esp_now_send(hostMac, (uint8_t*)&p, sizeof(p));
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < (int)sizeof(Packet)) return;
  Packet p;
  memcpy(&p, data, sizeof(p));

  if (p.type == MSG_WIN) wantState = S_WIN;
  else if (p.type == MSG_OFF) wantState = S_READY;
  else if (p.type == MSG_ASSIGN) {
    mySlot = p.id; // 0 = rezerwa, 1 = druzyna 1, 2 = druzyna 2
    lastAssignMs = millis();
  }
}

// ---------- SETUP / LOOP ----------

void setup() {
  Serial.begin(115200);
  delay(300);

  buzzerBegin();

  pinMode(WIN_LED_PIN, OUTPUT); // dioda zgaszona od pierwszej chwili
  winLed(false);

  pinMode(BTN_PIN, INPUT_PULLUP);

  ring.begin();
  ring.setBrightness(BRIGHT_SPARE);
  ring.clear();
  ring.show();

  randomSeed(esp_random());

  // --- WiFi MUSI wystartowac zanim odczytamy MAC ---
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(200); // daj stosowi WiFi dojsc do siebie
  myMac = WiFi.macAddress(); // dopiero teraz MAC jest wiarygodny

  printBanner();

  if (esp_now_init() != ESP_OK) {
    Serial.println("BLAD: ESP-NOW init");
    return;
  }
  esp_now_register_recv_cb(onRecv);

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, hostMac, 6);
  peer.channel = 0;
  peer.encrypt = false;
  esp_err_t addRes = esp_now_add_peer(&peer);
  Serial.printf("ESP-NOW gotowe, add_peer(host) = %s\n", esp_err_to_name(addRes));

  sendHello();
  lastHello = millis();
  lastMacPrint = millis();
}

void loop() {
  // --- serial: Enter = natychmiastowy wydruk statusu ---
  bool typed = false;
  while (Serial.available()) { Serial.read(); typed = true; }
  if (typed) printStatusLine();

  // --- linia statusu co MAC_PRINT_MS (MAC zawsze pod reka) ---
  if (millis() - lastMacPrint >= MAC_PRINT_MS) {
    lastMacPrint = millis();
    printStatusLine();
  }

  // --- utrata hosta -> wracamy do "szukam" (bialy ring) ---
  if (mySlot != SLOT_NONE && (millis() - lastAssignMs) > HOST_LOST_MS) {
    mySlot = SLOT_NONE;
  }

  // --- heartbeat HELLO ---
  unsigned long helloEvery = (mySlot == SLOT_NONE) ? HELLO_SEARCH_MS : HELLO_ALIVE_MS;
  if (millis() - lastHello >= helloEvery) {
    lastHello = millis();
    sendHello();
  }

  // --- guzik ---
  bool pressed = (digitalRead(BTN_PIN) == LOW);
  btnHeld = pressed;

  if (pressed && !wasPressed && (millis() - lastPress > 200)) {
    lastPress = millis();
    sendBuzz(); // host i tak zignoruje buzz z rezerwy
  }
  wasPressed = pressed;

  // --- zmiana stanu WIN/READY ---
  if (wantState != curState) {
    curState = wantState;
    stateStart = millis();
    ring.setBrightness(curState == S_WIN ? BRIGHT_WIN : readyBright());
    if (curState == S_WIN) {
      soundStart();
    } else {
      soundStop();
      winLed(false); // OFF z hosta gasi diode
    }
  }

  // --- zmiana slotu (przydzial druzyny) ---
  if (mySlot != shownSlot) {
    shownSlot = mySlot;
    if (curState != S_WIN) ring.setBrightness(readyBright());
    Serial.printf(">>> SLOT: %s\n", slotName());
  }

  soundTick();

  if (millis() - lastFrame >= 15) {
    lastFrame = millis();
    if (curState == S_WIN) {
      unsigned long t = millis() - stateStart;
      showWin(t);
      winLedUpdate(t);
    } else {
      showReady();
    }
  }
}
