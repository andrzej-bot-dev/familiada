// ===== HOST - Familiada =====
// Wgraj na ESP32 podlaczone do MacBooka.
// 1) Wklej nizej MAC-i obu buzzerow (z mac_reader).
// 2) Sterowanie z monitora portu (115200 baud):
//    'a' = uzbroj runde
//    'r' = reset
//
// Logika: pierwszy buzz w stanie ARMED wygrywa. Reszta zablokowana do resetu.

#include <WiFi.h>
#include <esp_now.h>

// >>> WKLEJ MAC-i BUZZEROW <<<
uint8_t buzzer1Mac[] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}; // BUZZER 1
uint8_t buzzer2Mac[] = {0x00, 0x00, 0x00, 0x00, 0x00, 0x00}; // BUZZER 2

// Typy wiadomosci
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
  Serial.println("Komendy: 'a' = uzbroj, 'r' = reset");
}

void loop() {
  // Sterowanie z monitora portu
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'a') {
      pendingWinner = 0;
      state = ARMED;
      sendOffAll();
      Serial.println("ARMED - czekam na pierwszy buzz");
    } else if (c == 'r') {
      state = LOCKED;
      pendingWinner = 0;
      sendOffAll();
      Serial.println("RESET - LOCKED");
    }
  }

  // Obsluga zwyciezcy poza callbackiem
  if (state == ARMED && pendingWinner != 0) {
    uint8_t w = pendingWinner;
    state = BUZZED;
    sendCmd(macForId(w), MSG_WIN);
    Serial.printf("ZWYCIEZCA: Buzzer %d\n", w);
  }
}
