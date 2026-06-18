
import * as THREE from 'three';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TransformationState {
  position: Vector3;
  rotation: Vector3;
  scale: number;
}

export interface SliceState {
  enabled: boolean;
  mode: 'single' | 'window';
  position: Vector3;
  rotation: Vector3;
  windowSize: number;
  showMiddle: boolean;
}

export interface MeshStats {
  volume: number;
  surfaceArea: number;
  boundingBox: {
    min: Vector3;
    max: Vector3;
    size: Vector3;
  };
  triangleCount: number;
}

export interface SceneObject {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  transform: TransformationState;
  visible: boolean;
  color: string;
  stats: MeshStats;
}

export interface SplitState {
  enabled: boolean;
  position: Vector3;
  rotation: Vector3;
  jointType: 'flat' | 'dovetail' | 'puzzle';
  jointSize: number;
  jointDepth: number;
  clearance: number;
}

export interface ExtendState {
  enabled: boolean;
  position: Vector3;
  rotation: Vector3;
  amount: number;
}

export interface MeasureState {
  enabled: boolean;
  p1: Vector3 | null;
  p2: Vector3 | null;
}

export interface AppState {
  objects: SceneObject[];
  selectedId: string | null;
  slice: SliceState;
  split: SplitState;
  extend: ExtendState;
  measure: MeasureState;
  viewMode: 'wireframe' | 'solid' | 'points' | 'transparent';
  globalColor: string;
  aiAnalysis?: string;
}
