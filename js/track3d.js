// Visor 3D del circuito con Three.js.
// Recibe el "paquete" de la vuelta más rápida (ver api.js) y dibuja:
// la pista con su altura real (exagerada), pintada por velocidad,
// su sombra en el piso y un carro que recorre la vuelta al ritmo real.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const EXAG = 3;       // cuánto se exagera la altura para que se note
const SIZE = 100;     // tamaño del circuito en unidades de la escena
const WIDTH = 1.5;    // ancho de la pista
const SAMPLES = 900;  // resolución de la pista

const C_SLOW = new THREE.Color('#5a0a0a');
const C_MID = new THREE.Color('#dc0000');
const C_FAST1 = new THREE.Color('#ff8a00');
const C_FAST2 = new THREE.Color('#ffe15a');

function speedColour(f) {
  const c = new THREE.Color();
  if (f < 0.4) return c.lerpColors(C_SLOW, C_MID, f / 0.4);
  if (f < 0.75) return c.lerpColors(C_MID, C_FAST1, (f - 0.4) / 0.35);
  return c.lerpColors(C_FAST1, C_FAST2, (f - 0.75) / 0.25);
}

export class Track3D {
  constructor(el, { onHud, onPlayState } = {}) {
    this.el = el;
    this.onHud = onHud || (() => {});
    this.onPlayState = onPlayState || (() => {});
    this.speed = 1;
    this.playing = true;
    this.visible = true;
    this.anim = null;
    this.t = 0;
    this.hold = 0;
    this.lastHud = 0;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.setClearColor(0x000000, 0);
    el.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x0d0f14, 160, 320);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x222233, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(40, 80, 30);
    this.scene.add(sun);

    const grid = new THREE.GridHelper(180, 18, 0x262b38, 0x1a1e29);
    grid.position.y = -0.06;
    this.scene.add(grid);

    this.root = new THREE.Group();
    this.scene.add(this.root);

    const c = (this.controls = new OrbitControls(this.camera, r.domElement));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.enablePan = false;
    c.minDistance = 25;
    c.maxDistance = 260;
    c.maxPolarAngle = Math.PI * 0.47;

    this.resize();
    new ResizeObserver(() => this.resize()).observe(el);
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { threshold: 0.01 }).observe(el);
    document.addEventListener('visibilitychange', () => { this.clock.getDelta(); });

    this.clock = new THREE.Clock();
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const w = this.el.clientWidth || 300;
    const h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  clear() {
    this.anim = null;
    this.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
    this.root.clear();
    this.onHud(null, 0);
  }

  load(pkg) {
    this.clear();
    const lapMs = pkg.lapTime * 1000;
    const raw = pkg.points.filter((p) => p[0] >= 0 && p[0] <= lapMs);
    if (raw.length < 20) return;

    // Centrar y escalar
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity;
    for (const [, x, y, z] of raw) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const s = SIZE / Math.max(maxX - minX, maxY - minY, 1);
    const toV = (x, y, z) => new THREE.Vector3((x - cx) * s, (z - minZ) * s * EXAG + 0.4, -(y - cy) * s);

    const pts = [];
    for (const [t, x, y, z, v] of raw) {
      const p = toV(x, y, z);
      const last = pts[pts.length - 1];
      if (last && last.p.distanceTo(p) < 0.05) continue;
      pts.push({ t, p, v });
    }
    if (pts.length < 20) return;

    const curve = new THREE.CatmullRomCurve3(pts.map((q) => q.p), true, 'centripetal');
    const samples = curve.getSpacedPoints(SAMPLES);

    // Velocidad para cada punto de la pista (del punto medido más cercano)
    const speeds = samples.map((sp) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const d = pts[i].p.distanceToSquared(sp);
        if (d < bd) { bd = d; best = i; }
      }
      return pts[best].v || 0;
    });
    const smooth = speeds.map((_, i) => {
      let sum = 0;
      for (let k = -3; k <= 3; k++) sum += speeds[(i + k + speeds.length) % speeds.length];
      return sum / 7;
    });
    const vMin = Math.min(...smooth);
    const vMax = Math.max(...smooth);

    // Cinta de la pista
    const up = new THREE.Vector3(0, 1, 0);
    const pos = [], col = [], shadow = [], idx = [], left = [], right = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const p = samples[i];
      const tan = curve.getTangentAt(Math.min(i / SAMPLES, 1));
      const side = new THREE.Vector3().crossVectors(tan, up).normalize().multiplyScalar(WIDTH / 2);
      const a = p.clone().add(side);
      const b = p.clone().sub(side);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
      shadow.push(a.x, 0, a.z, b.x, 0, b.z);
      left.push(a.x, a.y + 0.02, a.z);
      right.push(b.x, b.y + 0.02, b.z);
      const f = vMax > vMin ? (smooth[i % smooth.length] - vMin) / (vMax - vMin) : 0.5;
      const c = speedColour(f);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < SAMPLES) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    this.root.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));

    const sgeo = new THREE.BufferGeometry();
    sgeo.setAttribute('position', new THREE.Float32BufferAttribute(shadow, 3));
    sgeo.setIndex(idx);
    this.root.add(new THREE.Mesh(sgeo, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })));

    const edgeMat = new THREE.LineBasicMaterial({ color: 0xe8e8e8, transparent: true, opacity: 0.35 });
    for (const arr of [left, right]) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.root.add(new THREE.Line(g, edgeMat));
    }

    // Línea de meta
    const startTan = curve.getTangentAt(0);
    const finish = new THREE.Mesh(
      new THREE.BoxGeometry(WIDTH * 1.25, 0.08, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    finish.position.copy(samples[0]).add(new THREE.Vector3(0, 0.05, 0));
    finish.lookAt(samples[0].clone().add(startTan));
    this.root.add(finish);

    // Carro
    const car = new THREE.Group();
    const teamMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(pkg.driver.colour || '#dc0000') });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 2.0), teamMat);
    body.position.y = 0.2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.3), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    wing.position.set(0, 0.5, -0.9);
    const front = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.25), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    front.position.set(0, 0.1, 1.05);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
    car.add(body, wing, front, glow);
    car.scale.setScalar(2.1);
    this.root.add(car);
    this.car = car;

    // Cámara
    const box = new THREE.Box3().setFromPoints(samples);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const span = Math.max(size.x, size.z);
    const dist = span * (this.camera.aspect < 1 ? 1.45 : 1.05);
    this.camera.position.set(center.x, center.y + dist * 0.55, center.z + dist * 0.85);
    this.controls.target.copy(center);
    this.controls.update();

    this.anim = { pts, lapMs, i: 0 };
    this.t = 0;
    this.hold = 0;
    this.playing = true;
    this.onPlayState(true);
    this.placeCar(0);
  }

  placeCar(t) {
    const a = this.anim;
    if (!a) return null;
    const { pts } = a;
    if (t < pts[a.i].t) a.i = 0;
    while (a.i < pts.length - 2 && pts[a.i + 1].t <= t) a.i++;
    const p0 = pts[a.i];
    const p1 = pts[Math.min(a.i + 1, pts.length - 1)];
    const span = Math.max(p1.t - p0.t, 1);
    const f = Math.min(Math.max((t - p0.t) / span, 0), 1);
    const p = p0.p.clone().lerp(p1.p, f);
    this.car.position.copy(p);
    const ahead = pts[Math.min(a.i + 3, pts.length - 1)].p;
    if (ahead.distanceToSquared(p) > 0.0001) this.car.lookAt(ahead.x, p.y, ahead.z);
    return p0.v + (p1.v - p0.v) * f;
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.visible) return;

    if (this.anim && this.playing) {
      if (this.hold > 0) {
        this.hold -= dt;
        if (this.hold <= 0) { this.t = 0; this.anim.i = 0; }
      } else {
        this.t += dt * 1000 * this.speed;
        if (this.t >= this.anim.lapMs) { this.t = this.anim.lapMs; this.hold = 1.2; }
      }
      const v = this.placeCar(this.t);
      const now = performance.now();
      if (now - this.lastHud > 90) {
        this.onHud(v, this.t / 1000);
        this.lastHud = now;
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  toggle() {
    this.playing = !this.playing;
    this.onPlayState(this.playing);
  }

  restart() {
    if (!this.anim) return;
    this.t = 0;
    this.hold = 0;
    this.anim.i = 0;
    this.playing = true;
    this.onPlayState(true);
  }

  setSpeed(s) { this.speed = s; }
}
