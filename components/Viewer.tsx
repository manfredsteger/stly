
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AppState } from '../types';

interface ViewerProps {
  state: AppState;
}

const Viewer: React.FC<ViewerProps> = ({ state }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const helperGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const prevObjectsCountRef = useRef(0);

  const fitCameraToScene = () => {
    if (!sceneRef.current || !cameraRef.current || !objectsGroupRef.current) return;
    
    const box = new THREE.Box3();
    let hasObjects = false;
    
    objectsGroupRef.current.children.forEach((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
        box.expandByObject(child);
        hasObjects = true;
      }
    });
    
    if (!hasObjects) {
      cameraRef.current.position.set(200, 200, 200);
      cameraRef.current.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
      return;
    }
    
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = cameraRef.current.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    
    cameraZ = Math.max(cameraZ * 1.5, 50); 
    
    cameraRef.current.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
    cameraRef.current.lookAt(center);
    
    if (controlsRef.current) {
      controlsRef.current.target.copy(center);
      controlsRef.current.update();
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 5000);
    camera.position.set(200, 200, 200);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    
    const cameraLight = new THREE.DirectionalLight(0xffffff, 0.8);
    scene.add(cameraLight);

    const sun = new THREE.DirectionalLight(0xffffff, 0.5);
    sun.position.set(200, 500, 200);
    scene.add(sun);

    scene.add(new THREE.GridHelper(1000, 50, 0x1e293b, 0x0f172a));

    const objGroup = new THREE.Group();
    scene.add(objGroup);
    objectsGroupRef.current = objGroup;

    const helperGroup = new THREE.Group();
    scene.add(helperGroup);
    helperGroupRef.current = helperGroup;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    
    resizeObserver.observe(container);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      cameraLight.position.copy(camera.position);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Synchronize Scene Objects
  useEffect(() => {
    if (!objectsGroupRef.current) return;
    
    // Clear existing meshes, but preserve geometries that are still present in state.objects
    const activeIds = new Set(state.objects.map(o => o.id));
    const childrenToProcess = [...objectsGroupRef.current.children];
    childrenToProcess.forEach(c => {
        if (c instanceof THREE.Mesh || c instanceof THREE.Points) {
            const objId = c.userData?.id;
            // Only dispose of geometry if the object is no longer part of our active objects
            if (objId && !activeIds.has(objId)) {
                c.geometry.dispose();
            }
            if (c.material) {
                if (Array.isArray(c.material)) {
                    c.material.forEach((m: THREE.Material) => m.dispose());
                } else {
                    (c.material as THREE.Material).dispose();
                }
            }
        } else if (c instanceof THREE.BoxHelper) {
            c.geometry?.dispose();
            if (c.material) {
                if (Array.isArray(c.material)) {
                    c.material.forEach((m: THREE.Material) => m.dispose());
                } else {
                    (c.material as THREE.Material).dispose();
                }
            }
        }
    });
    objectsGroupRef.current.clear();

    state.objects.forEach(obj => {
      if (!obj.visible) return;

      const isSelected = obj.id === state.selectedId;
      const clippingPlanes: THREE.Plane[] = [];
      let clipIntersection = false;

      // Only the selected object gets the active slice
      if (isSelected && state.slice.enabled) {
        const normal = new THREE.Vector3(0, 0, 1).applyEuler(
           new THREE.Euler(
               THREE.MathUtils.degToRad(state.slice.rotation.x),
               THREE.MathUtils.degToRad(state.slice.rotation.y),
               THREE.MathUtils.degToRad(state.slice.rotation.z)
           )
        );
        const pos = new THREE.Vector3(state.slice.position.x, state.slice.position.y, state.slice.position.z);

        if (state.slice.mode === 'single') {
            clippingPlanes.push(new THREE.Plane(normal.clone().negate(), normal.dot(pos)));
        } else {
            const halfSize = state.slice.windowSize / 2;
            const startPos = pos.clone().add(normal.clone().multiplyScalar(-halfSize));
            const endPos = pos.clone().add(normal.clone().multiplyScalar(halfSize));

            if (state.slice.showMiddle) {
                clippingPlanes.push(new THREE.Plane(normal.clone().negate(), normal.dot(endPos)));
                clippingPlanes.push(new THREE.Plane(normal.clone(), -normal.dot(startPos)));
                clipIntersection = false;
            } else {
                clippingPlanes.push(new THREE.Plane(normal.clone(), -normal.dot(startPos)));
                clippingPlanes.push(new THREE.Plane(normal.clone().negate(), normal.dot(endPos)));
                clipIntersection = true;
            }
        }
      }

      const matProps: any = {
        color: obj.color,
        side: THREE.DoubleSide,
        flatShading: true,
        clippingPlanes: clippingPlanes.length > 0 ? clippingPlanes : null,
        clipIntersection,
        transparent: true,
        opacity: isSelected ? 1 : 0.6
      };

      let visualObject: THREE.Object3D;
      if (state.viewMode === 'points') {
        const pointsMaterial = new THREE.PointsMaterial({ color: obj.color, size: 1.5 });
        visualObject = new THREE.Points(obj.geometry, pointsMaterial);
      } else {
        let material;
        if (state.viewMode === 'wireframe') {
          material = new THREE.MeshBasicMaterial({ ...matProps, wireframe: true });
        } else if (state.viewMode === 'transparent') {
          material = new THREE.MeshPhongMaterial({ ...matProps, shininess: 60, transparent: true, opacity: 0.3, depthWrite: false });
        } else {
          material = new THREE.MeshPhongMaterial({ ...matProps, shininess: 40 });
        }
        visualObject = new THREE.Mesh(obj.geometry, material);
      }

      visualObject.userData = { id: obj.id };
      visualObject.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
      visualObject.rotation.set(
        THREE.MathUtils.degToRad(obj.transform.rotation.x),
        THREE.MathUtils.degToRad(obj.transform.rotation.y),
        THREE.MathUtils.degToRad(obj.transform.rotation.z)
      );
      visualObject.scale.setScalar(obj.transform.scale);
      
      if (isSelected) {
          const box = new THREE.BoxHelper(visualObject, 0x3b82f6);
          objectsGroupRef.current?.add(box);
      }

      objectsGroupRef.current?.add(visualObject);
    });

    const currentCount = state.objects.length;
    const prevCount = prevObjectsCountRef.current;
    if (currentCount > prevCount) {
      setTimeout(() => {
        fitCameraToScene();
      }, 50);
    }
    prevObjectsCountRef.current = currentCount;
  }, [state.objects, state.selectedId, state.slice, state.viewMode]);

  // Slicing Helpers
  useEffect(() => {
    if (!helperGroupRef.current || !state.selectedId) {
        helperGroupRef.current?.clear();
        return;
    }
    
    helperGroupRef.current.clear();
    const selectedObj = state.objects.find(o => o.id === state.selectedId);
    if (!selectedObj) return;

    if (state.slice.enabled) {
        const size = 1000;
        const planeGeo = new THREE.PlaneGeometry(size, size);
        
        const addPlane = (pos: THREE.Vector3, color: number) => {
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false });
            const mesh = new THREE.Mesh(planeGeo, mat);
            mesh.position.copy(pos);
            mesh.rotation.set(
                THREE.MathUtils.degToRad(state.slice.rotation.x),
                THREE.MathUtils.degToRad(state.slice.rotation.y),
                THREE.MathUtils.degToRad(state.slice.rotation.z)
            );
            helperGroupRef.current?.add(mesh);
        };

        const normal = new THREE.Vector3(0, 0, 1).applyEuler(
           new THREE.Euler(
               THREE.MathUtils.degToRad(state.slice.rotation.x),
               THREE.MathUtils.degToRad(state.slice.rotation.y),
               THREE.MathUtils.degToRad(state.slice.rotation.z)
           )
        );
        const centerPos = new THREE.Vector3(state.slice.position.x, state.slice.position.y, state.slice.position.z);

        if (state.slice.mode === 'single') {
            addPlane(centerPos, 0x3b82f6);
        } else {
            const halfSize = state.slice.windowSize / 2;
            const startPos = centerPos.clone().add(normal.clone().multiplyScalar(-halfSize));
            const endPos = centerPos.clone().add(normal.clone().multiplyScalar(halfSize));
            addPlane(startPos, 0x3b82f6);
            addPlane(endPos, 0x6366f1);
        }
    }

    if (state.split.enabled) {
        const size = 1000;
        const planeGeo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
        
        const mesh = new THREE.Mesh(planeGeo, mat);
        mesh.position.set(state.split.position.x, state.split.position.y, state.split.position.z);
        mesh.rotation.set(
            THREE.MathUtils.degToRad(state.split.rotation.x),
            THREE.MathUtils.degToRad(state.split.rotation.y),
            THREE.MathUtils.degToRad(state.split.rotation.z)
        );
        helperGroupRef.current?.add(mesh);

        if (state.split.jointType === 'dovetail' || state.split.jointType === 'puzzle') {
           // Reuse the exact same geometry logic for preview, to perfectly match the CSG result shape.
           // However, the actual cut geometry has a huge solid box to evaluate CSG. 
           // For preview, we can just outline it using edges, or simply draw the cut surface.
           // Since drawing the full box looks like a huge block, maybe we recreate just the joint?
           // Actually, we can just use the CSG method but use a smaller size, OR let's build the joint curve only.
           const jointSize = 3000;
           const shape = new THREE.Shape();
           const hw = state.split.jointSize / 2;
           const d = state.split.jointDepth;
           shape.moveTo(-hw, 0);

           if (state.split.jointType === 'dovetail') {
               const slope = hw * 0.4;
               shape.lineTo(hw, 0);
               shape.lineTo(hw + slope, -d);
               shape.lineTo(-hw - slope, -d);
               shape.lineTo(-hw, 0);
           } else if (state.split.jointType === 'puzzle') {
               const R = state.split.jointSize / 2;
               const neckW = R / 2; 
               const intersectY = -d + Math.sqrt(R*R - neckW*neckW);
               
               shape.lineTo(neckW, 0);
               shape.lineTo(neckW, intersectY);
               const startAngle = Math.acos(neckW / R); 
               const endAngle = Math.PI - startAngle;
               
               shape.absarc(0, -d, R, startAngle, endAngle, true);
               shape.lineTo(-hw, 0);
           }
           
           shape.lineTo(-hw, 0); // close
           const extrudeSettings = { depth: jointSize, bevelEnabled: false };
           const jointGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
           jointGeo.translate(0, 0, -jointSize/2); 
           jointGeo.rotateX(Math.PI / 2);

           const m = new THREE.Mesh(jointGeo, mat);
           m.position.copy(mesh.position);
           m.rotation.copy(mesh.rotation);
           helperGroupRef.current?.add(m);
        }
        
        // Add a small normal axis to show cut direction
        const dir = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation);
        const arrow = new THREE.ArrowHelper(dir, mesh.position, 20, 0xa855f7, 5, 2);
        helperGroupRef.current?.add(arrow);
    }
    if (state.extend.enabled) {
        const size = 1000;
        const planeGeo = new THREE.PlaneGeometry(size, size);
        const mat = new THREE.MeshBasicMaterial({ color: 0xea580c, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
        
        // Original plane
        const meshStart = new THREE.Mesh(planeGeo, mat);
        meshStart.position.set(state.extend.position.x, state.extend.position.y, state.extend.position.z);
        meshStart.rotation.set(
            THREE.MathUtils.degToRad(state.extend.rotation.x),
            THREE.MathUtils.degToRad(state.extend.rotation.y),
            THREE.MathUtils.degToRad(state.extend.rotation.z)
        );
        helperGroupRef.current?.add(meshStart);

        // Extended plane
        const meshEnd = new THREE.Mesh(planeGeo, mat);
        const dir = new THREE.Vector3(0, 0, 1).applyEuler(meshStart.rotation);
        const endPos = meshStart.position.clone().add(dir.multiplyScalar(state.extend.amount));
        meshEnd.position.copy(endPos);
        meshEnd.rotation.copy(meshStart.rotation);
        helperGroupRef.current?.add(meshEnd);

        // Draw an arrow between them
        const arrowDir = new THREE.Vector3(0, 0, 1).applyEuler(meshStart.rotation);
        const arrow = new THREE.ArrowHelper(arrowDir, meshStart.position, state.extend.amount, 0xea580c, 5, 2);
        helperGroupRef.current?.add(arrow);
    }

  }, [state.slice, state.split, state.extend, state.selectedId, state.objects]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default Viewer;
