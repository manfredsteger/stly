
import * as THREE from 'three';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TransformationState {
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
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
  locked?: boolean;
  color: string;
  stats: MeshStats;
  originalParts?: SceneObject[];
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
  unit: 'mm' | 'in';
}

export interface AlignState {
  enabled: boolean;
  step: 'select_source' | 'select_target';
  source?: {
    objectId: string;
    point: Vector3;
    normal: Vector3;
  };
}

export interface BooleanState {
  enabled: boolean;
  operation: 'subtract' | 'intersect' | 'union';
  targetId: string | null;
  cutterId: string | null;
  preview: boolean;
}

export interface AppState {
  objects: SceneObject[];
  selectedIds: string[];
  selectedId: string | null;
  slice: SliceState;
  split: SplitState;
  extend: ExtendState;
  measure: MeasureState;
  align: AlignState;
  boolean: BooleanState;
  viewMode: 'wireframe' | 'solid' | 'points' | 'transparent';
  globalColor: string;
  aiAnalysis?: string;
  transformMode: 'translate' | 'rotate' | 'scale';
  snapToEdge: boolean;
}
