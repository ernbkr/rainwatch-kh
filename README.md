# Cambodia Radar Desktop Viewer

A minimal Electron desktop app for viewing the latest Cambodia Meteo radar animation.

## Run

```bash
npm install
npm start
```

## Test

```bash
npm test
```

## Scope

V1 supports the Cambodia Meteo radar slideshow domains:

- `PHN` / 80 KM
- `240KM` / 240 KM
- `CAMBODIA` / 450 KM

The app fetches the public slideshow page from the Electron main process, parses the radar image arrays, and displays a looping animation in the renderer.

## Map Context

The MapLibre context layer is configured in `src/map-config.js`. Edit `styleUrl` to use a trusted MapLibre style URL, and tune each domain's `center`, `zoom`, and `coordinates` values there to align the georeferenced radar overlay.

The app crops the left `800x800` radar panel from each `1069x800` Cambodia Meteo frame and renders it as a MapLibre `image` source. Use the on-screen georeference panel to adjust the four image corners and copy updated config values.

MapLibre styles must provide their own tile sources, glyphs, sprites, and attribution. Do not use `mapbox://` style URLs or commit provider API keys.
