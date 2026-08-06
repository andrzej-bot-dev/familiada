// ===== HOST - Familiada v2 (dynamiczne buzzery: dowolne 2 z N) =====
//
// CO SIE ZMIENIA DLA APKI: NIC.
// Apka dalej wysyla ARM / RESET / PING,
// host dalej odsyla READY / BUZZ:1 / BUZZ:2 / ACK:ARM / ACK:RESET / PONG.
// BUZZ:1 i BUZZ:2 to NUMER DRUZYNY (slot), a nie numer fizycznego buzzera.
// Dochodza dodatkowe linie diagnostyczne z prefiksem "INFO:" - apka moze je
// spokojnie ignorowac (tak samo jak dotad ignorowala "ERR:unknown:").
//
// JAK TO DZIALA
// - MAC-ow buzzerow NIE trzeba juz wklejac. Host uczy sie ich sam.
// - Kazdy buzzer co ~3 s wysyla HELLO. Host trzyma liste wlaczonych.
// - Host sortuje wlaczone buzzery po ich MY_ID rosnaco:
//   najnizszy MY_ID -> DRUZYNA 1 (slot 1, ring czerwony)
//   drugi w kolejce -> DRUZYNA 2 (slot 2, ring niebieski)
//   reszta -> REZERWA (slot 0, ring bursztynowy, buzz ignorowany)
//   Przydzial jest DETERMINISTYCZNY: reset hosta / apki nie zamieni druzyn
//   miejscami.
// - Buzzer, ktory zamilknie na ponad 6 s (wylaczony, padl), wypada z listy
//   i sloty licza sie od nowa. Wystarczy: wylacz zepsuty, wlacz zapasowy.
// - Przeliczanie slotow dzieje sie TYLKO w stanie LOCKED (miedzy rundami),
//   zeby nic sie nie przestawilo w srodku pojedynku.
//
// SCENARIUSZ AWARYJNY NA WESELU
// 1. Wylacz oba buzzery pstryczkiem.
// 2. Wlacz ten, ktory dziala + zapasowy.
// 3. Poczekaj ~5 s. Ringi zapala sie na czerwono i niebiesko = gotowe.
//    (Czerwony to zawsze DRUZYNA 1.)
// 4. Reload apki, Polacz z hostem, graj dalej. Hosta nie trzeba ruszac.
//
// DODATKOWE KOMENDY (do wpisania recznie w Serial Monitorze, apka ich nie uzywa)
//   WHO    - wypisz liste wykrytych buzzerow i przydzialy
//   RESCAN - wyczysc liste, przydziel od nowa (buzzery zglosza sie w ~3 s)
//   SWAP   - zamien DRUZYNE 1 z DRUZYNA 2 miejscami

#include <WiFi.h>
#include <esp_now.h>

// ---- protokol ESP-NOW ----
#define MSG_BUZZ   1   // buzzer -> host: wcisnieto
#define MSG_WIN    2   // host -> buzzer: swiec
#define MSG_OFF    3   // host -> buzzer: gas
#define MSG_HELLO  4   // buzzer -> host: zyje, jestem MY_ID
#define MSG_ASSIGN 5   // host -> buzzer: twoj slot (0/1/2)

#define MAX_DEV 8
#define DEV_TIMEOUT_MS 6000  // brak HELLO tak dlugo = buzzer wypada z gry
                              // (buzzer nadaje HELLO co 2 s -> 3 zgubione pakiety
                              //  zanim uznamy go za wylaczonego)

typedef struct {
  uint8_t type;
  uint8_t id;
} Packet;

struct Dev {
  bool used;
  bool online;
  bool peer;
  uint8_t mac[6];
  uint8_t id;        // MY_ID zgloszony przez buzzer
  uint8_t slot;      // 0 = rezerwa, 1 = druzyna 1, 2 = druzyna 2
  unsigned long lastSeen;
};
Dev devs[MAX_DEV];

enum State { LOCKED, ARMED, BUZZED };
State state = LOCKED;
bool needRecalc = false;

// --- kolejka zdarzen z callbacku ESP-NOW (callback nic sam nie wysyla) ---
struct Evt { uint8_t mac[6]; uint8_t type; uint8_t id; };
#define QN 16
Evt q[QN];
volatile uint8_t qHead = 0, qTail = 0;

String serialBuffer = "";

// ---------- POMOCNICZE ----------

String macStr(const uint8_t *m) {
  char b[18];
  sprintf(b, "%02X:%02X:%02X:%02X:%02X:%02X", m[0], m[1], m[2], m[3], m[4], m[5]);
  return String(b);
}

int findDev(const uint8_t *mac) {
  for (int i = 0; i < MAX_DEV; i++)
    if (devs[i].used && memcmp(devs[i].mac, mac, 6) == 0) return i;
  return -1;
}

void ensurePeer(int i) {
  if (devs[i].peer) return;
  esp_now_peer_info_t p = {};
  memcpy(p.peer_addr, devs[i].mac, 6);
  p.channel = 0;
  p.encrypt = false;
  esp_err_t r = esp_now_add_peer(&p);
  if (r == ESP_OK || r == ESP_ERR_ESPNOW_EXIST) devs[i].peer = true;
}

void sendPacket(int i, uint8_t type, uint8_t id) {
  if (i < 0 || !devs[i].used) return;
  ensurePeer(i);
  Packet p = { type, id };
  esp_now_send(devs[i].mac, (uint8_t*)&p, sizeof(p));
}

void sendAssign(int i) {
  sendPacket(i, MSG_ASSIGN, devs[i].slot);
}

void sendOffAll() {
  // celowo do WSZYSTKICH znanych, nie tylko "online" - gdyby ktorys zostal
  // blednie uznany za offline, i tak ma zgasnac
  for (int i = 0; i < MAX_DEV; i++)
    if (devs[i].used) sendPacket(i, MSG_OFF, 0);
}

int devForSlot(uint8_t slot) {
  for (int i = 0; i < MAX_DEV; i++)
    if (devs[i].used && devs[i].online && devs[i].slot == slot) return i;
  return -1;
}

int countTeams() {
  int n = 0;
  if (devForSlot(1) >= 0) n++;
  if (devForSlot(2) >= 0) n++;
  return n;
}

// ---------- LISTA URZADZEN ----------

int findOrAdd(const uint8_t *mac, uint8_t id) {
  int i = findDev(mac);
  if (i >= 0) {
    if (!devs[i].online) {
      devs[i].online = true;
      needRecalc = true;
      Serial.printf("INFO:BACK id=%d mac=%s\n", devs[i].id, macStr(mac).c_str());
    }
    devs[i].id = id;
    devs[i].lastSeen = millis();
    return i;
  }
  for (int k = 0; k < MAX_DEV; k++) {
    if (!devs[k].used) {
      devs[k].used = true;
      devs[k].online = true;
      devs[k].peer = false;
      memcpy(devs[k].mac, mac, 6);
      devs[k].id = id;
      devs[k].slot = 0;
      devs[k].lastSeen = millis();
      ensurePeer(k);
      needRecalc = true;
      Serial.printf("INFO:JOIN id=%d mac=%s\n", id, macStr(mac).c_str());
      return k;
    }
  }
  return -1;
}

bool devLess(int a, int b) {
  if (devs[a].id != devs[b].id) return devs[a].id < devs[b].id;
  return memcmp(devs[a].mac, devs[b].mac, 6) < 0;
}

void printOneSlot(uint8_t slot) {
  int d = devForSlot(slot);
  Serial.printf(" druzyna%d=", slot);
  if (d < 0) Serial.print("---");
  else Serial.printf("id%d/%s", devs[d].id, macStr(devs[d].mac).c_str());
}

void printSlots() {
  Serial.print("INFO:SLOTS");
  printOneSlot(1);
  printOneSlot(2);
  Serial.println();
  if (countTeams() < 2) Serial.println("INFO:UWAGA - mniej niz 2 buzzery online");
}

void recalcSlots() {
  int idx[MAX_DEV];
  int n = 0;
  for (int i = 0; i < MAX_DEV; i++)
    if (devs[i].used && devs[i].online) idx[n++] = i;

  // sortowanie po MY_ID rosnaco (remis -> po MAC): deterministyczne przydzialy
  for (int a = 0; a < n - 1; a++)
    for (int b = a + 1; b < n; b++)
      if (devLess(idx[b], idx[a])) { int t = idx[a]; idx[a] = idx[b]; idx[b] = t; }

  for (int i = 0; i < MAX_DEV; i++) if (devs[i].used) devs[i].slot = 0;
  for (int k = 0; k < n && k < 2; k++) devs[idx[k]].slot = k + 1;

  for (int k = 0; k < n; k++) sendAssign(idx[k]);
  printSlots();
}

// ---------- CALLBACK ESP-NOW (tylko kolejkuje) ----------

void pushEvt(const uint8_t *mac, uint8_t type, uint8_t id) {
  uint8_t next = (uint8_t)((qHead + 1) % QN);
  if (next == qTail) return; // kolejka pelna - gubimy pakiet
  memcpy(q[qHead].mac, mac, 6);
  q[qHead].type = type;
  q[qHead].id = id;
  qHead = next;
}

#if ESP_ARDUINO_VERSION_MAJOR >= 3
void onRecv(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  const uint8_t *src = info->src_addr;
#else
void onRecv(const uint8_t *mac, const uint8_t *data, int len) {
  const uint8_t *src = mac;
#endif
  if (len < (int)sizeof(Packet)) return;
  Packet p;
  memcpy(&p, data, sizeof(p));
  pushEvt(src, p.type, p.id);
}

// ---------- OBSLUGA ZDARZEN (w loop, kolejnosc = kolejnosc odbioru) ----------

void handleEvt(const Evt &e) {
  int i = findOrAdd(e.mac, e.id);
  if (i < 0) return;

  if (e.type == MSG_HELLO) {
    sendAssign(i); // odswieza tez watchdog po stronie buzzera
    return;
  }

  if (e.type == MSG_BUZZ) {
    if (state != ARMED) return; // LOCKED / juz ktos wygral
    if (devs[i].slot != 1 && devs[i].slot != 2) { // rezerwa - ignorujemy
      Serial.printf("INFO:IGNORED buzz od rezerwy id=%d\n", devs[i].id);
      return;
    }
    state = BUZZED;
    sendPacket(i, MSG_WIN, 0);
    Serial.printf("BUZZ:%d\n", devs[i].slot); // <<< to czyta apka
  }
}

// ---------- PARSER SERIAL ----------

void printWho() {
  Serial.println("INFO:--- lista buzzerow ---");
  for (int i = 0; i < MAX_DEV; i++) {
    if (!devs[i].used) continue;
    const char *s = devs[i].slot == 1 ? "DRUZYNA 1"
                  : devs[i].slot == 2 ? "DRUZYNA 2" : "rezerwa";
    Serial.printf("INFO:DEV id=%d mac=%s %s %s (ostatnio %lu ms temu)\n",
      devs[i].id, macStr(devs[i].mac).c_str(),
      devs[i].online ? "ONLINE " : "offline", s,
      millis() - devs[i].lastSeen);
  }
  printSlots();
}

void processLine(const String &line) {
  String cmd = line;
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "ARM") {
    state = ARMED;
    sendOffAll();
    Serial.println("ACK:ARM");
    if (countTeams() < 2) Serial.println("INFO:UWAGA - gra mniej niz 2 buzzery");

  } else if (cmd == "RESET") {
    state = LOCKED;
    sendOffAll();
    Serial.println("ACK:RESET");
    if (needRecalc) { needRecalc = false; recalcSlots(); }

  } else if (cmd == "PING") {
    Serial.println("PONG");

  } else if (cmd == "WHO") {
    printWho();

  } else if (cmd == "RESCAN") {
    for (int i = 0; i < MAX_DEV; i++) { devs[i].used = false; devs[i].online = false; devs[i].peer = false; devs[i].slot = 0; }
    needRecalc = true;
    Serial.println("INFO:RESCAN - czekam na HELLO (~3 s)");

  } else if (cmd == "SWAP") {
    int d1 = devForSlot(1), d2 = devForSlot(2);
    if (d1 >= 0) devs[d1].slot = 2;
    if (d2 >= 0) devs[d2].slot = 1;
    if (d1 >= 0) sendAssign(d1);
    if (d2 >= 0) sendAssign(d2);
    Serial.println("INFO:SWAP");
    printSlots();

  } else if (cmd.length() > 0) {
    Serial.printf("ERR:unknown:%s\n", cmd.c_str());
  }
}

// ---------- SETUP / LOOP ----------

void setup() {
  Serial.begin(115200);
  delay(300);

  for (int i = 0; i < MAX_DEV; i++) devs[i].used = false;

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(200);

  if (esp_now_init() != ESP_OK) {
    Serial.println("BLAD: ESP-NOW init");
    return;
  }
  esp_now_register_recv_cb(onRecv);

  Serial.println("READY");
  Serial.printf("INFO:HOST MAC=%s (ten MAC ma byc w buzzerach)\n",
    WiFi.macAddress().c_str());
  Serial.println("INFO:czekam na HELLO od buzzerow...");
}

void loop() {
  // 1) zdarzenia z radia
  while (qTail != qHead) {
    Evt e = q[qTail];
    qTail = (uint8_t)((qTail + 1) % QN);
    handleEvt(e);
  }

  // 2) timeouty - kto zamilkl, ten wypada
  unsigned long now = millis();
  for (int i = 0; i < MAX_DEV; i++) {
    if (devs[i].used && devs[i].online && (now - devs[i].lastSeen > DEV_TIMEOUT_MS)) {
      devs[i].online = false;
      // UWAGA: slotu tu NIE zerujemy. Gdyby w srodku uzbrojonej rundy zgubily sie
      // 3 pakiety HELLO, buzzer stalby sie "rezerwa" i host zignorowalby jego buzz.
      // Slot czyszczony jest dopiero w recalcSlots(), a to chodzi tylko w LOCKED.
      needRecalc = true;
      Serial.printf("INFO:LOST id=%d mac=%s\n", devs[i].id, macStr(devs[i].mac).c_str());
    }
  }

  // 3) przeliczenie slotow tylko miedzy rundami
  if (needRecalc && state == LOCKED) {
    needRecalc = false;
    recalcSlots();
  }

  // 4) serial z apki
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      processLine(serialBuffer);
      serialBuffer = "";
    } else if (c != '\r') {
      serialBuffer += c;
      if (serialBuffer.length() > 32) serialBuffer = "";
    }
  }
}
