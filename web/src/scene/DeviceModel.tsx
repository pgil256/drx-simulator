import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { Mesh, MeshStandardMaterial, Object3D } from 'three';
import { useAppStore } from '../store/useAppStore';

// Names as exported by the STEP→GLB pipeline (underscores replace the
// original CAD-part spaces/colons). The two "Bent leg" groups are the
// patient-leg supports that should follow the actuators.
const LEG_NODE_NAMES = new Set(['Bent_leg1', 'Bent_leg_21']);
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

    axialBaseZRef.current = axialRef.current.position.z;
    lateralBaseYRef.current = lateralRef.current.rotation.y;
    horizontalBaseXRef.current = horizontalRef.current.rotation.x;

    // The raw GLB authors the patient-leg supports as children of
    // Chair_Frame1 (siblings of the chair frame proper), so without
    // intervention they stay static while the actuator boom and foot
    // tray move — the leg pieces look detached. Reparent them under
    // axial_slider so they tilt with horizontal, swing with lateral,
    // and translate with axial. attach() preserves world position, so
    // the legs stay where the GLB drew them at rest.
    //
    // Filter by parent name because the GLB has a name collision:
    // Bent_leg_21 is BOTH the top-level leg group AND one of the
    // ~35 individual mesh chunks inside Bent_leg1.
    scene.updateMatrixWorld(true);
    // Match either the still-static state (parent: Chair_Frame1) or the
    // already-reparented state (parent: axial_slider) so the effect is
    // idempotent under Strict-Mode double-invoke and HMR re-runs.
    const legs: Object3D[] = [];
    scene.traverse((obj) => {
      if (
        LEG_NODE_NAMES.has(obj.name) &&
        (obj.parent?.name === 'Chair_Frame1' || obj.parent === axialRef.current)
      ) {
        legs.push(obj);
      }
    });
    for (const leg of legs) {
      if (leg.parent !== axialRef.current) axialRef.current.attach(leg);
    }
    if (legs.length === 0) {
      console.warn('DeviceModel: no leg meshes found to reparent');
    }

    // Pulse-glow effect: tint every mesh inside the patient-leg groups.
    // Each Bent_leg_* group exports as ~35 individual meshes named
    // "Bent_leg", "Bent_leg_1", ..., so we walk the reparented groups
    // and clone every descendant mesh's material.
    const mats: MeshStandardMaterial[] = [];
    for (const leg of legs) {
      leg.traverse((obj: Object3D) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const src = mesh.material as MeshStandardMaterial;
        const cloned = src.clone();
        cloned.emissive.setRGB(1, 0, 0);
        cloned.emissiveIntensity = 0;
        mesh.material = cloned;
        mats.push(cloned);
      });
    }
    strapMatsRef.current = mats;
    if (mats.length === 0) {
      console.warn('DeviceModel: no strap meshes matched for glow effect');
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
