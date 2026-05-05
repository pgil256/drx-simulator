import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3 } from 'three';
import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
import { useAppStore } from '../store/useAppStore';

const PRESSURE_MAX_LBS = 80;
const GLOW_MAX_INTENSITY = 0.8;
const PULSE_HZ = 1.5;
const PULSE_GLOW_AMPLITUDE = 2.0;

// Rest-pose calibration: the GLB authors the leg tilted up from horizontal.
// This offset makes horizontal.pos = -15 (the initial store value) render parallel to the ground.
const HORIZONTAL_REST_CALIBRATION_DEG = 15;

const IN_TO_M = 0.0254;

function degToRad(deg: number) {
  return (deg * Math.PI) / 180;
}

export function DeviceModel() {
  const { scene } = useGLTF('/models/drx.glb');

  const axialRef = useRef<Object3D | null>(null);
  const lateralRef = useRef<Object3D | null>(null);
  const horizontalRef = useRef<Object3D | null>(null);

  const axialBaseZRef = useRef(0);
  const lateralBaseYRef = useRef(0);
  const horizontalBaseXRef = useRef(0);

  const strapMatsRef = useRef<MeshStandardMaterial[]>([]);
  const alignmentAppliedRef = useRef(false);

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

    // The GLB authors the chair frame and the actuator boom on different
    // X axes. Real device photos show the chair, boom, and tray aligned
    // on one axis, so we (a) shift lateral_pivot's rotation axis onto the
    // tray, and (b) shift the chair (frame + upholstered seat together)
    // so the cradle midline lands on the boom.
    //
    // Stored on scene.userData so HMR / Strict-Mode re-mounts revert and
    // re-apply rather than stacking shifts on a cached scene.
    scene.updateMatrixWorld(true);
    const trayBeforePivot = scene.getObjectByName('Traction_tray1') ?? axialRef.current;
    const userData = scene.userData as { drxPivotDx?: number; drxChairDx?: number };

    // Undo previous run's shifts (if any) before recomputing.
    if (userData.drxPivotDx !== undefined) {
      lateralRef.current.position.x -= userData.drxPivotDx;
      axialRef.current.position.x += userData.drxPivotDx;
    }
    if (userData.drxChairDx !== undefined) {
      const prevFrame = scene.getObjectByName('Chair_Frame1');
      const prevSeat = scene.getObjectByName('Chair1');
      if (prevFrame) prevFrame.position.x -= userData.drxChairDx;
      if (prevSeat) prevSeat.position.x -= userData.drxChairDx;
    }
    scene.updateMatrixWorld(true);

    const trayWorldX = new Vector3().setFromMatrixPosition(trayBeforePivot.matrixWorld).x;
    const lateralWorldX = new Vector3().setFromMatrixPosition(lateralRef.current.matrixWorld).x;
    const horizontalWorldX = new Vector3().setFromMatrixPosition(horizontalRef.current.matrixWorld).x;

    // (a) align lateral_pivot.x with the tray. axial_slider.x compensates
    // so the tray's world X stays put.
    const pivotAlignDx = trayWorldX - lateralWorldX;
    lateralRef.current.position.x += pivotAlignDx;
    axialRef.current.position.x -= pivotAlignDx;
    userData.drxPivotDx = pivotAlignDx;

    // (b) Center the chair on the boom using the cradle midline. The
    // Bent_leg / Bent_leg_2 groups are the visually prominent leg cradles;
    // their midpoint is the user-perceived chair center. Filter to
    // Chair_Frame1's direct children to avoid the nested mesh-named
    // 'Bent_leg_21' collision inside Bent_leg1.
    const chairFrame = scene.getObjectByName('Chair_Frame1');
    const chairMesh = scene.getObjectByName('Chair1');
    if (chairFrame) {
      const tmp = new Vector3();
      const cradleXs: number[] = [];
      for (const child of chairFrame.children) {
        if (!child.name.startsWith('Bent_leg')) continue;
        child.updateWorldMatrix(true, false);
        tmp.setFromMatrixPosition(child.matrixWorld);
        cradleXs.push(tmp.x);
      }
      if (cradleXs.length >= 2) {
        const cradleMidX = (Math.min(...cradleXs) + Math.max(...cradleXs)) / 2;
        const chairDx = horizontalWorldX - cradleMidX;
        chairFrame.position.x += chairDx;
        if (chairMesh) chairMesh.position.x += chairDx;
        userData.drxChairDx = chairDx;
      }
    }

    // Hide utility hardware that clutters the silhouette but isn't part of
    // the visible chair / boom / tray assembly. The CAD source includes
    // every fastener and caster wheel — leaving them visible spreads the
    // bounding box (so <Bounds> zooms out) and reads as floating debris
    // from overhead. The reference CAD render hides these too. Idempotent —
    // setting visible=false multiple times is fine.
    const HIDE_NAME_PREFIXES = [
      'Caster_wheel',
      'Handle_1',
      'Handle_2',
      'Handle_3',
      'Handle_bushing',
      'Hex_Cap_Screw',
      'Circular_Washer',
      'Prevailing_Torque',
      'Base_housing',
      'Electrical_box',
    ];
    scene.traverse((obj: Object3D) => {
      if (HIDE_NAME_PREFIXES.some((p) => obj.name.startsWith(p))) {
        obj.visible = false;
      }
    });
    alignmentAppliedRef.current = true;

    axialBaseZRef.current = axialRef.current.position.z;
    lateralBaseYRef.current = lateralRef.current.rotation.y;
    horizontalBaseXRef.current = horizontalRef.current.rotation.x;

    // Pulse-glow effect: tint every mesh inside the foot tray (the moving
    // piece where the cuff would press the patient's foot). Using the tray
    // makes the glow visually align with where pressure is applied. The
    // chair-frame "Bent_leg" pieces are static structural cradles and are
    // intentionally not part of the glow.
    const tray = scene.getObjectByName('Traction_tray1') ?? axialRef.current;
    const mats: MeshStandardMaterial[] = [];
    tray.traverse((obj: Object3D) => {
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
      console.warn('DeviceModel: no tray meshes matched for glow effect');
    }
  }, [scene]);

  useFrame((state) => {
    const d = useAppStore.getState().device;
    if (axialRef.current) {
      axialRef.current.position.z = axialBaseZRef.current + d.axial.pos * IN_TO_M;
    }
    if (lateralRef.current) {
      lateralRef.current.rotation.y = lateralBaseYRef.current + degToRad(d.lateral.pos);
    }
    if (horizontalRef.current) {
      horizontalRef.current.rotation.x =
        horizontalBaseXRef.current + degToRad(d.horizontal.pos + HORIZONTAL_REST_CALIBRATION_DEG);
    }

    const pressureGlow = (d.pressure.lbs / PRESSURE_MAX_LBS) * GLOW_MAX_INTENSITY;
    const pulseT = d.pulsing
      ? 0.5 + 0.5 * Math.sin(state.clock.getElapsedTime() * 2 * Math.PI * PULSE_HZ)
      : 0;
    const intensity = pressureGlow + pulseT * PULSE_GLOW_AMPLITUDE;
    for (const mat of strapMatsRef.current) {
      // Shift emissive toward yellow-white at pulse peaks so pulses look
      // visually distinct from a steady pressure glow.
      mat.emissive.setRGB(1, pulseT * 0.85, pulseT * 0.45);
      mat.emissiveIntensity = intensity;
    }
  });

  return <primitive object={scene} />;
}

useGLTF.preload('/models/drx.glb');
