import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import { Color, type Mesh, type MeshStandardMaterial, type Object3D } from 'three';

type ApplyMat = (mat: MeshStandardMaterial, isBlue: boolean, isBlack: boolean) => void;
type Variant = { label: string; apply: ApplyMat };

const isBlueColor = (c: Color) => c.b > c.r * 1.6 && c.b > c.g * 1.6 && c.b > 0.15;
const isBlackColor = (c: Color) => c.r < 0.07 && c.g < 0.07 && c.b < 0.07;

function getModelNode(root: Object3D, ...names: string[]) {
  for (const name of names) {
    const node = root.getObjectByName(name);
    if (node) return node;
  }
  return null;
}

const VARIANTS: Variant[] = [
  { label: '1. Original', apply: () => {} },
  {
    label: '2. Saturated',
    apply: (mat, isBlue, isBlack) => {
      if (isBlue) mat.color.set('#1a3eff');
      if (isBlack) mat.color.set('#050505');
    },
  },
  {
    label: '3. Muted',
    apply: (mat, isBlue, isBlack) => {
      if (isBlue) mat.color.set('#3958a3');
      if (isBlack) mat.color.set('#2a2a2a');
    },
  },
  {
    label: '4. All Black',
    apply: (mat) => {
      mat.color.set('#181818');
    },
  },
  {
    label: '5. All Blue',
    apply: (mat) => {
      mat.color.set('#1a3eff');
    },
  },
  {
    label: '6. Red & Black',
    apply: (mat, isBlue, isBlack) => {
      if (isBlue) mat.color.set('#c8181c');
      if (isBlack) mat.color.set('#0a0a0a');
    },
  },
  {
    label: '7. Matte Fabric',
    apply: (mat) => {
      mat.metalness = 0;
      mat.roughness = 0.95;
    },
  },
  {
    label: '8. Leather',
    apply: (mat) => {
      mat.metalness = 0.1;
      mat.roughness = 0.42;
    },
  },
  {
    label: '9. Plastic',
    apply: (mat) => {
      mat.metalness = 0;
      mat.roughness = 0.55;
    },
  },
  {
    label: '10. Emissive Blue',
    apply: (mat, isBlue) => {
      if (isBlue) {
        mat.emissive.set('#1a3eff');
        mat.emissiveIntensity = 0.5;
      }
    },
  },
];

const CHAIR_SPACING_M = 0.9;

export function ChairVariants() {
  const { scene } = useGLTF('/models/drx.glb');

  const chairs = useMemo(() => {
    const original = getModelNode(scene, 'Chair1', 'Chair:1');
    if (!original) return [];
    const total = VARIANTS.length;
    const startX = -((total - 1) * CHAIR_SPACING_M) / 2;

    return VARIANTS.map((variant, i) => {
      const clone = original.clone(true);
      clone.position.set(startX + i * CHAIR_SPACING_M, 0, 0);
      clone.rotation.set(0, 0, 0);

      clone.traverse((obj: Object3D) => {
        const mesh = obj as Mesh;
        if (!mesh.isMesh) return;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const cloned = materials.map((m) => {
          if (!m) return m;
          const c = (m as MeshStandardMaterial).clone();
          const blue = isBlueColor(c.color);
          const black = isBlackColor(c.color);
          variant.apply(c, blue, black);
          c.needsUpdate = true;
          return c;
        });
        mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]!;
      });

      return clone;
    });
  }, [scene]);

  return (
    <>
      {chairs.map((chair, i) => (
        <primitive key={i} object={chair} />
      ))}
    </>
  );
}

useGLTF.preload('/models/drx.glb');
