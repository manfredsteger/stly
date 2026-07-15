const fs = require('fs');
let code = fs.readFileSync('App.tsx', 'utf-8');

const explodeFunc = `
  const handleExplodeView = async () => {
      const visibleObjects = state.objects.filter(o => o.visible);
      if (visibleObjects.length < 2) {
          setErrorMsg("Mindestens 2 sichtbare Objekte erforderlich.");
          return;
      }
      
      setIsProcessing(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const THREE = await import('three');
          
          let globalCenter = new THREE.Vector3();
          
          // Calculate global center of mass
          visibleObjects.forEach(obj => {
              const center = new THREE.Vector3();
              const box = new THREE.Box3();
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
              geo.computeBoundingBox();
              if (geo.boundingBox) {
                  geo.boundingBox.getCenter(center);
                  globalCenter.add(center);
              }
          });
          
          globalCenter.divideScalar(visibleObjects.length);
          
          // Apply explosion offset
          const explosionDistance = 30; // 30mm base offset

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.map(obj => {
                  if (!obj.visible) return obj;
                  
                  const center = new THREE.Vector3();
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
                  geo.computeBoundingBox();
                  
                  let offset = new THREE.Vector3(0, 1, 0); // Default direction
                  if (geo.boundingBox) {
                      geo.boundingBox.getCenter(center);
                      const dir = new THREE.Vector3().subVectors(center, globalCenter);
                      if (dir.lengthSq() > 0.001) {
                          dir.normalize();
                          offset = dir;
                      }
                      
                      const size = new THREE.Vector3();
                      geo.boundingBox.getSize(size);
                      
                      // Scale offset by object size + base distance
                      const maxDim = Math.max(size.x, size.y, size.z);
                      offset.multiplyScalar(explosionDistance + maxDim * 0.5);
                  }
                  
                  return {
                      ...obj,
                      transform: {
                          ...obj.transform,
                          position: {
                              x: obj.transform.position.x + offset.x,
                              y: obj.transform.position.y + offset.y,
                              z: obj.transform.position.z + offset.z
                          }
                      }
                  };
              })
          }));
      } catch (err: any) {
          console.error("Explode Error:", err);
          setErrorMsg(\`Fehler bei Explosionsansicht: \${err.message || err.toString()}\`);
      } finally {
          setIsProcessing(false);
      }
  };
`;

code = code.replace(
    /const handleMergeObjects = async \(\) => \{/,
    explodeFunc + "\n\n  const handleMergeObjects = async () => {"
);

code = code.replace(
    /onMergeObjects=\{handleMergeObjects\}/,
    "onMergeObjects={handleMergeObjects}\n            onExplodeView={handleExplodeView}"
);

fs.writeFileSync('App.tsx', code);
console.log('App updated with explode view');
