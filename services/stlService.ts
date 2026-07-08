
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { MeshStats, SceneObject } from '../types';

export class STLService {
  private loader: STLLoader;
  private exporter: STLExporter;
  private objExporter: OBJExporter;
  private gltfExporter: GLTFExporter;

  constructor() {
    this.loader = new STLLoader();
    this.exporter = new STLExporter();
    this.objExporter = new OBJExporter();
    this.gltfExporter = new GLTFExporter();
  }

  async loadFromBuffer(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
    const geo = this.loader.parse(buffer);
    const pos = geo.attributes.position;
    if (pos) {
      let hasNaN = false;
      for (let i = 0; i < pos.count * pos.itemSize; i++) {
        if (isNaN(pos.array[i]) || !isFinite(pos.array[i])) {
          pos.array[i] = 0;
          hasNaN = true;
        }
      }
      if (hasNaN) {
        console.warn("STL loader: Replaced NaN/Infinite values with 0 in position attribute.");
      }
    }
    return geo;
  }

  async exportCombined(objects: SceneObject[], format: 'stl' | 'obj' | 'gltf' = 'stl'): Promise<Blob> {
    const group = new THREE.Group();
    
    objects.forEach(obj => {
      if (!obj.visible) return;
      const mesh = new THREE.Mesh(obj.geometry.clone());
      mesh.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
      mesh.rotation.set(
        THREE.MathUtils.degToRad(obj.transform.rotation.x),
        THREE.MathUtils.degToRad(obj.transform.rotation.y),
        THREE.MathUtils.degToRad(obj.transform.rotation.z)
      );
      mesh.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
      mesh.updateMatrixWorld();
      group.add(mesh);
    });

    if (format === 'obj') {
      const result = this.objExporter.parse(group);
      return new Blob([result], { type: 'text/plain' });
    }

    if (format === 'gltf') {
      return new Promise((resolve, reject) => {
        this.gltfExporter.parse(
          group,
          (gltf) => {
            const blob = new Blob([gltf as ArrayBuffer], { type: 'model/gltf-binary' });
            resolve(blob);
          },
          (error) => {
            reject(error);
          },
          { binary: true } // Export as GLB
        );
      });
    }

    // Default to STL
    const result = this.exporter.parse(group, { binary: true });
    return new Blob([result], { type: 'application/octet-stream' });
  }

  exportObjectToBase64(geometry: THREE.BufferGeometry): string {
    const mesh = new THREE.Mesh(geometry);
    const result = this.exporter.parse(mesh, { binary: true }) as DataView;
    const buffer = result.buffer;
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToBuffer(base64: string): ArrayBuffer {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Clips geometry on CPU for "Baking" parts to the scene
  clipGeometry(geometry: THREE.BufferGeometry, axis: 'x' | 'y' | 'z', start: number, end: number): THREE.BufferGeometry {
    let geo = geometry;
    if (geo.index) {
      geo = geo.toNonIndexed();
    }
    // For a real production app we would use CSG. 
    // Here we perform a simple vertex filtering to create the 'Baked' part.
    const posAttr = geo.attributes.position;
    const newPositions: number[] = [];
    
    for (let i = 0; i < posAttr.count; i += 3) {
      const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(posAttr, i + 2);
      
      const val1 = v1[axis];
      const val2 = v2[axis];
      const val3 = v3[axis];

      // Simple heuristic: If center of triangle is in window, keep it
      const avg = (val1 + val2 + val3) / 3;
      if (avg >= start && avg <= end) {
        newPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
      }
    }

    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    if (newPositions.length === 0) {
      newGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
      newGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
    } else {
      newGeo.computeVertexNormals();
    }
    return newGeo;
  }

  async analyzeWithAI(stats: MeshStats): Promise<string> {
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stats })
      });
      if (!response.ok) {
        throw new Error('API request failed');
      }
      const data = await response.json();
      return data.analysis || "Keine Analyse möglich.";
    } catch (e) {
      console.error(e);
      return "KI Analyse fehlgeschlagen.";
    }
  }

  calculateStats(geometry: THREE.BufferGeometry): MeshStats {
    if (!geometry || !geometry.attributes || !geometry.attributes.position || geometry.attributes.position.count === 0) {
      return {
        volume: 0,
        surfaceArea: 0,
        triangleCount: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
          size: { x: 0, y: 0, z: 0 }
        }
      };
    }

    let geo = geometry;
    if (geo.index) {
      geo = geo.toNonIndexed();
    }
    geo.computeBoundingBox();
    const box = geo.boundingBox || new THREE.Box3();
    const size = new THREE.Vector3();
    box.getSize(size);

    const pos = geo.attributes.position;
    if (!pos) {
      return {
        volume: 0,
        surfaceArea: 0,
        triangleCount: 0,
        boundingBox: {
          min: { x: 0, y: 0, z: 0 },
          max: { x: 0, y: 0, z: 0 },
          size: { x: 0, y: 0, z: 0 }
        }
      };
    }
    const faces = pos.count / 3;
    let volume = 0;

    const v1 = new THREE.Vector3();
    const v2 = new THREE.Vector3();
    const v3 = new THREE.Vector3();

    for (let i = 0; i < faces; i++) {
      v1.fromBufferAttribute(pos, i * 3 + 0);
      v2.fromBufferAttribute(pos, i * 3 + 1);
      v3.fromBufferAttribute(pos, i * 3 + 2);
      volume += v1.dot(v2.cross(v3)) / 6.0;
    }

    return {
      volume: Math.abs(volume),
      surfaceArea: 0,
      triangleCount: faces,
      boundingBox: {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        size: { x: size.x, y: size.y, z: size.z }
      }
    };
  }
}

export const stlService = new STLService();
