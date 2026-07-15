const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

const multiSelectLogic = `
    if (transformControlsRef.current) {
      if (state.selectedIds && state.selectedIds.length > 1 && !state.measure?.enabled && multiSelectGroupRef.current) {
        
        // Un-attach and clear the group first
        transformControlsRef.current.detach();
        
        // Find all active meshes
        const activeMeshes = objectsGroupRef.current.children.filter(c => state.selectedIds.includes(c.userData?.id));
        
        // Calculate common bounding box
        const box = new THREE.Box3();
        activeMeshes.forEach(mesh => {
            box.expandByObject(mesh);
        });
        
        // Move multiSelectGroup to the center
        const center = new THREE.Vector3();
        box.getCenter(center);
        multiSelectGroupRef.current.position.copy(center);
        multiSelectGroupRef.current.rotation.set(0, 0, 0);
        multiSelectGroupRef.current.scale.set(1, 1, 1);
        
        // We only want to add the gizmo to multiSelectGroupRef and NOT re-parent the visualObjects 
        // to avoid React rendering bugs. Actually, if we use attach() on multiSelectGroupRef it might work
        // until the next render... Wait! A better way is to attach to a dummy mesh, and on change, update 
        // state directly (handled above in dragging-changed, wait, if we don't attach, children won't move).
        // Let's just re-parent them here for the duration of the selection. React's objectsGroupRef.current.add(visualObject)
        // adds them back on next render.
        
        activeMeshes.forEach(mesh => {
            multiSelectGroupRef.current.attach(mesh);
        });

        // Add visual bounding box around the group
        const groupHelper = new THREE.Box3Helper(box, new THREE.Color(0xffa500));
        multiSelectGroupRef.current.userData.helper = groupHelper;
        // Don't add helper to group because it will scale with it. Add to scene.
        // Wait, if it's added to group, we can just use BoxHelper on the group!
        const boxHelper = new THREE.BoxHelper(multiSelectGroupRef.current, 0xffa500);
        multiSelectGroupRef.current.add(boxHelper);

        if (transformControlsRef.current.object !== multiSelectGroupRef.current) {
            transformControlsRef.current.attach(multiSelectGroupRef.current);
        }
      } else if (state.selectedId && !state.measure?.enabled) {
        // Re-add any items left in multiSelectGroupRef back to objectsGroupRef (just in case, though React does it)
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
`;

code = code.replace(
    /if \(transformControlsRef\.current\) \{[\s\S]*?transformControlsRef\.current\.detach\(\);\s*\}\s*\}/,
    multiSelectLogic
);

fs.writeFileSync('components/Viewer.tsx', code);
console.log("Patched multi select logic");
