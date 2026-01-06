
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
  axis: 'x' | 'y' | 'z';
  singlePos: number; // For single plane mode
  start: number;     // For window mode
  end: number;       // For window mode
  showMiddle: boolean; // For window mode: show middle vs show ends
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

export interface AppState {
  isLoaded: boolean;
  fileName: string | null;
  transform: TransformationState;
  slice: SliceState;
  stats: MeshStats | null;
  viewMode: 'wireframe' | 'solid' | 'points';
  color: string;
  aiAnalysis?: string;
}
