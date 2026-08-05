# Protokół serial — Host ESP32 ↔ Laptop

## Parametry
- **Baud:** 115200
- **Format:** 8N1
- **Terminator:** `\n` (LF)

## Komendy: Laptop → Host

| Komenda | Opis |
|---------|------|
| `ARM` | Uzbrój rundę — buzzery żywe, czekaj na pierwszy buzz |
| `RESET` | Zablokuj buzzery — nowa runda / koniec pojedynku |
| `PING` | Ping (host odpowiada `PONG`) |

## Komendy: Host → Laptop

| Komenda | Opis |
|---------|------|
| `READY` | Host gotowy (wysłane w `setup()`) |
| `BUZZ:1` | Buzzer 1 wygrał pojedynek |
| `BUZZ:2` | Buzzer 2 wygrał pojedynek |
| `ACK:ARM` | Potwierdzenie uzbrojenia |
| `ACK:RESET` | Potwierdzenie resetu |
| `PONG` | Odpowiedź na `PING` |
| `ERR:unknown:CMD` | Nieznana komenda (ignoruj) |

## Zachowanie

- **Tolerancyjny parser:** nieznane linie są logowane i ignorowane
- **Wielkość liter:** komendy rozpoznawane case-insensitive
- `BUZZ:n` gdzie n = numer buzera (obsługa variable liczby buzzerów)
- Odłączenie kabla: apka pokazuje 🔴, gra toczy się dalej (mock transport)

## ESP-NOW (buzzer ↔ host)

Pakiet 2 bajty: `{type, id}`
- `type: 1` (BUZZ) = buzzer → host
- `type: 2` (WIN) = host → buzzer (świeć)
- `type: 3` (OFF) = host → buzzer (gaś)

## Maszyna stanów hosta

```
LOCKED → [ARM] → ARMED → [buzz] → BUZZED → [RESET] → LOCKED
```
