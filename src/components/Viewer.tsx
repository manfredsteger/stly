
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { AppState, SceneObject } from '../types';
import { findConnectedEdgeSegments, getClosestVertexOnSegment } from '../services/edgeDetectionService';

interface ViewerProps {
  state: AppState;
  onMeasureClick?: (point: THREE.Vector3) => void;
  onAlignClick?: (objectId: string, point: THREE.Vector3, normal: THREE.Vector3) => void;
  onUpdateObject?: (id: string, updates: Partial<SceneObject>) => void;
  onUpdateObjects?: (updatesList: {id: string, updates: Partial<SceneObject>}[]) => void;
  onSaveHistory?: () => void;
  onClickObject?: (id: string | null, multiSelect: boolean) => void;
  onContextMenu?: (objectId: string, x: number, y: number) => void;
}

const Viewer: React.FC<ViewerProps> = ({ state, onMeasureClick, onAlignClick, onUpdateObject, onUpdateObjects, onSaveHistory, onClickObject, onContextMenu }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const objectsGroupRef = useRef<THREE.Group | null>(null);
  const helperGroupRef = useRef<THREE.Group | null>(null);
  const measureGroupRef = useRef<THREE.Group | null>(null);
  const multiSelectGroupRef = useRef<THREE.Group | null>(null);
  const alignGroupRef = useRef<THREE.Group | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const prevObjectsCountRef = useRef(0);
  const callbackRefs = useRef({ state, onUpdateObject, onUpdateObjects, onSaveHistory, onMeasureClick, onAlignClick, onClickObject, onContextMenu });
  const animationRef = useRef(state.animation);
  const snapTargetRef = useRef<THREE.Vector3 | null>(null);
  const snapMarkerRef = useRef<THREE.Mesh | null>(null);
  const edgeHighlightRef = useRef<THREE.LineSegments | null>(null);
  const measureHoverRef = useRef<THREE.Mesh | null>(null);
  const measureHoverPointRef = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    callbackRefs.current = { state, onUpdateObject, onUpdateObjects, onSaveHistory, onMeasureClick, onAlignClick, onClickObject, onContextMenu };
    animationRef.current = state.animation;
  }, [state, onUpdateObject, onUpdateObjects, onSaveHistory, onMeasureClick, onAlignClick, onClickObject, onContextMenu]);

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

    const measureGroup = new THREE.Group();
    scene.add(measureGroup);
    measureGroupRef.current = measureGroup;

    const alignGroup = new THREE.Group();
    scene.add(alignGroup);

    const multiSelectGroup = new THREE.Group();
    scene.add(multiSelectGroup);
    multiSelectGroupRef.current = multiSelectGroup;
    alignGroupRef.current = alignGroup;

    const markerGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false }); // emerald
    const snapMarker = new THREE.Mesh(markerGeo, markerMat);
    snapMarker.visible = false;
    snapMarker.renderOrder = 999;
    scene.add(snapMarker);
    snapMarkerRef.current = snapMarker;

    const edgeGeo = new THREE.BufferGeometry();
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00ffff, depthTest: false, linewidth: 2 });
    const edgeHighlight = new THREE.LineSegments(edgeGeo, edgeMat);
    const measureHoverMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, depthTest: false });
    const measureHoverMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 16), measureHoverMat);
    measureHoverMesh.renderOrder = 999;
    measureHoverMesh.visible = false;
    scene.add(measureHoverMesh);
    measureHoverRef.current = measureHoverMesh;
    edgeHighlight.visible = false;
    edgeHighlight.renderOrder = 999;
    scene.add(edgeHighlight);
    edgeHighlightRef.current = edgeHighlight;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode(state.transformMode || 'translate');
    
    transformControls.addEventListener('dragging-changed', (event) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
      const { state: currState, onUpdateObject: currUpdate, onUpdateObjects: currUpdateMultiple, onSaveHistory: currSaveHistory } = callbackRefs.current;
      
      if (event.value) { // Started dragging
        if (currSaveHistory) currSaveHistory();
        
        // Make object(s) transparent for live preview
        const obj = transformControls.object;
        if (obj) {
           obj.traverse((child) => {
              if (child instanceof THREE.Mesh && child.material) {
                 child.userData.origMaterial = child.material;
                 const transMat = child.material.clone();
                 transMat.transparent = true;
                 transMat.opacity = 0.5;
                 transMat.depthTest = false;
                 transMat.depthWrite = false;
                 child.material = transMat;
                 child.userData.origRenderOrder = child.renderOrder;
                 child.renderOrder = 999;
              }
           });
        }
      } else { // Stopped dragging
        const obj = transformControls.object;
        if (obj) {
           obj.traverse((child) => {
              if (child instanceof THREE.Mesh && child.userData.origMaterial) {
                 child.material.dispose();
                 child.material = child.userData.origMaterial;
                 delete child.userData.origMaterial;
                 child.renderOrder = child.userData.origRenderOrder || 0;
              }
           });
        }
        if (obj === multiSelectGroupRef.current && obj) {
            // Apply transformations back to children world positions
            if (currUpdateMultiple) {
                const updates = [];
                const tempPos = new THREE.Vector3();
                const tempQuat = new THREE.Quaternion();
                const tempScale = new THREE.Vector3();
                const tempEuler = new THREE.Euler();
                
                // We iterate over a copy of children because we don't modify them here
                // We just read their world transforms
                obj.children.forEach(child => {
                    if (child.userData?.id) {
                        child.getWorldPosition(tempPos);
                        child.getWorldQuaternion(tempQuat);
                        child.getWorldScale(tempScale);
                        tempEuler.setFromQuaternion(tempQuat);
                        
                        const targetObject = currState.objects.find(o => o.id === child.userData.id);
                        if (targetObject) {
                            updates.push({
                                id: child.userData.id,
                                updates: {
                                    transform: {
                                        ...targetObject.transform,
                                        position: { x: tempPos.x, y: tempPos.y, z: tempPos.z },
                                        rotation: { 
                                            x: THREE.MathUtils.radToDeg(tempEuler.x),
                                            y: THREE.MathUtils.radToDeg(tempEuler.y),
                                            z: THREE.MathUtils.radToDeg(tempEuler.z)
                                        },
                                        scale: { x: tempScale.x, y: tempScale.y, z: tempScale.z }
                                    }
                                }
                            });
                        }
                    }
                });
                
                if (updates.length > 0) {
                    currUpdateMultiple(updates);
                }
            }
        } else if (obj && obj.userData?.id) {
          
          // Apply snap if we were snapping
          if (currState.snapToEdge && currState.transformMode === 'translate' && snapTargetRef.current) {
             obj.position.copy(snapTargetRef.current);
             snapTargetRef.current = null;
             if (snapMarkerRef.current) snapMarkerRef.current.visible = false;
             if (edgeHighlightRef.current) edgeHighlightRef.current.visible = false;
          }
          if (currUpdate) {
            const targetObject = currState.objects.find(o => o.id === obj.userData.id);
            if (targetObject) {
              const euler = obj.rotation;
              const newRotation = {
                x: THREE.MathUtils.radToDeg(euler.x),
                y: THREE.MathUtils.radToDeg(euler.y),
                z: THREE.MathUtils.radToDeg(euler.z)
              };
              const newPosition = {
                x: obj.position.x,
                y: obj.position.y,
                z: obj.position.z
              };
              const newScale = {
                x: obj.scale.x,
                y: obj.scale.y,
                z: obj.scale.z
              };
              currUpdate(obj.userData.id, { 
                transform: {
                  ...targetObject.transform,
                  rotation: newRotation,
                  position: newPosition,
                  scale: newScale
                } 
              });
            }
          }
        }
      }
    });

    scene.add(transformControls.getHelper());
    transformControlsRef.current = transformControls;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    
    resizeObserver.observe(container);
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      // Only handle left click
      if (event.button !== 0) return;
      if (transformControls.dragging) return;
      
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      
      const { state: currState, onMeasureClick: currMeasureClick, onClickObject: currClickObject } = callbackRefs.current;
      
      // Raycast against the objectsGroupRef
      if (objectsGroupRef.current) {
        const intersects = raycaster.intersectObjects(objectsGroupRef.current.children, true);
        if (intersects.length > 0) {
           let point = intersects[0].point;
           
           if (currState.measure?.enabled && currMeasureClick) {
             // If we clicked a mesh and we want to measure, try to snap to nearest vertex
             const mesh = intersects[0].object as THREE.Mesh;
             if (measureHoverPointRef.current) {
                point = measureHoverPointRef.current.clone();
             } else if (mesh.geometry && mesh.geometry.attributes.position) {
               const posAttr = mesh.geometry.attributes.position;
               const face = intersects[0].face;
               if (face) {
                 const vA = new THREE.Vector3().fromBufferAttribute(posAttr, face.a).applyMatrix4(mesh.matrixWorld);
                 const vB = new THREE.Vector3().fromBufferAttribute(posAttr, face.b).applyMatrix4(mesh.matrixWorld);
                 const vC = new THREE.Vector3().fromBufferAttribute(posAttr, face.c).applyMatrix4(mesh.matrixWorld);
                 const dA = vA.distanceTo(point);
                 const dB = vB.distanceTo(point);
                 const dC = vC.distanceTo(point);
                 if (dA <= dB && dA <= dC) point = vA;
                 else if (dB <= dA && dB <= dC) point = vB;
                 else point = vC;
               }
             }
             currMeasureClick(point);
             return;
           }
           
           if (currClickObject) {
             // Find root object ID
             let obj: THREE.Object3D | null = intersects[0].object;
             while(obj && obj.parent !== objectsGroupRef.current) {
               obj = obj.parent;
             }
             if (obj && obj.userData?.id) {
               currClickObject(obj.userData.id, event.shiftKey);
               return;
             }
           }
        } else {
           if (!currState.measure?.enabled && currClickObject) {
             currClickObject(null, event.shiftKey);
           }
        }
      }
    };
    
    
    const onPointerMove = (event: PointerEvent) => {
      const currState = callbackRefs.current.state;
      if (!currState.measure?.enabled && !currState.align?.enabled) {
          if (edgeHighlightRef.current) edgeHighlightRef.current.visible = false;
          if (measureHoverRef.current) measureHoverRef.current.visible = false;
          measureHoverPointRef.current = null;
          return;
      }
      
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      
      if (objectsGroupRef.current) {
        const intersects = raycaster.intersectObjects(objectsGroupRef.current.children, true);
        if (intersects.length > 0) {
           const mesh = intersects[0].object as THREE.Mesh;
           const point = intersects[0].point;
           
           if (currState.measure?.enabled) {
               // Edge detection
               const segments = findConnectedEdgeSegments(mesh, point);
               if (segments.length > 0 && edgeHighlightRef.current) {
                  edgeHighlightRef.current.geometry.setFromPoints(segments);
                  edgeHighlightRef.current.visible = true;
                  edgeHighlightRef.current.material.color.setHex(0xff00ff); // Magenta for measure
               } else if (edgeHighlightRef.current) {
                  edgeHighlightRef.current.visible = false;
               }
               
               // Vertex snapping
               const closestVertex = getClosestVertexOnSegment(mesh, point);
               if (closestVertex && measureHoverRef.current) {
                  measureHoverRef.current.position.copy(closestVertex);
                  measureHoverRef.current.visible = true;
                  measureHoverPointRef.current = closestVertex;
               } else if (measureHoverRef.current) {
                  measureHoverRef.current.visible = false;
                  measureHoverPointRef.current = null;
               }
           }
        } else {
           if (edgeHighlightRef.current) edgeHighlightRef.current.visible = false;
           if (measureHoverRef.current) measureHoverRef.current.visible = false;
           measureHoverPointRef.current = null;
        }
      }
    };
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    renderer.domElement.addEventListener('pointerdown', onPointerDown);



    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      cameraLight.position.copy(camera.position);
      
      const anim = animationRef.current;
      const state = callbackRefs.current.state;
      
      if (anim && anim.enabled && anim.playing && state.selectedId && objectsGroupRef.current) {
         const time = clock.getElapsedTime();
         // find the object in state
         const objData = state.objects.find(o => o.id === state.selectedId);
         // find the mesh
         const mesh = objectsGroupRef.current.children.find(c => c.userData?.id === state.selectedId);
         
         if (objData && mesh) {
             const offset = Math.sin(time * anim.speed) * anim.distance;
             // Reset to base first
             mesh.position.set(objData.transform.position.x, objData.transform.position.y, objData.transform.position.z);
             
             if (anim.axis === 'x') mesh.position.x += offset;
             if (anim.axis === 'y') mesh.position.y += offset;
             if (anim.axis === 'z') mesh.position.z += offset;
         }
      } else if (anim && (!anim.enabled || !anim.playing) && state.selectedId && objectsGroupRef.current) {
         // Reset position if paused
         const objData = state.objects.find(o => o.id === state.selectedId);
         const mesh = objectsGroupRef.current.children.find(c => c.userData?.id === state.selectedId);
         if (objData && mesh) {
            mesh.position.set(objData.transform.position.x, objData.transform.position.y, objData.transform.position.z);
         }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.dispose();
    };
  }, []); // END OF INIT USE-EFFECT

  // RENDER OBJECTS
  useEffect(() => {
    if (!objectsGroupRef.current) return;
    const group = objectsGroupRef.current;
    
    // Clear old
    while(group.children.length > 0) {
      group.remove(group.children[0]);
    }
    if (multiSelectGroupRef.current) {
        while(multiSelectGroupRef.current.children.length > 0) {
            multiSelectGroupRef.current.remove(multiSelectGroupRef.current.children[0]);
        }
    }

    state.objects.forEach(obj => {
      if (!obj.visible) return;
      
      const material = new THREE.MeshStandardMaterial({
        color: obj.color,
        roughness: 0.4,
        metalness: 0.1,
        side: THREE.DoubleSide
      });

      if (state.viewMode === 'wireframe') {
        material.wireframe = true;
      }

      let visualObject: THREE.Object3D = new THREE.Mesh(obj.geometry, material);
      visualObject.userData = { id: obj.id };

      // Apply transformations
      visualObject.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
      visualObject.rotation.set(
        THREE.MathUtils.degToRad(obj.transform.rotation.x),
        THREE.MathUtils.degToRad(obj.transform.rotation.y),
        THREE.MathUtils.degToRad(obj.transform.rotation.z)
      );
      visualObject.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);

      if (state.viewMode === 'xray') {
         material.transparent = true;
         material.opacity = 0.3;
         material.depthWrite = false;
      }

      group.add(visualObject);
    });

    const currentCount = state.objects.length;
    const prevCount = prevObjectsCountRef.current;
    if (currentCount > prevCount) {
      setTimeout(() => {
        fitCameraToScene();
      }, 50);
    }
    prevObjectsCountRef.current = currentCount;
  }, [state.objects, state.viewMode, state.slice, state.boolean]);


  // TRANSFORM CONTROLS SELECTION
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(state.transformMode || 'translate');
      if (state.selectedIds && state.selectedIds.length > 1 && !state.measure?.enabled && multiSelectGroupRef.current) {
        
        transformControlsRef.current.detach();
        
        const activeMeshes = objectsGroupRef.current.children.filter(c => state.selectedIds.includes(c.userData?.id));
        const box = new THREE.Box3();
        activeMeshes.forEach(mesh => {
            box.expandByObject(mesh);
        });
        
        const center = new THREE.Vector3();
        box.getCenter(center);
        while(multiSelectGroupRef.current.children.length > 0){ multiSelectGroupRef.current.remove(multiSelectGroupRef.current.children[0]); }
        multiSelectGroupRef.current.position.copy(center);
        multiSelectGroupRef.current.rotation.set(0, 0, 0);
        multiSelectGroupRef.current.scale.set(1, 1, 1);
        
        activeMeshes.forEach(mesh => {
            multiSelectGroupRef.current.attach(mesh);
        });
        
        const boxHelper = new THREE.BoxHelper(multiSelectGroupRef.current, 0xffa500);
        multiSelectGroupRef.current.add(boxHelper);
        
        if (transformControlsRef.current.object !== multiSelectGroupRef.current) {
            transformControlsRef.current.attach(multiSelectGroupRef.current);
        }
      } else if (state.selectedId && !state.measure?.enabled) {
        while(multiSelectGroupRef.current && multiSelectGroupRef.current.children.length > 0){ multiSelectGroupRef.current.remove(multiSelectGroupRef.current.children[0]); }
        
        const selectedObj = state.objects.find(o => o.id === state.selectedId);
        const activeMesh = objectsGroupRef.current.children.find(c => c.userData?.id === state.selectedId);
        if (activeMesh && selectedObj && !selectedObj.locked) {
          if (transformControlsRef.current.object !== activeMesh) {
            transformControlsRef.current.attach(activeMesh);
          }
        } else {
          transformControlsRef.current.detach();
        }
      } else {
        transformControlsRef.current.detach();
      }
    }
  }, [state.objects, state.selectedId, state.selectedIds, state.measure?.enabled, state.transformMode]);

  // Measure Visuals
  useEffect(() => {
    if (!measureGroupRef.current) return;
    measureGroupRef.current.clear();
    
    if (!state.measure?.enabled) return;
    
    const p1 = state.measure.p1;
    const p2 = state.measure.p2;
    
    const createMarker = (pos: THREE.Vector3, color: number) => {
        const geo = new THREE.SphereGeometry(2, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.renderOrder = 999; // Render on top
        return mesh;
    };
    
    if (p1) measureGroupRef.current.add(createMarker(new THREE.Vector3(p1.x, p1.y, p1.z), 0x06b6d4)); // cyan-500
    if (p2) measureGroupRef.current.add(createMarker(new THREE.Vector3(p2.x, p2.y, p2.z), 0x22d3ee)); // cyan-400
    
    if (p1 && p2) {
        const points = [];
        points.push(new THREE.Vector3(p1.x, p1.y, p1.z));
        points.push(new THREE.Vector3(p2.x, p2.y, p2.z));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x06b6d4, depthTest: false, linewidth: 2 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 999;
        
        measureGroupRef.current.add(line);
    }
    
  }, [state.measure]);

  // Align Visuals
  useEffect(() => {
    if (!alignGroupRef.current) return;
    alignGroupRef.current.clear();

    if (!state.align?.enabled) return;
    if (state.align.step === 'select_target' && state.align.source) {
        const source = state.align.source;
        const pos = new THREE.Vector3(source.point.x, source.point.y, source.point.z);
        const normal = new THREE.Vector3(source.normal.x, source.normal.y, source.normal.z);

        const geo = new THREE.SphereGeometry(1.5, 16, 16);
        const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.renderOrder = 999;
        alignGroupRef.current.add(mesh);

        const arrowHelper = new THREE.ArrowHelper(normal, pos, 10, 0xf59e0b, 3, 2);
        // @ts-ignore
        arrowHelper.renderOrder = 999;
        alignGroupRef.current.add(arrowHelper);
    }
  }, [state.align]);

  // Slicing Helpers
  useEffect(() => {
    if (!helperGroupRef.current || !state.selectedId) {
        helperGroupRef.current?.clear();
        return;
    }
    
    helperGroupRef.current.clear();
    const selectedObj = state.objects.find(o => o.id === state.selectedId);
    if (!selectedObj) return;

    if (state.slice?.enabled) {
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

    if (state.split?.enabled) {
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
    if (state.extend?.enabled) {
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
