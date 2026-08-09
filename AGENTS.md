# AGENTS.md: harbor-lights

A browser game prototype. You keep a remote signal station, fragmented radio
transmissions arrive from approaching vessels, and you decide what to do with
them. Fuel drains. If the beacon goes out, something wakes up.

Vite and vanilla JS. `src/` is the game, `reference/` is source material.

## Tone is the product

"Cozy cosmic horror" is a narrow target and it is easy to miss in both
directions. The escalation is staged on purpose:

| Phase | Register |
|---|---|
| 0 | mundane maritime traffic |
| 1 | slightly off |
| 2 | clearly wrong |
| 3 | existential dread |

Phase 0 and 1 carry the whole thing. If the early transmissions read as
obviously spooky, the later ones have nowhere to go. Write phase 0 as if the
game were a shipping log and mean it.

**Restraint over explanation.** The thing beneath the surface does not get
described, named, or given a motive. Ambiguity is not a placeholder for lore
that hasn't been written yet.

## Writing transmissions

- Radio voice: clipped, procedural, interrupted. Callsigns, bearings, cargo.
- The wrongness is in the details a real operator would notice, not in
  adjectives. A vessel reporting a heading it cannot be on beats a vessel
  reporting dread.
- Don't write jokes about the horror. Cozy means warm, not knowing.

## Licensing

This is original creative IP and it is **deliberately unlicensed**,
all-rights-reserved. Don't add a LICENSE file. The absence is the decision.

## Prototype rules

It is a prototype. Prefer the smallest thing that lets the tone be evaluated
over engineering that assumes the design is settled. No state management
library, no build complexity, no abstraction for a single caller.

## Claude Code specifics

`CLAUDE.md` is a symlink to this file. Codex reads only `AGENTS.md`, Claude Code
reads only `CLAUDE.md`, and neither reads the other's, so one file serves both
and they cannot drift. Edit `AGENTS.md`; `/init` will try to replace the symlink
with a real file, which would make this invisible to Codex again.
