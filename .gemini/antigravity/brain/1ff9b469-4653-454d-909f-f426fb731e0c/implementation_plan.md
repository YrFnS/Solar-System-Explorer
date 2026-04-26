# Phase 3: Visual Overhaul (Textures & Models)

We are going to upgrade the flat-colored spheres into stunning, photorealistic celestial bodies using high-resolution textures, and prepare the app to load complex 3D models for space stations and probes.

## User Review Required

> [!IMPORTANT]
> **3D Models from Sketchfab/BlenderKit:** 
> I will write all the logic to load `.gltf` / `.glb` models for the human artifacts (ISS, Voyager, etc.). However, since Sketchfab requires a logged-in account to download files, I cannot automatically download those specific models for you. 
> 
> My plan is to write a Node.js script that automatically downloads high-res **Planet Textures** from public NASA/open-source repositories directly into your `public/textures/` folder. For the **Artifacts**, I will set up the code so that all you need to do is drop your downloaded `.glb` files into the `public/models/` folder and they will instantly appear in space!

## Proposed Changes

---

### Textures & Assets
I will create a script to fetch the following assets into your `public/textures` directory:
- **Albedo Maps** (Base color) for Sun, Mercury, Venus, Earth, Moon, Mars, Jupiter, Saturn, Uranus, Neptune, and Pluto.
- **Normal/Bump Maps** for rocky planets (Earth, Moon, Mars) to give them realistic 3D terrain shadows.
- **Cloud Maps** for Earth to create a separate, slowly rotating atmospheric layer.
- **Ring Textures** with alpha transparency for Saturn and Uranus.

---

### Component Updates

#### [MODIFY] [data.ts](file:///c:/Users/Itokoro/Downloads/New%20folder/Solar%20System%20Explorer/src/components/solar-system/data.ts)
- Update `PlanetData`, `MoonData`, and `HumanArtifactData` interfaces to accept new fields: `textureUrl`, `bumpMapUrl`, `cloudMapUrl`, `ringTextureUrl`, and `modelUrl`.
- Populate these fields with the local paths to the assets in the `/public` folder.

#### [MODIFY] [Planet.tsx](file:///c:/Users/Itokoro/Downloads/New%20folder/Solar%20System%20Explorer/src/components/solar-system/Planet.tsx)
- Integrate `@react-three/drei`'s `useTexture` hook.
- Upgrade the `meshStandardMaterial` to accept `map`, `normalMap`, and `roughnessMap`.
- If the planet has a `cloudMapUrl`, render a slightly larger secondary sphere with a transparent cloud material that rotates independently.
- If the planet has a `ringTextureUrl`, replace the procedural torus rings with a flat `ringGeometry` mapped with the transparent ring texture.

#### [MODIFY] [Sun.tsx](file:///c:/Users/Itokoro/Downloads/New%20folder/Solar%20System%20Explorer/src/components/solar-system/Sun.tsx)
- Apply a high-contrast sun texture to an emissive material.
- Retain the glow effect using a larger additive-blending sphere.

#### [MODIFY] [HumanArtifacts.tsx](file:///c:/Users/Itokoro/Downloads/New%20folder/Solar%20System%20Explorer/src/components/solar-system/HumanArtifacts.tsx)
- Replace the current simple primitive shapes with the `useGLTF` hook from `@react-three/drei`.
- Add a fallback mechanism so that if a `.glb` model is missing from the `public/models/` folder, it gracefully falls back to the old primitive shapes.

## Verification Plan

### Automated Steps
1. Run the asset download script to ensure all textures are successfully placed in `public/textures/`.
2. Ensure the Next.js dev server compiles without errors with the new `@react-three/drei` hooks.

### Manual Verification
1. I will ask you to check the browser to confirm the planets now look highly realistic with visible terrain and clouds.
2. I will instruct you on exactly how to drop your Sketchfab `.glb` files into the `public/models/` folder to see them appear in-game.
