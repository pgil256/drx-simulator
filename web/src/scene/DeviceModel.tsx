/* eslint-disable react-hooks/immutability -- react-three-fiber scene objects are mutated imperatively. */
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import {
  Box3,
  BoxGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import type { Object3D } from 'three';
import { useAppStore } from '../store/useAppStore';
import { patientLateralDegToCadDeg } from './motionConventions';

const PRESSURE_MAX_LBS = 80;
const GLOW_MAX_INTENSITY = 0.8;
const PULSE_HZ = 1.5;
const PULSE_GLOW_AMPLITUDE = 0;
const PULSE_AXIAL_AMPLITUDE_IN = 0.25;

const IN_TO_M = 0.0254;

const HIDE_NAME_PREFIXES = [
  'Hex_Cap_Screw',
  'Hex Cap Screw',
  'Circular_Washer',
  'Circular Washer',
  'Prevailing_Torque',
  'Prevailing Torque',
  'Handle_bushing',
  'Handle bushing',
];

const HIDE_EXACT_NAMES = ['Handle 3:1', 'Handle_31', 'Handle31'];

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function getModelNode(root: Object3D, ...names: string[]) {
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (node) return node;
  }
  return null;
}

function getAxisFromUserData(obj: Object3D, fallback: Vector3) {
  const raw = obj.userData.drxAxisLocal;
  if (!Array.isArray(raw) || raw.length !== 3 || !raw.every((v) => Number.isFinite(v))) {
    return fallback.clone();
  }
  const len = Math.hypot(raw[0], raw[1], raw[2]);
  if (len === 0) return fallback.clone();
  return new Vector3(raw[0] / len, raw[1] / len, raw[2] / len);
}

function removeSidePitch(axis: Vector3) {
  const aligned = new Vector3(0, axis.y, axis.z);
  if (aligned.lengthSq() < 1e-8) return axis.clone().normalize();
  aligned.normalize();
  return aligned.dot(axis) < 0 ? aligned.negate() : aligned;
}

function gapCoverQuaternion(axis: Vector3) {
  const rail = axis.clone().normalize();
  const width = new Vector3(1, 0, 0);
  const normal = new Vector3().crossVectors(rail, width).normalize();
  const matrix = new Matrix4().makeBasis(width, normal, rail);
  return new Quaternion().setFromRotationMatrix(matrix);
}

function expandBoxInLocal(box: Box3, root: Object3D, parent: Object3D) {
  const parentInverse = new Matrix4().copy(parent.matrixWorld).invert();
  const tempBox = new Box3();
  root.traverse((obj: Object3D) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    tempBox.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld).applyMatrix4(parentInverse);
    box.union(tempBox);
  });
}

export function DeviceModel() {
  const { scene } = useGLTF('/models/drx.glb');

  const axialRef = useRef<Object3D | null>(null);
  const lateralRef = useRef<Object3D | null>(null);
  const horizontalRef = useRef<Object3D | null>(null);

  const axialBasePosRef = useRef(new Vector3());
  const axialAxisRef = useRef(new Vector3(0, 0, 1));
  const lateralAxisRef = useRef(new Vector3(0, 1, 0));
  const horizontalAxisRef = useRef(new Vector3(1, 0, 0));
  const lateralBaseQuatRef = useRef(new Quaternion());
  const horizontalBaseQuatRef = useRef(new Quaternion());
  const lateralMotionQuatRef = useRef(new Quaternion());
  const horizontalMotionQuatRef = useRef(new Quaternion());
  const axialGapCoverRef = useRef<Mesh | null>(null);
  const axialGapCoverBaseRef = useRef(new Vector3());
  const axialGapCoverNormalRef = useRef(new Vector3(0, 1, 0));

  const strapMatsRef = useRef<MeshStandardMaterial[]>([]);

  useEffect(() => {
    axialRef.current = scene.getObjectByName('axial_slider') ?? null;
    lateralRef.current = scene.getObjectByName('lateral_pivot') ?? null;
    horizontalRef.current = scene.getObjectByName('horizontal_pivot') ?? null;

    if (!axialRef.current || !lateralRef.current || !horizontalRef.current) {
      console.warn(
        'DeviceModel: pivot groups not found. Expected axial_slider, lateral_pivot, horizontal_pivot',
      );
      return;
    }

    const rawAxialAxis = getAxisFromUserData(axialRef.current, new Vector3(0, 0, 1));
    const alignedAxialAxis = removeSidePitch(rawAxialAxis);
    const footAlignment = new Quaternion().setFromUnitVectors(rawAxialAxis, alignedAxialAxis);
    const footAlignmentApplied = Boolean(scene.userData.drxFootAlignmentApplied);

    axialBasePosRef.current.copy(axialRef.current.position);
    axialAxisRef.current.copy(alignedAxialAxis);
    lateralAxisRef.current.copy(getAxisFromUserData(lateralRef.current, new Vector3(0, 1, 0)));
    horizontalAxisRef.current.copy(getAxisFromUserData(horizontalRef.current, new Vector3(1, 0, 0)));
    lateralBaseQuatRef.current.copy(lateralRef.current.quaternion);
    horizontalBaseQuatRef.current.copy(horizontalRef.current.quaternion);

    const tractionTray = getModelNode(scene, 'Traction_tray1', 'Traction tray:1');
    const tractionBody = getModelNode(scene, 'Traction_body1', 'Traction body:1') ?? axialRef.current;
    if (!footAlignmentApplied) {
      tractionTray?.quaternion.premultiply(footAlignment);
      axialRef.current.quaternion.premultiply(footAlignment);
      scene.userData.drxFootAlignmentApplied = true;
    }

    const coverNormal = new Vector3(0, 1, 0)
      .projectOnPlane(alignedAxialAxis)
      .normalize();
    if (coverNormal.lengthSq() < 1e-8) coverNormal.set(0, 1, 0);
    axialGapCoverNormalRef.current.copy(coverNormal);
    axialGapCoverBaseRef.current
      .copy(axialBasePosRef.current)
      .addScaledVector(alignedAxialAxis, 0.045)
      .addScaledVector(coverNormal, 0.035);
    scene.updateMatrixWorld(true);
    const footBox = new Box3();
    expandBoxInLocal(footBox, tractionBody, lateralRef.current);
    if (tractionTray) expandBoxInLocal(footBox, tractionTray, lateralRef.current);
    if (!footBox.isEmpty()) {
      axialGapCoverBaseRef.current.x = (footBox.min.x + footBox.max.x) / 2;
    }

    let gapCover = lateralRef.current.getObjectByName('axial_gap_cover') as Mesh | null;
    if (!gapCover) {
      gapCover = new Mesh(
        new BoxGeometry(1, 1, 1),
        new MeshBasicMaterial({ color: '#050505' }),
      );
      gapCover.name = 'axial_gap_cover';
      gapCover.castShadow = true;
      gapCover.receiveShadow = true;
      lateralRef.current.add(gapCover);
    }
    gapCover.quaternion.copy(gapCoverQuaternion(alignedAxialAxis));
    axialGapCoverRef.current = gapCover;

    scene.traverse((obj: Object3D) => {
      if (
        HIDE_EXACT_NAMES.includes(obj.name) ||
        HIDE_NAME_PREFIXES.some((prefix) => obj.name.startsWith(prefix))
      ) {
        obj.visible = false;
      }
    });

    const mats: MeshStandardMaterial[] = [];
    tractionBody.traverse((obj: Object3D) => {
      const mesh = obj as Mesh;
      if (!mesh.isMesh) return;
      const src = mesh.material as MeshStandardMaterial;
      if (!src || !('emissive' in src)) return;
      const cloned = src.clone();
      cloned.emissive.setRGB(1, 0, 0);
      cloned.emissiveIntensity = 0;
      mesh.material = cloned;
      mats.push(cloned);
    });
    strapMatsRef.current = mats;
    if (mats.length === 0) {
      console.warn('DeviceModel: no traction-body meshes matched for glow effect');
    }
  }, [scene]);

  useFrame((state) => {
    const d = useAppStore.getState().device;
    if (axialRef.current) {
      const jerkDelta = d.pulsing
        ? Math.sin(state.clock.getElapsedTime() * 2 * Math.PI * PULSE_HZ) *
          PULSE_AXIAL_AMPLITUDE_IN *
          IN_TO_M
        : 0;
      const delta = d.axial.pos * IN_TO_M + jerkDelta;
      const base = axialBasePosRef.current;
      const axis = axialAxisRef.current;
      axialRef.current.position.copy(base).addScaledVector(axis, delta);

      if (axialGapCoverRef.current) {
        const coverLength = Math.max(0.18, Math.abs(delta) + 0.32);
        axialGapCoverRef.current.position
          .copy(axialGapCoverBaseRef.current)
          .addScaledVector(axis, delta / 2);
        axialGapCoverRef.current.scale.set(0.16, 0.08, coverLength);
      }
    }
    if (lateralRef.current) {
      const motion = lateralMotionQuatRef.current.setFromAxisAngle(
        lateralAxisRef.current,
        degToRad(patientLateralDegToCadDeg(d.lateral.pos)),
      );
      lateralRef.current.quaternion.copy(lateralBaseQuatRef.current).premultiply(motion);
    }
    if (horizontalRef.current) {
      // The horizontal UI value is the physical angle relative to parallel:
      // negative values lower the base extension, positive values lift it.
      const motion = horizontalMotionQuatRef.current.setFromAxisAngle(
        horizontalAxisRef.current,
        degToRad(-d.horizontal.pos),
      );
      horizontalRef.current.quaternion.copy(horizontalBaseQuatRef.current).premultiply(motion);
    }

    const pressureGlow = (d.pressure.lbs / PRESSURE_MAX_LBS) * GLOW_MAX_INTENSITY;
    const pulseT = d.pulsing
      ? 0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * 2 * Math.PI * PULSE_HZ)
      : 0;
    const intensity = pressureGlow + pulseT * PULSE_GLOW_AMPLITUDE;
    for (const mat of strapMatsRef.current) {
      mat.emissive.setRGB(1, pulseT * 0.85, pulseT * 0.45);
      mat.emissiveIntensity = intensity;
    }
  });

  return <primitive object={scene} />;
}

useGLTF.preload('/models/drx.glb');
