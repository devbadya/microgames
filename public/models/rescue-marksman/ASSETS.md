# Rescue Marksman 3D Assets

All downloaded models in this folder are low-poly `GLB` files selected for PlayCanvas browser use.

## Quaternius Ultimate Monsters

Source: https://quaternius.com/ (Ultimate Monsters pack, distributed via the Quaternius Patreon).

License: CC0 1.0 Universal (Public Domain Dedication). See `License.txt` shipped with the original pack.

Each glTF below is self-contained: buffers and the shared `Atlas_Monsters` PNG are embedded as base64 data URIs, so no neighbouring `.bin` or texture files are required.

`monsters/big/` (humanoid / large monsters):

- `BlueDemon.gltf`
- `Bunny.gltf`
- `Cactoro.gltf`
- `Ninja.gltf`
- `Orc.gltf`
- `Orc_Skull.gltf`
- `Yeti.gltf` (used as the final boss)

`monsters/blob/` (small rounded creatures, civilians and early hostiles):

- `Cat.gltf`
- `Chicken.gltf`
- `Dog.gltf`
- `GreenSpikyBlob.gltf`
- `Pigeon.gltf`
- `PinkBlob.gltf`

`monsters/flying/` (hovering hostiles):

- `Goleling.gltf`
- `Hywirl.gltf`

Animation clips actually used by `games/rescue-marksman/main.ts`:

- Big set: `Walk`, `Idle`, `HitReact`, `Death`.
- Blob set: `Walk`, `Idle`, `HitRecieve` (typo in source files), `Death`.
- Flying set: `Flying_Idle`, `HitReact`, `Death`.

## Quaternius Animated Mech Pack (March 2021)

Source: https://quaternius.com/ (Animated Mech Pack).

License: CC0 1.0 Universal (Public Domain Dedication). See `License.txt` shipped with the original pack.

`monsters/mech/` (armed robots used as Level 2 hostiles and a boss-level guard):

- `Mike.gltf`
- `Stan.gltf`
- `Leela.gltf`
- `George.gltf`

Mech clips actually used: `Idle`, `Walk`, `Walk_Holding`, `HitRecieve_1`, `Death` (the mechs ship richer animation sets including `Run`, `Run_Holding`, `Shoot`, `Jump`, `Yes`, `No`).

## Procedural Fallbacks

The game also creates procedural buildings, weapon parts, props, and hit markers with PlayCanvas primitives. If a monster glTF fails to load, the actor falls back to a coloured box+sphere body so gameplay never breaks.
