#!/bin/bash
# Start lokalnego serwera Familiady
cd "$(dirname "$0")"
echo "🎪 Familiada — uruchamianie serwera"
echo "=================================="
echo ""
echo "  Panel:    http://localhost:8123/panel.html"
echo "  Plansza:  http://localhost:8123/plansza.html"
echo "  Edytor:   http://localhost:8123/edytor.html"
echo "  Start:    http://localhost:8123/"
echo ""
echo "  Ctrl+C = zatrzymaj"
echo ""
python3 -m http.server 8123
