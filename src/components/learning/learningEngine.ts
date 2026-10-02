import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { formatScore } from "../../lib/learningInsights";

export interface SceneNode {
  id: string;
  label: string;
  score: number | null;
  target?: number;
  count?: number;
  ordinal?: number;
}
export type SceneMode = "tree" | "journey";
type Tone = "achieved" | "developing" | "pending";

interface Callbacks {
  onSelect: (index: number) => void;
  onFail: () => void;
}

interface Item {
  index: number;
  node: SceneNode;
  tone: Tone;
  color: THREE.Color;
  colorTarget: THREE.Color;
  energy: number;
  scale: number;
  flash: number;
  appear: number;
  start: number;
  pos: THREE.Vector3;
  orb: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  shell: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  glow: THREE.Sprite;
  chip: HTMLDivElement;
  chipScore: HTMLSpanElement;
  tag?: HTMLDivElement;
  // Tree
  curve?: THREE.CatmullRomCurve3;
  originU?: number;
  branch?: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
  bud?: THREE.Sprite;
  pulse?: THREE.Sprite;
  pulseOffset?: number;
  lastPulse?: number;
  satellites?: THREE.Group;
  satelliteMaterial?: THREE.MeshStandardMaterial;
  // Journey
  x?: number;
  z?: number;
  y?: number;
  yTarget?: number;
  solid?: number;
  pillar?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  ghost?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  baseRing?: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

interface Ripple {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  start: number;
  duration: number;
  from: number;
  to: number;
  facing: boolean;
  strength: number;
}

const MINT = new THREE.Color("#a0efce");
const AMBER = new THREE.Color("#f5c58a");
const IDLE = new THREE.Color("#708799");
const TEAL = new THREE.Color("#66d8d7");
const GROUND_Y = 0.55;
const MAX_PIXEL_RATIO = 2;

const toneOf = (node: SceneNode): Tone =>
  node.score === null
    ? "pending"
    : node.score >= (node.target ?? 5)
      ? "achieved"
      : "developing";
const toneColor = (tone: Tone) =>
  tone === "achieved" ? MINT : tone === "developing" ? AMBER : IDLE;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutBack = (t: number, s = 1.7) => {
  const c = s + 1;
  return 1 + c * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
};
const progress = (time: number, start: number, duration: number) =>
  clamp01((time - start) / duration);
const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
const yForScore = (score: number | null) =>
  score === null ? GROUND_Y : GROUND_Y + Math.min(10, Math.max(0, score)) * 0.4;

const canvasTexture = (
  size: number,
  paint: (context: CanvasRenderingContext2D, size: number) => void,
) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) paint(context, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const glowPainter = (context: CanvasRenderingContext2D, size: number) => {
  const half = size / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.16, "rgba(255,255,255,0.72)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.16)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
};

const fresnelMaterial = (color: THREE.Color, intensity = 1.2) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uIntensity: { value: intensity },
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uIntensity;
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4) * uIntensity;
        gl_FragColor = vec4(uColor * rim, clamp(rim, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

const groundMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: TEAL.clone() },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float base = smoothstep(1.0, 0.0, r) * 0.13;
        float sweep = fract(atan(p.y, p.x) / 6.2831853 - uTime * 0.05);
        float beam = pow(sweep, 16.0) * smoothstep(1.0, 0.97, sweep) * smoothstep(1.0, 0.15, r) * 0.16;
        float glow = (base + beam) * uOpacity;
        gl_FragColor = vec4(uColor * glow, clamp(glow, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

const thresholdMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: MINT.clone() },
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec2 vUv;
      void main() {
        vec2 grid = vUv * vec2(26.0, 9.0);
        vec2 g = abs(fract(grid - 0.5) - 0.5) / fwidth(grid);
        float line = 1.0 - min(min(g.x, g.y), 1.0);
        float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x)
          * smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float band = fract(vUv.x - uTime * 0.09);
        float scan = exp(-pow((band - 0.5) * 12.0, 2.0));
        float alpha = (line * 0.42 + 0.05 + scan * 0.22) * edge * uOpacity;
        gl_FragColor = vec4(uColor * alpha, clamp(alpha, 0.0, 1.0));
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

/**
 * Builds a tube whose radius tapers from r0 at the start to r1 at the end.
 * TubeGeometry stores one ring of (radial + 1) vertices per segment, so each
 * ring can be scaled around its centre on the curve.
 */
const taperedTube = (
  curve: THREE.Curve<THREE.Vector3>,
  segments: number,
  r0: number,
  r1: number,
  radial = 8,
) => {
  const geometry = new THREE.TubeGeometry(curve, segments, 1, radial, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const centre = new THREE.Vector3();
  const vertex = new THREE.Vector3();
  for (let ring = 0; ring <= segments; ring++) {
    const u = ring / segments;
    curve.getPointAt(u, centre);
    const radius = r0 + (r1 - r0) * u;
    for (let k = 0; k <= radial; k++) {
      const index = ring * (radial + 1) + k;
      vertex
        .fromBufferAttribute(position, index)
        .sub(centre)
        .multiplyScalar(radius)
        .add(centre);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
  position.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
};

const revealTube = (
  geometry: THREE.TubeGeometry,
  amount: number,
  segments: number,
  radial: number,
) => {
  const perRing = radial * 6;
  geometry.setDrawRange(0, Math.round(segments * clamp01(amount)) * perRing);
};

const disposeObject = (root: THREE.Object3D, keep: Set<THREE.Texture>) => {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = (object as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (!material) return;
    (Array.isArray(material) ? material : [material]).forEach((item) => {
      const map = (item as THREE.SpriteMaterial).map;
      if (map && !keep.has(map)) map.dispose();
      item.dispose();
    });
  });
};

export class LearningEngine {
  private container: HTMLElement;
  private labels: HTMLElement;
  private callbacks: Callbacks;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private controls: OrbitControls;
  private glowTexture: THREE.Texture;
  private shared: Set<THREE.Texture>;
  private persistent = new THREE.Group();
  private groundDisc: THREE.Mesh<THREE.CircleGeometry, THREE.ShaderMaterial>;
  private groundLines: THREE.Group;
  private groundDots: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private fireflies: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private fireflyData: { x: number; z: number; speed: number; phase: number; tint: THREE.Color }[] = [];
  private halo = new THREE.Group();
  private haloMaterials: THREE.MeshBasicMaterial[] = [];
  private haloPosition = new THREE.Vector3();
  private haloVisible = 0;
  private ripples: Ripple[] = [];
  private world: THREE.Group | null = null;
  private outgoing: { group: THREE.Group; chips: HTMLElement[]; start: number }[] = [];
  private items: Item[] = [];
  private chips: HTMLElement[] = [];
  private mode: SceneMode = "tree";
  private signature = "";
  private builds = 0;
  private buildAt = 0;
  private speed = 1;
  private active = 0;
  private hovered = -1;
  private reduced = false;
  private now = 0;
  private last = 0;
  private frame = 0;
  private dirty = true;
  private inView = true;
  private pointer = new THREE.Vector2();
  private pointerInside = false;
  private pointerMoved = false;
  private pointerStart = { x: 0, y: 0 };
  private raycaster = new THREE.Raycaster();
  private resizeObserver: ResizeObserver;
  private intersection: IntersectionObserver;
  private width = 1;
  private height = 1;
  private cameraHome = new THREE.Vector3();
  private cameraIntro: { from: THREE.Spherical; to: THREE.Spherical; start: number; duration: number } | null = null;
  private targetHome = new THREE.Vector3(0, 1.8, 0);
  private nextRipple = 0;
  // Tree only
  private trunk: {
    mesh: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial>;
    curve: THREE.CatmullRomCurve3;
    bud: THREE.Sprite;
    seed: THREE.Sprite;
  } | null = null;
  // Journey only
  private path: {
    core: THREE.Mesh<THREE.TubeGeometry, THREE.MeshStandardMaterial> | null;
    aura: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> | null;
    curve: THREE.CatmullRomCurve3 | null;
    stations: number[];
    reveal: number;
    key: string;
  } | null = null;
  private threshold: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null;
  private comet: {
    head: THREE.Sprite;
    core: THREE.Sprite;
    trail: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
    s: number;
    velocity: number;
    arrivedAt: number;
    visible: number;
  } | null = null;
  private referenceChip: HTMLDivElement | null = null;
  private referenceAnchor = new THREE.Vector3(3.95, yForScore(5), -1.3);
  private scratch = new THREE.Vector3();
  private scratch2 = new THREE.Vector3();

  constructor(container: HTMLElement, labels: HTMLElement, callbacks: Callbacks) {
    this.container = container;
    this.labels = labels;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    container.appendChild(this.renderer.domElement);

    this.glowTexture = canvasTexture(128, glowPainter);
    this.shared = new Set([this.glowTexture]);
    this.scene.fog = new THREE.FogExp2("#0b1a24", 0.035);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.targetHome);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = false;
    this.controls.enableZoom = false;
    this.controls.minPolarAngle = Math.PI / 5;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.rotateSpeed = 0.7;
    this.controls.addEventListener("change", this.markDirty);
    this.controls.addEventListener("start", this.cancelCameraIntro);

    this.scene.add(new THREE.HemisphereLight("#e9fff6", "#182b42", 2.4));
    const key = new THREE.DirectionalLight("#fff5db", 3.2);
    key.position.set(3, 8, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight("#66d8d7", 1.6);
    rim.position.set(-5, 3, -4);
    this.scene.add(rim);

    this.scene.add(this.persistent);
    this.groundDisc = new THREE.Mesh(new THREE.CircleGeometry(4.9, 96), groundMaterial());
    this.groundDisc.rotation.x = -Math.PI / 2;
    this.groundDisc.position.y = -0.02;
    this.persistent.add(this.groundDisc);
    this.groundLines = new THREE.Group();
    [2.3, 3.2, 4.15].forEach((radius, index) => {
      const points = Array.from({ length: 129 }, (_, i) => {
        const angle = (i / 128) * Math.PI * 2;
        return new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({
          color: "#4f9d97",
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      line.userData.opacity = [0.42, 0.3, 0.2][index];
      this.groundLines.add(line);
    });
    const ticks: number[] = [];
    for (let i = 0; i < 72; i++) {
      const angle = (i / 72) * Math.PI * 2;
      const inner = i % 6 === 0 ? 4.3 : 4.42;
      ticks.push(
        Math.cos(angle) * inner, 0, Math.sin(angle) * inner,
        Math.cos(angle) * 4.55, 0, Math.sin(angle) * 4.55,
      );
    }
    const tickGeometry = new THREE.BufferGeometry();
    tickGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ticks, 3));
    const tickLines = new THREE.LineSegments(
      tickGeometry,
      new THREE.LineBasicMaterial({ color: "#4f9d97", transparent: true, opacity: 0, depthWrite: false }),
    );
    tickLines.userData.opacity = 0.3;
    this.groundLines.add(tickLines);
    this.persistent.add(this.groundLines);

    const dotPositions: number[] = [];
    for (let i = 0; i < 96; i++) {
      const angle = (i / 96) * Math.PI * 2;
      dotPositions.push(Math.cos(angle) * 3.68, 0.01, Math.sin(angle) * 3.68);
    }
    const dotGeometry = new THREE.BufferGeometry();
    dotGeometry.setAttribute("position", new THREE.Float32BufferAttribute(dotPositions, 3));
    this.groundDots = new THREE.Points(
      dotGeometry,
      new THREE.PointsMaterial({
        color: MINT,
        size: 0.07,
        map: this.glowTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.persistent.add(this.groundDots);

    const count = 150;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const radius = Math.sqrt(Math.random()) * 4.6;
      const angle = Math.random() * Math.PI * 2;
      this.fireflyData.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        speed: 0.12 + Math.random() * 0.28,
        phase: Math.random() * Math.PI * 2,
        tint: Math.random() < 0.18 ? AMBER : Math.random() < 0.5 ? TEAL : MINT,
      });
      positions[i * 3 + 1] = Math.random() * 6;
    }
    const fireflyGeometry = new THREE.BufferGeometry();
    fireflyGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    fireflyGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.fireflies = new THREE.Points(
      fireflyGeometry,
      new THREE.PointsMaterial({
        size: 0.09,
        map: this.glowTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.fireflies.frustumCulled = false;
    this.persistent.add(this.fireflies);

    const ring = new THREE.TorusGeometry(0.4, 0.011, 8, 96);
    const haloRing = new THREE.MeshBasicMaterial({
      color: MINT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.haloMaterials.push(haloRing);
    this.halo.add(new THREE.Mesh(ring, haloRing));
    const arcs = new THREE.Group();
    arcs.name = "arcs";
    for (let i = 0; i < 3; i++) {
      const material = haloRing.clone();
      this.haloMaterials.push(material);
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.016, 6, 40, 1.15), material);
      arc.rotation.z = (i / 3) * Math.PI * 2;
      arcs.add(arc);
    }
    this.halo.add(arcs);
    this.halo.visible = false;
    this.scene.add(this.halo);

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.RingGeometry(0.97, 1, 96),
        new THREE.MeshBasicMaterial({
          color: MINT,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.visible = false;
      this.scene.add(mesh);
      this.ripples.push({ mesh, start: -1, duration: 1, from: 0, to: 1, facing: false, strength: 1 });
    }

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("webglcontextlost", this.onContextLost);
    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(container);
    this.intersection = new IntersectionObserver((entries) => {
      this.inView = entries[0]?.isIntersecting ?? true;
    });
    this.intersection.observe(container);
    this.onResize();
    this.frame = requestAnimationFrame(this.loop);
  }

  /** Rebuilds the scene when the structure changes, otherwise tweens the data. */
  sync(mode: SceneMode, nodes: SceneNode[]) {
    const signature = `${mode}:${nodes.map((node) => node.id).join("|")}`;
    if (signature === this.signature) {
      this.update(nodes);
      return;
    }
    this.signature = signature;
    this.build(mode, nodes);
  }

  setActive(index: number) {
    if (index === this.active) return;
    this.active = index;
    const item = this.items[index];
    if (item && !this.reduced && item.appear > 0.6) {
      item.flash = 1;
      this.spawnRipple(item.pos, 0.25, 1.5, 0.75, true, 0.9);
    }
    this.markDirty();
  }

  setReduced(reduced: boolean) {
    this.reduced = reduced;
    this.controls.autoRotate = false;
    this.markDirty();
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.intersection.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.controls.removeEventListener("change", this.markDirty);
    this.controls.removeEventListener("start", this.cancelCameraIntro);
    this.controls.dispose();
    this.labels.replaceChildren();
    disposeObject(this.scene, new Set());
    this.glowTexture.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    canvas.remove();
  }

  // ---------------------------------------------------------------- build

  private build(mode: SceneMode, nodes: SceneNode[]) {
    if (this.world) {
      this.outgoing.push({ group: this.world, chips: this.chips, start: this.now });
      this.chips.forEach((chip) => chip.classList.add("is-leaving"));
    }
    this.mode = mode;
    this.items = [];
    this.chips = [];
    this.trunk = null;
    this.path = null;
    this.threshold = null;
    this.comet = null;
    this.referenceChip = null;
    this.hovered = -1;
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.builds += 1;
    this.speed = this.builds === 1 ? 1 : 1.3;
    this.buildAt = this.now;
    this.nextRipple = 0.1;
    if (mode === "tree") this.buildTree(nodes);
    else this.buildJourney(nodes);
    this.update(nodes, true);
    this.cameraHome.copy(
      mode === "journey" ? new THREE.Vector3(2.2, 5.1, 10.4) : new THREE.Vector3(5.5, 4.3, 7.4),
    );
    this.targetHome.set(0, mode === "journey" ? 1.95 : 2.05, 0);
    this.frameCamera(true);
    this.markDirty();
  }

  private makeChip(item: Pick<Item, "index">, number: string, name: string) {
    const chip = document.createElement("div");
    chip.className = "scene-chip";
    const num = document.createElement("span");
    num.className = "scene-chip__num";
    num.textContent = number;
    const label = document.createElement("span");
    label.className = "scene-chip__name";
    label.textContent = name;
    const score = document.createElement("span");
    score.className = "scene-chip__score";
    chip.append(num, label, score);
    chip.addEventListener("click", () => this.callbacks.onSelect(item.index));
    chip.addEventListener("pointerenter", () => {
      this.hovered = item.index;
      this.markDirty();
    });
    chip.addEventListener("pointerleave", () => {
      if (this.hovered === item.index) this.hovered = -1;
      this.markDirty();
    });
    this.labels.appendChild(chip);
    this.chips.push(chip);
    return { chip, score };
  }

  private makeOrb(color: THREE.Color, radius: number, detail = 4) {
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, detail),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.5,
        roughness: 0.25,
        metalness: 0.15,
      }),
    );
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(radius * 1.45, 3), fresnelMaterial(color));
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    return { orb, shell, glow };
  }

  private sprite(color: THREE.Color | string, opacity = 1) {
    return new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
  }

  private buildTree(nodes: SceneNode[]) {
    const world = this.world!;
    const n = nodes.length;
    const height = n > 1 ? 3.7 : 1.6;
    const trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(-0.16, height * 0.38, 0.06),
      new THREE.Vector3(0.06, height * 0.74, -0.04),
      new THREE.Vector3(0, height, 0),
    ]);
    const trunk = new THREE.Mesh(
      taperedTube(trunkCurve, 64, 0.14, 0.04, 10),
      new THREE.MeshStandardMaterial({
        color: "#86d6bb",
        emissive: "#2c7a66",
        emissiveIntensity: 0.45,
        roughness: 0.5,
        metalness: 0.05,
      }),
    );
    world.add(trunk);
    const bud = this.sprite("#e6fff4", 0);
    bud.scale.setScalar(0.7);
    world.add(bud);
    const seed = this.sprite(MINT, 0.9);
    seed.position.set(0, 0.12, 0);
    world.add(seed);
    this.trunk = { mesh: trunk, curve: trunkCurve, bud, seed };

    nodes.forEach((node, index) => {
      const angle = index * 2.39996 + 0.4;
      const radius = 1.7 + (index % 2) * 0.55;
      const y = 1.4 + (n > 1 ? index / (n - 1) : 0) * 2.6;
      const end = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      const originU = Math.min(0.92, (y * 0.6) / height);
      const origin = trunkCurve.getPointAt(originU);
      const mid = new THREE.Vector3(end.x * 0.48, (origin.y + y) / 2 + 0.3, end.z * 0.48);
      const curve = new THREE.CatmullRomCurve3([origin, mid, end]);
      const tone = toneOf(node);
      const color = toneColor(tone).clone();
      const branch = new THREE.Mesh(
        taperedTube(curve, 48, 0.065, 0.022, 8),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.28,
          roughness: 0.45,
          metalness: 0.08,
        }),
      );
      world.add(branch);
      const { orb, shell, glow } = this.makeOrb(color, 0.24);
      orb.position.copy(end);
      shell.position.copy(end);
      glow.position.copy(end);
      orb.userData.index = index;
      world.add(orb, shell, glow);
      const branchBud = this.sprite("#ffffff", 0);
      branchBud.scale.setScalar(0.45);
      world.add(branchBud);
      const pulse = this.sprite(color, 0);
      pulse.scale.setScalar(0.42);
      world.add(pulse);

      const satelliteMaterial = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.6,
        roughness: 0.3,
      });
      const satellites = new THREE.Group();
      satellites.position.copy(end);
      satellites.rotation.x = 0.45 + index * 0.27;
      satellites.rotation.z = (index % 2 ? -1 : 1) * 0.3;
      const satelliteCount = Math.min(node.count ?? 0, 10);
      const satelliteGeometry = new THREE.OctahedronGeometry(0.058);
      for (let s = 0; s < satelliteCount; s++) {
        const a = (s / Math.max(satelliteCount, 1)) * Math.PI * 2;
        const satellite = new THREE.Mesh(
          s === 0 ? satelliteGeometry : satelliteGeometry.clone(),
          satelliteMaterial,
        );
        satellite.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
        satellite.userData.phase = a;
        satellites.add(satellite);
      }
      world.add(satellites);

      const { chip, score } = this.makeChip(
        { index },
        String(node.ordinal ?? index + 1).padStart(2, "0"),
        node.label,
      );
      this.items.push({
        index,
        node,
        tone,
        color,
        colorTarget: color.clone(),
        energy: 1,
        scale: 1,
        flash: 0,
        appear: 0,
        start: 0.75 + index * 0.17,
        pos: end.clone(),
        orb,
        shell,
        glow,
        chip,
        chipScore: score,
        curve,
        originU,
        branch,
        bud: branchBud,
        pulse,
        pulseOffset: index * 0.61,
        lastPulse: -1,
        satellites,
        satelliteMaterial,
      });
    });
  }

  private buildJourney(nodes: SceneNode[]) {
    const world = this.world!;
    const n = nodes.length;
    const pillarGeometry = new THREE.CylinderGeometry(0.03, 0.05, 1, 14);
    pillarGeometry.translate(0, 0.5, 0);
    nodes.forEach((node, index) => {
      const x = n === 1 ? 0 : -3.3 + (index / (n - 1)) * 6.6;
      const z = Math.sin(index * 1.5) * 0.65;
      const tone = toneOf(node);
      const color = toneColor(tone).clone();
      const pillar = new THREE.Mesh(
        index === 0 ? pillarGeometry : pillarGeometry.clone(),
        new THREE.MeshStandardMaterial({
          color: "#3a7479",
          emissive: "#1f5458",
          emissiveIntensity: 0.6,
          roughness: 0.4,
          transparent: true,
          opacity: 0.85,
        }),
      );
      pillar.position.set(x, 0, z);
      world.add(pillar);
      const baseRing = new THREE.Mesh(
        new THREE.RingGeometry(0.17, 0.205, 48),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      baseRing.rotation.x = -Math.PI / 2;
      baseRing.position.set(x, 0.012, z);
      world.add(baseRing);
      const { orb, shell, glow } = this.makeOrb(color, 0.2);
      orb.userData.index = index;
      world.add(orb, shell, glow);
      const ghost = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.21, 1),
        new THREE.MeshBasicMaterial({
          color: IDLE,
          wireframe: true,
          transparent: true,
          opacity: 0.7,
          depthWrite: false,
        }),
      );
      ghost.position.set(x, GROUND_Y, z);
      ghost.userData.index = index;
      world.add(ghost);
      const { chip, score } = this.makeChip(
        { index },
        String(index + 1).padStart(2, "0"),
        node.label,
      );
      const tag = document.createElement("div");
      tag.className = "scene-tag";
      tag.textContent = node.label;
      this.labels.appendChild(tag);
      this.chips.push(tag);
      this.items.push({
        index,
        node,
        tone,
        color,
        colorTarget: color.clone(),
        energy: 1,
        scale: 1,
        flash: 0,
        appear: 0,
        start: 0.25 + index * 0.13,
        pos: new THREE.Vector3(x, 0, z),
        orb,
        shell,
        glow,
        chip,
        chipScore: score,
        tag,
        x,
        z,
        y: yForScore(node.score),
        yTarget: yForScore(node.score),
        solid: node.score === null ? 0 : 1,
        pillar,
        ghost,
        baseRing,
      });
    });

    const threshold = new THREE.Mesh(new THREE.PlaneGeometry(7.9, 2.7), thresholdMaterial());
    threshold.rotation.x = -Math.PI / 2;
    threshold.position.y = yForScore(5);
    world.add(threshold);
    this.threshold = threshold;
    const reference = document.createElement("div");
    reference.className = "scene-reference";
    reference.textContent = "Referencia 5";
    this.labels.appendChild(reference);
    this.chips.push(reference);
    this.referenceChip = reference;

    const head = this.sprite("#e8fff6", 0);
    head.scale.setScalar(1.05);
    const core = this.sprite("#ffffff", 0);
    core.scale.setScalar(0.3);
    const trailCount = 46;
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
    trailGeometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(trailCount * 3), 3));
    const trail = new THREE.Points(
      trailGeometry,
      new THREE.PointsMaterial({
        size: 0.2,
        map: this.glowTexture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    trail.frustumCulled = false;
    world.add(head, core, trail);
    this.comet = { head, core, trail, s: 0, velocity: 0, arrivedAt: -1, visible: 0 };
    this.path = { core: null, aura: null, curve: null, stations: [], reveal: 0, key: "" };
  }

  // --------------------------------------------------------------- update

  private update(nodes: SceneNode[], initial = false) {
    nodes.forEach((node, index) => {
      const item = this.items[index];
      if (!item) return;
      item.node = node;
      item.tone = toneOf(node);
      item.colorTarget.copy(toneColor(item.tone));
      item.chip.dataset.tone = item.tone;
      item.chipScore.textContent =
        this.mode === "journey" && node.score === null ? "Sin datos" : formatScore(node.score);
      if (this.mode === "journey") {
        item.yTarget = yForScore(node.score);
        if (initial || this.reduced) {
          item.y = item.yTarget;
          item.solid = node.score === null ? 0 : 1;
        }
      }
      if (initial || this.reduced) {
        item.color.copy(item.colorTarget);
        item.energy = item.tone === "pending" ? 0.35 : 1;
      }
    });
    this.markDirty();
  }

  // ---------------------------------------------------------------- camera

  private homePosition() {
    const narrow = this.width < 520;
    const tall = this.height > this.width * 0.95;
    return this.cameraHome.clone().multiplyScalar(narrow ? 1.4 : tall ? 1.2 : 1);
  }

  private frameCamera(intro: boolean) {
    const home = this.homePosition();
    this.controls.target.copy(this.targetHome);
    if (!intro || this.reduced) {
      this.cameraIntro = null;
      this.camera.position.copy(home);
      this.controls.update();
      return;
    }
    const offset = this.camera.position.clone().sub(this.targetHome);
    const to = new THREE.Spherical().setFromVector3(home.clone().sub(this.targetHome));
    const from =
      this.builds === 1 || offset.lengthSq() < 0.01
        ? new THREE.Spherical(
            to.radius * 0.62,
            Math.min(this.controls.maxPolarAngle, to.phi + 0.28),
            to.theta - 1.05,
          )
        : new THREE.Spherical().setFromVector3(offset);
    if (from.theta - to.theta > Math.PI) from.theta -= Math.PI * 2;
    if (to.theta - from.theta > Math.PI) from.theta += Math.PI * 2;
    this.cameraIntro = {
      from,
      to,
      start: this.now,
      duration: this.builds === 1 ? 2.8 : 1.6,
    };
  }

  private cancelCameraIntro = () => {
    this.cameraIntro = null;
  };

  // ---------------------------------------------------------------- events

  private markDirty = () => {
    this.dirty = true;
  };

  private onResize = () => {
    const { width, height } = this.container.getBoundingClientRect();
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    if (this.cameraIntro) {
      this.cameraIntro.to.setFromVector3(this.homePosition().sub(this.targetHome));
    } else if (this.signature) {
      const home = this.homePosition();
      const offset = this.camera.position.clone().sub(this.controls.target);
      offset.setLength(home.distanceTo(this.targetHome));
      this.camera.position.copy(this.controls.target).add(offset);
      this.controls.update();
    }
    this.markDirty();
  };

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.onFail();
  };

  private setPointer(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  private onPointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
  };

  private onPointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 6) return;
    this.setPointer(event);
    const hit = this.pick();
    if (hit !== -1) this.callbacks.onSelect(hit);
  };

  private onPointerMove = (event: PointerEvent) => {
    this.setPointer(event);
    this.pointerInside = true;
    this.pointerMoved = true;
  };

  private onPointerLeave = () => {
    this.pointerInside = false;
    this.pointerMoved = true;
  };

  private pick() {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets: THREE.Object3D[] = [];
    this.items.forEach((item) => {
      if (item.appear < 0.5) return;
      targets.push(item.orb);
      if (item.ghost && (item.solid ?? 1) < 0.5) targets.push(item.ghost);
    });
    const hit = this.raycaster.intersectObjects(targets, false)[0];
    return hit ? (hit.object.userData.index as number) : -1;
  }

  private spawnRipple(
    position: THREE.Vector3,
    from: number,
    to: number,
    duration: number,
    facing: boolean,
    strength: number,
    color: THREE.Color = MINT,
  ) {
    const ripple = this.ripples.find((item) => item.start < 0) ?? this.ripples[0];
    ripple.mesh.position.copy(position);
    ripple.mesh.material.color.copy(color);
    ripple.mesh.rotation.set(facing ? 0 : -Math.PI / 2, 0, 0);
    ripple.mesh.visible = true;
    Object.assign(ripple, { start: this.now, duration, from, to, facing, strength });
  }

  // ------------------------------------------------------------------ loop

  private loop = (timestamp: number) => {
    this.frame = requestAnimationFrame(this.loop);
    const time = timestamp / 1000;
    const dt = this.last ? Math.min(0.05, time - this.last) : 0.016;
    this.last = time;
    if (!this.inView || document.hidden) return;
    this.now += dt;
    const reduced = this.reduced;
    const local = reduced ? 1e6 : (this.now - this.buildAt) * this.speed;
    const step = reduced ? 1 : dt;

    if (this.pointerMoved) {
      this.pointerMoved = false;
      const hit = this.pointerInside ? this.pick() : -1;
      if (hit !== this.hovered) {
        this.hovered = hit;
        this.markDirty();
      }
      this.renderer.domElement.style.cursor = hit === -1 ? "" : "pointer";
    }

    const animating = !reduced;
    this.updateCamera(local, step);
    this.updateAmbient(local, dt, reduced);
    if (this.mode === "tree") this.updateTree(local, step, reduced);
    else this.updateJourney(local, step, reduced);
    this.updateHalo(step, reduced);
    this.updateRipples(reduced);
    this.updateOutgoing(reduced);
    this.controls.update();
    this.updateLabels();
    if (animating || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  private updateCamera(local: number, step: number) {
    const intro = this.cameraIntro;
    if (intro) {
      const t = this.reduced ? 1 : clamp01((this.now - intro.start) / intro.duration);
      const e = easeInOutCubic(t);
      const spherical = new THREE.Spherical(
        intro.from.radius + (intro.to.radius - intro.from.radius) * e,
        intro.from.phi + (intro.to.phi - intro.from.phi) * e,
        intro.from.theta + (intro.to.theta - intro.from.theta) * e,
      );
      this.camera.position.setFromSpherical(spherical).add(this.controls.target);
      if (t >= 1) this.cameraIntro = null;
    }
    this.controls.autoRotate = !this.reduced && this.mode === "tree" && !intro && local > 2.4 && this.hovered === -1;
    this.controls.autoRotateSpeed = 0.45;
    const active = this.items[this.active];
    const focus = this.scratch.copy(this.targetHome);
    if (active && active.appear > 0.5) {
      if (this.mode === "journey") focus.set(active.pos.x * 0.32, this.targetHome.y, 0);
      else focus.lerp(this.scratch2.copy(active.pos).setY(Math.max(1.6, active.pos.y * 0.8)), 0.22);
    }
    const target = this.controls.target;
    const lambda = this.reduced ? 1e3 : 2.2;
    target.set(
      damp(target.x, focus.x, lambda, step),
      damp(target.y, focus.y, lambda, step),
      damp(target.z, focus.z, lambda, step),
    );
  }

  private updateAmbient(local: number, dt: number, reduced: boolean) {
    const appear = easeOutCubic(progress(this.now, 0, 1.4));
    const groundMaterial = this.groundDisc.material;
    groundMaterial.uniforms.uTime.value = reduced ? 0 : this.now;
    groundMaterial.uniforms.uOpacity.value = reduced ? 1 : appear;
    this.groundLines.children.forEach((line) => {
      const material = (line as THREE.Line).material as THREE.LineBasicMaterial;
      material.opacity = (line.userData.opacity as number) * (reduced ? 1 : appear);
    });
    this.groundLines.scale.setScalar(reduced ? 1 : 0.7 + 0.3 * appear);
    this.groundDots.material.opacity = 0.75 * (reduced ? 1 : appear);
    if (!reduced) this.groundDots.rotation.y += dt * 0.04;

    const position = this.fireflies.geometry.attributes.position as THREE.BufferAttribute;
    const color = this.fireflies.geometry.attributes.color as THREE.BufferAttribute;
    this.fireflyData.forEach((fly, index) => {
      let y = position.getY(index);
      if (!reduced) {
        y += dt * fly.speed;
        if (y > 6.2) y = 0;
      }
      const sway = reduced ? 0 : Math.sin(this.now * 0.6 + fly.phase) * 0.22;
      position.setXYZ(index, fly.x + sway, y, fly.z + Math.cos(this.now * 0.5 + fly.phase) * 0.18);
      const fade = Math.min(1, y / 0.8) * Math.min(1, (6.2 - y) / 1.4);
      const flicker = reduced ? 0.6 : 0.45 + 0.55 * Math.pow(Math.sin(this.now * 1.7 + fly.phase * 3) * 0.5 + 0.5, 2);
      const intensity = fade * flicker * 0.85 * (reduced ? 1 : appear);
      color.setXYZ(index, fly.tint.r * intensity, fly.tint.g * intensity, fly.tint.b * intensity);
    });
    position.needsUpdate = true;
    color.needsUpdate = true;

    if (!reduced && this.mode === "tree" && local > this.nextRipple) {
      this.nextRipple = local + 4.2;
      this.spawnRipple(this.scratch2.set(0, 0.02, 0), 0.2, 4.6, 3.2, false, 0.55);
    }
  }

  private applyColor(item: Item) {
    item.orb.material.color.copy(item.color);
    item.orb.material.emissive.copy(item.color);
    item.shell.material.uniforms.uColor.value.copy(item.color);
    (item.glow.material as THREE.SpriteMaterial).color.copy(item.color);
    item.branch?.material.color.copy(item.color);
    item.branch?.material.emissive.copy(item.color);
    item.satelliteMaterial?.color.copy(item.color);
    item.satelliteMaterial?.emissive.copy(item.color);
    if (item.pulse) (item.pulse.material as THREE.SpriteMaterial).color.copy(item.color);
    if (item.baseRing) item.baseRing.material.color.copy(item.color);
  }

  private updateItemCommon(item: Item, step: number, reduced: boolean) {
    const lambda = reduced ? 1e3 : 5;
    item.color.r = damp(item.color.r, item.colorTarget.r, lambda, step);
    item.color.g = damp(item.color.g, item.colorTarget.g, lambda, step);
    item.color.b = damp(item.color.b, item.colorTarget.b, lambda, step);
    item.energy = damp(item.energy, item.tone === "pending" ? 0.35 : 1, lambda, step);
    const isActive = item.index === this.active;
    const isHovered = item.index === this.hovered;
    item.scale = damp(item.scale, isActive ? 1.32 : isHovered ? 1.16 : 1, reduced ? 1e3 : 9, step);
    item.flash = reduced ? 0 : damp(item.flash, 0, 3.2, step);
    this.applyColor(item);
  }

  private updateTree(local: number, step: number, reduced: boolean) {
    const trunk = this.trunk;
    if (trunk) {
      const grow = easeOutCubic(progress(local, 0.15, 0.95));
      revealTube(trunk.mesh.geometry, grow, 64, 10);
      const growing = grow > 0 && grow < 1;
      trunk.curve.getPointAt(Math.max(0.001, grow), trunk.bud.position);
      (trunk.bud.material as THREE.SpriteMaterial).opacity = growing ? 1 : damp((trunk.bud.material as THREE.SpriteMaterial).opacity, 0, 6, step);
      const seedPulse = reduced ? 0.8 : 0.75 + Math.sin(this.now * 2.2) * 0.12 + (1 - progress(local, 0, 0.6)) * 1.4;
      trunk.seed.scale.setScalar(0.9 * seedPulse);
    }
    this.items.forEach((item) => {
      this.updateItemCommon(item, step, reduced);
      const branchTime = progress(local, item.start, 0.7);
      const branchGrow = easeOutCubic(branchTime);
      revealTube(item.branch!.geometry, branchGrow, 48, 8);
      const budMaterial = item.bud!.material as THREE.SpriteMaterial;
      if (branchGrow > 0 && branchGrow < 1) {
        item.curve!.getPointAt(Math.max(0.001, branchGrow), item.bud!.position);
        budMaterial.opacity = 1;
      } else budMaterial.opacity = damp(budMaterial.opacity, 0, 6, step);

      const popStart = item.start + 0.6;
      const pop = progress(local, popStart, 0.75);
      if (pop > 0 && item.appear === 0 && !reduced) item.flash = 1.4;
      item.appear = pop;
      const popScale = pop <= 0 ? 0 : easeOutBack(pop, 2.4);
      const scale = popScale * item.scale;
      item.orb.scale.setScalar(Math.max(0.0001, scale));
      item.shell.scale.setScalar(Math.max(0.0001, scale * (1 + item.flash * 0.25)));
      item.shell.material.uniforms.uIntensity.value = (0.8 + item.flash * 1.4) * item.energy;
      item.orb.material.emissiveIntensity = (0.35 + item.flash * 0.9) * item.energy + (item.index === this.active ? 0.25 : 0);
      const breathe = reduced ? 0 : Math.sin(this.now * 2.4 + item.index) * 0.08;
      const glowSize = (1.25 + breathe + item.flash * 1.1 + (item.index === this.active ? 0.45 : 0)) * item.energy;
      item.glow.scale.setScalar(Math.max(0.0001, glowSize * popScale));
      (item.glow.material as THREE.SpriteMaterial).opacity = 0.55 * Math.min(1, pop * 2);

      const satellites = item.satellites!;
      const unfold = progress(local, popStart + 0.3, 0.8);
      satellites.scale.setScalar(Math.max(0.0001, easeOutBack(unfold, 1.6) * (0.9 + item.scale * 0.1)));
      if (!reduced) satellites.rotation.y += step * (0.35 + item.index * 0.04) * (item.index === this.active ? 2 : 1);
      satellites.children.forEach((satellite) => {
        satellite.rotation.x += reduced ? 0 : step * 1.2;
        satellite.rotation.y += reduced ? 0 : step * 0.8;
        satellite.position.y = reduced ? 0 : Math.sin(this.now * 2 + (satellite.userData.phase as number)) * 0.04;
      });

      const pulseMaterial = item.pulse!.material as THREE.SpriteMaterial;
      if (!reduced && item.tone !== "pending" && pop >= 1 && this.trunk) {
        const period = 3.6;
        const cycle = ((local + item.pulseOffset!) % period) / period;
        const travel = cycle * 1.55;
        if (travel <= 1) {
          const split = 0.38;
          if (travel < split) {
            this.trunk.curve.getPointAt((travel / split) * item.originU!, item.pulse!.position);
          } else {
            item.curve!.getPointAt((travel - split) / (1 - split), item.pulse!.position);
          }
          pulseMaterial.opacity = Math.sin(Math.min(1, travel) * Math.PI) * 0.9 + 0.1;
          item.lastPulse = travel;
        } else {
          if ((item.lastPulse ?? 0) <= 1 && (item.lastPulse ?? 0) > 0.9) item.flash = Math.max(item.flash, 0.55);
          item.lastPulse = travel;
          pulseMaterial.opacity = 0;
        }
      } else pulseMaterial.opacity = 0;
    });
  }

  private updateJourney(local: number, step: number, reduced: boolean) {
    const n = this.items.length;
    this.items.forEach((item) => {
      this.updateItemCommon(item, step, reduced);
      const rise = progress(local, item.start, 0.85);
      item.appear = rise;
      const lift = rise <= 0 ? 0 : easeOutBack(rise, 1.4);
      item.y = damp(item.y!, item.yTarget!, reduced ? 1e3 : 4.5, step);
      item.solid = damp(item.solid!, item.node.score === null ? 0 : 1, reduced ? 1e3 : 6, step);
      const y = item.y! * lift;
      item.pos.set(item.x!, y, item.z!);
      const solid = item.solid!;
      item.pillar!.scale.set(1, Math.max(0.0001, y * solid), 1);
      item.pillar!.material.opacity = 0.85 * solid;
      item.pillar!.visible = solid > 0.01;
      const orbScale = Math.max(0.0001, Math.min(1, rise * 3) * solid * item.scale);
      item.orb.position.copy(item.pos);
      item.orb.scale.setScalar(orbScale);
      item.shell.position.copy(item.pos);
      item.shell.scale.setScalar(Math.max(0.0001, orbScale * (1 + item.flash * 0.3)));
      item.shell.material.uniforms.uIntensity.value = (0.8 + item.flash * 1.6) * item.energy;
      item.orb.material.emissiveIntensity = 0.4 + item.flash * 0.9 + (item.index === this.active ? 0.25 : 0);
      item.glow.position.copy(item.pos);
      const breathe = reduced ? 0 : Math.sin(this.now * 2.2 + item.index) * 0.07;
      item.glow.scale.setScalar(Math.max(0.0001, (1.15 + breathe + item.flash * 1.2 + (item.index === this.active ? 0.4 : 0)) * orbScale));
      (item.glow.material as THREE.SpriteMaterial).opacity = 0.55 * solid;
      const ghost = item.ghost!;
      ghost.visible = solid < 0.99;
      ghost.scale.setScalar(Math.max(0.0001, (1 - solid) * Math.min(1, rise * 2) * item.scale));
      ghost.material.opacity = 0.65 * (1 - solid) * (reduced ? 1 : 0.7 + Math.sin(this.now * 3 + item.index) * 0.3);
      if (!reduced) {
        ghost.rotation.y += step * 0.6;
        ghost.rotation.x += step * 0.3;
      }
      if ((item.solid ?? 1) < 0.5) item.pos.set(item.x!, GROUND_Y * lift, item.z!);
      ghost.position.set(item.x!, GROUND_Y * lift, item.z!);
      item.baseRing!.material.opacity = 0.6 * Math.min(1, rise * 2) * (0.5 + solid * 0.5);
      const ringScale = 1 + (item.index === this.active ? 0.5 + (reduced ? 0 : Math.sin(this.now * 3) * 0.12) : 0);
      item.baseRing!.scale.setScalar(ringScale);
    });

    const threshold = this.threshold;
    if (threshold) {
      threshold.material.uniforms.uTime.value = reduced ? 0 : this.now;
      threshold.material.uniforms.uOpacity.value = easeOutCubic(progress(local, 0.1 + n * 0.13, 0.8));
    }
    this.updatePath(local, reduced);
    this.updateComet(local, step, reduced);
  }

  private updatePath(local: number, reduced: boolean) {
    const path = this.path;
    if (!path || !this.world) return;
    const scored = this.items.filter((item) => (item.solid ?? 0) > 0.5);
    const stations = scored.map((item) => item.index);
    const points = scored.map((item) => item.pos.clone());
    const reveal = easeInOutCubic(progress(local, 0.3 + this.items.length * 0.13 + 0.25, 1.5));
    const key = points.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(";");
    path.stations = stations;
    if (key !== path.key) {
      path.key = key;
      if (path.core) {
        this.world.remove(path.core);
        path.core.geometry.dispose();
        path.core.material.dispose();
        path.core = null;
      }
      if (path.aura) {
        this.world.remove(path.aura);
        path.aura.geometry.dispose();
        path.aura.material.dispose();
        path.aura = null;
      }
      path.curve = points.length > 1 ? new THREE.CatmullRomCurve3(points, false, "centripetal") : null;
      if (path.curve) {
        path.core = new THREE.Mesh(
          new THREE.TubeGeometry(path.curve, 160, 0.03, 8, false),
          new THREE.MeshStandardMaterial({
            color: "#bff7e0",
            emissive: MINT,
            emissiveIntensity: 0.9,
            roughness: 0.3,
          }),
        );
        path.aura = new THREE.Mesh(
          new THREE.TubeGeometry(path.curve, 160, 0.1, 8, false),
          new THREE.MeshBasicMaterial({
            color: MINT,
            transparent: true,
            opacity: 0.12,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );
        this.world.add(path.core, path.aura);
      }
    }
    path.reveal = reduced ? 1 : reveal;
    if (path.core) revealTube(path.core.geometry, path.reveal, 160, 8);
    if (path.aura) revealTube(path.aura.geometry, path.reveal, 160, 8);
  }

  /** Maps a fractional station index onto the path through scored stations. */
  private pointAtStation(s: number, out: THREE.Vector3) {
    const path = this.path;
    if (!path) return false;
    const stations = path.stations;
    if (!stations.length) return false;
    if (stations.length === 1 || !path.curve) {
      out.copy(this.items[stations[0]].pos);
      return true;
    }
    if (s <= stations[0]) return !!path.curve.getPoint(0, out);
    if (s >= stations[stations.length - 1]) return !!path.curve.getPoint(1, out);
    let k = 0;
    while (k < stations.length - 2 && stations[k + 1] < s) k++;
    const fraction = (s - stations[k]) / (stations[k + 1] - stations[k]);
    path.curve.getPoint((k + clamp01(fraction)) / (stations.length - 1), out);
    return true;
  }

  private updateComet(local: number, step: number, reduced: boolean) {
    const comet = this.comet;
    const path = this.path;
    if (!comet || !path) return;
    const stations = path.stations;
    const drawing = path.reveal < 1 && !reduced;
    if (drawing && path.curve && stations.length > 1) {
      const t = path.reveal * (stations.length - 1);
      const k = Math.min(stations.length - 2, Math.floor(t));
      comet.s = stations[k] + (t - k) * (stations[k + 1] - stations[k]);
      comet.velocity = 0;
    } else if (reduced) {
      comet.s = this.active;
      comet.velocity = 0;
    } else {
      const stiffness = 26;
      const dampingRatio = 8.2;
      comet.velocity += ((this.active - comet.s) * stiffness - comet.velocity * dampingRatio) * step;
      comet.s += comet.velocity * step;
      const settled = Math.abs(this.active - comet.s) < 0.03 && Math.abs(comet.velocity) < 0.15;
      if (settled && comet.arrivedAt !== this.active && path.reveal >= 1) {
        comet.arrivedAt = this.active;
        const item = this.items[this.active];
        if (item) {
          item.flash = Math.max(item.flash, 1);
          this.spawnRipple(this.scratch2.set(item.x!, 0.02, item.z!), 0.2, 1.6, 1.1, false, 0.8, item.color);
        }
      }
    }
    const visibleTarget = stations.length && local > 0.3 + this.items.length * 0.13 ? 1 : 0;
    comet.visible = damp(comet.visible, visibleTarget, reduced ? 1e3 : 5, step);
    const head = this.scratch;
    if (!this.pointAtStation(comet.s, head)) {
      comet.visible = 0;
    }
    comet.head.position.copy(head);
    comet.core.position.copy(head);
    const glimmer = reduced ? 1 : 1 + Math.sin(this.now * 8) * 0.06;
    comet.head.scale.setScalar(1.05 * glimmer * Math.max(0.0001, comet.visible));
    (comet.head.material as THREE.SpriteMaterial).opacity = 0.9 * comet.visible;
    (comet.core.material as THREE.SpriteMaterial).opacity = comet.visible;

    const positions = comet.trail.geometry.attributes.position as THREE.BufferAttribute;
    const colors = comet.trail.geometry.attributes.color as THREE.BufferAttribute;
    const count = positions.count;
    const speed = drawing ? 2.5 : Math.abs(comet.velocity);
    const length = reduced ? 0 : Math.min(1.4, 0.04 + speed * 0.3);
    const direction = drawing ? -1 : comet.velocity >= 0 ? -1 : 1;
    const point = this.scratch2;
    for (let i = 0; i < count; i++) {
      const f = i / (count - 1);
      this.pointAtStation(comet.s + direction * length * f, point);
      positions.setXYZ(i, point.x, point.y, point.z);
      const fade = Math.pow(1 - f, 1.6) * comet.visible * (length > 0.06 ? 0.9 : 0.25);
      colors.setXYZ(i, (0.62 + 0.38 * (1 - f)) * fade, 0.94 * fade, (0.81 + 0.19 * (1 - f)) * fade);
    }
    positions.needsUpdate = true;
    colors.needsUpdate = true;
  }

  private updateHalo(step: number, reduced: boolean) {
    const item = this.items[this.active];
    const show = item && item.appear > 0.6 && (this.mode === "tree" || (item.solid ?? 0) > 0.5) ? 1 : 0;
    this.haloVisible = damp(this.haloVisible, show, reduced ? 1e3 : 6, step);
    this.halo.visible = this.haloVisible > 0.01;
    if (!item) return;
    const target = item.pos;
    if (this.haloPosition.lengthSq() === 0 || reduced) this.haloPosition.copy(target);
    else {
      this.haloPosition.set(
        damp(this.haloPosition.x, target.x, 7, step),
        damp(this.haloPosition.y, target.y, 7, step),
        damp(this.haloPosition.z, target.z, 7, step),
      );
    }
    this.halo.position.copy(this.haloPosition);
    this.halo.quaternion.copy(this.camera.quaternion);
    const scale = (this.mode === "journey" ? 0.85 : 1) * (reduced ? 1 : 1 + Math.sin(this.now * 2.6) * 0.05);
    this.halo.scale.setScalar(scale);
    const arcs = this.halo.getObjectByName("arcs");
    if (arcs && !reduced) arcs.rotation.z -= step * 0.9;
    this.haloMaterials.forEach((material, index) => {
      material.color.copy(item.color);
      material.opacity = this.haloVisible * (index === 0 ? 0.9 : 0.55);
    });
  }

  private updateRipples(reduced: boolean) {
    this.ripples.forEach((ripple) => {
      if (ripple.start < 0) return;
      const t = (this.now - ripple.start) / ripple.duration;
      if (t >= 1 || reduced) {
        ripple.start = -1;
        ripple.mesh.visible = false;
        return;
      }
      const e = easeOutCubic(t);
      ripple.mesh.scale.setScalar(ripple.from + (ripple.to - ripple.from) * e);
      ripple.mesh.material.opacity = (1 - t) * (1 - t) * ripple.strength;
      if (ripple.facing) ripple.mesh.quaternion.copy(this.camera.quaternion);
    });
  }

  private updateOutgoing(reduced: boolean) {
    this.outgoing = this.outgoing.filter((entry) => {
      const t = reduced ? 1 : clamp01((this.now - entry.start) / 0.45);
      const s = 1 - easeInCubic(t);
      entry.group.scale.setScalar(Math.max(0.0001, s));
      entry.group.position.y = -0.6 * easeInCubic(t);
      entry.group.rotation.y = t * 0.5;
      if (t < 1) return true;
      this.scene.remove(entry.group);
      disposeObject(entry.group, this.shared);
      entry.chips.forEach((chip) => chip.remove());
      return false;
    });
  }

  private project(position: THREE.Vector3, element: HTMLElement, offsetY: number, opacity: number) {
    const v = this.scratch2.copy(position).project(this.camera);
    const hidden = v.z > 1 || opacity <= 0.01;
    const x = ((v.x + 1) / 2) * this.width;
    const y = ((1 - v.y) / 2) * this.height + offsetY;
    element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%)`;
    element.style.opacity = hidden ? "0" : opacity.toFixed(3);
    element.style.visibility = hidden ? "hidden" : "visible";
  }

  private updateLabels() {
    const anchor = new THREE.Vector3();
    this.items.forEach((item) => {
      const isActive = item.index === this.active;
      item.chip.classList.toggle("is-active", isActive);
      item.chip.classList.toggle("is-hover", item.index === this.hovered && !isActive);
      item.chip.style.zIndex = isActive ? "3" : item.index === this.hovered ? "2" : "1";
      const lift = this.mode === "tree" ? 0.34 * item.scale : 0.3 * item.scale;
      anchor.copy(item.pos).setY(item.pos.y + lift);
      const visible = this.mode === "tree" ? clamp01((item.appear - 0.3) * 2) : clamp01((item.appear - 0.2) * 2);
      this.project(anchor, item.chip, -4, visible);
      if (item.tag) {
        anchor.set(item.x!, 0, item.z! + 0.62);
        this.project(anchor, item.tag, 14, visible * 0.95);
        item.tag.classList.toggle("is-active", isActive);
      }
    });
    if (this.referenceChip && this.threshold) {
      this.project(
        this.referenceAnchor,
        this.referenceChip,
        0,
        this.threshold.material.uniforms.uOpacity.value as number,
      );
    }
  }
}
