# Third-Party Notices

This project is distributed under the MIT License. It also depends on third-party software, formats, scientific data, and visual assets governed by their own licenses or terms.

This notice is informational and does not replace license texts shipped by dependencies or required by source assets.

## Core application libraries

The active application uses permissively licensed open-source libraries, primarily under MIT-compatible terms:

- React and React DOM
- Next.js
- Three.js
- React Three Fiber
- Drei
- Zustand
- Lucide React
- Radix UI packages
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

Consult `package.json`, `bun.lock`, and each distributed license file for exact versions and terms.

## KTX2 and Basis Universal

The active GPU-compressed texture catalogue uses:

- Khronos Group KTX Software 4.4.2 in the asset-generation workflow
- the KTX 2.0 container format
- Basis Universal ETC1S/BasisLZ and UASTC encoding modes
- Three.js `KTX2Loader`
- the Basis JavaScript and WebAssembly transcoder distributed with the installed Three.js package

Khronos KTX Software, Basis Universal, and their runtime components remain governed by their own permissive licenses and notices. Native encoding tools run only during asset preparation. The browser receives committed KTX2 derivatives and the Three.js-compatible transcoder runtime copied during development or production builds.

Khronos, KTX, Vulkan, OpenGL, WebGL, and related names or marks are used descriptively. No affiliation, sponsorship, certification, or endorsement is implied.

## Development and validation tooling

Development and CI tooling includes:

- TypeScript
- ESLint and eslint-config-next
- Puppeteer
- Bun and Bun type definitions
- Tailwind PostCSS tooling
- Sharp
- Khronos KTX command-line tools

These tools are not bundled as application content unless their distributed terms or runtime role require it.

## NASA/JPL data

Approximate major-planet orbital elements are based on material published by NASA/JPL Solar System Dynamics:

- <https://ssd.jpl.nasa.gov/planets/approx_pos.html>
- <https://ssd.jpl.nasa.gov/horizons/>

NASA/JPL names and marks are not endorsements. The application identifies its model as an educational approximation rather than a navigation product.

## Visual assets and generated derivatives

The repository's MIT license covers project-authored code and project-generated assets. It does not automatically relicense third-party textures or models. WebP and KTX2 outputs inherit the redistribution constraints of their source images.

See `ASSET_SOURCES.md` for provenance requirements, generated derivative paths, and redistribution guidance.

## No endorsement

Names such as NASA, JPL, ISS, Hubble, Voyager, JWST, Khronos, KTX, and mission names are used descriptively. No affiliation, sponsorship, or endorsement is implied.
