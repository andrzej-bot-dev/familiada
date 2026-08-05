// ===== HOST - Familiada =====
// Wgraj na ESP32 podlaczone do laptopa.
// 1) Wklej nizej MAC-i obu buzzerow (z mac_reader).
// 2) Sterowanie z apki po USB (115200 baud, linie tekstowe):
//    ARM   = uzbroj runde (buzzery żywe)
//    RESET = zablokuj buzzery (nowa runda)
//    PING  = ping (host odpowiada PONG)
//
// Host wysyła do apki:
//    READY      (na starcie)
//    BUZZ:1     (buzzer 1 wygrał)
//    BUZZ:2     (buzzer 2 wygrał)
//    ACK:ARM    (potwierdzenie uzbrojenia)
//    ACK:RESET  (potwierdzenie resetu)
//    PONG       (odpowiedź na PING)
//
// Logika ESP-NOW: pierwszy buzz w stanie ARMED wygrywa. Reszta zablokowana do resetu.
// INSTRUKCJA: Zautoryzuj logikę ESP-NOW i struktury z oryginału. Tylko parser serial zmieniony.

#include <WiFi.h>
#include <esp_now.h>

// >>> WKLEJ MAC-i BUZZEROW <<<
uint8_t buzzer1Mac[] = {0x5C, 0x01, 0x3B, 0xBF, 0x24, 0x14}; // BUZZER 1 — 5C:01:3B:BF:24:14
uint8_t buzzer2Mac[] = {0x30, 0x76, 0xF5, 0x94, 0x4C, 0x04}; // BUZZER 2 — 30:76:F5:94:4C:04

// Typy wiadomosci ESP-NOW
#define MSG_BUZZ 1 // buzzer -> host: "wcisnieto"
#define MSG_WIN  2 // host -> buzzer: "swiec"
#define MSG_OFF  3 // host -> buzzer: "gas"

typedef struct {
  uint8_t type;
  uint8_t id;
} Packet;

enum State { LOCKED, ARMED, BUZZED };
volatile State state = LOCKED;
volatile uint8_t pendingWinner = 0; // latch z callbacku

uint8_t* macForId(uint8_t id) {
  return (id == 1) ? buzzer1Mac : buzzer2Mac;
}

void sendCmd(uint8_t *mac, uint8_t type) {
  Packet p = { type, 0 };
  esp_now_send(mac, (uint8_t*)&p, sizeof(p));
}

void sendOffAll() {
  sendCmd(buzzer1Mac, MSG_OFF);
  sendCmd(buzzer2Mac, MSG_OFF);
}

// Callback odbioru. Tylko latchujemy pierwszy buzz - wysylke robi loop().
#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
#else
void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
#endif
  if (len < (int)sizeof(Packet)) return;
  Packet p;
  memcpy(&p, data, sizeof(p));
  if (p.type == MSG_BUZZ && state == ARMED && pendingWinner == 0) {
    pendingWinner = p.id;
  }
}

void addPeer(uint8_t *mac) {
  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, mac, 6);
  peer.channel = 0;
  peer.encrypt = false;
  esp_now_add_peer(&peer);
}

// === Parser serial (linie tekstowe) ===
// Bufor na linię wejściową
String serialBuffer = "";

void processLine(const String &line) {
  String cmd = line;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "ARM") {
    pendingWinner = 0;
    state = ARMED;
    sendOffAll();
    Serial.println("ACK:ARM");
  } else if (cmd == "RESET") {
    state = LOCKED;
    pendingWinner = 0;
    sendOffAll();
    Serial.println("ACK:RESET");
  } else if (cmd == "PING") {
    Serial.println("PONG");
  } else if (cmd.length() > 0) {
    // Nieznana komenda — ignoruj, ale zaloguj
    Serial.printf("ERR:unknown:%s\n", cmd.c_str());
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("Blad ESP-NOW init");
    return;
  }
  esp_now_register_recv_cb(onRecv);
  addPeer(buzzer1Mac);
  addPeer(buzzer2Mac);

  Serial.println("READY");
}

void loop() {
  // Czytaj serial linia po linii
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      processLine(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') {
      serialBuffer += c;
      // Limit długości linii (ochrona przed przepełnieniem)
      if (serialBuffer.length() > 32) {
        serialBuffer = "";
      }
    }
  }

  // Obsluga zwyciezcy poza callbackiem
  if (state == ARMED && pendingWinner != 0) {
    uint8_t w = pendingWinner;
    state = BUZZED;
    sendCmd(macForId(w), MSG_WIN);
    Serial.printf("BUZZ:%d\n", w);
  }
}
