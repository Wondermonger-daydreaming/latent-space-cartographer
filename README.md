# Latent Space Cartographer

A visual exploration tool for understanding and navigating latent spaces in machine learning models. Latent Space Cartographer leverages transformers and dimensionality reduction techniques to create interactive 3D visualizations of high-dimensional data.

## Features

- **3D Visualization**: Interactive three-dimensional exploration of latent spaces using Three.js
- **Force-Directed Layout**: D3-based force simulation for intuitive node positioning
- **Neural Embeddings**: Powered by @xenova/transformers for on-the-fly embedding generation
- **Dimensionality Reduction**: SVD-based reduction for efficient visualization
- **Web ML Runtime**: ONNX Runtime for fast inference in the browser

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
npm install
```

### Development

Start the development server with hot module replacement:

```bash
npm run dev
```

The application will be available at `http://localhost:5173` (or the URL shown in your terminal).

### Building

Create an optimized production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Three.js** - 3D graphics rendering
- **D3-Force** - Graph layout simulation
- **Transformers.js** - On-device ML models
- **ONNX Runtime** - Neural network inference
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible UI components

## Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
