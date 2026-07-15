import * as THREE from 'three';
import { stlService } from './stlService';

describe('STLService', () => {
  it('should calculate stats correctly for a simple geometry', () => {
    // Create a simple tetrahedron buffer geometry
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      1, 1, 1,
      -1, -1, 1,
      -1, 1, -1,
      
      1, 1, 1,
      -1, 1, -1,
      1, -1, -1,
      
      1, 1, 1,
      1, -1, -1,
      -1, -1, 1,
      
      -1, -1, 1,
      1, -1, -1,
      -1, 1, -1
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    
    const stats = stlService.calculateStats(geometry);
    
    expect(stats.triangleCount).toBe(4);
    expect(stats.boundingBox).toBeDefined();
    // Bounding box size should be 2, 2, 2
    expect(stats.boundingBox.size.x).toBeCloseTo(2);
    expect(stats.boundingBox.size.y).toBeCloseTo(2);
    expect(stats.boundingBox.size.z).toBeCloseTo(2);
    expect(stats.volume).toBeGreaterThan(0);
  });

  it('should correctly clip geometry', () => {
    const geometry = new THREE.BoxGeometry(10, 10, 10);
    // Keep only the right half
    const clipped = stlService.clipGeometry(geometry, 'x', 0, 10);
    
    const stats = stlService.calculateStats(clipped);
    expect(stats.triangleCount).toBeGreaterThan(0);
    expect(stats.triangleCount).toBeLessThan(12); // Less than the full box faces
  });
});
