# Harbor Lights

A "cozy cosmic horror" browser game prototype. You are the keeper of a remote
signal station. Layered ambient audio sets the mood; fragmented radio
transmissions arrive from approaching vessels, and you decide what to do with
them. Fuel drains over time. If the beacon goes out, something beneath the
surface wakes up.

The tone escalates in phases:

- **Phase 0** — mundane maritime traffic
- **Phase 1** — slightly off
- **Phase 2** — clearly wrong
- **Phase 3** — existential dread

Think *Dredge* meets *Papers Please* meets a radio operator's nightmare.

## Stack

- Vite + React 18
- [Tone.js](https://tonejs.github.io/) for layered procedural audio (no asset
  files — everything is synthesised in-browser)
- Transmissions defined as data in `src/data/transmissions.json` so new
  content can be added without touching game logic

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints, click the pulsing dot to start audio (browsers
require a user gesture), and the first transmission will arrive shortly after.

## Project layout

```
src/
  audio/engine.js          # Tone.js layer graph (ocean, wind, static, horn, deep)
  components/SignalStation.jsx  # UI shell, splash, panels, decision buttons
  data/transmissions.json  # All transmission content — edit freely
  state/useStation.js      # Game state hook: queue, fuel, logbook, decisions
  main.jsx                 # Entry point
reference/
  lighthouse-signal-station.jsx  # Original single-file prototype (kept for tone reference)
```

## Adding a transmission

Append an object to `src/data/transmissions.json`:

```json
{
  "id": "t9",
  "callsign": "MV EXAMPLE",
  "freq": "156.999",
  "phase": 1,
  "fragments": [
    "First line typed out...",
    "Second line...",
    "And so on."
  ]
}
```

Phase controls both the colour treatment and which decision buttons are
available (`INVESTIGATE` unlocks at phase ≥ 1, `REFUEL` at phase ≥ 2).

## Status

Side project for creative exploration. Not portfolio polish — expect rough
edges and frequent rewrites.
