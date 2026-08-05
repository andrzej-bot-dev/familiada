# Pytania — format i tworzenie

## Format pliku zestawu

```json
{
  "nazwa": "Familiada Weselna",
  "opis": "Pytania na wesele",
  "pytania": [
    {
      "id": "w1",
      "pytanie": "Co robi się na weselu?",
      "odpowiedzi": [
        { "tekst": "Tańczy się", "punkty": 38 },
        { "tekst": "Je się", "punkty": 24 },
        { "tekst": "Pije się", "punkty": 18 },
        { "tekst": "Bawi się / śpiewa", "punkty": 12 },
        { "tekst": "Składa życzenia", "punkty": 8 }
      ]
    }
  ]
}
```

## Zasady

- Odpowiedzi posortowane od najwyższej (najpopularniejszej)
- Suma punktów ≈ 100 (reprezentuje "100 osób")
- 3-8 odpowiedzi na pytanie
- ID unikalne w obrębie zestawu

## Edytor

Otwórz `edytor.html` w przeglądarce:
- Twórz/edytuj/usuwaj pytania
- Importuj/eksportuj pliki JSON
- Walidacja na żywo

## Ręczne tworzenie

1. Stwórz plik JSON w `data/zestawy/`
2. Dodaj wpis w `data/indeks.json` → `zestawy`
3. Wybierz w panelu

## Wskazówki

- Pytania uniwersalne = baza + można zmienić nazwy drużyn
- Pytania okolicznościowe (wesele, firma) = bardziej angażujące
- Krótkie odpowiedzi (1-3 słowa) lepiej wyglądają na planszy
- Używaj " / " dla odpowiedzi bliskozwiązanych ("Bawi się / śpiewa")
