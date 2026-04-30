import type { Vector3Tuple } from 'three';
import { Box, SquareArrowDown, SquareArrowRight, type LucideIcon } from 'lucide-react';

export type CameraPreset = {
  id: 'overhead' | 'side' | 'three-quarter';
  label: string;
  icon: LucideIcon;
  position: Vector3Tuple;
  target: Vector3Tuple;
};

export const CAMERA_PRESETS: CameraPreset[] = [
  { id: 'three-quarter', label: '3/4 View', icon: Box,              position: [2.2, 1.5, 2.5], target: [0, 0.6, 0] },
  { id: 'side',          label: 'Side',     icon: SquareArrowRight, position: [3.5, 0.8, 0],   target: [0, 0.6, 0] },
  { id: 'overhead',      label: 'Overhead', icon: SquareArrowDown,  position: [0, 4, 0.01],    target: [0, 0, 0] },
];
