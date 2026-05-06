import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls } from '@react-three/drei';
import { Suspense, useEffect, useRef } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { DeviceModel } from './DeviceModel';
import { CAMERA_PRESETS } from './cameraPresets';
import { useAppStore } from '../store/useAppStore';

function CameraRig({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const { camera } = useThree();
  const presetId = useAppStore((s) => s.ui.cameraPreset);
  const hasAppliedRef = useRef(false);

  useEffect(() => {
    // Skip first mount — let <Bounds> do the initial framing.
    if (!hasAppliedRef.current) {
      hasAppliedRef.current = true;
      return;
    }
    const p = CAMERA_PRESETS.find((x) => x.id === presetId) ?? CAMERA_PRESETS[0];
    camera.position.set(...p.position);
    const controls = controlsRef.current;
    if (controls) {
      controls.target.set(...p.target);
      controls.update();
    } else {
      camera.lookAt(...p.target);
    }
  }, [presetId, camera, controlsRef]);

  return null;
}

export function Scene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <Canvas
      className="h-full w-full"
      camera={{ position: [2, 1.5, 2.5], fov: 45 }}
      shadows
      style={{ background: '#ffffff' }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 3]} intensity={0.9} castShadow color="#ffffff" />
        <directionalLight position={[-3, 4, -2]} intensity={0.4} color="#ffffff" />
        <Bounds fit clip observe margin={1.2}>
          <DeviceModel />
        </Bounds>
        <CameraRig controlsRef={controlsRef} />
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.08} />
      </Suspense>
    </Canvas>
  );
}
