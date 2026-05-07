import type { Vector3Tuple } from 'three';
import { Box, SquareArrowDown, SquareArrowRight, type LucideIcon } from 'lucide-react';

export type CameraPreset = {
  id: 'overhead' | 'side' | 'three-quarter';
  label: string;
  icon: LucideIcon;
  position: Vector3Tuple;
  target: Vector3Tuple;
};

const CAD_MODEL_TARGET: Vector3Tuple = [0.25, 0.55, -0.04];

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'three-quarter',
    label: '3/4 View',
    icon: Box,
    position: [CAD_MODEL_TARGET[0] + 2.2, 1.5, CAD_MODEL_TARGET[2] + 2.5],
    target: CAD_MODEL_TARGET,
  },
  {
    id: 'side',
    label: 'Side',
    icon: SquareArrowRight,
    position: [CAD_MODEL_TARGET[0] + 3.5, 0.8, CAD_MODEL_TARGET[2]],
    target: CAD_MODEL_TARGET,
  },
  {
    id: 'overhead',
    label: 'Overhead',
    icon: SquareArrowDown,
    position: [CAD_MODEL_TARGET[0], 4, CAD_MODEL_TARGET[2] + 0.01],
    target: CAD_MODEL_TARGET,
  },
];
