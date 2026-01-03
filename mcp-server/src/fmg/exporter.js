import {chromium} from "playwright";
import {Mutex} from "./mutex.js";
import {startStaticServer} from "./staticServer.js";

function isLikelyPath(urlOrPath) {
  return typeof urlOrPath === "string" && !urlOrPath.includes("://");
}

function base64ByteLength(base64) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export class FmgExporter {
  #repoRoot;
  #headless;
  #timeoutMs;
  #mutex = new Mutex();
  #browser;
  #static;

  constructor({repoRoot, headless = true, timeoutMs = 180_000} = {}) {
    this.#repoRoot = repoRoot;
    this.#headless = headless;
    this.#timeoutMs = timeoutMs;
  }

  async #ensureStarted() {
    if (!this.#static) {
      const rootDir = isLikelyPath(this.#repoRoot)
        ? this.#repoRoot
        : new URL(this.#repoRoot).pathname;
      this.#static = await startStaticServer({rootDir});
    }

    if (!this.#browser) {
      try {
        this.#browser = await chromium.launch({
          headless: this.#headless,
          args: ["--disable-dev-shm-usage"]
        });
      } catch (error) {
        const message =
          "Playwright Chromium non disponibile. Esegui: `cd mcp-server && npx playwright install chromium`";
        const wrapped = new Error(message);
        wrapped.cause = error;
        throw wrapped;
      }
    }
  }

  async close() {
    if (this.#browser) {
      await this.#browser.close();
      this.#browser = undefined;
    }
    if (this.#static) {
      await this.#static.close();
      this.#static = undefined;
    }
  }

  async export({seed, format, options} = {}) {
    return this.#mutex.runExclusive(async () => {
      await this.#ensureStarted();

      const context = await this.#browser.newContext({
        viewport: {width: 1280, height: 720}
      });
      try {
        const page = await context.newPage();

        const url = new URL("/index.html", this.#static.baseUrl);
        if (seed) url.searchParams.set("seed", String(seed));

        await page.goto(url.toString(), {waitUntil: "load", timeout: this.#timeoutMs});

        await page.waitForFunction(() => {
          const ready =
            Boolean(document.getElementById("map")) &&
            typeof seed === "string" &&
            seed.length > 0 &&
            typeof pack === "object" &&
            pack &&
            typeof grid === "object" &&
            grid &&
            grid.cells &&
            grid.cells.h &&
            pack.cells &&
            pack.cells.i;
          return ready;
        }, null, {timeout: this.#timeoutMs});

        const result = await page.evaluate(
          async ({format, exportOptions}) => {
          function clampNumber(value, {min = -Infinity, max = Infinity} = {}) {
            const n = Number(value);
            if (!Number.isFinite(n)) return undefined;
            return Math.min(max, Math.max(min, n));
          }

          async function blobToBase64(blob) {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = () => reject(new Error("FileReader error"));
              reader.readAsDataURL(blob);
            });
            const s = String(dataUrl);
            const comma = s.indexOf(",");
            return comma >= 0 ? s.slice(comma + 1) : s;
          }

          async function canvasToBlob(canvas, mimeType, quality = 1) {
            return await new Promise((resolve, reject) => {
              canvas.toBlob(
                blob => {
                  if (blob) resolve(blob);
                  else reject(new Error("Canvas toBlob() error"));
                },
                mimeType,
                quality
              );
            });
          }

          const opts = exportOptions || {};
          const fileBase = typeof getFileName === "function" ? getFileName() : "map";

          const svgExportOptions = {
            debug: Boolean(opts.debug),
            noLabels: Boolean(opts.noLabels),
            noWater: Boolean(opts.noWater),
            noScaleBar: Boolean(opts.noScaleBar),
            noIce: Boolean(opts.noIce),
            noVignette: Boolean(opts.noVignette),
            fullMap: opts.fullMap !== undefined ? Boolean(opts.fullMap) : true
          };

          const resolution = clampNumber(opts.resolution, {min: 0.1, max: 20}) ?? 1;
          const jpegQuality = clampNumber(opts.quality, {min: 0, max: 1});

          async function exportSvg() {
            const url = await getMapURL("svg", {...svgExportOptions, fullMap: true});
            const text = await (await fetch(url)).text();
            return {filename: fileBase + ".svg", mimeType: "image/svg+xml", kind: "text", data: text};
          }

          async function exportRaster(mimeType) {
            const url = await getMapURL("png", {...svgExportOptions, fullMap: true});
            const img = new Image();
            img.src = url;
            await img.decode();

            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(graphWidth * resolution));
            canvas.height = Math.max(1, Math.round(graphHeight * resolution));
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const blob = await canvasToBlob(canvas, mimeType, jpegQuality ?? 0.92);
            const base64 = await blobToBase64(blob);
            const ext = mimeType === "image/png" ? "png" : "jpeg";
            return {filename: fileBase + "." + ext, mimeType, kind: "base64", data: base64};
          }

          async function exportMapFile() {
            if (typeof prepareMapData !== "function") throw new Error("prepareMapData is not available");
            const text = prepareMapData();
            return {filename: fileBase + ".map", mimeType: "text/plain", kind: "text", data: text};
          }

          function buildMapInfo() {
            return {
              version: VERSION,
              description: "Azgaar's Fantasy Map Generator output: azgaar.github.io/Fantasy-map-generator",
              exportedAt: new Date().toISOString(),
              mapName: mapName.value,
              width: graphWidth,
              height: graphHeight,
              seed,
              mapId
            };
          }

          function buildSettings() {
            return {
              distanceUnit: distanceUnitInput.value,
              distanceScale,
              areaUnit: areaUnit.value,
              heightUnit: heightUnit.value,
              heightExponent: heightExponentInput.value,
              temperatureScale: temperatureScale.value,
              populationRate: populationRate,
              urbanization: urbanization,
              mapSize: mapSizeOutput.value,
              latitude: latitudeOutput.value,
              longitude: longitudeOutput.value,
              prec: precOutput.value,
              options: window.options,
              mapName: mapName.value,
              hideLabels: hideLabels.checked,
              stylePreset: stylePreset.value,
              rescaleLabels: rescaleLabels.checked,
              urbanDensity: urbanDensity
            };
          }

          function buildPackCellsData() {
            const data = {
              v: pack.cells.v,
              c: pack.cells.c,
              p: pack.cells.p,
              g: Array.from(pack.cells.g),
              h: Array.from(pack.cells.h),
              area: Array.from(pack.cells.area),
              f: Array.from(pack.cells.f),
              t: Array.from(pack.cells.t),
              haven: Array.from(pack.cells.haven),
              harbor: Array.from(pack.cells.harbor),
              fl: Array.from(pack.cells.fl),
              r: Array.from(pack.cells.r),
              conf: Array.from(pack.cells.conf),
              biome: Array.from(pack.cells.biome),
              s: Array.from(pack.cells.s),
              pop: Array.from(pack.cells.pop),
              culture: Array.from(pack.cells.culture),
              burg: Array.from(pack.cells.burg),
              routes: pack.cells.routes,
              state: Array.from(pack.cells.state),
              religion: Array.from(pack.cells.religion),
              province: Array.from(pack.cells.province)
            };

            return {
              cells: Array.from(pack.cells.i).map(cellId => ({
                i: cellId,
                v: data.v[cellId],
                c: data.c[cellId],
                p: data.p[cellId],
                g: data.g[cellId],
                h: data.h[cellId],
                area: data.area[cellId],
                f: data.f[cellId],
                t: data.t[cellId],
                haven: data.haven[cellId],
                harbor: data.harbor[cellId],
                fl: data.fl[cellId],
                r: data.r[cellId],
                conf: data.conf[cellId],
                biome: data.biome[cellId],
                s: data.s[cellId],
                pop: data.pop[cellId],
                culture: data.culture[cellId],
                burg: data.burg[cellId],
                routes: data.routes[cellId],
                state: data.state[cellId],
                religion: data.religion[cellId],
                province: data.province[cellId]
              })),
              vertices: Array.from(pack.vertices.p).map((_, vertexId) => ({
                i: vertexId,
                p: pack.vertices.p[vertexId],
                v: pack.vertices.v[vertexId],
                c: pack.vertices.c[vertexId]
              })),
              features: pack.features,
              cultures: pack.cultures,
              burgs: pack.burgs,
              states: pack.states,
              provinces: pack.provinces,
              religions: pack.religions,
              rivers: pack.rivers,
              markers: pack.markers,
              routes: pack.routes,
              zones: pack.zones
            };
          }

          function buildGridCellsData() {
            const dataArrays = {
              v: grid.cells.v,
              c: grid.cells.c,
              b: grid.cells.b,
              f: Array.from(grid.cells.f),
              t: Array.from(grid.cells.t),
              h: Array.from(grid.cells.h),
              temp: Array.from(grid.cells.temp),
              prec: Array.from(grid.cells.prec)
            };

            return {
              cells: Array.from(grid.cells.i).map(cellId => ({
                i: cellId,
                v: dataArrays.v[cellId],
                c: dataArrays.c[cellId],
                b: dataArrays.b[cellId],
                f: dataArrays.f[cellId],
                t: dataArrays.t[cellId],
                h: dataArrays.h[cellId],
                temp: dataArrays.temp[cellId],
                prec: dataArrays.prec[cellId]
              })),
              vertices: Array.from(grid.vertices.p).map((_, vertexId) => ({
                i: vertexId,
                p: grid.vertices.p[vertexId],
                v: grid.vertices.v[vertexId],
                c: grid.vertices.c[vertexId]
              })),
              cellsDesired: grid.cellsDesired,
              spacing: grid.spacing,
              cellsY: grid.cellsY,
              cellsX: grid.cellsX,
              points: grid.points,
              boundary: grid.boundary,
              seed: grid.seed,
              features: pack.features
            };
          }

          async function exportJson(which) {
            const info = buildMapInfo();
            if (which === "packCells") {
              return {
                filename: fileBase + ".packCells.json",
                mimeType: "application/json",
                kind: "text",
                data: JSON.stringify({info, cells: buildPackCellsData()})
              };
            }

            if (which === "gridCells") {
              return {
                filename: fileBase + ".gridCells.json",
                mimeType: "application/json",
                kind: "text",
                data: JSON.stringify({info, cells: buildGridCellsData()})
              };
            }

            const settings = buildSettings();

            if (which === "minimal") {
              const packData = {
                features: pack.features,
                cultures: pack.cultures,
                burgs: pack.burgs,
                states: pack.states,
                provinces: pack.provinces,
                religions: pack.religions,
                rivers: pack.rivers,
                markers: pack.markers,
                routes: pack.routes,
                zones: pack.zones
              };
              const payload = {info, settings, mapCoordinates, pack: packData, biomesData, notes, nameBases};
              return {filename: fileBase + ".minimal.json", mimeType: "application/json", kind: "text", data: JSON.stringify(payload)};
            }

            const payload = {
              info,
              settings,
              mapCoordinates,
              pack: buildPackCellsData(),
              grid: buildGridCellsData(),
              biomesData,
              notes,
              nameBases
            };
            return {filename: fileBase + ".full.json", mimeType: "application/json", kind: "text", data: JSON.stringify(payload)};
          }

          async function exportGeoJson(kind) {
            if (kind === "cells") {
              const {cells, vertices} = pack;
              const json = {type: "FeatureCollection", features: []};

              const getPopulation = i => {
                const [r, u] = getCellPopulation(i);
                return rn(r + u);
              };
              const getHeight = i => parseInt(getFriendlyHeight([...cells.p[i]]));
              function getCellCoordinates(cellVertices) {
                const coordinates = cellVertices.map(vertex => {
                  const [x, y] = vertices.p[vertex];
                  return getCoordinates(x, y, 4);
                });
                return [[...coordinates, coordinates[0]]];
              }

              cells.i.forEach(i => {
                const coordinates = getCellCoordinates(cells.v[i]);
                const height = getHeight(i);
                const biome = cells.biome[i];
                const type = pack.features[cells.f[i]].type;
                const population = getPopulation(i);
                const state = cells.state[i];
                const province = cells.province[i];
                const culture = cells.culture[i];
                const religion = cells.religion[i];
                const neighbors = cells.c[i];

                const properties = {id: i, height, biome, type, population, state, province, culture, religion, neighbors};
                const feature = {type: "Feature", geometry: {type: "Polygon", coordinates}, properties};
                json.features.push(feature);
              });

              return {filename: fileBase + ".cells.geojson", mimeType: "application/geo+json", kind: "text", data: JSON.stringify(json)};
            }

            if (kind === "routes") {
              const features = pack.routes.map(({i, points, group, name = null}) => {
                const coordinates = points.map(([x, y]) => getCoordinates(x, y, 4));
                return {type: "Feature", geometry: {type: "LineString", coordinates}, properties: {id: i, group, name}};
              });
              return {
                filename: fileBase + ".routes.geojson",
                mimeType: "application/geo+json",
                kind: "text",
                data: JSON.stringify({type: "FeatureCollection", features})
              };
            }

            if (kind === "rivers") {
              const features = pack.rivers
                .map(({i, cells, points, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, name, type}) => {
                  if (!cells || cells.length < 2) return null;
                  const meanderedPoints = Rivers.addMeandering(cells, points);
                  const coordinates = meanderedPoints.map(([x, y]) => getCoordinates(x, y, 4));
                  return {
                    type: "Feature",
                    geometry: {type: "LineString", coordinates},
                    properties: {id: i, source, mouth, parent, basin, widthFactor, sourceWidth, discharge, name, type}
                  };
                })
                .filter(Boolean);

              return {
                filename: fileBase + ".rivers.geojson",
                mimeType: "application/geo+json",
                kind: "text",
                data: JSON.stringify({type: "FeatureCollection", features})
              };
            }

            if (kind === "markers") {
              const features = pack.markers.map(marker => {
                const {i, type, icon, x, y, size, fill, stroke} = marker;
                const coordinates = getCoordinates(x, y, 4);
                const note = notes.find(note => note.id === "marker" + i);
                const properties = {id: i, type, icon, x, y, ...note, size, fill, stroke};
                return {type: "Feature", geometry: {type: "Point", coordinates}, properties};
              });

              return {
                filename: fileBase + ".markers.geojson",
                mimeType: "application/geo+json",
                kind: "text",
                data: JSON.stringify({type: "FeatureCollection", features})
              };
            }

            throw new Error("Unknown GeoJSON kind");
          }

          async function exportTilesZip() {
            if (!window.JSZip) {
              await import("./libs/jszip.min.js");
            }
            const JSZip = window.JSZip;
            if (!JSZip) throw new Error("JSZip not available");

            const tilesX = clampNumber(opts.tilesX, {min: 1, max: 50}) ?? 2;
            const tilesY = clampNumber(opts.tilesY, {min: 1, max: 50}) ?? 2;
            const scale = clampNumber(opts.tileScale, {min: 0.1, max: 10}) ?? 1;

            const zip = new JSZip();

            const urlSchema = await getMapURL("tiles", {debug: true, fullMap: true});
            const schemaImg = new Image();
            schemaImg.src = urlSchema;
            await schemaImg.decode();

            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = graphWidth;
            canvas.height = graphHeight;
            ctx.drawImage(schemaImg, 0, 0, canvas.width, canvas.height);
            zip.file("schema.png", await canvasToBlob(canvas, "image/png"));

            const url = await getMapURL("tiles", {fullMap: true});
            const img = new Image();
            img.src = url;
            await img.decode();

            const tileW = (graphWidth / tilesX) | 0;
            const tileH = (graphHeight / tilesY) | 0;

            const width = graphWidth * scale;
            const height = width * (tileH / tileW);
            canvas.width = width;
            canvas.height = height;

            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            function getRowLabel(row) {
              const first = row >= alphabet.length ? alphabet[Math.floor(row / alphabet.length) - 1] : "";
              const last = alphabet[row % alphabet.length];
              return first + last;
            }

            for (let y = 0, row = 0; y + tileH <= graphHeight; y += tileH, row++) {
              const rowName = getRowLabel(row);
              for (let x = 0, cell = 1; x + tileW <= graphWidth; x += tileW, cell++) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, x, y, tileW, tileH, 0, 0, width, height);
                const blob = await canvasToBlob(canvas, "image/png");
                zip.file(`${rowName}${cell}.png`, blob);
              }
            }

            const base64 = await zip.generateAsync({type: "base64"});
            return {filename: fileBase + ".zip", mimeType: "application/zip", kind: "base64", data: base64};
          }

          async function exportHeightmapPng() {
            const tiny = document.createElement("canvas");
            tiny.width = grid.cellsX;
            tiny.height = grid.cellsY;
            const ctx = tiny.getContext("2d");
            const imageData = ctx.createImageData(grid.cellsX, grid.cellsY);

            grid.cells.h.forEach((height, i) => {
              const h = height < 20 ? Math.max(height / 1.5, 0) : height;
              const v = (h / 100) * 255;
              const n = i * 4;
              imageData.data[n] = v;
              imageData.data[n + 1] = v;
              imageData.data[n + 2] = v;
              imageData.data[n + 3] = 255;
            });
            ctx.putImageData(imageData, 0, 0);

            const img = new Image();
            img.src = tiny.toDataURL("image/png");
            await img.decode();

            const canvas = document.createElement("canvas");
            canvas.width = graphWidth;
            canvas.height = graphHeight;
            canvas.getContext("2d").drawImage(img, 0, 0, graphWidth, graphHeight);
            const blob = await canvasToBlob(canvas, "image/png");
            const base64 = await blobToBase64(blob);
            return {filename: fileBase + ".heightmap.png", mimeType: "image/png", kind: "base64", data: base64};
          }

          switch (String(format)) {
            case "svg":
              return await exportSvg();
            case "png":
              return await exportRaster("image/png");
            case "jpeg":
              return await exportRaster("image/jpeg");
            case "map":
              return await exportMapFile();
            case "json_full":
              return await exportJson("full");
            case "json_minimal":
              return await exportJson("minimal");
            case "json_pack_cells":
              return await exportJson("packCells");
            case "json_grid_cells":
              return await exportJson("gridCells");
            case "geojson_cells":
              return await exportGeoJson("cells");
            case "geojson_routes":
              return await exportGeoJson("routes");
            case "geojson_rivers":
              return await exportGeoJson("rivers");
            case "geojson_markers":
              return await exportGeoJson("markers");
            case "tiles_zip":
              return await exportTilesZip();
            case "heightmap_png":
              return await exportHeightmapPng();
            default:
              throw new Error("Unsupported format: " + format);
          }
        },
        {format, exportOptions: options}
      );

      const base64 =
        result.kind === "base64" ? result.data : Buffer.from(String(result.data), "utf8").toString("base64");
      return {
        filename: result.filename,
        mimeType: result.mimeType,
        base64,
        sizeBytes: base64ByteLength(base64)
      };
      } finally {
        await context.close();
      }
    });
  }
}
