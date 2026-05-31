declare module '*.module.css';
declare module '*.css';
declare module 'onnxruntime-web';

// Ambient declaration for svd-js. This block overrides the package's own types,
// so it MUST match the runtime shape: svd-js@1.1.1 returns the singular values
// on `q` (not `s`) — verified at runtime. Declaring `s` here compiles but throws
// at runtime, so keep this as `q`.
declare module 'svd-js' {
  export function SVD(matrix: number[][]): {
    u: number[][];
    q: number[];
    v: number[][];
  };
}

// ---------------------------------------------------------------------------
// Ambient declarations for `three@0.165`.
//
// This install ships NO bundled TypeScript types (no three/build/*.d.ts, and
// @types/three is not installed). package.json is owned by other work and may
// not be edited, so the surface used by TopologyCanvas is declared locally.
// These are permissive stubs (members loosely typed via the `Any` alias) but
// the *names* exist so `THREE.Scene` etc. resolve as types under strict mode.
// Following the existing ambient-module pattern already in this file.
// ---------------------------------------------------------------------------
declare module 'three' {
  type Any = unknown;

  export class Vector2 {
    constructor(x?: number, y?: number);
    x: number;
    y: number;
  }
  export class Vector3 {
    constructor(x?: number, y?: number, z?: number);
    x: number;
    y: number;
    z: number;
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    sub(v: Vector3): this;
    multiplyScalar(s: number): this;
    setScalar(s: number): this;
  }
  export class Box3 {
    expandByPoint(p: Vector3): this;
    getCenter(target: Vector3): Vector3;
    getSize(target: Vector3): Vector3;
  }
  export class Color {
    constructor(color?: number | string);
    setHex(hex: number): this;
  }
  export class Object3D {
    position: Vector3;
    scale: Vector3;
    userData: Record<string, Any>;
    add(...objects: Object3D[]): this;
    remove(...objects: Object3D[]): this;
    lookAt(x: number, y: number, z: number): void;
  }
  export class Scene extends Object3D {}
  export class PerspectiveCamera extends Object3D {
    constructor(fov?: number, aspect?: number, near?: number, far?: number);
    aspect: number;
    updateProjectionMatrix(): void;
  }
  export class WebGLRenderer {
    constructor(params?: Any);
    domElement: HTMLCanvasElement;
    setSize(width: number, height: number): void;
    setPixelRatio(value: number): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
    dispose(): void;
  }
  export class AmbientLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }
  export class DirectionalLight extends Object3D {
    constructor(color?: number, intensity?: number);
  }
  export class Raycaster {
    setFromCamera(coords: Vector2, camera: PerspectiveCamera): void;
    intersectObjects(objects: Object3D[]): Array<{ object: Object3D }>;
  }
  export class BufferGeometry {
    setFromPoints(points: Vector3[]): this;
    dispose(): void;
  }
  export class SphereGeometry extends BufferGeometry {
    constructor(
      radius?: number,
      widthSegments?: number,
      heightSegments?: number,
    );
  }
  export interface Material {
    dispose(): void;
    needsUpdate: boolean;
  }
  export class MeshStandardMaterial implements Material {
    constructor(params?: Any);
    color: Color;
    emissive: Color;
    emissiveIntensity: number;
    needsUpdate: boolean;
    dispose(): void;
  }
  export class LineBasicMaterial implements Material {
    constructor(params?: Any);
    needsUpdate: boolean;
    dispose(): void;
  }
  export class LineDashedMaterial implements Material {
    constructor(params?: Any);
    needsUpdate: boolean;
    dispose(): void;
  }
  export class Mesh extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
    geometry: BufferGeometry;
    material: Material | Material[];
  }
  export class Line extends Object3D {
    constructor(geometry?: BufferGeometry, material?: Material | Material[]);
    geometry: BufferGeometry;
    material: Material | Material[];
    computeLineDistances(): this;
  }
}

declare module 'three/examples/jsm/controls/OrbitControls.js' {
  import { PerspectiveCamera, Vector3 } from 'three';
  export class OrbitControls {
    constructor(camera: PerspectiveCamera, domElement?: HTMLElement);
    enableDamping: boolean;
    target: Vector3;
    update(): void;
    dispose(): void;
  }
}

declare module 'three/examples/jsm/renderers/CSS2DRenderer.js' {
  import { Object3D, Scene, PerspectiveCamera } from 'three';
  export class CSS2DObject extends Object3D {
    constructor(element: HTMLElement);
    element: HTMLElement;
  }
  export class CSS2DRenderer {
    constructor();
    domElement: HTMLElement;
    setSize(width: number, height: number): void;
    render(scene: Scene, camera: PerspectiveCamera): void;
  }
}
