// One-off verification: load drx.glb, apply the same X-centering / pivot
// alignment that DeviceModel.tsx now does, and print rest+rotated positions
// of the foot tray relative to the chair midline. Should show the rest pose
// on the chair midline and ±20° rotations producing mirror-symmetric arcs.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const glbPath = resolve(__dirname, '..', 'public', 'models', 'drx.glb');

const buf = await readFile(glbPath);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

const gltf = await new Promise((res, rej) => {
  new GLTFLoader().parse(ab, '', res, rej);
});
const scene = gltf.scene;
scene.updateMatrixWorld(true);

const horizontal = scene.getObjectByName('horizontal_pivot');
const lateral = scene.getObjectByName('lateral_pivot');
const axial = scene.getObjectByName('axial_slider');
const tray = scene.getObjectByName('Traction_tray1');
const legNames = ['Vertical_leg_11', 'Vertical_leg_12', 'Vertical_leg_21', 'Vertical_leg_22'];

const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
const fmt = (v) => `(${v.x.toFixed(3)}, ${v.y.toFixed(3)}, ${v.z.toFixed(3)})`;

const legXs = legNames.map((n) => wp(scene.getObjectByName(n)).x);
const chairMidX = (Math.min(...legXs) + Math.max(...legXs)) / 2;

console.log('=== Pre-fix rest ===');
console.log('chair midline X:', chairMidX.toFixed(3));
console.log('horizontal_pivot:', fmt(wp(horizontal)));
console.log('lateral_pivot:   ', fmt(wp(lateral)));
console.log('Traction_tray1:  ', fmt(wp(tray)));
console.log('tray X offset from chair midline:', (wp(tray).x - chairMidX).toFixed(3));

// === Apply the same fix DeviceModel.tsx now does ===
const trayWorld = wp(tray);
const lateralWorld = wp(lateral);

const pivotAlignDx = trayWorld.x - lateralWorld.x;
lateral.position.x += pivotAlignDx;
axial.position.x -= pivotAlignDx;

const centeringDx = chairMidX - trayWorld.x;
horizontal.position.x += centeringDx;

scene.updateMatrixWorld(true);

console.log('\n=== Post-fix rest (lateral=0) ===');
console.log('horizontal_pivot:', fmt(wp(horizontal)));
console.log('lateral_pivot:   ', fmt(wp(lateral)));
console.log('Traction_tray1:  ', fmt(wp(tray)));
console.log('tray X offset from chair midline:', (wp(tray).x - chairMidX).toFixed(3));

// Test rotation symmetry
for (const deg of [-20, -10, 0, 10, 20]) {
  lateral.rotation.y = (deg * Math.PI) / 180;
  scene.updateMatrixWorld(true);
  const t = wp(tray);
  console.log(`  lateral=${deg.toString().padStart(3)}°  tray world=${fmt(t)}  Δx from midline=${(t.x - chairMidX).toFixed(3)}`);
}
