export const FMG_FORMATS = [
  {id: "svg", ext: ".svg", mimeType: "image/svg+xml", description: "Mappa come SVG (full map)"},
  {id: "png", ext: ".png", mimeType: "image/png", description: "Mappa come PNG (full map)"},
  {id: "jpeg", ext: ".jpeg", mimeType: "image/jpeg", description: "Mappa come JPEG (full map)"},
  {id: "map", ext: ".map", mimeType: "text/plain", description: "Formato nativo FMG (.map)"},

  {id: "json_full", ext: ".full.json", mimeType: "application/json", description: "Export JSON completo (pack + grid)"},
  {id: "json_minimal", ext: ".minimal.json", mimeType: "application/json", description: "Export JSON minimale (pack senza celle)"},
  {id: "json_pack_cells", ext: ".packCells.json", mimeType: "application/json", description: "Export JSON celle pack"},
  {id: "json_grid_cells", ext: ".gridCells.json", mimeType: "application/json", description: "Export JSON celle grid"},

  {id: "geojson_cells", ext: ".cells.geojson", mimeType: "application/geo+json", description: "GeoJSON celle"},
  {id: "geojson_routes", ext: ".routes.geojson", mimeType: "application/geo+json", description: "GeoJSON rotte"},
  {id: "geojson_rivers", ext: ".rivers.geojson", mimeType: "application/geo+json", description: "GeoJSON fiumi"},
  {id: "geojson_markers", ext: ".markers.geojson", mimeType: "application/geo+json", description: "GeoJSON marker"},

  {id: "tiles_zip", ext: ".zip", mimeType: "application/zip", description: "Zip di tile PNG + schema"},
  {id: "heightmap_png", ext: ".heightmap.png", mimeType: "image/png", description: "PNG heightmap (scala grigi)"}
];

