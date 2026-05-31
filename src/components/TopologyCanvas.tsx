import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  CSS2DRenderer,
  CSS2DObject,
} from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { CartographerResult } from '../types';

type Props = {
  result: CartographerResult | null;
  selected: string | null;
  onSelectNode: (label: string) => void;
};

const EDGE_COLORS: Record<string, number> = {
  pure: 0x34d399,
  analogy: 0xc084fc,
  comparative: 0xfb923c,
};

const NODE_RADIUS = 0.25;
const FIT_RADIUS = 6;
const SELECTED_EMISSIVE = 0xffffff;

export function TopologyCanvas({ result, selected, onSelectNode }: Props) {
  if (!result || !result.nodes.length) {
    return (
      <div className="topology-placeholder">
        Enter up to five concepts and press Compute to generate the topology.
      </div>
    );
  }
  // The inner component owns the entire Three.js lifecycle and tears it down on
  // unmount, so swapping between placeholder and scene never leaks.
  return (
    <Scene3D result={result} selected={selected} onSelectNode={onSelectNode} />
  );
}

type SceneProps = {
  result: CartographerResult;
  selected: string | null;
  onSelectNode: (label: string) => void;
};

type SceneRefs = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  pointer: THREE.Vector2;
  nodeMeshes: THREE.Mesh[];
  objects: THREE.Object3D[]; // node/edge/label objects added per-result
};

function Scene3D({ result, selected, onSelectNode }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<SceneRefs | null>(null);
  // Keep latest callback without re-running the mount effect.
  const onSelectRef = useRef(onSelectNode);
  onSelectRef.current = onSelectNode;

  // ---- Mount: create renderer/scene/camera/controls + loop + listeners.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(0, 0, FIT_RADIUS * 2.6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.domElement.style.display = 'block';
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const controls = new OrbitControls(camera, labelRenderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(5, 8, 10);
    scene.add(dir);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    refs.current = {
      scene,
      camera,
      renderer,
      labelRenderer,
      controls,
      raycaster,
      pointer,
      nodeMeshes: [],
      objects: [],
    };

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const updatePointer = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const meshes: THREE.Object3D[] = refs.current?.nodeMeshes ?? [];
      return raycaster.intersectObjects(meshes);
    };

    const onPointerMove = (e: PointerEvent) => {
      const hits = updatePointer(e);
      container.style.cursor = hits.length ? 'pointer' : 'default';
    };

    const onClick = (e: PointerEvent) => {
      const hits = updatePointer(e);
      if (hits.length) {
        const label = hits[0].object.userData.label as string | undefined;
        if (label) onSelectRef.current(label);
      }
    };

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('click', onClick);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('click', onClick);

      // Dispose per-result objects (geometries/materials/labels).
      disposeObjects(scene, refs.current?.objects ?? []);

      controls.dispose();
      renderer.dispose();

      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentNode === container) {
        container.removeChild(labelRenderer.domElement);
      }
      refs.current = null;
    };
  }, []);

  // ---- Build/refresh scene objects whenever the result changes.
  useEffect(() => {
    const ctx = refs.current;
    if (!ctx) return;

    // Clear previous node/edge/label objects.
    disposeObjects(ctx.scene, ctx.objects);
    ctx.objects = [];
    ctx.nodeMeshes = [];

    // Normalize positions: center the cloud and uniformly scale to FIT_RADIUS.
    const box = new THREE.Box3();
    for (const n of result.nodes) {
      box.expandByPoint(
        new THREE.Vector3(n.position[0], n.position[1], n.position[2]),
      );
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxExtent = Math.max(size.x, size.y, size.z);
    const scale = maxExtent > 1e-9 ? (FIT_RADIUS * 2) / maxExtent : 1;

    const positions = new Map<string, THREE.Vector3>();
    for (const n of result.nodes) {
      const v = new THREE.Vector3(n.position[0], n.position[1], n.position[2])
        .sub(center)
        .multiplyScalar(scale);
      positions.set(n.id, v);
    }

    // NODES + LABELS — each node owns its geometry so disposal is 1:1.
    for (const n of result.nodes) {
      const pos = positions.get(n.id);
      if (!pos) continue;
      const sphereGeo = new THREE.SphereGeometry(NODE_RADIUS, 24, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(n.color),
        roughness: 0.45,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.position.copy(pos);
      mesh.userData.label = n.label;
      mesh.userData.id = n.id;
      ctx.scene.add(mesh);
      ctx.objects.push(mesh);
      ctx.nodeMeshes.push(mesh);

      const div = document.createElement('div');
      div.className = 'node-label';
      div.textContent = n.label;
      const label = new CSS2DObject(div);
      label.position.set(pos.x, pos.y + NODE_RADIUS * 1.8, pos.z);
      ctx.scene.add(label);
      ctx.objects.push(label);
    }

    // EDGES — colored by mode, opacity scaled by closeness (1 - distance).
    for (const e of result.edges) {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) continue;

      const geo = new THREE.BufferGeometry().setFromPoints([a, b]);
      const color = EDGE_COLORS[e.mode] ?? 0x94a3b8;
      const opacity = Math.min(0.9, Math.max(0.25, 1 - e.distance));

      let line: THREE.Line;
      if (e.mode === 'analogy') {
        const mat = new THREE.LineDashedMaterial({
          color,
          transparent: true,
          opacity,
          dashSize: 0.3,
          gapSize: 0.2,
        });
        line = new THREE.Line(geo, mat);
        line.computeLineDistances();
      } else {
        const mat = new THREE.LineBasicMaterial({
          color,
          transparent: true,
          opacity,
        });
        line = new THREE.Line(geo, mat);
      }
      ctx.scene.add(line);
      ctx.objects.push(line);
    }

    // Fit camera: target origin, pull back relative to the fitted cloud.
    ctx.controls.target.set(0, 0, 0);
    ctx.camera.position.set(
      FIT_RADIUS * 0.6,
      FIT_RADIUS * 0.6,
      FIT_RADIUS * 2.4,
    );
    ctx.camera.lookAt(0, 0, 0);
    ctx.controls.update();
  }, [result]);

  // ---- Reflect the selected prop: emphasize the matching node.
  useEffect(() => {
    const ctx = refs.current;
    if (!ctx) return;
    for (const mesh of ctx.nodeMeshes) {
      const isSel = selected != null && mesh.userData.label === selected;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mesh.scale.setScalar(isSel ? 1.6 : 1);
      mat.emissive.setHex(isSel ? SELECTED_EMISSIVE : 0x000000);
      mat.emissiveIntensity = isSel ? 0.6 : 0;
      mat.needsUpdate = true;
    }
  }, [selected, result]);

  return <div ref={containerRef} className="topology-3d" />;
}

function disposeObjects(scene: THREE.Object3D, objects: THREE.Object3D[]) {
  for (const obj of objects) {
    scene.remove(obj);
    // Duck-type rather than rely on instanceof narrowing through the local
    // ambient three stubs: meshes and lines carry geometry + material, plain
    // Object3D (lights, CSS2DObject) do not. Cast through unknown since the
    // stub's Object3D doesn't declare these optional members.
    const disposable = obj as unknown as {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };
    const geo = disposable.geometry;
    if (geo && typeof geo.dispose === 'function') geo.dispose();
    const mat = disposable.material;
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose());
    else if (mat && typeof mat.dispose === 'function') mat.dispose();
    if (obj instanceof CSS2DObject) {
      obj.element.remove();
    }
  }
}
