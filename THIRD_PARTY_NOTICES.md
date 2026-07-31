# Third-Party Notices

This project is distributed under the MIT License. It also depends on third-party software and scientific data that remain governed by their respective licenses or terms.

This notice is informational and does not replace the license text shipped by each dependency.

## Core application libraries

The following runtime libraries are used by the active application and are available under permissive open-source licenses, primarily MIT:

- React and React DOM
- Next.js
- Three.js
- React Three Fiber
- Drei
- Zustand
- Lucide React
- Radix UI component packages
- Tailwind CSS and Tailwind Merge
- class-variance-authority and clsx
- cmdk
- Embla Carousel
- React Hook Form
- React Day Picker
- React Resizable Panels
- Recharts
- Sonner
- Vaul
- Sharp

Consult `package.json`, `bun.lock`, and each package's distributed license file for the exact version and license text.

## KTX2 and Basis Universal

The optional GPU-compressed texture path uses:

- Khronos Group KTX Software 4.4.2 in the asset-generation workflow
- the KTX 2.0 container format
- Basis Universal ETC1S/BasisLZ and UASTC encoding modes
- Three.js `KTX2Loader`
- the Basis JavaScript and WebAssembly transcoder distributed with the installed Three.js package

Khronos KTX Software and Basis Universal remain governed by their own permissive licenses and notices. The encoding tools run only during asset preparation. The browser receives the Three.js-compatible transcoder runtime and committed KTX2 derivatives.

Khronos, KTX, Vulkan, OpenGL, WebGL, and related names or marks are used descriptively. No affiliation, sponsorship, certification, or endorsement is implied.

## Development and validation tooling

Development and CI tooling includes:

- TypeScript
- ESLint and eslint-config-next
- Puppeteer
- Bun and Bun type definitions
- Tailwind PostCSS tooling
- Khronos KTX command-line tools for the KTX2 experiment

These tools are not bundled as application content unless their licenses or source notices require otherwise.

## NASA/JPL data

Approximate major-planet orbital elements are based on material published by NASA/JPL Solar System Dynamics:

- <https://ssd.jpl.nasa.gov/planets/approx_pos.html>
- <https://ssd.jpl.nasa.gov/horizons/>

NASA/JPL names and marks are not endorsements of this project. The application clearly labels the model as an educational approximation rather than a navigation product.

## Visual assets

The repository's MIT license applies to project-authored code and project-generated assets. It does not automatically relicense third-party textures or models. See `ASSET_SOURCES.md` for provenance requirements and redistribution guidance.

## No endorsement

Names such as NASA, JPL, ISS, Hubble, Voyager, JWST, Khronos, KTX, and mission names are used descriptively. No affiliation, sponsorship, or endorsement is implied.
