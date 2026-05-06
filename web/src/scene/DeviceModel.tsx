import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Box3, Vector3 } from 'three';
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
    const userData = scene.userData as {
      drxPivotDx?: number;
      drxAxialDx?: number;
      drxChairDx?: number;
    };

    // Undo previous run's shifts (if any) before recomputing. Order matters:
    // axial undo must come before pivot undo to mirror the apply order.
    if (userData.drxAxialDx !== undefined) {
      axialRef.current.position.x -= userData.drxAxialDx;
    }
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

    // (a) align lateral_pivot.x with the tray's origin. axial_slider.x
    // compensates so the tray's world X stays put.
    const pivotAlignDx = trayWorldX - lateralWorldX;
    lateralRef.current.position.x += pivotAlignDx;
    axialRef.current.position.x -= pivotAlignDx;
    userData.drxPivotDx = pivotAlignDx;

    // (a2) Center the visible foot piece on the rod axis. The GLB has the
    // tray + traction body geometry offset ~9cm from axial_slider's origin,
    // so the rod axis (lateral_pivot.x) sits to one side of the visible
    // foot platform. Shifting axial_slider.x by the bbox offset moves the
    // visible rod+tray onto the rod axis. (The shift is in lateral_pivot's
    // local frame — when lateral rotates, the foot piece swings symmetrically
    // around lateral_pivot just like before; the rest pose just lands on
    // the centerline.)
    scene.updateMatrixWorld(true);
    const axialMeshBox = new Box3();
    const axialTempBox = new Box3();
    const expandAxial = (obj: Object3D) => {
      if (!obj.visible) return;
      const m = obj as Mesh;
      if (m.isMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        axialTempBox.copy(m.geometry.boundingBox!);
        m.updateWorldMatrix(true, false);
        axialTempBox.applyMatrix4(m.matrixWorld);
        axialMeshBox.union(axialTempBox);
      }
      for (const c of obj.children) expandAxial(c);
    };
    expandAxial(axialRef.current);
    if (!axialMeshBox.isEmpty()) {
      const axialMidX = (axialMeshBox.min.x + axialMeshBox.max.x) / 2;
      const lateralWorldXNow = new Vector3().setFromMatrixPosition(
        lateralRef.current.matrixWorld,
      ).x;
      const axialDx = lateralWorldXNow - axialMidX;
      axialRef.current.position.x += axialDx;
      userData.drxAxialDx = axialDx;
    }

    // (b) Center the chair on the boom using the visible cradle bbox.
    // Chair_Frame1 has a 180° Y rotation that flips its children's X
    // direction — using cradle origins as the midline doesn't account for
    // the geometry's asymmetric extension, so the visible chair appears
    // off-center even when origins are aligned. Computing the bounding box
    // of the cradle GEOMETRIES (Bent_leg children of Chair_Frame1) gives
    // the true visual midline. Filter to direct children to avoid the
    // nested mesh-named 'Bent_leg_21' collision inside Bent_leg1.
    const chairFrame = scene.getObjectByName('Chair_Frame1');
    const chairMesh = scene.getObjectByName('Chair1');
    if (chairFrame) {
      const cradleBox = new Box3();
      const tempBox = new Box3();
      const expandByVisibleMesh = (obj: Object3D) => {
        if (!obj.visible) return;
        const m = obj as Mesh;
        if (m.isMesh && m.geometry) {
          if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
          tempBox.copy(m.geometry.boundingBox!);
          m.updateWorldMatrix(true, false);
          tempBox.applyMatrix4(m.matrixWorld);
          cradleBox.union(tempBox);
        }
        for (const c of obj.children) expandByVisibleMesh(c);
      };
      for (const child of chairFrame.children) {
        if (child.name.startsWith('Bent_leg')) expandByVisibleMesh(child);
      }
      if (!cradleBox.isEmpty()) {
        const cradleMidX = (cradleBox.min.x + cradleBox.max.x) / 2;
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

    // (c) Center the visible device on the world origin in X/Z so the
    // OrbitControls target (which CameraRig sets to (0, 0.6, 0)) actually
    // points at the model. Without this, the device sits ~0.4m off-axis
    // from origin and reads as offset on phone-portrait viewports.
    // Reset scene.position before computing the bbox so re-mounts on a
    // cached scene don't compute a bbox that's already centered.
    scene.position.x = 0;
    scene.position.z = 0;
    scene.updateMatrixWorld(true);
    const finalBox = new Box3();
    const finalTemp = new Box3();
    const expandFinal = (obj: Object3D) => {
      if (!obj.visible) return;
      const m = obj as Mesh;
      if (m.isMesh && m.geometry) {
        if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
        finalTemp.copy(m.geometry.boundingBox!);
        m.updateWorldMatrix(true, false);
        finalTemp.applyMatrix4(m.matrixWorld);
        finalBox.union(finalTemp);
      }
      for (const c of obj.children) expandFinal(c);
    };
    expandFinal(scene);
    if (!finalBox.isEmpty()) {
      const cx = (finalBox.min.x + finalBox.max.x) / 2;
      const cz = (finalBox.min.z + finalBox.max.z) / 2;
      scene.position.x = -cx;
      scene.position.z = -cz;
    }

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
