const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

// The messed up part starts around `resizeObserver.disconnect();`
// We need to properly close the first useEffect, add the render objects useEffect, and then the transform controls useEffect.

const fixPart = `
    return () => {
      resizeObserver.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
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
  }, [state.objects, state.selectedId, state.selectedIds, state.measure?.enabled]);
`;

// Replace from `return () => { \n resizeObserver.disconnect();` to `}, [state.objects...]);`
const regex = /return \(\) => \{\s*resizeObserver\.disconnect\(\);[\s\S]*?\}, \[state\.objects[^\]]*\]\);/;
code = code.replace(regex, fixPart.trim());

fs.writeFileSync('components/Viewer.tsx', code);
console.log("Fixed Viewer.tsx");
