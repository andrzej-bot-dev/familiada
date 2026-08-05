# Decyzje projektowe

## D1: Vanilla JS + ES modules (bez frameworka)
**Dlaczego:** Zero build-stepu, zero zależności, działa offline natychmiast.

## D2: BroadcastChannel zamiast WebSocket
**Dlaczego:** Działa między oknami tej samej strony bez serwera. Fallback na localStorage events.

## D3: Reducer pattern (jak Redux) dla stanu
**Dlaczego:** Przewidywalne, testowalne, łatwe undo/redo.

## D4: Mock transport jako domyślny
**Dlaczego:** Apka jest grywalna od razu, bez sprzętu. F2/F3 symulują buzz.

## D5: Audio przez <audio> + cache
**Dlaczego:** Proste, działa offline, nie wymaga Web Audio API.

## D6: Plansza nie trzyma stanu
**Dlaczego:** Single source of truth = panel. Plansza to tylko render. Mniej bugów.

## D7: localStorage zapis po każdej zmianie
**Dlaczego:** F5 nie kasuje wyników. Nie trzeba "zapisywać".

## D8: CSS custom properties zamiast CSS-in-JS
**Dlaczego:** Zero zależności, motywy przez `data-motyw` atrybut.

## D9: Parser serial tolerancyjny na nieznane linie
**Dlaczego:** Host może wysyłać debug info. Apka nie może się wywalić.

## D10: Edytor pytań w pamięci (bez zapisu na dysk)
**Dlaczego:** Browser nie ma dostępu do filesystem. Eksport/import JSON wystarczy.
