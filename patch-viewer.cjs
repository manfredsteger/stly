const fs = require('fs');
let code = fs.readFileSync('components/Viewer.tsx', 'utf-8');

code = code.replace(
    /onUpdateObject\?: \(id: string, updates: Partial<SceneObject>\) => void;/,
    "onUpdateObject?: (id: string, updates: Partial<SceneObject>) => void;\n  onUpdateObjects?: (updatesList: {id: string, updates: Partial<SceneObject>}[]) => void;"
);

code = code.replace(
    /const Viewer: React\.FC<ViewerProps> = \(\{\s*state,\s*onMeasureClick,\s*onAlignClick,\s*onUpdateObject,\s*onSaveHistory,\s*onClickObject,\s*onContextMenu\s*\}\) => \{/,
    "const Viewer: React.FC<ViewerProps> = ({ state, onMeasureClick, onAlignClick, onUpdateObject, onUpdateObjects, onSaveHistory, onClickObject, onContextMenu }) => {"
);

code = code.replace(
    /const callbackRefs = useRef\(\{ state, onUpdateObject, onSaveHistory \}\);/,
    "const callbackRefs = useRef({ state, onUpdateObject, onUpdateObjects, onSaveHistory });"
);

code = code.replace(
    /callbackRefs\.current = \{ state, onUpdateObject, onSaveHistory \};/,
    "callbackRefs.current = { state, onUpdateObject, onUpdateObjects, onSaveHistory };"
);

// We need to change how transformControls attaches and detaches.
// Also add multiSelectGroupRef
code = code.replace(
    /const measureGroupRef = useRef<THREE\.Group \| null>\(null\);/,
    "const measureGroupRef = useRef<THREE.Group | null>(null);\n  const multiSelectGroupRef = useRef<THREE.Group | null>(null);"
);

// In init (useEffect[]):
code = code.replace(
    /scene\.add\(alignGroup\);/,
    "scene.add(alignGroup);\n\n    const multiSelectGroup = new THREE.Group();\n    scene.add(multiSelectGroup);\n    multiSelectGroupRef.current = multiSelectGroup;"
);

// In the 'dragging-changed' listener, if it's our multiSelectGroup
// we need to handle it.
const draggingChangedHandler = `
    transformControls.addEventListener('dragging-changed', (event) => {
      if (controlsRef.current) {
        controlsRef.current.enabled = !event.value;
      }
      const { state: currState, onUpdateObject: currUpdate, onUpdateObjects: currUpdateMultiple, onSaveHistory: currSaveHistory } = callbackRefs.current;
      
      if (event.value) { // Started dragging
        if (currSaveHistory) currSaveHistory();
      } else { // Stopped dragging
        const obj = transformControls.object;
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
`;

code = code.replace(
    /transformControls\.addEventListener\('dragging-changed', \(event\) => \{[\s\S]*?currUpdate\(obj\.userData\.id, \{\s*transform: \{\s*\.\.\.targetObject\.transform,\s*rotation: newRotation,\s*position: newPosition,\s*scale: newScale\s*\}\s*\}\);\s*\}\s*\}\s*\}\s*\}\s*\}\);/,
    draggingChangedHandler
);

fs.writeFileSync('components/Viewer.tsx', code);
console.log("Patched dragging-changed listener and refs");
