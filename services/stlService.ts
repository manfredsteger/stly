
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter';
import { MeshStats, Vector3 } from '../types';
import { GoogleGenAI } from "@google/genai";

export class STLService {
  private loader: STLLoader;
  private exporter: STLExporter;

  constructor() {
    this.loader = new STLLoader();
    this.exporter = new STLExporter();
  }

  async loadFromBuffer(buffer: ArrayBuffer): Promise<THREE.BufferGeometry> {
    return this.loader.parse(buffer);
  }

  exportMesh(mesh: THREE.Mesh): Blob {
    const result = this.exporter.parse(mesh, { binary: true });
    return new Blob([result], { type: 'application/octet-stream' });
  }

  async analyzeWithAI(stats: MeshStats): Promise<string> {
    // Initializing with named parameter and direct process.env.API_KEY as per guidelines
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Analyze this 3D model (STL) based on its stats for 3D printing:
      - Triangle Count: ${stats.triangleCount}
      - Volume: ${stats.volume.toFixed(2)} mm³
      - Dimensions: ${stats.boundingBox.size.x.toFixed(1)} x ${stats.boundingBox.size.y.toFixed(1)} x ${stats.boundingBox.size.z.toFixed(1)} mm
      Give a short professional assessment (max 3 sentences) in German about printability and if it should be split.`;
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      // Correctly accessing .text property (not a method) from GenerateContentResponse
      return response.text || "Analyse fehlgeschlagen.";
    } catch (e) {
      console.error("Gemini AI error:", e);
      return "KI Analyse derzeit nicht verfügbar.";
    }
  }

  calculateStats(geometry: THREE.BufferGeometry): MeshStats {
    if (!geometry.index && geometry.attributes.position.count === 0) {
        return this.getEmptyStats();
    }

    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);

    let volume = 0;
    let surfaceArea = 0;

    const pos = geometry.attributes.position;
    const faces = pos.count / 3;

    for (let i = 0; i < faces; i++) {
      const v1 = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 0);
      const v2 = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(pos, i * 3 + 2);

      volume += v1.dot(v2.cross(v3)) / 6.0;

      const edge1 = new THREE.Vector3().subVectors(v2, v1);
      const edge2 = new THREE.Vector3().subVectors(v3, v1);
      surfaceArea += edge1.cross(edge2).length() / 2.0;
    }

    return {
      volume: Math.abs(volume),
      surfaceArea: surfaceArea,
      triangleCount: faces,
      boundingBox: {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z },
        size: { x: size.x, y: size.y, z: size.z }
      }
    };
  }

  private getEmptyStats(): MeshStats {
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
}

export const stlService = new STLService();
