const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

code = code.replace(
    /stats: \(await import\('\.\/services\/stlService'\)\)\.stlService\.calculateStats\(mergedGeo\)/,
    "stats: (await import('./services/stlService')).stlService.calculateStats(mergedGeo),\n              originalParts: objectsToGroup"
);

const ungroupFunc = `
  const handleUngroupObjects = async () => {
      const selectedIds = state.selectedIds || [];
      if (selectedIds.length !== 1) return;
      
      const objToUngroup = state.objects.find(o => o.id === selectedIds[0]);
      if (!objToUngroup || !objToUngroup.originalParts || objToUngroup.originalParts.length === 0) return;
      
      setIsProcessing(true);
      
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const THREE = await import('three');
          
          // The group object might have been moved.
          // Its original components were stored with their world transforms at the time of grouping,
          // AND the grouped object was created at 0,0,0.
          // If the grouped object has a transform, we must apply it to the children.
          const groupMatrix = new THREE.Matrix4().compose(
              new THREE.Vector3(objToUngroup.transform.position.x, objToUngroup.transform.position.y, objToUngroup.transform.position.z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.x), 
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.y), 
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.z)
              )),
              new THREE.Vector3(objToUngroup.transform.scale.x, objToUngroup.transform.scale.y, objToUngroup.transform.scale.z)
          );

          const newObjects = objToUngroup.originalParts.map(part => {
              // Create matrix for part's original transform
              const partMatrix = new THREE.Matrix4().compose(
                  new THREE.Vector3(part.transform.position.x, part.transform.position.y, part.transform.position.z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      THREE.MathUtils.degToRad(part.transform.rotation.x), 
                      THREE.MathUtils.degToRad(part.transform.rotation.y), 
                      THREE.MathUtils.degToRad(part.transform.rotation.z)
                  )),
                  new THREE.Vector3(part.transform.scale.x, part.transform.scale.y, part.transform.scale.z)
              );
              
              // Apply group's matrix over part's matrix
              const finalMatrix = new THREE.Matrix4().multiplyMatrices(groupMatrix, partMatrix);
              
              // Decompose back to position, rotation, scale
              const position = new THREE.Vector3();
              const quaternion = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              finalMatrix.decompose(position, quaternion, scale);
              const euler = new THREE.Euler().setFromQuaternion(quaternion);

              return {
                  ...part,
                  id: Math.random().toString(36).substr(2, 9), // new IDs to avoid conflicts
                  transform: {
                      position: { x: position.x, y: position.y, z: position.z },
                      rotation: { 
                          x: THREE.MathUtils.radToDeg(euler.x), 
                          y: THREE.MathUtils.radToDeg(euler.y), 
                          z: THREE.MathUtils.radToDeg(euler.z) 
                      },
                      scale: { x: scale.x, y: scale.y, z: scale.z }
                  },
                  visible: true
              };
          });

          pushHistory();
          setState(prev => {
              const newIds = newObjects.map(o => o.id);
              return {
                  ...prev,
                  objects: prev.objects.filter(o => o.id !== objToUngroup.id).concat(newObjects),
                  selectedId: newIds[0],
                  selectedIds: newIds
              };
          });
      } catch (err: any) {
          console.error("Ungroup Error:", err);
          setErrorMsg(\`Fehler beim Gruppierung aufheben: \${err.message || err.toString()}\`);
      } finally {
          setIsProcessing(false);
      }
  };
`;

code = code.replace(
    /const handleGroupObjects = async \(\) => \{/,
    ungroupFunc + "\n\n  const handleGroupObjects = async () => {"
);

code = code.replace(
    /onGroupObjects=\{handleGroupObjects\}/,
    "onGroupObjects={handleGroupObjects}\n            onUngroupObjects={handleUngroupObjects}"
);

fs.writeFileSync('App.tsx', code);
console.log('App updated with ungroup');
