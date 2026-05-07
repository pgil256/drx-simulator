// Numeric sanity checks for the CAD-derived DRX GLB.
//
// Run: node scripts/inspect-glb.mjs [path/to/drx.glb]

import { NodeIO } from '@gltf-transform/core';
import { Box3, Matrix4, Vector3 } from 'three';
import { resolve } from 'node:path';

const GLB_PATH = resolve(process.argv[2] ?? 'public/models/drx.glb');

const REQUIRED_NODES = [
  'static_frame',
  'horizontal_pivot',
  'lateral_pivot',
  'axial_slider',
  'Chair:1',
  'Chair Frame:1',
  'Base extension:1',
  'Hinge:1',
  'Traction body:1',
  'Traction tray:1',
];

const FASTENER_PREFIXES = [
  'Hex Cap Screw',
  'Hex_Cap_Screw',
  'Circular Washer',
  'Circular_Washer',
  'Prevailing Torque',
  'Prevailing_Torque',
  'Handle bushing',
  'Handle_bushing',
];

const EPSILON_M = 1e-5;
const CENTERLINE_WARN_M = 0.05;
const CENTERLINE_FAIL_M = 0.12;

const failures = [];
const warnings = [];

const doc = await new NodeIO().read(GLB_PATH);
const root = doc.getRoot();
const nodes = root.listNodes();

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function named(name) {
  return nodes.find((node) => node.getName() === name) ?? null;
}

function namedWithin(name, ancestor) {
  return nodes.find((node) => node.getName() === name && isDescendantOf(node, ancestor)) ?? null;
}

function requireNode(name) {
  const node = named(name);
  if (!node) fail(`Missing node: ${name}`);
  return node;
}

function isFastener(node) {
  return FASTENER_PREFIXES.some((prefix) => node.getName().startsWith(prefix));
}

function isDescendantOf(node, ancestor) {
  for (let parent = node.getParentNode(); parent; parent = parent.getParentNode()) {
    if (parent === ancestor) return true;
  }
  return false;
}

function matrix(array) {
  return new Matrix4().fromArray(array);
}

function worldAxis(node, columnIndex) {
  const elements = matrix(node.getWorldMatrix()).elements;
  return new Vector3(
    elements[columnIndex * 4],
    elements[columnIndex * 4 + 1],
    elements[columnIndex * 4 + 2],
  ).normalize();
}

function localDirection(parentWorldMatrix, worldDirection) {
  return worldDirection
    .clone()
    .transformDirection(matrix(parentWorldMatrix).invert())
    .normalize();
}

function aligned(a, b) {
  return Math.abs(a.clone().normalize().dot(b.clone().normalize()));
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function center(box) {
  return box.getCenter(new Vector3());
}

function expandBox(box, node) {
  if (isFastener(node)) return;

  const mesh = node.getMesh();
  if (mesh) {
    const world = matrix(node.getWorldMatrix());
    const point = new Vector3();
    const element = [];
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      if (!position) continue;
      for (let i = 0; i < position.getCount(); i++) {
        position.getElement(i, element);
        point.set(element[0], element[1], element[2]).applyMatrix4(world);
        box.expandByPoint(point);
      }
    }
  }

  for (const child of node.listChildren()) {
    expandBox(box, child);
  }
}

function bboxFor(...parts) {
  const box = new Box3();
  for (const part of parts) expandBox(box, part);
  return box;
}

for (const name of REQUIRED_NODES) {
  requireNode(name);
}

if (failures.length > 0) {
  printAndExit();
}

const staticFrame = named('static_frame');
const horizontalPivot = named('horizontal_pivot');
const lateralPivot = named('lateral_pivot');
const axialSlider = named('axial_slider');
const chair = named('Chair:1');
const chairFrame = named('Chair Frame:1');
const baseExtension = named('Base extension:1');
const hingeSourceName = lateralPivot.getExtras().drxSourcePart ?? 'Hinge:1';
const hinge = namedWithin(hingeSourceName, lateralPivot) ?? named('Hinge:1');
const tractionBody = named('Traction body:1');
const tractionTray = named('Traction tray:1');

if (!isDescendantOf(horizontalPivot, staticFrame)) {
  fail('horizontal_pivot is not parented under static_frame');
}
if (!isDescendantOf(lateralPivot, horizontalPivot)) {
  fail('lateral_pivot is not parented under horizontal_pivot');
}
if (!isDescendantOf(axialSlider, lateralPivot)) {
  fail('axial_slider is not parented under lateral_pivot');
}
if (!isDescendantOf(baseExtension, horizontalPivot)) {
  fail('Base extension:1 is not parented under horizontal_pivot');
}
if (!isDescendantOf(hinge, lateralPivot)) {
  fail('Hinge:1 is not parented under lateral_pivot');
}
if (!isDescendantOf(tractionBody, axialSlider)) {
  fail('Traction body:1 is not parented under axial_slider');
}
if (!isDescendantOf(tractionTray, lateralPivot) || isDescendantOf(tractionTray, axialSlider)) {
  fail('Traction tray:1 must stay under lateral_pivot and outside axial_slider');
}

for (const pivot of [horizontalPivot, lateralPivot, axialSlider]) {
  const sourceTranslation = pivot.getExtras().drxWorldTranslation;
  if (!Array.isArray(sourceTranslation)) {
    fail(`${pivot.getName()} is missing drxWorldTranslation extras`);
  } else if (distance(pivot.getWorldTranslation(), sourceTranslation) > EPSILON_M) {
    fail(`${pivot.getName()} moved away from its CAD source translation`);
  }
}

if (distance(baseExtension.getWorldTranslation(), horizontalPivot.getWorldTranslation()) > EPSILON_M) {
  fail('Base extension CAD origin no longer matches horizontal_pivot origin');
}
const hingeCenter = center(bboxFor(hinge));
if (distance(hingeCenter.toArray(), lateralPivot.getWorldTranslation()) > EPSILON_M) {
  fail('Lateral hinge geometry centerline no longer matches lateral_pivot origin');
}
if (distance(tractionBody.getWorldTranslation(), axialSlider.getWorldTranslation()) > EPSILON_M) {
  fail('Traction body CAD origin no longer matches axial_slider origin');
}

const horizontalAxis = horizontalPivot.getExtras().drxAxisLocal;
const lateralAxis = lateralPivot.getExtras().drxAxisLocal;
const axialAxis = axialSlider.getExtras().drxAxisLocal;
for (const [label, axis] of [
  ['horizontal_pivot', horizontalAxis],
  ['lateral_pivot', lateralAxis],
  ['axial_slider', axialAxis],
]) {
  if (!Array.isArray(axis) || axis.length !== 3) {
    fail(`${label} is missing drxAxisLocal extras`);
    continue;
  }
  const axisLen = Math.hypot(axis[0], axis[1], axis[2]);
  if (Math.abs(axisLen - 1) > 1e-3) {
    fail(`${label} drxAxisLocal is not normalized: length=${axisLen}`);
  }
}

if (Array.isArray(horizontalAxis)) {
  const expected = localDirection(staticFrame.getWorldMatrix(), worldAxis(baseExtension, 0));
  if (aligned(new Vector3(...horizontalAxis), expected) < 0.999) {
    fail('horizontal_pivot axis does not match the Base extension CAD hinge axis');
  }
}

if (Array.isArray(lateralAxis)) {
  const expected = localDirection(horizontalPivot.getWorldMatrix(), worldAxis(hinge, 0));
  if (aligned(new Vector3(...lateralAxis), expected) < 0.999) {
    fail('lateral_pivot axis does not match the lateral Hinge CAD centerline');
  }
}

if (Array.isArray(axialAxis)) {
  const trayRailAxis = localDirection(lateralPivot.getWorldMatrix(), worldAxis(tractionTray, 2));
  const bodyRailAxis = localDirection(lateralPivot.getWorldMatrix(), worldAxis(tractionBody, 0));
  const axis = new Vector3(...axialAxis);
  if (aligned(axis, trayRailAxis) < 0.999 || aligned(axis, bodyRailAxis) < 0.999) {
    fail('axial_slider axis does not match the Traction tray/body rail direction');
  }
}

const expectedBodyToTray = axialSlider.getExtras().drxTractionBodyToTrayWorldDelta;
if (!Array.isArray(expectedBodyToTray)) {
  fail('axial_slider is missing drxTractionBodyToTrayWorldDelta extras');
} else {
  const actual = [
    tractionBody.getWorldTranslation()[0] - tractionTray.getWorldTranslation()[0],
    tractionBody.getWorldTranslation()[1] - tractionTray.getWorldTranslation()[1],
    tractionBody.getWorldTranslation()[2] - tractionTray.getWorldTranslation()[2],
  ];
  if (distance(actual, expectedBodyToTray) > EPSILON_M) {
    fail('Traction body/tray relative CAD transform changed during grouping');
  }
}

const chairCenter = center(bboxFor(chair, chairFrame));
const baseCenter = center(bboxFor(baseExtension));
const bodyCenter = center(bboxFor(tractionBody));
const trayCenter = center(bboxFor(tractionTray));

const centerlineReport = [
  ['base extension', Math.abs(baseCenter.x - chairCenter.x)],
  ['traction body', Math.abs(bodyCenter.x - chairCenter.x)],
  ['traction tray', Math.abs(trayCenter.x - chairCenter.x)],
];

for (const [label, delta] of centerlineReport) {
  if (delta > CENTERLINE_FAIL_M) {
    fail(`${label} is ${format(delta)}m off the chair centerline in overhead rest pose`);
  } else if (delta > CENTERLINE_WARN_M) {
    warn(`${label} is ${format(delta)}m off the chair centerline in overhead rest pose`);
  }
}

console.log('GLB inspection:', GLB_PATH);
console.log('Pivot groups: static_frame -> horizontal_pivot -> lateral_pivot -> axial_slider');
console.log('Centerline X deltas from chair:', Object.fromEntries(centerlineReport));
console.log('Motion axes local:', {
  horizontal: horizontalAxis,
  lateral: lateralAxis,
  axial: axialAxis,
});

printAndExit();

function format(n) {
  return n.toFixed(4);
}

function printAndExit() {
  for (const message of warnings) {
    console.warn('WARN:', message);
  }
  for (const message of failures) {
    console.error('FAIL:', message);
  }
  if (failures.length > 0) {
    process.exit(1);
  }
  console.log('GLB inspection passed');
}
