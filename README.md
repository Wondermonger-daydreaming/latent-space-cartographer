# Latent Space Cartographer

Interactive 3D cartography of concept embeddings, entirely in the browser. Enter a handful of text concepts, and the app embeds each one with a neural sentence-encoder running locally via WebAssembly, reduces the embeddings to three dimensions with PCA, and renders the resulting topology as an explorable WebGL scene. No server, no API keys — the embedding model runs on your machine, with a deterministic fallback when it can't be downloaded.

## Features

- **In-browser neural embeddings** — phrases are embedded with [Transformers.js](https://github.com/xenova/transformers.js) (`sentence-transformers/all-MiniLM-L6-v2`, 384-dim) running in the browser. If the model can't load (e.g. offline), the app falls back to a deterministic pseudo-embedding so it still runs.
- **PCA → 3D** — embeddings are projected to three dimensions via PCA (classical-MDS formulation computed with `svd-js`), which is correct for the small-N case the app targets.
- **Interactive Three.js visualization** — a real WebGL 3D scene with orbit/zoom/pan controls, spheres for concepts colored by their dominant feature family, mode-colored edges, floating text labels, and hover + click selection.
- **Three relationship modes** — *pure*, *analogy*, and *comparative* (see [Modes](#modes)).
- **Cosine + Jaccard relationships** — edges between concepts are weighted by cosine distance in embedding space and by feature-family Jaccard overlap.
- **Optional SAE feature decomposition** — if a trained Sparse Autoencoder is supplied as `model.onnx` (run via `onnxruntime-web`), real learned features are used; otherwise the app falls back to a heuristic feature mapping.
- **Persistence** — sessions and your label-corrections are saved to `localStorage`.

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm

### Installation

```bash
npm install
```

### Development

Start the Vite dev server with hot module replacement:

```bash
npm run dev
```

The app will be available at http://localhost:5173 (or the URL shown in your terminal).

### Build

Create an optimized production build:

```bash
npm run build
```

### Preview

Serve the production build locally:

```bash
npm run preview
```

### Test

Run the test suite:

```bash
npm test
```

## How It Works

1. **Input** — you enter 2–5 concept phrases (each with an optional "domain context"), pick a mode, and click Compute.
2. **Embed** — each phrase is embedded into a 384-dim vector with Transformers.js in the browser. If the model is unavailable, a deterministic pseudo-embedding stands in.
3. **Relate** — concepts are connected by edges weighted from cosine distance and feature-family Jaccard overlap.
4. **Reduce** — the embeddings are projected to 3D coordinates via PCA (`svd-js`).
5. **Render** — the topology is drawn as an interactive Three.js WebGL scene: spheres for concepts, edges between them, text labels, and orbit controls with hover and selection.
6. **Decompose** — each concept's embedding is broken down into "feature families" (learned via an ONNX SAE if present, otherwise heuristic) which drive sphere coloring and the Jaccard overlaps.

## Modes

- **pure** — embeds each phrase as-is and maps the raw relationships between concepts.
- **analogy** — applies embedding arithmetic (a domain shift) so you can explore directional/analogical relationships between concepts.
- **comparative** — shows side-by-side variants of the concepts for direct comparison.

## Feature Decomposition & the SAE

Each concept's embedding is decomposed into interpretable "feature families." Real, learned features require a trained Sparse Autoencoder packaged as `model.onnx` and loaded through `onnxruntime-web`.

**No `model.onnx` ships in this repository.** Out of the box, the feature families are therefore a **heuristic / procedural mapping**, not learned features — useful for exploring the UI and relationships, but not an interpretable decomposition of the embedding space. The full design and specification for training and packaging the intended SAE pipeline lives in [`SKILL.md`](./SKILL.md).

## Tech Stack

- **React 18** — UI framework
- **TypeScript** — type-safe development
- **Vite** — build tool and dev server
- **Three.js** — WebGL 3D rendering
- **svd-js** — SVD for the PCA projection
- **Transformers.js (`@xenova/transformers`)** — in-browser neural embeddings
- **onnxruntime-web** — optional SAE inference (only used if `model.onnx` is provided)

Dev tooling: **ESLint**, **Prettier**, **Vitest**.

## Limitations

- **Heuristic features without an SAE** — without a trained `model.onnx`, feature families are a heuristic mapping rather than a learned decomposition.
- **Coarse PCA on very small N** — with only a handful of concepts, the 3D PCA projection is necessarily coarse and can shift noticeably as concepts are added or removed.
- **First-run model download** — the first embedding pass downloads the MiniLM model (tens of MB) into the browser cache, unless the offline pseudo-embedding fallback kicks in.

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
