const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const groupFunc = `
  const handleGroupObjects = async () => {
      const selectedIds = state.selectedIds || [];
      if (selectedIds.length < 2) return;
      
      const objectsToGroup = state.objects.filter(o => selectedIds.includes(o.id));
      
      setIsProcessing(true);
      
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
          const THREE = await import('three');

          const geometries = objectsToGroup.map(obj => {
              const geo = obj.geometry.clone();
              const matrix = new THREE.Matrix4().compose(
                  new THREE.Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      THREE.MathUtils.degToRad(obj.transform.rotation.x), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.y), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.z)
                  )),
                  new THREE.Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z)
              );
              geo.applyMatrix4(matrix);
              return geo;
          });

          const mergedGeo = mergeGeometries(geometries, false);
          
          if (mergedGeo.attributes.position && mergedGeo.attributes.position.count === 0) {
              mergedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
              mergedGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
          } else {
              mergedGeo.computeVertexNormals();
          }

          const newObj = {
              id: Math.random().toString(36).substr(2, 9),
              name: \`Gruppe (\${objectsToGroup.length} Teile)\`,
              geometry: mergedGeo,
              transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
              visible: true,
              color: objectsToGroup[0].color || state.globalColor,
              stats: (await import('./services/stlService')).stlService.calculateStats(mergedGeo)
          };

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.filter(o => !selectedIds.includes(o.id)).concat([newObj]),
              selectedId: newObj.id,
              selectedIds: [newObj.id]
          }));
      } catch (err) {
          console.error("Group Error:", err);
          setErrorMsg(\`Fehler beim Gruppieren: \${err.message || err.toString()}\`);
      } finally {
          setIsProcessing(false);
      }
  };
`;

code = code.replace(
    /const handleMergeObjects = async \(\) => \{/,
    groupFunc + "\n\n  const handleMergeObjects = async () => {"
);

code = code.replace(
    /onSnapCentroids=\{handleSnapCentroids\}/,
    "onSnapCentroids={handleSnapCentroids}\n            onGroupObjects={handleGroupObjects}"
);

fs.writeFileSync('App.tsx', code);
console.log('App updated');
