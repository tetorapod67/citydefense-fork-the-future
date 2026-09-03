# CityDefense P0 Judged Asset Provenance

## Status

- Selection status: `P0_REVIEW_ACCEPTED`
- Provenance status: `PASS_WITH_DECLARED_LICENSE_NOTE`
- Required assets: 50
- Accepted assets: 50
- Missing assets: 0
- Public asset sources: CityDefense implementation-pack individual sprites and new Codex built-in image-generation outputs only
- Third-party reference images promoted, transformed, cropped, or redistributed: none

This branch contains only the minimum visual set required for the P0 judging screen. It does not add runtime code, deployment configuration, Devpost material, reference images, source boards, or raw generation sheets.

## Source-priority audit

The requested priority order was applied as follows:

1. `CityDefense_P0_Judged_Asset_Drop_v1.0.zip` was not present in the available image-generation task or local downloads, so it was not used.
2. `CityDefense_Implementation_Pack_v2.2_GATE0_SCOPE_FROZEN.zip` supplied 17 subject-correct individual PNG candidates. The pack describes these as provisional rather than previously judged. They were promoted only after the current P0 subject, transparency, size, and duplicate review.
3. No completed Accepted Checkpoint was present in the available image-generation task or work package.
4. The locally available Codex built-in image-generation tool supplied 33 missing or rejected subjects in small category and visual-gate correction sheets. The original sheets are not committed.

`CityDefense_Implementation_Pack_v2.1_FULL.zip` was not separately imported because its 124 individual PNG files are byte-identical to v2.2.

| Input | SHA-256 | Use |
|---|---|---|
| CityDefense v2.2 Gate 0 pack | `fc2bb1375dfbf2afada5ca813dc099b0822a158c19b20413ef4f8f64e84e1384` | 17 reviewed individual sprites |
| CityDefense v2.1 full pack | `e2453851877f047876101ba3be655d9eab9dbf1d358496d581fadec5d8c2a9cb` | Integrity comparison only; no duplicate import |

## Generated-source record

The built-in generator returned RGB PNGs with either a pale checker matte or a flat magenta chroma matte. Those RGB sheets were rejected as shipping assets. Only fixed semantic cells were promoted after deterministic matte removal, alpha reconstruction, trimming, resizing, and edge inspection.

| Non-shipping source sheet | SHA-256 | Accepted roles |
|---|---|---|
| `map-supplement.png` | `b9782f10b255678395bd3f5b34948a559daf89646a1295451299257017d64523` | road corner, road T, rail straight, selection, hover |
| `buildings-supplement.png` | `bc928542aa205271e2952d9435274fd9cfca8d3c4bc45b1f997879138b2562cc` | town hall, hospital, substation, depot, sensor tower, drone pad, slope barrier |
| `units-supplement-v2.png` | `215da1e2ec893a1423f5295abba5caecb8ba983be2256fec796cb9e9a2417155` | response and evacuation carriers in verified adjacent NE/SE headings |
| `crisis-supplement.png` | `b7264cd575767e51333f79f9ce6f053f1ea657704439a0f5734a375e83bfaa64` | six crisis states |
| `signals-supplement.png` | `cb21b7f38348eb9295481e8c72c18f41e145c2efef4ff39c0d3d6541d107d5a4` | eight signal/UI subjects |
| `visual-gate-replacements.png` | `23d5397aef0d063517bc6b1f514bbf16ace08dd5b58504d386d708831753bfb4` | reconnaissance drone, branch icon, isometric rail curve |

The first vehicle sheet was rejected because its pairs read as opposite front/rear views rather than adjacent NE/SE headings. The v2 sheet listed above replaced it. The pack reconnaissance craft and branch glyph failed the actual-size semantic gate, and both the pack `track_curve.png` and the first dedicated curve failed the rail-shape/connection gate. The single three-cell visual-gate sheet listed above replaced those three final blockers; the curve cell was mapped to the project's 2:1 isometric plane during normalization.

## Normalization contract

- Format: transparent RGBA PNG
- Projection: consistent 2:1 isometric view for world assets
- Lighting: upper-left / north-west visual light
- Object anchor: bottom-center, recorded as `(0.5, 1.0)`
- Tile and screen-space UI anchor: center, recorded as `(0.5, 0.5)`
- Dimensions: map `128×96`; buildings `128×128` except station `128×96`; units `128×128`; crisis `96×96`; signals/UI `64×64`
- Outer edge: fully transparent on all four sides
- Asset content: no baked labels, real-world logos, trademarks, or generic placeholder icons
- Key policy: catalog production IDs are preserved when the visual direction/topology is verified; dedicated stable keys are used for uncatalogued corner, T-junction, rail-curve, and overlay assets rather than claiming an unverified compass mask.

Exact dimensions, anchors, final SHA-256 values, source cells, and per-asset selection status are in:

- `public/assets/p0/asset-manifest.json`
- `public/assets/p0/provenance.json`

## QA evidence

- `public/assets/p0/contact-sheet.png` contains all 50 accepted assets.
- `public/assets/p0/qa/actual-size-map-and-signals.png` renders map and UI assets at 1:1 production pixels.
- `public/assets/p0/qa/actual-size-buildings.png` renders all buildings at 1:1 production pixels.
- `public/assets/p0/qa/actual-size-units-and-crisis.png` renders all units and crisis states at 1:1 production pixels.
- `public/assets/p0/qa/edge-composite-generated.png` renders every newly generated asset at 1:1 pixels over black, white, magenta, and green mattes for fringe inspection.

The final gate verifies manifest path existence, manifest hash and dimension agreement, non-empty alpha, transparent outer edges, bottom-center or center anchors, exact-file and normalized-pixel duplicates, required-set coverage, and the absence of raw/reference/source-sheet material. A repository secret scan and a provenance/license-marker scan are run before publication.

## Rights and license note

No conflicting license marker or third-party reference image is included in this branch. The repository license is MIT, and publication is performed under the owner's explicit instruction for this public repository. The implementation packs do not include a separate per-asset license file; this absence is declared rather than silently inferred away. This record documents source handling and is not legal advice.
