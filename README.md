# Wandfarben – Das Ziegelwand-Spiel

Ein kleines Browserspiel. Tippe die **blauen** Ziegel mit der **linken Maustaste** an, um sie **rot** zu machen. Es werden aber immer mehr Ziegel blau – und immer schneller. Schaffst du es, die Wand unter Kontrolle zu halten?

## Spielen

Einfach `index.html` im Browser öffnen – keine Installation nötig.

Alternativ online spielen unter:
https://TH3RRMA.github.io/wandfarben_game/

## Steuerung

- **Linke Maustaste** (oder Fingertipp auf Touchscreens): blauen Ziegel antippen
- **Enter** oder **Leertaste**: Spiel starten / neu starten

## So funktioniert's

- Ziegel beginnen blau und werden durch Antippen rot.
- Nach und nach werden zufällige rote Ziegel wieder blau – das Tempo steigt dabei stetig an.
- Das Spiel ist in **Phasen** unterteilt (je 30 Sekunden). Danach gibt es eine Pause.
- In den Pausen kaufst du **Upgrades** (z. B. größerer Einfärbe-Radius) mit deinen Punkten.
- **Fehlklicks** auf rote Ziegel verschlechtern die angebotenen Upgrades.
- Das Spiel endet, sobald alle Ziegel gleichzeitig blau sind.
- Eine lokale **Top-10-Bestenliste** wird im Browser gespeichert.

## Dateien

- `index.html` – Struktur und Oberfläche
- `style.css` – Design der Ziegelwand
- `game.js` – Spiellogik
