import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface SceneNode {
  id: string;
  label: string;
  score: number | null;
  target?: number;
  count?: number;
  ordinal?: number;
}
export type SceneMode = "tree" | "journey";
interface Props {
  mode: SceneMode;
  nodes: SceneNode[];
  activeIndex: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

const MINT = "#a0efce";
const AMBER = "#f5c58a";
const nodeColor = (node: SceneNode) =>
  node.score === null
    ? "#708799"
    : node.score >= (node.target ?? 5)
      ? MINT
      : AMBER;

export default function LearningScene({
  mode,
  nodes,
  activeIndex,
  reducedMotion,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ activeIndex, reducedMotion, onSelect });
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    current.current = { activeIndex, reducedMotion, onSelect };
  }, [activeIndex, reducedMotion, onSelect]);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "low-power",
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    queueMicrotask(() => setFailed(false));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);
    renderer.domElement.setAttribute("aria-hidden", "true");
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const cameraHome =
      mode === "journey"
        ? new THREE.Vector3(2.8, 5.2, 11)
        : new THREE.Vector3(6, 4.8, 8);
    camera.position.copy(cameraHome);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.8, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 5;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.autoRotateSpeed = 0.35;
    controls.update();
    scene.add(new THREE.HemisphereLight("#e9fff6", "#182b42", 3));
    const keyLight = new THREE.DirectionalLight("#fff5db", 4);
    keyLight.position.set(3, 8, 5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight("#66d8d7", 35, 25);
    rimLight.position.set(-4, 4, -3);
    scene.add(rimLight);
    const world = new THREE.Group();
    scene.add(world);
    const hits: THREE.Object3D[] = [];
    const selected: THREE.Mesh[] = [];
    const nodeLabels: (THREE.Sprite | undefined)[] = [];
    const points: THREE.Vector3[] = [];
    const material = (color: string, glow = 0) =>
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.35,
        emissive: color,
        emissiveIntensity: glow,
      });
    const mesh = (
      geometry: THREE.BufferGeometry,
      color: string,
      position: THREE.Vector3,
      glow = 0,
    ) => {
      const object = new THREE.Mesh(geometry, material(color, glow));
      object.position.copy(position);
      world.add(object);
      return object;
    };
    const label = (
      text: string,
      position: THREE.Vector3,
      color = "#d7e7e9",
      scale = 1,
    ) => {
      const canvas = document.createElement("canvas");
      canvas.height = 112;
      const context = canvas.getContext("2d");
      if (!context) return;
      const short = text.length > 25 ? `${text.slice(0, 23)}…` : text;
      context.font = "500 52px sans-serif";
      canvas.width = Math.ceil(context.measureText(short).width + 32);
      context.font = "500 52px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = color;
      context.fillText(short, canvas.width / 2, 56);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          transparent: true,
        }),
      );
      sprite.position.copy(position);
      sprite.scale.set(
        canvas.width * 0.004 * scale,
        canvas.height * 0.004 * scale,
        1,
      );
      world.add(sprite);
      return sprite;
    };
    const tube = (path: THREE.Vector3[], color: string, radius = 0.025) => {
      const curve = new THREE.CatmullRomCurve3(path);
      return mesh(
        new THREE.TubeGeometry(curve, 48, radius, 7, false),
        color,
        new THREE.Vector3(),
        0.12,
      );
    };
    mesh(
      new THREE.CylinderGeometry(3.5, 3.7, 0.16, 80),
      "#142c3b",
      new THREE.Vector3(0, -0.22, 0),
    );
    for (const radius of [2.8, 3.5, 4.2]) {
      const ring = mesh(
        new THREE.TorusGeometry(radius, 0.008, 5, 100),
        "#2b5661",
        new THREE.Vector3(0, -0.12, 0),
      );
      ring.rotation.x = Math.PI / 2;
    }

    if (mode === "tree") {
      const trunkHeight = nodes.length > 1 ? 3.7 : 1.15;
      tube(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(-0.12, trunkHeight * 0.45, 0),
          new THREE.Vector3(0, trunkHeight, 0),
        ],
        "#8dd8bf",
        0.095,
      );
      mesh(
        new THREE.IcosahedronGeometry(0.22, 2),
        "#d1ffe8",
        new THREE.Vector3(0, 0.3, 0),
        0.4,
      );
      nodes.forEach((node, index) => {
        const angle = index * 2.39996 + 0.4;
        const radius = 1.7 + (index % 2) * 0.55;
        const y = 1.4 + (index / Math.max(nodes.length - 1, 1)) * 2.6;
        const endpoint = new THREE.Vector3(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        );
        const origin = new THREE.Vector3(0, y * 0.6, 0);
        tube(
          [
            origin,
            new THREE.Vector3(endpoint.x * 0.65, y * 0.73, endpoint.z * 0.65),
            endpoint,
          ],
          nodeColor(node),
          0.045,
        );
        const orb = mesh(
          new THREE.IcosahedronGeometry(0.23, 3),
          nodeColor(node),
          endpoint,
          0.35,
        );
        orb.userData.index = index;
        hits.push(orb);
        selected.push(orb);
        label(
          `${String(node.ordinal ?? index + 1).padStart(2, "0")} · ${node.score === null ? "—" : node.score.toFixed(1)}`,
          endpoint.clone().add(new THREE.Vector3(0, 0.5, 0)),
          nodeColor(node),
          0.85,
        );
        nodeLabels.push(
          label(
            node.label,
            endpoint.clone().add(new THREE.Vector3(0, 0.9, 0)),
            "#e3f5ee",
            0.9,
          ),
        );
        const count = Math.min(node.count ?? 0, 10);
        for (let leaf = 0; leaf < count; leaf++) {
          const a = (leaf / Math.max(count, 1)) * Math.PI * 2;
          const tip = endpoint
            .clone()
            .add(
              new THREE.Vector3(
                Math.cos(a) * 0.48,
                0.2 + Math.sin(a) * 0.1,
                Math.sin(a) * 0.48,
              ),
            );
          tube([endpoint, tip], "#477665", 0.009);
          mesh(new THREE.OctahedronGeometry(0.065), nodeColor(node), tip, 0.2);
        }
      });
      label("APRENDIZAJE", new THREE.Vector3(0, 0.08, 2.5), "#80a4a9", 0.75);
    } else if (mode === "journey") {
      nodes.forEach((node, index) => {
        const x =
          nodes.length === 1 ? 0 : -3.2 + (index / (nodes.length - 1)) * 6.4;
        const y =
          node.score === null
            ? 0.55
            : 0.55 + Math.min(10, Math.max(0, node.score)) * 0.32;
        const point = new THREE.Vector3(x, y, Math.sin(index * 1.5) * 0.65);
        points.push(point);
        mesh(
          new THREE.CylinderGeometry(0.045, 0.045, y, 12),
          "#315b62",
          new THREE.Vector3(x, y / 2, point.z),
        );
        const orb = mesh(
          new THREE.SphereGeometry(0.19, 24, 16),
          nodeColor(node),
          point,
          0.3,
        );
        orb.userData.index = index;
        hits.push(orb);
        selected.push(orb);
        label(
          node.score === null ? "Sin datos" : node.score.toFixed(1),
          point.clone().add(new THREE.Vector3(0, 0.52, 0)),
          nodeColor(node),
          1.1,
        );
        label(
          node.label,
          new THREE.Vector3(x, -0.1, point.z + 0.55),
          "#c5d9de",
          0.75,
        );
      });
      if (points.length > 1) tube(points, "#94dece", 0.035);
      const threshold = mesh(
        new THREE.BoxGeometry(7.2, 0.008, 2.3),
        "#638274",
        new THREE.Vector3(0, 2.15, 0),
      );
      threshold.material.transparent = true;
      threshold.material.opacity = 0.12;
      label(
        "REFERENCIA · 5",
        new THREE.Vector3(-3.1, 2.3, -1.2),
        "#809d99",
        0.7,
      );
    }

    const halo = mesh(
      new THREE.TorusGeometry(0.34, 0.013, 8, 64),
      MINT,
      new THREE.Vector3(),
    );
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = { x: 0, y: 0 };
    const down = (event: PointerEvent) => {
      pointerStart = { x: event.clientX, y: event.clientY };
    };
    const pick = (event: PointerEvent) => {
      if (
        Math.hypot(
          event.clientX - pointerStart.x,
          event.clientY - pointerStart.y,
        ) > 6
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hits)[0];
      if (hit) current.current.onSelect(hit.object.userData.index as number);
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointerup", pick);
    const loseContext = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", loseContext);
    let dirty = true;
    const resize = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.position.copy(cameraHome).multiplyScalar(width < 500 ? 1.45 : 1);
      camera.updateProjectionMatrix();
      dirty = true;
    });
    resize.observe(container);
    let inView = true;
    const observer = new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
    });
    observer.observe(container);
    let frame = 0;
    let lastTime = 0;
    let lastActive = -1;
    let introStart: number | null = null;
    const changed = () => {
      dirty = true;
    };
    controls.addEventListener("change", changed);
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      if (!inView || document.hidden || time - lastTime < 32) return;
      lastTime = time;
      const state = current.current;
      introStart ??= time;
      if (mode === "tree")
        world.scale.y = state.reducedMotion
          ? 1
          : 0.15 +
            0.85 *
              (1 - Math.pow(1 - Math.min(1, (time - introStart) / 1100), 3));
      nodeLabels.forEach((sprite, index) => {
        if (sprite) sprite.visible = index === state.activeIndex;
      });
      controls.autoRotate = !state.reducedMotion && mode === "tree";
      controls.update();
      if (selected[state.activeIndex]) {
        const active = selected[state.activeIndex];
        halo.position.copy(active.position);
        halo.quaternion.copy(camera.quaternion);
        halo.scale.setScalar(
          state.reducedMotion ? 1 : 1 + Math.sin(time * 0.002) * 0.07,
        );
        selected.forEach((object, index) => {
          object.scale.setScalar(index === state.activeIndex ? 1.25 : 1);
        });
      }
      if (mode === "journey" && points[state.activeIndex]) {
        const point = points[state.activeIndex];
        const target = new THREE.Vector3(point.x * 0.3, 1.8, 0);
        controls.target.lerp(target, state.reducedMotion ? 1 : 0.045);
      }
      if (
        !state.reducedMotion ||
        dirty ||
        lastActive !== state.activeIndex
      )
        renderer.render(scene, camera);
      lastActive = state.activeIndex;
      dirty = false;
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      controls.removeEventListener("change", changed);
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointerup", pick);
      renderer.domElement.removeEventListener("webglcontextlost", loseContext);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Sprite) {
          if (object instanceof THREE.Mesh) object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((item) => {
            if ("map" in item) (item.map as THREE.Texture | null)?.dispose();
            item.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [mode, nodes]);

  return (
    <div className="learning-canvas" ref={host}>
      {failed && (
        <div className="learning-render-fallback" role="status">
          <strong>La vista de datos sigue disponible</strong>
          <p>
            Tu navegador no ha podido iniciar la escena 3D. Selecciona «Vista
            2D» para continuar.
          </p>
        </div>
      )}
    </div>
  );
}
