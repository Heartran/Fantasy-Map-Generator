# Fantasy Map Generator — MCP Server

Questo progetto è una web app (DOM/SVG/canvas). Questo MCP server la avvia in **headless Chromium** e ti espone tool MCP per generare/esportare mappe.

## Requisiti

- Node.js (testato con Node 22)
- Dipendenze npm in `mcp-server/`
- Browser Playwright (Chromium)

## Install

Da root repo:

```bash
cd mcp-server
npm install
npx playwright install chromium
```

## Avvio (stdio)

```bash
cd mcp-server
npm run mcp:stdio
```

## Avvio (HTTP/SSE)

```bash
cd mcp-server
npm run mcp:http -- --port 3333
```

Endpoint:
- SSE: `http://127.0.0.1:3333/mcp/sse`
- POST messages: `http://127.0.0.1:3333/mcp/message?sessionId=...`

## Tool principali

- `fmg_formats`: lista formati supportati
- `fmg_export`: genera + esporta in un formato

### Formati (`format`)

ID supportati (vedi anche `fmg_formats`):

- `svg`, `png`, `jpeg`, `map`
- `json_full`, `json_minimal`, `json_pack_cells`, `json_grid_cells`
- `geojson_cells`, `geojson_routes`, `geojson_rivers`, `geojson_markers`
- `tiles_zip`, `heightmap_png`

### Opzioni (`options`)

- Raster: `resolution` (es. `2`), `quality` (solo `jpeg`, 0..1)
- SVG/raster: `noLabels`, `noWater`, `noScaleBar`, `noIce`, `noVignette`, `debug`
- Tiles: `tilesX`, `tilesY`, `tileScale`

## Variabili d'ambiente

- `FMG_REPO_ROOT`: path al repo (default: 2 livelli sopra `mcp-server/src`)
- `FMG_HEADLESS=false`: avvia Chromium non-headless (debug)
- `FMG_MCP_TIMEOUT_MS`: timeout per generazione/export (default `180000`)
