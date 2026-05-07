// Reorganizes the raw cascadio-converted GLB into named animation pivots:
// static_frame -> horizontal_pivot -> lateral_pivot -> axial_slider.
//
// Pivots are placed from CAD part origins/placements, not from bounding boxes:
// - horizontal_pivot uses the Base extension CAD origin.
// - lateral_pivot uses the visible lateral hinge geometry centerline.
// - axial_slider uses the Traction body CAD origin and stores the rail vector
//   from the body/tray CAD geometry in node extras for runtime axial motion.
//
// Run: node scripts/reorganize-glb.mjs

import { NodeIO } from '@gltf-transform/core';
import { Box3, Matrix4, Vector3 } from 'three';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const IN_PATH = resolve(WEB_ROOT, 'public/models/drx-raw.glb');
const OUT_PATH = resolve(WEB_ROOT, 'public/models/drx.glb');

const HORIZONTAL_PARTS = new Set(['Base extension:1']);
const LATERAL_PARTS = new Set(['Hinge:1', 'Hinge (Lateral):1', 'Hinge-1:1', 'Traction tray:1']);
const AXIAL_PARTS = new Set(['Traction body:1']);

const HORIZONTAL_ANCHORS = ['Base extension:1'];
const LATERAL_ANCHORS = ['Hinge:1', 'Hinge (Lateral):1', 'Hinge-1:1'];
const AXIAL_ANCHORS = ['Traction body:1'];

const io = new NodeIO();
const doc = await io.read(IN_PATH);
const root = doc.getRoot();
const scene = root.listScenes()[0];

const assembly = scene.listChildren()[0];
if (!assembly || assembly.getName() !== 'Full assembly') {
  throw new Error('Expected top-level "Full assembly" node; got: ' + assembly?.getName());
}

const originalChildren = [...assembly.listChildren()];
const byName = new Map(originalChildren.map((child) => [child.getName(), child]));

function reqAny(names, purpose) {
  for (const name of names) {
    const node = byName.get(name);
    if (node) return node;
  }
  throw new Error(
    `Missing ${purpose}. Tried ${names.join(', ')}. Available parts:\n` +
      originalChildren.map((child) => `- ${child.getName()}`).join('\n'),
  );
}

function matrixFromArray(matrix) {
  return new Matrix4().fromArray(matrix);
}

function matrixToArray(matrix) {
  return Array.from(matrix.toArray());
}

function worldMatrixWithTranslation(basisWorldMatrix, worldTranslation) {
  const matrix = matrixFromArray(basisWorldMatrix);
  matrix.setPosition(worldTranslation[0], worldTranslation[1], worldTranslation[2]);
  return matrixToArray(matrix);
}

function localMatrix(parentWorldMatrix, childWorldMatrix) {
  return matrixToArray(
    matrixFromArray(parentWorldMatrix).invert().multiply(matrixFromArray(childWorldMatrix)),
  );
}

function localPoint(parentWorldMatrix, worldTranslation) {
  return new Vector3(worldTranslation[0], worldTranslation[1], worldTranslation[2])
    .applyMatrix4(matrixFromArray(parentWorldMatrix).invert())
    .toArray();
}

function localDirection(parentWorldMatrix, worldDirection) {
  const direction = worldDirection.clone();
  if (direction.lengthSq() < 1e-10) return [0, 0, 1];
  direction.transformDirection(matrixFromArray(parentWorldMatrix).invert()).normalize();
  return direction.toArray().map((v) => Number(v.toFixed(8)));
}

function geometryWorldCenter(node) {
  const box = new Box3();
  const point = new Vector3();
  const element = [];
  const visit = (current) => {
    const mesh = current.getMesh();
    if (mesh) {
      const world = matrixFromArray(current.getWorldMatrix());
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
    for (const child of current.listChildren()) visit(child);
  };
  visit(node);
  if (box.isEmpty()) return node.getWorldTranslation();
  return box.getCenter(new Vector3()).toArray();
}

function worldAxis(node, columnIndex) {
  const elements = matrixFromArray(node.getWorldMatrix()).elements;
  return new Vector3(
    elements[columnIndex * 4],
    elements[columnIndex * 4 + 1],
    elements[columnIndex * 4 + 2],
  ).normalize();
}

function oriented(axis, toward) {
  const normalized = axis.clone().normalize();
  return normalized.dot(toward) < 0 ? normalized.negate() : normalized;
}

function averageAxes(axes) {
  const acc = new Vector3();
  for (const axis of axes) {
    const next = axis.clone().normalize();
    if (acc.lengthSq() > 0 && acc.dot(next) < 0) next.negate();
    acc.add(next);
  }
  if (acc.lengthSq() < 1e-10) return new Vector3(0, 0, 1);
  return acc.normalize();
}

function reparentPreservingWorld(child, newParent, parentWorldMatrix) {
  const childWorldMatrix = child.getWorldMatrix();
  newParent.addChild(child);
  child.setMatrix(localMatrix(parentWorldMatrix, childWorldMatrix));
}

const horizontalAnchor = reqAny(HORIZONTAL_ANCHORS, 'horizontal pivot anchor');
const lateralAnchor = reqAny(LATERAL_ANCHORS, 'lateral pivot anchor');
const axialAnchor = reqAny(AXIAL_ANCHORS, 'axial slider anchor');
const tractionTray = reqAny(['Traction tray:1'], 'traction tray');
const chair = reqAny(['Chair:1'], 'chair');

const staticWorldMatrix = assembly.getWorldMatrix();
const horizontalWorldTranslation = horizontalAnchor.getWorldTranslation();
const lateralWorldTranslation = geometryWorldCenter(lateralAnchor);
const axialWorldTranslation = axialAnchor.getWorldTranslation();
const tractionTrayWorldTranslation = tractionTray.getWorldTranslation();

const horizontalWorldMatrix = worldMatrixWithTranslation(
  staticWorldMatrix,
  horizontalWorldTranslation,
);
const lateralWorldMatrix = worldMatrixWithTranslation(
  horizontalWorldMatrix,
  lateralWorldTranslation,
);
const axialWorldMatrix = worldMatrixWithTranslation(lateralWorldMatrix, axialWorldTranslation);

const horizontalAxisWorld = oriented(worldAxis(horizontalAnchor, 0), new Vector3(1, 0, 0));
const lateralAxisWorld = oriented(worldAxis(lateralAnchor, 0), new Vector3(0, 1, 0));
const chairToTrayWorld = new Vector3(
  axialWorldTranslation[0] - chair.getWorldTranslation()[0],
  axialWorldTranslation[1] - chair.getWorldTranslation()[1],
  axialWorldTranslation[2] - chair.getWorldTranslation()[2],
);
const axialRailWorldDirection = oriented(
  averageAxes([worldAxis(axialAnchor, 0), worldAxis(tractionTray, 2)]),
  chairToTrayWorld,
);
const horizontalAxisLocal = localDirection(staticWorldMatrix, horizontalAxisWorld);
const lateralAxisLocal = localDirection(horizontalWorldMatrix, lateralAxisWorld);
const axialAxisLocal = localDirection(lateralWorldMatrix, axialRailWorldDirection);
const tractionBodyToTrayWorldDelta = [
  axialWorldTranslation[0] - tractionTrayWorldTranslation[0],
  axialWorldTranslation[1] - tractionTrayWorldTranslation[1],
  axialWorldTranslation[2] - tractionTrayWorldTranslation[2],
];

const staticFrame = doc.createNode('static_frame');
staticFrame.setMatrix(staticWorldMatrix);

const horizontalPivot = doc.createNode('horizontal_pivot');
horizontalPivot.setMatrix(localMatrix(staticWorldMatrix, horizontalWorldMatrix));
horizontalPivot.setExtras({
  drxSourcePart: horizontalAnchor.getName(),
  drxWorldTranslation: horizontalWorldTranslation,
  drxAxisLocal: horizontalAxisLocal,
});

const lateralPivot = doc.createNode('lateral_pivot');
lateralPivot.setMatrix(localMatrix(horizontalWorldMatrix, lateralWorldMatrix));
lateralPivot.setExtras({
  drxSourcePart: lateralAnchor.getName(),
  drxWorldTranslation: lateralWorldTranslation,
  drxAxisLocal: lateralAxisLocal,
});

const axialSlider = doc.createNode('axial_slider');
axialSlider.setMatrix(localMatrix(lateralWorldMatrix, axialWorldMatrix));
axialSlider.setExtras({
  drxSourcePart: axialAnchor.getName(),
  drxWorldTranslation: axialWorldTranslation,
  drxAxisLocal: axialAxisLocal,
  drxTractionBodyToTrayWorldDelta: tractionBodyToTrayWorldDelta,
});

horizontalPivot.addChild(lateralPivot);
lateralPivot.addChild(axialSlider);
staticFrame.addChild(horizontalPivot);
scene.addChild(staticFrame);

const counts = { static: 0, horizontal: 0, lateral: 0, axial: 0 };

for (const child of originalChildren) {
  const name = child.getName();
  if (HORIZONTAL_PARTS.has(name)) {
    reparentPreservingWorld(child, horizontalPivot, horizontalWorldMatrix);
    counts.horizontal++;
  } else if (LATERAL_PARTS.has(name)) {
    reparentPreservingWorld(child, lateralPivot, lateralWorldMatrix);
    counts.lateral++;
  } else if (AXIAL_PARTS.has(name)) {
    reparentPreservingWorld(child, axialSlider, axialWorldMatrix);
    counts.axial++;
  } else {
    reparentPreservingWorld(child, staticFrame, staticWorldMatrix);
    counts.static++;
  }
}

scene.removeChild(assembly);
assembly.dispose();

await io.write(OUT_PATH, doc);

console.log('Reorganized:', counts);
console.log('Pivot anchors:', {
  horizontal: horizontalAnchor.getName(),
  lateral: lateralAnchor.getName(),
  axial: axialAnchor.getName(),
});
console.log('Pivot local translations:', {
  horizontal: localPoint(staticWorldMatrix, horizontalWorldTranslation),
  lateral: localPoint(horizontalWorldMatrix, lateralWorldTranslation),
  axial: localPoint(lateralWorldMatrix, axialWorldTranslation),
});
console.log('Axial rail axis in lateral_pivot local space:', axialAxisLocal);
console.log('Rotation axes:', {
  horizontal: horizontalAxisLocal,
  lateral: lateralAxisLocal,
});
console.log('Wrote', OUT_PATH);
