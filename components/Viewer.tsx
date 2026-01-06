
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { AppState } from '../types';

interface ViewerProps {
  geometry: THREE.BufferGeometry | null;
  state: AppState;
}

const Viewer: React.FC<ViewerProps> = ({ geometry, state }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const helperGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      2000
    );
    camera.position.set(150, 150, 150);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.localClippingEnabled = true;
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dl1 = new THREE.DirectionalLight(0xffffff, 0.8);
    dl1.position.set(100, 100, 100);
    scene.add(dl1);
    const dl2 = new THREE.DirectionalLight(0xffffff, 0.4);
    dl2.position.set(-100, -50, -100);
    scene.add(dl2);

    scene.add(new THREE.GridHelper(400, 40, 0x1e293b, 0x0f172a));

    const helperGroup = new THREE.Group();
    scene.add(helperGroup);
    helperGroupRef.current = helperGroup;

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // Update Helper Planes Visuals
  useEffect(() => {
    if (!sceneRef.current || !state.stats || !helperGroupRef.current) return;

    helperGroupRef.current.clear();

    if (state.slice.enabled) {
      const size = Math.max(state.stats.boundingBox.size.x, state.stats.boundingBox.size.y, state.stats.boundingBox.size.z) * 2;
      const planeGeo = new THREE.PlaneGeometry(size, size);
      
      const createHelper = (pos: number, color: number) => {
        const mat = new THREE.MeshBasicMaterial({ 
          color: color, 
          transparent: true, 
          opacity: 0.1, 
          side: THREE.DoubleSide,
          depthWrite: false 
        });
        const mesh = new THREE.Mesh(planeGeo, mat);
        if (state.slice.axis === 'x') mesh.rotation.y = Math.PI / 2;
        if (state.slice.axis === 'y') mesh.rotation.x = Math.PI / 2;
        
        const position = { x: 0, y: 0, z: 0 };
        (position as any)[state.slice.axis] = pos;
        mesh.position.set(position.x, position.y, position.z);
        return mesh;
      };

      if (state.slice.mode === 'single') {
        helperGroupRef.current.add(createHelper(state.slice.singlePos, 0x3b82f6));
      } else {
        helperGroupRef.current.add(createHelper(state.slice.start, 0x3b82f6));
        helperGroupRef.current.add(createHelper(state.slice.end, 0x6366f1));
      }
    }
  }, [state.slice, state.stats]);

  // Update Mesh and Clipping
  useEffect(() => {
    if (!sceneRef.current || !geometry) return;

    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
    }

    const clippingPlanes: THREE.Plane[] = [];
    let clipIntersection = false;

    if (state.slice.enabled) {
      const axisVec = new THREE.Vector3();
      if (state.slice.axis === 'x') axisVec.set(1, 0, 0);
      else if (state.slice.axis === 'y') axisVec.set(0, 1, 0);
      else axisVec.set(0, 0, 1);

      if (state.slice.mode === 'single') {
        // Show everything on the positive side of the plane
        clippingPlanes.push(new THREE.Plane(axisVec.clone().negate(), state.slice.singlePos));
      } else {
        if (state.slice.showMiddle) {
          // INTERSECTION of two half-spaces: 
          // 1. After start: Normal pointing positive (negate for THREE.Plane distance)
          // 2. Before end: Normal pointing negative
          clippingPlanes.push(new THREE.Plane(axisVec.clone().negate(), state.slice.end));
          clippingPlanes.push(new THREE.Plane(axisVec.clone(), -state.slice.start));
          clipIntersection = false; // Must satisfy BOTH planes
        } else {
          // UNION of two half-spaces:
          // 1. Everything before Start
          // 2. Everything after End
          clippingPlanes.push(new THREE.Plane(axisVec.clone(), -state.slice.start));
          clippingPlanes.push(new THREE.Plane(axisVec.clone().negate(), state.slice.end));
          clipIntersection = true; // satisfies AT LEAST ONE plane (pixel rejected ONLY if outside BOTH)
        }
      }
    }

    const materialProps = {
      color: state.color,
      flatShading: true,
      side: THREE.DoubleSide,
      clippingPlanes: clippingPlanes,
      clipIntersection: clipIntersection,
      clipShadows: true
    };

    let material: THREE.Material;
    if (state.viewMode === 'wireframe') material = new THREE.MeshBasicMaterial({ ...materialProps, wireframe: true });
    else if (state.viewMode === 'points') material = new THREE.PointsMaterial({ color: state.color, size: 2 });
    else material = new THREE.MeshPhongMaterial({ ...materialProps, shininess: 30 });

    const mesh = new THREE.Mesh(geometry, material);
    geometry.center();
    meshRef.current = mesh;
    sceneRef.current.add(mesh);
  }, [geometry, state.viewMode, state.color, state.slice]);

  // Apply Transformations
  useEffect(() => {
    if (!meshRef.current) return;
    meshRef.current.position.set(state.transform.position.x, state.transform.position.y, state.transform.position.z);
    meshRef.current.rotation.set(
      THREE.MathUtils.degToRad(state.transform.rotation.x),
      THREE.MathUtils.degToRad(state.transform.rotation.y),
      THREE.MathUtils.degToRad(state.transform.rotation.z)
    );
    meshRef.current.scale.setScalar(state.transform.scale);
  }, [state.transform]);

  return <div ref={containerRef} className="w-full h-full relative" />;
};

export default Viewer;
