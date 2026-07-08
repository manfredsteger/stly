import * as THREE from 'three';
import { csgService } from './csgService';
import { SceneObject } from '../types';

describe('CSGService', () => {
  const defaultMeshStats = { volume: 0, surfaceArea: 0, triangleCount: 0, boundingBox: { min: {x:0, y:0, z:0}, max: {x:0, y:0, z:0}, size: {x:0, y:0, z:0} } };

  it('should split geometry into pieces successfully', async () => {
    // Generate a simple box
    const boxGeo = new THREE.BoxGeometry(10, 10, 10);
    const sliceState = { mode: 'single' as const, cutPosition: 0, cutPlane: 'z' as const, slices: 2 };
    
    // We mock scene objects
    const obj: SceneObject = {
      id: 'obj-1',
      name: 'Test Box',
      geometry: boxGeo,
      visible: true,
      color: '#ffffff',
      stats: defaultMeshStats,
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
    };
    
    const splitArgs = {
        enabled: true,
        jointSize: 20,
        jointDepth: 10,
        clearance: 0.1,
        jointType: 'flat' as const,
        position: {x: 0, y: 0, z: 0},
        rotation: {x: 0, y: 0, z: 0}
    };

    const newGeometries = csgService.performSplit(obj, splitArgs);
    expect(newGeometries).toBeDefined();
    expect(newGeometries?.partA).toBeDefined();
    expect(newGeometries?.partB).toBeDefined();
  });

  it('should merge two geometries', async () => {
    const box1 = new THREE.BoxGeometry(10, 10, 10);
    const box2 = new THREE.BoxGeometry(5, 5, 5);

    const baseObj: SceneObject = {
      id: 'obj-1',
      name: 'Base Box',
      geometry: box1,
      visible: true,
      color: '#ffffff',
      stats: defaultMeshStats,
      transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
    };
    const addObj: SceneObject = {
      id: 'obj-2',
      name: 'Add Box',
      geometry: box2,
      visible: true,
      color: '#ffffff',
      stats: defaultMeshStats,
      transform: { position: { x: 10, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }
    };

    const resultGeo = csgService.mergeObjects([baseObj, addObj]);
    expect(resultGeo).toBeDefined();
  });
});

