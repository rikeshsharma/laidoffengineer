// The Graveyard: a streamed Three.js world that the mascot roams.
import * as THREE from './assets/vendor/three.module.min.js';

// Memorial N always occupies the same plot, derived from its index alone. Chunks of 36 plots are
// laid along a square spiral from the gate, so any client or server can locate a memorial without
// a spatial index, and the world only ever loads the few chunks around the mascot.
export const CHUNK_SIZE = 48;
export const GRID = 6;
export const PER_CHUNK = GRID * GRID;
const SLOT = 6.4;
const MARGIN = (CHUNK_SIZE - SLOT * (GRID - 1)) / 2;
const VIEW_RADIUS = 2;
const CHUNK_CACHE_LIMIT = 400;
const LABEL_COUNT = 16;
const LABEL_RANGE = 18;
const READ_RANGE = 3.4;
const PLAYER_RADIUS = .6;
const SPAWN = { x: CHUNK_SIZE / 2, z: CHUNK_SIZE + 1 };
const STONE_DEPTH = .32;
const STONE_BEVEL = .05;
const STONE_VARIANTS = [{ kind: 'arch', width: 1.6, height: 2 }, { kind: 'square', width: 1.5, height: 1.85, radius: .18 }];
const STONE_COLORS = ['#c9cfc0', '#d8d6cc', '#bfc6d6', '#d9cdb8', '#c4ccb2', '#cfc6dc'];
const LEAF_COLORS = ['#5fbf4a', '#4fae46', '#7ccb4f', '#3f9e48', '#8fd35a'];
const FLOWER_COLORS = ['#ff6b8b', '#ffd23f', '#a78bfa', '#ff9f43', '#ffffff', '#5ec8f2'];
const SKY_TOP = '#3f9df5';
const SKY_HORIZON = '#cfeeff';

export function spiralIndex(x, z) {
  const ring = Math.max(Math.abs(x), Math.abs(z));
  if (!ring) return 0;
  const base = (2 * ring - 1) ** 2;
  if (x === ring && z > -ring) return base + z + ring - 1;
  if (z === ring) return base + 2 * ring + ring - 1 - x;
  if (x === -ring) return base + 4 * ring + ring - 1 - z;
  return base + 6 * ring + x + ring - 1;
}

export function spiralCoords(index) {
  if (!index) return [0, 0];
  const ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);
  const offset = index - (2 * ring - 1) ** 2;
  const side = Math.floor(offset / (2 * ring)), step = offset % (2 * ring);
  if (side === 0) return [ring, -ring + 1 + step];
  if (side === 1) return [ring - 1 - step, ring];
  if (side === 2) return [-ring, ring - 1 - step];
  return [-ring + 1 + step, -ring];
}

export function plotPosition(index) {
  const chunk = Math.floor(index / PER_CHUNK), slot = index % PER_CHUNK;
  const [cx, cz] = spiralCoords(chunk);
  // Row 0 sits beside the chunk's +z path, so the first memorials face the gate.
  return {
    chunk, cx, cz,
    x: cx * CHUNK_SIZE + MARGIN + (slot % GRID) * SLOT,
    z: cz * CHUNK_SIZE + CHUNK_SIZE - MARGIN - Math.floor(slot / GRID) * SLOT
  };
}

function random(...values) {
  let hash = 2166136261;
  for (const value of values) {
    hash ^= Math.floor(value) | 0;
    hash = Math.imul(hash, 16777619);
    hash ^= hash >>> 13;
  }
  hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
  return ((hash ^ (hash >>> 13)) >>> 0) / 4294967296;
}

function archShape(width, height, bottom = 0) {
  const radius = width / 2, shape = new THREE.Shape();
  shape.moveTo(-radius, bottom);
  shape.lineTo(radius, bottom);
  shape.lineTo(radius, bottom + height - radius);
  shape.absarc(0, bottom + height - radius, radius, 0, Math.PI, false);
  shape.lineTo(-radius, bottom);
  return shape;
}

function roundedRectShape(width, height, radius, bottom = 0) {
  const x = -width / 2, shape = new THREE.Shape();
  shape.moveTo(x + radius, bottom);
  shape.lineTo(x + width - radius, bottom);
  shape.quadraticCurveTo(x + width, bottom, x + width, bottom + radius);
  shape.lineTo(x + width, bottom + height - radius);
  shape.quadraticCurveTo(x + width, bottom + height, x + width - radius, bottom + height);
  shape.lineTo(x + radius, bottom + height);
  shape.quadraticCurveTo(x, bottom + height, x, bottom + height - radius);
  shape.lineTo(x, bottom + radius);
  shape.quadraticCurveTo(x, bottom, x + radius, bottom);
  return shape;
}

function stoneShape(variant, inset = 0) {
  return variant.kind === 'arch'
    ? archShape(variant.width - inset * 2, variant.height - inset * 2, inset)
    : roundedRectShape(variant.width - inset * 2, variant.height - inset * 2, Math.max(.02, variant.radius - inset), inset);
}

// A box whose silhouette is exactly width × height × depth, with rounded edges.
function roundedBox(width, height, depth, radius) {
  const geometry = new THREE.ExtrudeGeometry(roundedRectShape(width, height, radius, -height / 2), {
    depth: depth - radius * 2, bevelEnabled: true, bevelThickness: radius, bevelSize: radius, bevelOffset: -radius, bevelSegments: 3, curveSegments: 6
  });
  return geometry.translate(0, 0, -(depth - radius * 2) / 2);
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

// Canvas space maps onto a stone face: the full canvas covers the stone's width and height.
function paintStoneFace(canvas, { background, ink, grave }) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  if (grave) {
    const shine = ctx.createLinearGradient(0, 0, width, height);
    shine.addColorStop(0, '#ffffff38');
    shine.addColorStop(.6, '#ffffff00');
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.font = '400 40px Figtree, sans-serif';
  ctx.fillText('✝', width / 2, height * .2);
  ctx.font = '650 74px Newsreader, Georgia, serif';
  ctx.fillText('RIP', width / 2, height * .37);
  if (!grave) return;
  ctx.font = '700 29px Figtree, sans-serif';
  let y = height * .49;
  for (const line of wrapLines(ctx, grave.name, width * .74, 2)) { ctx.fillText(line, width / 2, y); y += 33; }
  ctx.font = 'italic 500 26px Newsreader, Georgia, serif';
  y += 8;
  for (const line of wrapLines(ctx, grave.epitaph, width * .72, 3)) { ctx.fillText(line, width / 2, y); y += 29; }
}

function faceTransform(texture, variant) {
  // Extruded cap UVs are shape coordinates; map the stone's footprint onto the whole texture.
  texture.repeat.set(1 / variant.width, 1 / variant.height);
  texture.offset.set(.5, 0);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

async function loadFaceTexture(url) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c6c9f1';
  ctx.beginPath(); ctx.roundRect(0, 0, 256, 256, 64); ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    ctx.clearRect(0, 0, 256, 256);
    ctx.drawImage(image, 0, 0, 256, 256);
    texture.needsUpdate = true;
  } catch { /* The plain screen remains. */ }
  return texture;
}

function groundTexture() {
  const size = 512, canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7cc35a';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = ['#6fb64f', '#8bcf63', '#74bd53', '#95d66b'][i % 4];
    ctx.fillRect(random(i, 1) * size, random(i, 2) * size, 2 + random(i, 3) * 4, 2 + random(i, 4) * 6);
  }
  // Paths run along every chunk border, 6 world units either side.
  const band = size * 6 / CHUNK_SIZE;
  ctx.fillStyle = '#ead9a7';
  for (const [x, y, w, h] of [[0, 0, size, band], [0, size - band, size, band], [0, 0, band, size], [size - band, 0, band, size]]) ctx.fillRect(x, y, w, h);
  for (let i = 0; i < 700; i++) {
    const edge = i % 4, along = random(i, 5) * size, across = random(i, 6) * band;
    const [x, y] = [[along, across], [along, size - across], [across, along], [size - across, along]][edge];
    ctx.fillStyle = random(i, 7) > .5 ? '#dcc890' : '#f3e6bd';
    ctx.beginPath(); ctx.arc(x, y, 1.5 + random(i, 8) * 2.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#6aad4c';
  ctx.lineWidth = 3;
  ctx.strokeRect(band, band, size - band * 2, size - band * 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function signTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 224;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#a8714a'; ctx.fillRect(0, 0, 512, 224);
  ctx.fillStyle = '#b98257';
  for (let y = 0; y < 224; y += 56) ctx.fillRect(0, y + 4, 512, 48);
  ctx.fillStyle = '#fff6e0'; ctx.textAlign = 'center';
  ctx.font = '650 64px Newsreader, Georgia, serif'; ctx.fillText('Rest in pivot.', 256, 104);
  ctx.font = '600 26px Figtree, sans-serif'; ctx.fillText('LAIDOFFENGINEER.LOL · THE GRAVEYARD', 256, 162);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMascot(faceTexture, shadows) {
  const group = new THREE.Group();
  const rig = new THREE.Group();
  group.add(rig);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .05 });
  const orange = material('#d97757'), orangeDark = material('#b65d41'), cream = material('#f4f0e6'), steel = material('#8f96a3'), dark = material('#363a44');
  const add = (parent, geometry, mat, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = shadows;
    parent.add(mesh);
    return mesh;
  };
  const wheels = [];
  const wheelGeometry = new THREE.CylinderGeometry(.17, .17, .07, 8).rotateZ(Math.PI / 2);
  for (const side of [-1, 1]) {
    add(rig, roundedBox(.36, .46, 1.12, .14), dark, side * .6, .25);
    for (const z of [-.36, 0, .36]) wheels.push(add(rig, wheelGeometry, steel, side * .79, .25, z));
  }
  add(rig, roundedBox(.98, .84, .84, .14), orange, 0, .92);
  add(rig, roundedBox(.52, .32, .04, .015), material('#c6c9f1'), 0, .98, .43);
  const meter = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
  const bars = [0, 1, 2].map(index => add(rig, new THREE.BoxGeometry(.1, .15, .02), meter, -.13 + index * .13, .98, .455));
  const arms = [-1, 1].map(side => {
    const pivot = new THREE.Group();
    pivot.position.set(side * .57, 1.16, 0);
    rig.add(pivot);
    add(pivot, new THREE.BoxGeometry(.13, .46, .18).translate(0, -.21, 0), orangeDark);
    add(pivot, new THREE.BoxGeometry(.2, .12, .26), steel, 0, -.48, .04);
    return pivot;
  });
  add(rig, new THREE.CylinderGeometry(.08, .1, .3, 10), steel, 0, 1.47);
  const head = new THREE.Group();
  head.position.set(0, 1.58, 0);
  rig.add(head);
  add(head, roundedBox(.94, .8, .6, .16), cream, 0, .4);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.68, .68), new THREE.MeshBasicMaterial({ map: faceTexture, transparent: true }));
  screen.position.set(0, .4, .312);
  head.add(screen);
  for (const side of [-1, 1]) add(head, new THREE.CylinderGeometry(.1, .1, .1, 12).rotateZ(Math.PI / 2), orange, side * .5, .4);
  const antenna = new THREE.Group();
  antenna.position.set(.22, .8, 0);
  head.add(antenna);
  add(antenna, new THREE.CylinderGeometry(.018, .018, .36, 6).translate(0, .18, 0), steel);
  add(antenna, new THREE.SphereGeometry(.07, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffb347' }), 0, .38);
  return { group, rig, head, arms, wheels, antenna, bars };
}

export async function createGraveyardWorld({ host, stick, jumpButton, source, isActive, onRead, onNearby, reducedMotion }) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const shadows = !coarse;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'graveyard-canvas';
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', 'A 3D graveyard of memorials, explored by a small robot');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(SKY_HORIZON, 38, 92);
  const camera = new THREE.PerspectiveCamera(55, 1, .1, 1200);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(SKY_TOP) }, horizon: { value: new THREE.Color(SKY_HORIZON) } },
    vertexShader: 'varying vec3 vPosition; void main() { vPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 horizon; varying vec3 vPosition; void main() { float h = clamp(normalize(vPosition).y * 1.5, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(h, 0.65)), 1.0); \n#include <colorspace_fragment>\n }'
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.add(new THREE.HemisphereLight('#d8efff', '#7fb455', 1.6));
  const sun = new THREE.DirectionalLight('#fff1d2', 2.4);
  sun.castShadow = shadows;
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 1, far: 160 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);

  await document.fonts?.ready;
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const groundMap = groundTexture();
  groundMap.anisotropy = maxAnisotropy;
  const GROUND_SIZE = CHUNK_SIZE * 8;
  groundMap.repeat.set(GROUND_SIZE / CHUNK_SIZE, GROUND_SIZE / CHUNK_SIZE);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: groundMap }));
  ground.receiveShadow = shadows;
  scene.add(ground);

  // Instanced meshes keep the draw-call count flat no matter how many memorials are loaded.
  const chunkCount = (VIEW_RADIUS * 2 + 1) ** 2;
  const white = new THREE.Color('#ffffff');
  function instanced(geometry, material, capacity, { colors = false, cast = true } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.castShadow = shadows && cast;
    mesh.receiveShadow = shadows;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (colors) for (let i = 0; i < capacity; i++) mesh.setColorAt(i, white);
    scene.add(mesh);
    return mesh;
  }
  const engraving = STONE_VARIANTS.map(variant => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 400;
    paintStoneFace(canvas, { background: '#ffffff', ink: '#a3a39b' });
    return faceTransform(new THREE.CanvasTexture(canvas), variant);
  });
  const stoneSide = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .95 });
  const stoneMeshes = STONE_VARIANTS.map((variant, index) => {
    const geometry = new THREE.ExtrudeGeometry(stoneShape(variant), {
      depth: STONE_DEPTH, bevelEnabled: true, bevelThickness: STONE_BEVEL, bevelSize: STONE_BEVEL, bevelOffset: -STONE_BEVEL, bevelSegments: 2, curveSegments: 14
    }).translate(0, 0, -STONE_DEPTH / 2);
    const face = new THREE.MeshStandardMaterial({ map: engraving[index], roughness: .9 });
    return instanced(geometry, [face, stoneSide], chunkCount * PER_CHUNK, { colors: true });
  });
  const labelGeometries = STONE_VARIANTS.map(variant => new THREE.ShapeGeometry(stoneShape(variant, STONE_BEVEL), 14));
  const plinths = instanced(new THREE.BoxGeometry(1.95, .24, .8).translate(0, .12, 0), new THREE.MeshStandardMaterial({ color: '#b3b8aa', roughness: 1 }), chunkCount * PER_CHUNK);
  const flowers = instanced(new THREE.IcosahedronGeometry(.13, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), chunkCount * (PER_CHUNK * 3 + 40), { colors: true, cast: false });
  const trunks = instanced(new THREE.CylinderGeometry(.26, .36, 2.4, 7).translate(0, 1.2, 0), new THREE.MeshLambertMaterial({ color: '#8a5a3b', flatShading: true }), chunkCount * 12);
  const canopies = instanced(new THREE.IcosahedronGeometry(1.9, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), chunkCount * 24, { colors: true });
  const bushes = instanced(new THREE.IcosahedronGeometry(.85, 0), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true }), chunkCount * 10, { colors: true });
  const rocks = instanced(new THREE.DodecahedronGeometry(.7, 0), new THREE.MeshLambertMaterial({ color: '#a7aab0', flatShading: true }), chunkCount * 5);
  const lampPosts = instanced(new THREE.CylinderGeometry(.08, .11, 3.1, 6).translate(0, 1.55, 0), new THREE.MeshLambertMaterial({ color: '#3b3f4a' }), chunkCount * 2);
  const lampHeads = instanced(new THREE.OctahedronGeometry(.26, 0), new THREE.MeshBasicMaterial({ color: '#ffd27a' }), chunkCount * 2, { cast: false });

  const sign = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: '#7a4f33' });
  for (const x of [-1.6, 1.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(.2, 2.6, .2), wood);
    post.position.set(x, 1.3, 0); post.castShadow = shadows; sign.add(post);
  }
  const board = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.66, .14), [wood, wood, wood, wood, new THREE.MeshLambertMaterial({ map: signTexture() }), wood]);
  board.position.y = 2.05; board.castShadow = shadows; sign.add(board);
  sign.position.set(SPAWN.x - 8.5, 0, SPAWN.z - 2.5);
  sign.rotation.y = .45;
  scene.add(sign);

  const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, fog: false, emissive: '#cfd8e6' }), 16 * 5, { cast: false });
  clouds.receiveShadow = false;
  const cloudPuffs = Array.from({ length: 16 * 5 }, (_, index) => {
    const cloud = Math.floor(index / 5), puff = index % 5;
    return {
      x: random(cloud, 31) * 700, z: random(cloud, 32) * 700, y: 38 + random(cloud, 33) * 26,
      dx: (puff - 2) * 3.4 + random(index, 34) * 2, dy: random(index, 35) * 2, dz: random(index, 36) * 3,
      scale: 3 + random(index, 37) * 2.6 - Math.abs(puff - 2) * .6
    };
  });

  const face = await loadFaceTexture('assets/favicon.svg');
  const mascot = createMascot(face, shadows);
  scene.add(mascot.group);
  const blob = new THREE.Mesh(new THREE.CircleGeometry(.95, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#173a12', transparent: true, opacity: .22, depthWrite: false }));
  scene.add(blob);

  const labels = Array.from({ length: LABEL_COUNT }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 400;
    const texture = new THREE.CanvasTexture(canvas);
    const mesh = new THREE.Mesh(labelGeometries[0], new THREE.MeshStandardMaterial({ map: texture, roughness: .9 }));
    mesh.matrixAutoUpdate = false;
    mesh.visible = false;
    mesh.receiveShadow = shadows;
    scene.add(mesh);
    return { canvas, texture, mesh, stone: null };
  });

  const player = { position: new THREE.Vector3(SPAWN.x, 0, SPAWN.z), velocity: new THREE.Vector3(), facing: Math.PI, vy: 0, grounded: true, squash: 0, walk: 0 };
  const view = { yaw: 0, pitch: .3, distance: 7.5 };
  const lookTarget = new THREE.Vector3();
  const keys = new Set();
  const stickInput = { x: 0, z: 0, active: false };
  let jumpQueued = false;
  let running = false;
  let frame = 0;
  let total = 0;
  let claimedChunks = 0;
  let generation = 0;
  let lastChunkKey = '';
  let chunkTimer = 0;
  let labelTimer = 0;
  let nearby = null;
  let elapsed = 0;
  const clock = new THREE.Clock(false);
  const chunkData = new Map();
  const pending = new Set();
  const visible = new Map();
  const stoneLookup = STONE_VARIANTS.map(() => []);
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), euler = new THREE.Euler(), color = new THREE.Color();
  const frontOffset = new THREE.Matrix4().makeTranslation(0, 0, STONE_DEPTH / 2 + STONE_BEVEL + .004);
  const compose = (x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) => matrix.compose(position.set(x, y, z), quaternion.setFromEuler(euler.set(rx, ry, rz)), scale.set(sx, sy, sz));

  function makeStone(index, grave) {
    const plot = plotPosition(index);
    const variant = random(index, 1) < .64 ? 0 : 1;
    const size = .9 + random(index, 3) * .24;
    const turn = (random(index, 4) - .5) * .22;
    const lean = (random(index, 5) - .5) * (random(index, 6) > .82 ? .24 : .05);
    const colorHex = STONE_COLORS[Math.floor(random(index, 2) * STONE_COLORS.length)];
    return {
      index, grave, variant, size, turn, colorHex, x: plot.x, z: plot.z,
      color: new THREE.Color(colorHex),
      matrix: compose(plot.x, .2, plot.z, lean * .4, turn, lean, size).clone(),
      flowers: random(index, 7) < .45
    };
  }

  function makeScenery(cx, cz, claimed) {
    const items = [];
    const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;
    const isGate = cx === 0 && cz === 0;
    if (!isGate && random(cx, cz, 11) < .55) items.push({ type: 'tree', x: x0, z: z0, size: .9 + random(cx, cz, 12) * .5, tint: random(cx, cz, 13) });
    if (claimed) {
      items.push({ type: 'lamp', x: x0 + CHUNK_SIZE / 2, z: z0 + 5.6 }, { type: 'lamp', x: x0 + 5.6, z: z0 + CHUNK_SIZE / 2 });
      return items;
    }
    // Unclaimed land is meadow, waiting for future plots.
    const inner = n => MARGIN + 1 + n * (CHUNK_SIZE - MARGIN * 2 - 2);
    const trees = 4 + Math.floor(random(cx, cz, 14) * 6);
    for (let i = 0; i < trees; i++) items.push({ type: 'tree', x: x0 + inner(random(cx, cz, i, 15)), z: z0 + inner(random(cx, cz, i, 16)), size: .8 + random(cx, cz, i, 17) * .7, tint: random(cx, cz, i, 18) });
    for (let i = 0; i < 7; i++) items.push({ type: 'bush', x: x0 + inner(random(cx, cz, i, 19)), z: z0 + inner(random(cx, cz, i, 20)), size: .7 + random(cx, cz, i, 21) * .7, tint: random(cx, cz, i, 22) });
    for (let i = 0; i < 3; i++) items.push({ type: 'rock', x: x0 + inner(random(cx, cz, i, 23)), z: z0 + inner(random(cx, cz, i, 24)), size: .6 + random(cx, cz, i, 25) * .9, tint: random(cx, cz, i, 26) });
    for (let i = 0; i < 36; i++) items.push({ type: 'flower', x: x0 + inner(random(cx, cz, i, 27)), z: z0 + inner(random(cx, cz, i, 28)), tint: random(cx, cz, i, 29) });
    return items;
  }

  function compileColliders(chunk) {
    chunk.colliders = [
      ...chunk.stones.map(stone => ({ x: stone.x, z: stone.z, r: stone.size })),
      ...chunk.scenery.filter(item => item.type !== 'flower').map(item => ({
        x: item.x, z: item.z, r: { tree: .5 * item.size, bush: .75 * item.size, rock: .65 * item.size, lamp: .2 }[item.type]
      }))
    ];
    if (chunk.cx === 0 && chunk.cz === 0) chunk.colliders.push({ x: sign.position.x - 1.45, z: sign.position.z + .7, r: .35 }, { x: sign.position.x + 1.45, z: sign.position.z - .7, r: .35 }, { x: sign.position.x, z: sign.position.z, r: .5 });
  }

  function requestChunk(index) {
    if (pending.has(index)) return;
    pending.add(index);
    const requestGeneration = generation;
    const start = index * PER_CHUNK;
    Promise.resolve(source.range(start, Math.min(total, start + PER_CHUNK))).then(graves => {
      pending.delete(index);
      if (requestGeneration !== generation) return;
      chunkData.set(index, graves);
      while (chunkData.size > CHUNK_CACHE_LIMIT) chunkData.delete(chunkData.keys().next().value);
      const chunk = [...visible.values()].find(item => item.index === index);
      if (!chunk) return;
      chunk.stones = graves.map((grave, slot) => makeStone(start + slot, grave));
      compileColliders(chunk);
      rebuildInstances();
    }, () => pending.delete(index));
  }

  function buildChunk(cx, cz) {
    const index = spiralIndex(cx, cz);
    const claimed = index < claimedChunks;
    const chunk = { cx, cz, index, claimed, stones: [], scenery: makeScenery(cx, cz, claimed), colliders: [] };
    if (claimed) {
      const graves = chunkData.get(index);
      if (graves) {
        // Refresh the cache position so recently visited chunks are evicted last.
        chunkData.delete(index);
        chunkData.set(index, graves);
        chunk.stones = graves.map((grave, slot) => makeStone(index * PER_CHUNK + slot, grave));
      } else requestChunk(index);
    }
    compileColliders(chunk);
    return chunk;
  }

  function updateChunks(force = false) {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE), pcz = Math.floor(player.position.z / CHUNK_SIZE);
    const key = `${pcx},${pcz}`;
    if (!force && key === lastChunkKey) return;
    lastChunkKey = key;
    const needed = new Set();
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
        const cx = pcx + dx, cz = pcz + dz, chunkKey = `${cx},${cz}`;
        needed.add(chunkKey);
        if (!visible.has(chunkKey)) visible.set(chunkKey, buildChunk(cx, cz));
      }
    }
    for (const chunkKey of visible.keys()) if (!needed.has(chunkKey)) visible.delete(chunkKey);
    rebuildInstances();
  }

  function rebuildInstances() {
    const writers = new Map();
    const put = (mesh, tint) => {
      const count = writers.get(mesh) || 0;
      if (count >= mesh.instanceMatrix.count) return -1;
      mesh.setMatrixAt(count, matrix);
      if (tint) mesh.setColorAt(count, tint);
      writers.set(mesh, count + 1);
      return count;
    };
    stoneLookup.forEach(list => { list.length = 0; });
    for (const chunk of visible.values()) {
      for (const stone of chunk.stones) {
        matrix.copy(stone.matrix);
        const slot = put(stoneMeshes[stone.variant], stone.color);
        if (slot >= 0) stoneLookup[stone.variant][slot] = stone;
        compose(stone.x, 0, stone.z, 0, stone.turn, 0, stone.size);
        put(plinths);
        if (stone.flowers) {
          const forwardX = Math.sin(stone.turn), forwardZ = Math.cos(stone.turn);
          for (let i = 0; i < 3; i++) {
            const side = (i - 1) * .32 + (random(stone.index, 40 + i) - .5) * .1;
            compose(stone.x + forwardX * .72 * stone.size + forwardZ * side, .12, stone.z + forwardZ * .72 * stone.size - forwardX * side, 0, i, 0, .8 + random(stone.index, 50 + i) * .5);
            put(flowers, color.set(FLOWER_COLORS[Math.floor(random(stone.index, 60 + i) * FLOWER_COLORS.length)]));
          }
        }
      }
      for (const item of chunk.scenery) {
        if (item.type === 'tree') {
          compose(item.x, 0, item.z, 0, item.tint * 6, 0, item.size);
          put(trunks);
          compose(item.x, 2.9 * item.size, item.z, 0, item.tint * 5, 0, item.size, item.size * .9);
          put(canopies, color.set(LEAF_COLORS[Math.floor(item.tint * LEAF_COLORS.length)]));
          compose(item.x + .5 * item.size, 4.1 * item.size, item.z - .3 * item.size, 0, item.tint * 3, 0, item.size * .62);
          put(canopies, color.set(LEAF_COLORS[Math.floor(item.tint * 13) % LEAF_COLORS.length]));
        } else if (item.type === 'bush') {
          compose(item.x, .45 * item.size, item.z, 0, item.tint * 6, 0, item.size, item.size * .75);
          put(bushes, color.set(LEAF_COLORS[Math.floor(item.tint * LEAF_COLORS.length)]).multiplyScalar(.85));
        } else if (item.type === 'rock') {
          compose(item.x, .25 * item.size, item.z, item.tint, item.tint * 6, 0, item.size, item.size * .7);
          put(rocks);
        } else if (item.type === 'lamp') {
          compose(item.x, 0, item.z, 0, 0, 0, 1);
          put(lampPosts);
          compose(item.x, 3.25, item.z, 0, .4, 0, 1, 1.3);
          put(lampHeads);
        } else if (item.type === 'flower') {
          compose(item.x, .12, item.z, 0, item.tint * 9, 0, .8 + item.tint * .6);
          put(flowers, color.set(FLOWER_COLORS[Math.floor(item.tint * FLOWER_COLORS.length)]));
        }
      }
    }
    for (const mesh of [...stoneMeshes, plinths, flowers, trunks, canopies, bushes, rocks, lampPosts, lampHeads]) {
      mesh.count = writers.get(mesh) || 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    labels.forEach(label => { label.stone = null; label.mesh.visible = false; });
    updateLabels();
  }

  function nearbyStones(radius) {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE), pcz = Math.floor(player.position.z / CHUNK_SIZE);
    const found = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const chunk = visible.get(`${pcx + dx},${pcz + dz}`);
        if (!chunk) continue;
        for (const stone of chunk.stones) {
          const distance = Math.hypot(stone.x - player.position.x, stone.z - player.position.z);
          if (distance < radius) found.push({ stone, distance });
        }
      }
    }
    return found.sort((a, b) => a.distance - b.distance);
  }

  // Only the nearest stones get a readable, uniquely painted face; the rest share one engraving.
  function updateLabels() {
    const candidates = nearbyStones(LABEL_RANGE);
    const wanted = new Set(candidates.slice(0, LABEL_COUNT).map(item => item.stone));
    labels.forEach(label => { if (label.stone && !wanted.has(label.stone)) { label.stone = null; label.mesh.visible = false; } });
    const assigned = new Set(labels.map(label => label.stone).filter(Boolean));
    for (const stone of wanted) {
      if (assigned.has(stone)) continue;
      const label = labels.find(item => !item.stone);
      if (!label) break;
      label.stone = stone;
      paintStoneFace(label.canvas, { background: stone.colorHex, ink: '#3c4534', grave: stone.grave });
      faceTransform(label.texture, STONE_VARIANTS[stone.variant]);
      label.mesh.geometry = labelGeometries[stone.variant];
      label.mesh.matrix.multiplyMatrices(stone.matrix, frontOffset);
      label.mesh.matrixWorldNeedsUpdate = true;
      label.mesh.visible = true;
    }
    // Prefer the memorial the mascot is facing over one just behind it.
    const forwardX = Math.sin(player.facing), forwardZ = Math.cos(player.facing);
    let closest = null, best = Infinity;
    for (const { stone, distance } of candidates) {
      if (distance >= READ_RANGE) break;
      const facing = ((stone.x - player.position.x) * forwardX + (stone.z - player.position.z) * forwardZ) / (distance || 1);
      const score = distance * (1.3 - .3 * facing);
      if (score < best) { best = score; closest = stone; }
    }
    if (closest !== nearby) {
      nearby = closest;
      onNearby(nearby ? nearby.grave : null);
    }
  }

  function collide() {
    const pcx = Math.floor(player.position.x / CHUNK_SIZE), pcz = Math.floor(player.position.z / CHUNK_SIZE);
    for (let pass = 0; pass < 2; pass++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const chunk = visible.get(`${pcx + dx},${pcz + dz}`);
          if (!chunk) continue;
          for (const collider of chunk.colliders) {
            const offsetX = player.position.x - collider.x, offsetZ = player.position.z - collider.z;
            const minimum = collider.r + PLAYER_RADIUS, distance = Math.hypot(offsetX, offsetZ);
            if (distance >= minimum) continue;
            const nx = distance ? offsetX / distance : 1, nz = distance ? offsetZ / distance : 0;
            player.position.x = collider.x + nx * minimum;
            player.position.z = collider.z + nz * minimum;
            const along = player.velocity.x * nx + player.velocity.z * nz;
            if (along < 0) { player.velocity.x -= along * nx; player.velocity.z -= along * nz; }
          }
        }
      }
    }
  }

  function readInput() {
    let x = stickInput.x, z = stickInput.z;
    if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    const length = Math.hypot(x, z);
    if (length > 1) { x /= length; z /= length; }
    return { x, z, sprint: keys.has('ShiftLeft') || keys.has('ShiftRight') || Math.hypot(stickInput.x, stickInput.z) > .92 };
  }

  const angleGap = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

  function update(dt) {
    elapsed += dt;
    const input = isActive() ? readInput() : { x: 0, z: 0, sprint: false };
    const sinYaw = Math.sin(view.yaw), cosYaw = Math.cos(view.yaw);
    const moveX = input.x * cosYaw - input.z * sinYaw;
    const moveZ = -input.x * sinYaw - input.z * cosYaw;
    const speed = input.sprint ? 10 : 5.5;
    const blend = 1 - Math.exp(-dt * 10);
    player.velocity.x += (moveX * speed - player.velocity.x) * blend;
    player.velocity.z += (moveZ * speed - player.velocity.z) * blend;
    player.position.x += player.velocity.x * dt;
    player.position.z += player.velocity.z * dt;
    collide();
    const groundSpeed = Math.hypot(player.velocity.x, player.velocity.z);
    if (Math.hypot(moveX, moveZ) > .05) player.facing += angleGap(player.facing, Math.atan2(moveX, moveZ)) * (1 - Math.exp(-dt * 12));
    if (jumpQueued && player.grounded && isActive()) { player.vy = 7.6; player.grounded = false; }
    jumpQueued = false;
    if (!player.grounded) {
      player.vy -= 22 * dt;
      player.position.y += player.vy * dt;
      if (player.position.y <= 0) { player.position.y = 0; player.vy = 0; player.grounded = true; player.squash = 1; }
    }

    const motion = reducedMotion() ? 0 : 1;
    player.walk += groundSpeed * dt * 1.7;
    player.squash = Math.max(0, player.squash - dt * 5);
    const stride = Math.min(1, groundSpeed / 6) * motion;
    mascot.group.position.copy(player.position);
    mascot.group.rotation.y = player.facing;
    mascot.rig.position.y = Math.abs(Math.sin(player.walk)) * .07 * stride + Math.sin(elapsed * 2.2) * .012 * motion;
    mascot.rig.scale.set(1 + player.squash * .12 * motion, 1 - player.squash * .16 * motion, 1 + player.squash * .12 * motion);
    mascot.arms.forEach((arm, side) => { arm.rotation.x = Math.sin(player.walk + side * Math.PI) * .7 * stride + (player.grounded ? 0 : -1.2); });
    mascot.wheels.forEach(wheel => { wheel.rotation.x += groundSpeed * dt / .17; });
    mascot.antenna.rotation.x = -player.velocity.length() * .025 * motion + Math.sin(elapsed * 6) * .04 * motion;
    // The head turns to read whichever memorial is closest.
    let lookYaw = 0;
    if (nearby) lookYaw = THREE.MathUtils.clamp(angleGap(player.facing, Math.atan2(nearby.x - player.position.x, nearby.z - player.position.z)), -.9, .9);
    mascot.head.rotation.y += (lookYaw - mascot.head.rotation.y) * (1 - Math.exp(-dt * 6));
    mascot.head.rotation.z = Math.sin(elapsed * 1.3) * .04 * motion;
    mascot.bars.forEach((bar, index) => { bar.visible = (elapsed * (input.sprint ? 6 : 1.2) + index) % 4 > 1; });
    blob.position.set(player.position.x, .03, player.position.z);
    blob.scale.setScalar(1 / (1 + player.position.y * .35));

    const target = position.set(player.position.x, player.position.y * .5 + 1.5, player.position.z);
    lookTarget.lerp(target, reducedMotion() ? 1 : 1 - Math.exp(-dt * 14));
    const horizontal = Math.cos(view.pitch) * view.distance;
    camera.position.set(lookTarget.x + Math.sin(view.yaw) * horizontal, lookTarget.y + Math.sin(view.pitch) * view.distance, lookTarget.z + Math.cos(view.yaw) * horizontal);
    camera.lookAt(lookTarget);
    sky.position.copy(camera.position);

    // The ground follows the mascot while its texture stays fixed to the world grid.
    ground.position.set(player.position.x, 0, player.position.z);
    groundMap.offset.set(player.position.x / CHUNK_SIZE, -player.position.z / CHUNK_SIZE);
    sun.position.set(player.position.x + 28, 52, player.position.z + 22);
    sun.target.position.set(player.position.x, 0, player.position.z);

    cloudPuffs.forEach((puff, index) => {
      const wrap = (value, origin) => origin + ((value - origin) % 700 + 1050) % 700 - 350;
      compose(wrap(puff.x + elapsed * 1.4, player.position.x) + puff.dx, puff.y + puff.dy, wrap(puff.z, player.position.z) + puff.dz, 0, 0, 0, puff.scale, puff.scale * .7);
      clouds.setMatrixAt(index, matrix);
    });
    clouds.count = cloudPuffs.length;
    clouds.instanceMatrix.needsUpdate = true;

    chunkTimer += dt;
    if (chunkTimer > .2) { chunkTimer = 0; updateChunks(); }
    labelTimer += dt;
    if (labelTimer > .15) { labelTimer = 0; updateLabels(); }
  }

  function render() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    const canvas = renderer.domElement;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      // Tall phone screens get a wider view so the mascot doesn't fill the frame.
      camera.fov = camera.aspect < 1 ? 70 : 55;
      camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
  }

  function tick() {
    if (!running) return;
    update(Math.min(.05, clock.getDelta()));
    render();
    frame = requestAnimationFrame(tick);
  }

  // Input: keyboard, mouse-drag camera, wheel zoom, touch joystick and a jump button.
  const pointers = new Map();
  let stickPointer = null;
  const handledKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'KeyE', 'Enter']);
  window.addEventListener('keydown', event => {
    if (!running || !isActive() || !handledKeys.has(event.code) || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input, textarea, select')) return;
    const onButton = !!event.target.closest?.('button, a');
    if (event.code === 'Space' || event.code === 'Enter' || event.code === 'KeyE') {
      if (onButton && event.code !== 'KeyE') return;
      event.preventDefault();
      if (event.code === 'Space') jumpQueued = true;
      else if (!event.repeat && nearby) onRead(nearby.grave);
      return;
    }
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', event => {
    if (event.button > 0) return;
    const rect = canvas.getBoundingClientRect();
    if (event.pointerType !== 'mouse' && !stickPointer && event.clientX - rect.left < rect.width * .45) {
      stickPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      stick.hidden = false;
      stick.style.left = `${event.clientX - rect.left}px`;
      stick.style.top = `${event.clientY - rect.top}px`;
      stick.firstElementChild.style.transform = '';
    } else pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (stickPointer?.id === event.pointerId) {
      let dx = event.clientX - stickPointer.x, dy = event.clientY - stickPointer.y;
      const length = Math.hypot(dx, dy), limit = 48;
      if (length > limit) { dx *= limit / length; dy *= limit / length; }
      stick.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
      stickInput.x = dx / limit;
      stickInput.z = -dy / limit;
      return;
    }
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    view.yaw -= (event.clientX - pointer.x) * .006;
    view.pitch = THREE.MathUtils.clamp(view.pitch + (event.clientY - pointer.y) * .004, -.05, 1.15);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  });
  const releasePointer = event => {
    if (stickPointer?.id === event.pointerId) {
      stickPointer = null;
      stickInput.x = stickInput.z = 0;
      stick.hidden = true;
      return;
    }
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (event.type === 'pointerup' && pointer && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < 6) readStoneAt(event);
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    view.distance = THREE.MathUtils.clamp(view.distance * Math.exp(event.deltaY * .001), 3.5, 16);
  }, { passive: false });
  jumpButton.addEventListener('pointerdown', event => { event.preventDefault(); jumpQueued = true; });
  jumpButton.addEventListener('click', event => { if (!event.detail) jumpQueued = true; });

  const raycaster = new THREE.Raycaster();
  function readStoneAt(event) {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), camera);
    raycaster.far = 40;
    const hit = raycaster.intersectObjects(stoneMeshes, false)[0];
    if (!hit) return;
    const stone = stoneLookup[stoneMeshes.indexOf(hit.object)][hit.instanceId];
    if (stone) onRead(stone.grave);
  }

  function placePlayer(x, z, facing, { pitch = .3, distance = 7.5, yawOffset = 0 } = {}) {
    player.position.set(x, 0, z);
    player.velocity.set(0, 0, 0);
    player.vy = 0;
    player.grounded = true;
    player.facing = facing;
    view.yaw = facing - Math.PI + yawOffset;
    view.pitch = pitch;
    view.distance = distance;
    lookTarget.set(x, 1.5, z);
    updateChunks(true);
  }

  async function refresh(fromIndex = 0) {
    total = await source.count();
    claimedChunks = Math.ceil(total / PER_CHUNK);
    const firstChunk = Math.floor(fromIndex / PER_CHUNK);
    for (const index of [...chunkData.keys()]) if (index >= firstChunk) chunkData.delete(index);
    generation++;
    pending.clear();
    visible.clear();
    updateChunks(true);
    return total;
  }

  await refresh();
  placePlayer(SPAWN.x, SPAWN.z, Math.PI);
  update(0);
  render();

  return {
    start() {
      if (running) return;
      running = true;
      clock.start();
      clock.getDelta();
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
      keys.clear();
      stickInput.x = stickInput.z = 0;
      stick.hidden = true;
    },
    refresh,
    goToGate() { placePlayer(SPAWN.x, SPAWN.z, Math.PI); },
    // Stand in front of memorial N, facing it, with the camera looking over the row behind.
    goToMemorial(index) {
      const plot = plotPosition(index);
      // Stand to one side and swing the camera the other way, so the mascot doesn't hide the inscription.
      const x = plot.x + 1.3, z = plot.z + 2.7;
      placePlayer(x, z, Math.atan2(plot.x - x, plot.z - z), { pitch: .42, distance: 6, yawOffset: -.75 });
    },
    readNearby() { if (nearby) onRead(nearby.grave); },
    get total() { return total; }
  };
}
