# Settlement artwork preservation and reuse plan

Publication update (2026-10-11): user approved source-based Delvers v5 and authorised publication of that isolated district package plus this preservation archive. The earlier incomplete district references have been replaced with the published city crops for all other eleven districts. Earlier warnings below describe the stopped experiment, not the verified current package. These six illustrations remain unused settlement candidates, not new towns or deployed district images.

Six generated illustrations are preserved for possible standalone towns on the global map. They are **not approved replacements for Eldervale districts**. No locations, routes, NPCs or game state are changed by this plan.

## Preserved artwork

Original generated files remain untouched. Exact copies live in `art-archive/settlement-candidates/2026-10-11/`, outside the app's public assets. [The manifest](../art-archive/settlement-candidates/2026-10-11/manifest.json) records source filenames, dimensions and SHA-256 hashes. All six copies match their originals.

Each image is 1536 × 1024. Despite the original .png filenames, the files contain JPEG-encoded images; the archive preserves the original bytes. Correct the extension and consuming references together when preparing an approved production asset. Enlarging these files cannot reveal additional detail.

| Candidate | Possible settlement role | Features to design around |
| --- | --- | --- |
| [01: Lantern neighbourhood](../art-archive/settlement-candidates/2026-10-11/01-lantern-neighbourhood.png) | Cosy trade town or neighbourhood-sized borough | Timber inn, bakery, cobbler, lantern workshop, theatre, well and footbridge. |
| [02: Expedition town](../art-archive/settlement-candidates/2026-10-11/02-expedition-town.png) | Mining or delvers' settlement | Prominent circular shaft and hoist, expedition supplies, lodgings and memorial building. The shaft needs an explicit safe-access/story design. |
| [03: Civic town](../art-archive/settlement-candidates/2026-10-11/03-civic-town.png) | Affluent walled borough or small ducal seat | Palace, petition hall, terraces, gardens and civic buildings. Too grand for a rural hamlet; public forecourts do not imply unrestricted palace access. |
| [04: Historic town](../art-archive/settlement-candidates/2026-10-11/04-historic-town.png) | Old river town with ruins and archives | Weathered stone buildings, books, clockwork, museum-like buildings and barred cellar. Visible doors are not automatically dungeon entrances. |
| [05: Forge town](../art-archive/settlement-candidates/2026-10-11/05-forge-town.png) | Industrial canal or specialist craft town | Foundry, cranes, canal bridges, workshops and machinery. Give it a working-town identity distinct from a market town. |
| [06: Market town](../art-archive/settlement-candidates/2026-10-11/06-market-town.png) | River trading centre | Covered markets, scales, merchant halls, warehouses, boats and docks. Roads and river travel must fit the world geography. |

These are visual role suggestions, not new canonical names or commitments to use every image. They were produced during the aborted district-art work; the archive names describe appearance rather than asserting exact correspondence to the original district briefs.

## Why they are not district replacements

The generated plates repeat a central junction and radiating streets. They reference the city's illustration style, but do not preserve its actual street, river and landmark geography. Using them as adjoining districts would make Eldervale feel disconnected. Separate towns can legitimately have their own geography, but six similar layouts together would still feel repetitive.

Preserve the assets, select only appropriate ones, and make each chosen settlement distinct through its geography, residents and activities. Do not replace existing town artwork, cast or quests merely to consume these images.

## Delivery sequence

1. **Review one candidate first.** Choose a settlement role and size with the user. Recommend the historic or forge town for contrast; select its position only after reviewing existing regional geography and authored roads. Prefer a genuinely new settlement rather than relabelling an established one.
2. **Approve its world placement.** Specify its name, nearby places, river/road relationship and approach. Add a global marker only when a real visitable location and route exist. Do not invent travel connections from decorative boats or bridges.
3. **Read the image as a fixed place.** Identify public entrances, streets, bridges, water edges and 5–10 useful destinations. Anchor markers to illustrated buildings. Derive a stable connected route graph from that layout, not another standard eight-spoke template. Keep the artwork fixed and reveal eligible markers/routes through existing discovery controls.
4. **Author a worthwhile local experience.** Give the settlement a distinctive purpose, several residents with species/portrait variety, useful local conversations, one optional persistent task and an ambient activity. Give each important stop something to inspect, learn or do. Use reviewed portraits; no random reassignment of established NPC identities.
5. **Connect it through shared systems.** Use canonical travel, presence, dialogue and quest state. Carriage boarding requires an authored stop and valid connected journey; a disabled travel control should explain its unmet condition. Detours preserve main-adventure progress, inventory and earned levels. Decorative interiors stay unavailable until explicitly authored.
6. **Verify one complete visit.** Check world/local marker alignment, every public route and return route, arrival dialogue, NPC knowledge, task persistence, saved progress, travel eligibility and readable native-resolution presentation. Add reusable regression tests for any engine defect discovered; do not add transcript-specific wording patches.
7. **Review before expanding.** Let the user play the first town and approve its visual fit. Only then select another candidate with a contrasting role. Keep unused images archived; there is no requirement to use all six.
8. **Publish only when requested.** Run the project's tests, build/typecheck and adventure validations for implementation. Merge/push only with user authorization. The only game runtime remains the usual main checkout on port 4173.

## Eldervale remains a separate next step

Before generating replacement district art, approve a single master city geography: district boundaries, river course, bridges, walls, landmark positions and adjoining street connections. Develop one district against that geography and review it alongside the city overview. Do not resume the repeated central-square approach.

Existing Eldervale locations, residents, quests and saves remain intact. These settlement candidates do not solve the city's district continuity problem.

## Current handoff and limits

This is preservation and planning only. The six archived copies have verified matching source hashes. No gameplay implementation, new image generation, game startup, commit, merge or push was performed for this request.

The `codex/district-map-detail` worktree contains unfinished district-art code changes from the stopped task, including references to an incomplete district asset set. Preserve those edits for review, but **do not merge the worktree wholesale**. A later documentation/art-only commit must exclude unfinished code. Main remains unchanged by this request. The archive is currently local, not backed up to GitHub.

Next action: live-test the approved Delvers plate, then continue geography-first district work; settlement reuse remains a future content package.
