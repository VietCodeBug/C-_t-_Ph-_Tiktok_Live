# Map handoff — 10 seats, portrait 9:16

## Files

- cho_via_he.glb / pho_giao_hang.glb: static map geometry and named anchor nodes; no external texture dependencies.
- source/*.blend: editable layers, materials, orthographic camera and lighting. DEBUG_10_SEATS contains temporary preview markers; hide/remove that collection when placing your own characters.
- board_layouts.json: directed graph, source and adapted coordinates, spawn rules, camera bounds and collider proposals.
- previews/*_10_seats_1080x1920.png: ten debug seat markers distributed on the board.
- previews/*_spawn_1080x1920.png: odd seats at C00 and even seats at C08, five slots each.
- validation.json: actual map checks. This is not a game or network benchmark.

## Coordinate contract

GLB/JSON use +Y up, X/Z ground, in world units. Tile width is 2. Tile face top is y=0. Blender uses its normal +Z-up coordinates and the exporter converts to glTF automatically. Character reference height from the worksheet is 1.15 wu.

The source proposals are adapted for portrait: CHO source (x,z) maps to (z-3,(7-x)*1.6); PHO maps to (x,z*1.6). source_position and source_row retain the original data. Topology and step counts are unchanged.

## Replace with your own assets

- NODE_C00 etc.: token foot anchors, one per logical tile.
- SPAWN_C00_1..5 / SPAWN_C08_1..5: five foot anchors around each start station.
- ASSET_SLOT_TILE_<ID>: event prop placement anchors; keep walking surfaces visible.
- ASSET_SLOT_MARKET_<n> / ASSET_SLOT_WAREHOUSE_<n>: central prop anchors. Read maximum_footprint_x/z and suggested_max_height from node extras before sizing a prop. Narrow lanes have smaller limits.
- FORK_CAMERA_C02 / FORK_CAMERA_C10: fork composition references, with left/right targets in extras.

Use Sprite billboards or your own appropriate character assets above the anchors. Seat markers/text in PNG previews are temporary and are not exported into production GLB. The map does not contain a character asset pack.

The static road network is boolean-unioned to avoid intersecting coplanar surfaces at forks. Individual node faces and all anchor IDs remain separate/editable.

## Layout/camera

Both layouts have 24 nodes and four possible branch combinations per lap; each lap visits 20 nodes, with C00 and C08 ten steps apart. Left/right was checked for the provided fixed overview camera; recheck if changing camera orientation. Tile types are runtime data; the map does not hardcode prices, events or property ownership.

For Three.js use camera.position_world, target_world and orthographic_bounds from JSON; bounds already correspond to aspect 1080/1920. Source .blend contains the same camera/light setup. Do not infer camera bounds from the ortho_scale field alone.

Collider boxes are proposals in JSON, not engine collision bodies. Apply them in the actual game engine. Camera/HUD safe-area overlays and gameplay/network behavior remain integration work.
