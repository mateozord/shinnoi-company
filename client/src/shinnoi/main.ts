// Shinnoi Company: escritório em three.js no estilo lo-fi dos vídeos (toon, contorno por profundidade, pontilhado
// Bayer, render em baixa resolução ampliado sem suavizar). Os dados vêm do mesmo stream do Habblaud (OfficeStore).
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OfficeStore } from '../net/store';
import type { AgentInfo, OfficeSnapshot } from '../../../shared/types';
import { STATIONS, isActive, stationOf, type StationId } from './stations';
import { setupPanels } from './panels';

THREE.ColorManagement.enabled = false;
const PIXEL = 3; // 1 pixel da cena = 3 pixels da tela
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- renderer + pós-processamento (mesmo shader dos vídeos) ----------
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.setPixelRatio(1);
const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
target.depthTexture = new THREE.DepthTexture(1, 1);

const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 80);
const post = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: target.texture }, tDepth: { value: target.depthTexture }, res: { value: new THREE.Vector2() }, cNear: { value: camera.near }, cFar: { value: camera.far } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 res; uniform float cNear; uniform float cFar; varying vec2 vUv;
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * cNear * cFar) / (cFar + cNear - z * (cFar - cNear)); }
float b2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 a){ return b2(0.5 * a) * 0.25 + b2(a); }
void main(){
  vec2 px = 1.0 / res; vec3 c = texture2D(tColor, vUv).rgb; float d = lin(texture2D(tDepth, vUv).x);
  float e = 0.0;
  vec2 o[4]; o[0] = vec2(px.x, 0.0); o[1] = vec2(-px.x, 0.0); o[2] = vec2(0.0, px.y); o[3] = vec2(0.0, -px.y);
  for (int i = 0; i < 4; i++) { float dn = lin(texture2D(tDepth, vUv + o[i]).x); if (dn - d > 0.05 * d + 0.02) e = 1.0; }
  c = mix(c, vec3(0.06, 0.035, 0.09), e * 0.9);
  vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.9;
  c = floor(c * 18.0 + bayer(gl_FragCoord.xy)) / 18.0;
  gl_FragColor = vec4(c, 1.0);
}`,
});
const postScene = new THREE.Scene();
postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

// ---------- cena ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1024);
scene.fog = new THREE.Fog(0x1a1024, 22, 42);
const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]), 3, 1);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
ramp.needsUpdate = true;
const toon = (color: number, emissive = 0x000000) => new THREE.MeshToonMaterial({ color, emissive, gradientMap: ramp });

scene.add(new THREE.HemisphereLight(0xffd9b0, 0x2a1838, 1.1));
const sun = new THREE.DirectionalLight(0xffc89a, 1.6);
sun.position.set(-6, 12, 8);
scene.add(sun);

// piso em xadrez de tábuas
{
  const cv = document.createElement('canvas');
  cv.width = cv.height = 16;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#2b1b36'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#33213f'; g.fillRect(0, 0, 8, 8); g.fillRect(8, 8, 8, 8);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
}

const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
};

// ---------- hub: mesa do coordenador com toca-discos ----------
const hub = new THREE.Group();
scene.add(hub);
hub.add(new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.3, 8), toon(0x3d2a4d)));
hub.children[0].position.y = 0.15;
hub.add(box(1.8, 0.7, 1.1, toon(0x7a4b3a), 0, 0.65, 0));
const vinyl = new THREE.Group();
vinyl.position.set(-0.35, 1.03, 0);
vinyl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 20), toon(0x1c1420)));
vinyl.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), toon(0xf0a35e, 0x5a2a10)));
hub.add(vinyl);
const lampMat = toon(0xffd27a, 0x000000);
hub.add(box(0.06, 0.6, 0.06, toon(0x2a2030), 0.55, 1.3, -0.25));
const lampHead = box(0.3, 0.18, 0.3, lampMat, 0.55, 1.62, -0.25);
hub.add(lampHead);
const hubLight = new THREE.PointLight(0xffb070, 0, 7);
hubLight.position.set(0.55, 1.5, -0.25);
hub.add(hubLight);

// ---------- estações ----------
interface Station {
  id: StationId;
  color: THREE.Color;
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  screen: THREE.MeshToonMaterial;
  light: THREE.PointLight;
  dots: THREE.Mesh[];
  label: HTMLDivElement;
  activity: number; // 0..1 suavizado
  on: boolean;
}
const labelsEl = document.getElementById('labels')!;
const makeLabel = (text: string, color: string): HTMLDivElement => {
  const el = document.createElement('div');
  el.className = 'lbl off';
  el.style.setProperty('--c', color);
  el.textContent = text;
  labelsEl.append(el);
  return el;
};
const hubLabel = makeLabel('SHINNOI', '#f0a35e');

const RADIUS = 5.2;
const stations: Station[] = STATIONS.map((def, i) => {
  // em volta do hub: atrás-esq., atrás-dir., frente-esq., frente-dir.
  const a = [150, 30, 215, 325][i % 4] * (Math.PI / 180);
  const root = new THREE.Group();
  root.position.set(Math.cos(a) * RADIUS, 0, -Math.sin(a) * RADIUS * 0.8);
  root.lookAt(0, 0, 0);
  scene.add(root);
  const color = new THREE.Color(def.color);
  const hex = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.25, 6), toon(0x35243f));
  hex.position.y = 0.125;
  root.add(hex);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.36, 1.36, 0.06, 6), toon(def.color, 0x000000));
  rim.position.y = 0.04;
  root.add(rim);
  root.add(box(1.3, 0.55, 0.65, toon(0x6b4434), 0, 0.52, 0.3)); // mesa
  const screen = toon(0x22303a, 0x000000);
  root.add(box(0.75, 0.48, 0.06, toon(0x1d1622), 0, 1.08, 0.5));
  root.add(box(0.66, 0.38, 0.02, screen, 0, 1.08, 0.465));
  const body = box(0.42, 0.5, 0.3, toon(def.color), 0, 0.6, -0.35);
  const head = box(0.34, 0.32, 0.32, toon(0xe8b48c), 0, 1.05, -0.35);
  root.add(body, head, box(0.5, 0.3, 0.45, toon(0x2a2030), 0, 0.4, -0.45)); // cadeira
  const light = new THREE.PointLight(def.color, 0, 4);
  light.position.set(0, 1.4, 0.2);
  root.add(light);
  // fio de luz até o hub: pontinhos que pulsam quando a estação trabalha
  const dots: THREE.Mesh[] = [];
  const from = new THREE.Vector3(0, 0.08, 0);
  const to = root.position.clone().setY(0.08);
  for (let k = 1; k < 12; k++) {
    const d = box(0.14, 0.05, 0.14, new THREE.MeshBasicMaterial({ color: def.color }));
    d.position.lerpVectors(from, to, k / 12);
    scene.add(d);
    dots.push(d);
  }
  return { id: def.id, color, root, body, head, screen, light, dots, label: makeLabel(def.label, `#${color.getHexString()}`), activity: 0, on: false };
});

// ---------- sessões principais: fileira de portas no fundo ----------
interface Door { mesh: THREE.Mesh; mat: THREE.MeshToonMaterial; label: HTMLDivElement; on: boolean }
const doors = new Map<string, Door>();
const doorMatOff = 0x3a2a48;
function syncDoors(mains: AgentInfo[]): void {
  const keep = new Set(mains.map((m) => m.id));
  for (const [id, d] of doors) if (!keep.has(id)) { scene.remove(d.mesh); d.label.remove(); doors.delete(id); }
  mains.forEach((m, i) => {
    let d = doors.get(m.id);
    if (!d) {
      const mat = toon(doorMatOff);
      const mesh = box(0.9, 1.6, 0.15, mat);
      scene.add(mesh);
      const label = makeLabel('', '#b78ae0');
      label.classList.add('click');
      label.title = 'Clique para mandar uma mensagem';
      const id = m.id;
      label.addEventListener('click', () => openMessage(id));
      d = { mesh, mat, label, on: false };
      doors.set(m.id, d);
    }
    const x = (i - (mains.length - 1) / 2) * 3.2;
    d.mesh.position.set(x, 0.8, -6.5);
    d.on = isActive(m);
    d.label.innerHTML = '';
    d.label.append(m.title?.slice(0, 18) || m.name);
    const small = document.createElement('small');
    small.textContent = m.activity?.text ?? m.status;
    d.label.append(small);
  });
}

// ---------- dados ----------
const toast = document.getElementById('toast')!;
const conn = document.getElementById('conn')!;
let hubOn = false;
function apply(snap: OfficeSnapshot): void {
  const mains = snap.agents.filter((a) => a.kind !== 'sub' && a.status !== 'offline');
  const subs = snap.agents.filter((a) => a.kind === 'sub' && a.status !== 'offline' && a.status !== 'done');
  hubOn = mains.some(isActive);
  syncDoors(mains);
  for (const st of stations) {
    const mine = subs.filter((a) => stationOf(a) === st.id);
    st.on = mine.some(isActive);
    const who = mine.find(isActive) ?? mine[0];
    st.label.innerHTML = '';
    st.label.append(STATIONS.find((d) => d.id === st.id)!.label);
    if (who) {
      const small = document.createElement('small');
      small.textContent = who.activity?.text ?? who.status;
      st.label.append(small);
    }
  }
  const last = snap.agents
    .filter((a) => a.activity && a.status !== 'offline')
    .sort((a, b) => (b.activity!.at ?? 0) - (a.activity!.at ?? 0))[0];
  toast.textContent = last ? `${last.activity!.icon} ${last.name}: ${last.activity!.text}` : '';
}
const store = new OfficeStore({ mock: new URLSearchParams(location.search).has('mock') });
store.on('snapshot', apply);
store.on('connection', (c) => { conn.textContent = c === 'open' || c === 'mock' ? 'ao vivo' : c === 'connecting' ? 'conectando…' : 'sem conexão'; });
store.connect();
const { openMessage } = setupPanels(store);

// ---------- layout + loop ----------
function resize(): void {
  const w = Math.max(1, Math.floor(innerWidth / PIXEL));
  const h = Math.max(1, Math.floor(innerHeight / PIXEL));
  renderer.setSize(w, h, false);
  target.setSize(w, h);
  post.uniforms.res.value.set(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();
camera.position.set(0, 12.4, 15.6);
// arrastar gira, rodinha dá zoom, botão direito move; limites para não passar por baixo do piso
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.4, -0.6);
controls.enableDamping = true;
controls.minDistance = 7;
controls.maxDistance = 32;
controls.maxPolarAngle = Math.PI * 0.45;
controls.update();

const v = new THREE.Vector3();
const place = (el: HTMLElement, obj: THREE.Object3D, y: number) => {
  obj.getWorldPosition(v);
  v.y += y;
  v.project(camera);
  el.style.left = `${((v.x + 1) / 2) * innerWidth}px`;
  el.style.top = `${((1 - v.y) / 2) * innerHeight}px`;
};

const clock = new THREE.Clock();
let t = 0;
function frame(): void {
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!reduceMotion) t += dt;
  vinyl.rotation.y -= (hubOn ? 2.2 : 0.3) * dt;
  lampMat.emissive.setHex(hubOn ? 0x7a4a14 : 0x1a1008);
  hubLight.intensity = hubOn ? 6 : 1;
  hubLabel.classList.toggle('off', !hubOn);
  place(hubLabel, hub, 2.1);
  for (const st of stations) {
    st.activity += ((st.on ? 1 : 0) - st.activity) * Math.min(1, dt * 4);
    const a = st.activity;
    st.screen.emissive.copy(st.color).multiplyScalar(0.15 + a * 0.6 + (st.on ? Math.sin(t * 9) * 0.06 : 0));
    st.light.intensity = a * 5;
    st.head.position.y = 1.05 + (st.on ? Math.abs(Math.sin(t * 10)) * 0.04 : 0);
    st.body.rotation.y = st.on ? Math.sin(t * 3) * 0.06 : 0;
    st.dots.forEach((d, k) => {
      const wave = (Math.sin(k * 0.9 - t * 7) + 1) / 2;
      (d.material as THREE.MeshBasicMaterial).color.copy(st.color).multiplyScalar(0.18 + a * wave * 0.95);
    });
    st.label.classList.toggle('off', !st.on);
    place(st.label, st.root, 1.9);
  }
  for (const d of doors.values()) {
    d.mat.color.setHex(d.on ? 0xb78ae0 : doorMatOff);
    d.mat.emissive.setHex(d.on ? 0x2a1240 : 0x000000);
    d.label.classList.toggle('off', !d.on);
    place(d.label, d.mesh, 1.15);
  }
  controls.update();
  // a névoa acompanha a distância da câmera (zoom)
  const dist = camera.position.distanceTo(controls.target);
  (scene.fog as THREE.Fog).near = dist * 1.15;
  (scene.fog as THREE.Fog).far = dist * 2.2;
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(postScene, postCam);
  requestAnimationFrame(frame);
}
frame();
