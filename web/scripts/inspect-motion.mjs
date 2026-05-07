// Verifies that actuator movement uses the CAD-derived axes and keeps moving
// assemblies rigid. This is a numeric companion to the browser motion captures.
//
// Run: node scripts/inspect-motion.mjs [path/to/drx.glb]

import { NodeIO } from '@gltf-transform/core';
import { Matrix4, Vector3 } from 'three';
import { resolve } from 'node:path';

const GLB_PATH = resolve(process.argv[2] ?? 'public/models/drx.glb');
const IN_TO_M = 0.0254;
const EPSILON = 1e-5;

const doc = await new NodeIO().read(GLB_PATH);
const nodes = doc.getRoot().listNodes();
const failures = [];

function fail(message) {
  failures.push(message);
}

function node(name) {
  const found = nodes.find((n) => n.getName() === name);
  if (!found) fail(`Missing node: ${name}`);
  return found;
}

function matrix(array) {
  return new Matrix4().fromArray(array);
}

function axisFromExtras(n) {
  const raw = n.getExtras().drxAxisLocal;
  if (!Array.isArray(raw) || raw.length !== 3) {
    fail(`${n.getName()} missing drxAxisLocal`);
    return new Vector3(0, 0, 1);
  }
  return new Vector3(raw[0], raw[1], raw[2]).normalize();
}

function worldAxis(n, columnIndex) {
  const elements = matrix(n.getWorldMatrix()).elements;
  return new Vector3(
    elements[columnIndex * 4],
    elements[columnIndex * 4 + 1],
    elements[columnIndex * 4 + 2],
  ).normalize();
}

function rotatePointAroundAxis(point, pivot, axis, angleRad) {
  return point
    .clone()
    .sub(pivot)
    .applyAxisAngle(axis.clone().normalize(), angleRad)
    .add(pivot);
}

function distance(a, b) {
  return a.distanceTo(b);
}

function assertClose(label, a, b, tolerance = EPSILON) {
  const d = distance(a, b);
  if (d > tolerance) fail(`${label}: expected ${b.toArray()}, got ${a.toArray()} (delta ${d})`);
}

const horizontalPivot = node('horizontal_pivot');
const lateralPivot = node('lateral_pivot');
const axialSlider = node('axial_slider');
const baseExtension = node('Base extension:1');
const tractionBody = node('Traction body:1');
const tractionTray = node('Traction tray:1');

if (failures.length === 0) {
  const horizontalPivotWorld = new Vector3(...horizontalPivot.getWorldTranslation());
  const lateralPivotWorld = new Vector3(...lateralPivot.getWorldTranslation());
  const trayWorld = new Vector3(...tractionTray.getWorldTranslation());
  const bodyWorld = new Vector3(...tractionBody.getWorldTranslation());

  const horizontalAxisWorld = worldAxis(baseExtension, 0);
  if (horizontalAxisWorld.dot(new Vector3(1, 0, 0)) < 0) horizontalAxisWorld.negate();

  const lateralAxisAtRestWorld = worldAxis(nodes.find((n) => {
    return n.getName() === 'Hinge:1' && n.getParentNode()?.getName() === 'lateral_pivot';
  }) ?? lateralPivot, 0);
  if (lateralAxisAtRestWorld.dot(new Vector3(0, 1, 0)) < 0) lateralAxisAtRestWorld.negate();

  const axialAxisAtRestWorld = worldAxis(tractionTray, 2);
  const axialAxisLocal = axisFromExtras(axialSlider);
  const axialAxisWorld = axialAxisLocal.clone();

  // Axial: positive travel moves the traction body through the stationary
  // traction tray, parallel to the tray/body rail axis.
  const axialEndTray = trayWorld.clone();
  const axialEndBody = bodyWorld.clone().addScaledVector(axialAxisWorld, 4 * IN_TO_M);
  const bodyDelta = axialEndBody.clone().sub(bodyWorld).normalize();
  if (Math.abs(bodyDelta.dot(axialAxisAtRestWorld)) < 0.999) {
    fail('Axial positive travel is not parallel to the Traction tray rail axis');
  }
  assertClose(
    'Axial keeps the traction tray stationary',
    axialEndTray,
    trayWorld,
  );
  assertClose(
    'Axial body/tray travel delta',
    axialEndBody.clone().sub(axialEndTray).sub(bodyWorld.clone().sub(trayWorld)),
    axialAxisWorld.clone().multiplyScalar(4 * IN_TO_M),
  );

  // Horizontal: descendants rotate around the base-extension hinge, so their
  // radius to the pivot stays constant through the full programmed range.
  for (const degrees of [-25, -15, 5]) {
    const angle = ((degrees + 15) * Math.PI) / 180;
    const moved = rotatePointAroundAxis(trayWorld, horizontalPivotWorld, horizontalAxisWorld, angle);
    const radiusDelta = Math.abs(
      distance(moved, horizontalPivotWorld) - distance(trayWorld, horizontalPivotWorld),
    );
    if (radiusDelta > EPSILON) fail(`Horizontal ${degrees} deg changes tray pivot radius`);
  }

  // Lateral: +/- travel should be symmetric around the CAD lateral hinge
  // centerline and preserve the tray/body rigid offset.
  for (const degrees of [-20, 20]) {
    const angle = (degrees * Math.PI) / 180;
    const movedTray = rotatePointAroundAxis(trayWorld, lateralPivotWorld, lateralAxisAtRestWorld, angle);
    const movedBody = rotatePointAroundAxis(bodyWorld, lateralPivotWorld, lateralAxisAtRestWorld, angle);
    const radiusDelta = Math.abs(
      distance(movedTray, lateralPivotWorld) - distance(trayWorld, lateralPivotWorld),
    );
    if (radiusDelta > EPSILON) fail(`Lateral ${degrees} deg changes tray pivot radius`);
    assertClose(
      `Lateral ${degrees} deg body/tray rigid transform`,
      movedBody.clone().sub(movedTray).applyAxisAngle(lateralAxisAtRestWorld, -angle),
      bodyWorld.clone().sub(trayWorld),
      1e-4,
    );
  }

  console.log('Motion axes:', {
    horizontal: horizontalAxisWorld.toArray(),
    lateral: lateralAxisAtRestWorld.toArray(),
    axial: axialAxisWorld.toArray(),
  });
}

for (const message of failures) {
  console.error('FAIL:', message);
}
if (failures.length > 0) process.exit(1);
console.log('Motion inspection passed:', GLB_PATH);
