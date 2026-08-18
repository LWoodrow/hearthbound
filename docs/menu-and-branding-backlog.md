# Menu system and universe branding

Status: Implemented

## Delivered

- One shared six-step route: Game library → Universe → Campaign or season → Adventure, episode, case, or operation → Party or cast → Play.
- A registry-driven theme package for Hearthbound, Hunters, Unmasked, Forsaken, Hysteria, and Classified.
- Universe packages contain display identity, icon, colour tokens, typography, texture, motifs, map treatment, scene-art direction, narration and audio mood, and terminology.
- Universe-derived branding and terminology across the library, setup, character, map, and play navigation.
- Responsive shared controls with iPad-sized touch targets and horizontally scrollable journey navigation at narrow widths.
- Planned universes can be previewed but cannot accidentally open Hearthbound rules or content under another brand.
- The supernatural universe is displayed as **Hunters** while retaining the stable internal identifier `supernatural`.

## Acceptance criteria

1. Complete — every registered game type uses the same menu hierarchy and control placement.
2. Complete — the library, setup, character, map, and play surfaces inherit their identity from the selected universe package.
3. Complete — unavailable content packs stay disabled, preventing wording, rules, maps, characters, or assets from leaking between universes.
4. Complete — **Hunters** is the sole player-facing supernatural brand.
5. Complete — stable universe identifiers are independent of display names and saved world identifiers remain unchanged.
6. Complete — a new universe is added by registering one theme package; shared screens require no copy or rewrite.

## Guardrails retained

- Themes affect presentation and terminology only; they do not mutate game logic or saved-game formats.
- The active universe selects the theme for every screen.
- Readability, keyboard semantics, responsive layout, and touch targets take priority over decorative treatments.
- Each universe owns its continuity, characters, rules, maps, inventory, hidden state, art direction, and terminology.
