import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { SceneObject, SplitState, Vector3 } from '../types';
import { MeshStats } from '../types';

// Setup three-mesh-bvh
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const standardizeGeo = (geo: THREE.BufferGeometry) => {
    let clean = geo.clone();
    const pos = clean.getAttribute("position");
    if (pos) {
        for (let i = 0; i < pos.count * pos.itemSize; i++) {
            if (isNaN(pos.array[i]) || !isFinite(pos.array[i])) {
                pos.array[i] = 0;
            }
        }
    }
    
    // Always merge vertices for STL-like geometries if they don't have indexes
    if (!clean.index) {
        clean = BufferGeometryUtils.mergeVertices(clean, 1e-4);
    }

    const finalGeo = new THREE.BufferGeometry();
    finalGeo.setAttribute('position', clean.getAttribute('position').clone());
    
    if (clean.index) {
        // Ensure index is always Uint32Array for consistency between merged geometries and native BoxGeometry
        const oldIndex = clean.index.array;
        const newIndex = new Uint32Array(oldIndex.length);
        for (let i = 0; i < oldIndex.length; i++) {
            newIndex[i] = oldIndex[i];
        }
        finalGeo.setIndex(new THREE.BufferAttribute(newIndex, 1));
    } else {
        // Fallback
        const count = clean.attributes.position.count;
        const indices = new Uint32Array(count);
        for (let i = 0; i < count; i++) indices[i] = i;
        finalGeo.setIndex(new THREE.BufferAttribute(indices, 1));
    }
    
    if (finalGeo.attributes.position && finalGeo.attributes.position.count === 0) { finalGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); finalGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { finalGeo.computeVertexNormals(); }
    finalGeo.computeBoundsTree();
    console.log("standardizeGeo final attributes:", Object.keys(finalGeo.attributes));
    return mergeVertices(finalGeo, 1e-4);
};

export const csgService = {
  performSlice: (
    object: SceneObject,
    sliceArgs: import('../types').SliceState
  ): THREE.BufferGeometry | null => {
    const size = 5000;
    let planeGeo: THREE.BufferGeometry = new THREE.BoxGeometry(size, size, size);
    if (sliceArgs.mode === 'single') {
        planeGeo.translate(0, 0, size/2);
    } else {
        // window mode -> slice thickness
        planeGeo.scale(1, 1, sliceArgs.windowSize / size);
    }

    planeGeo = standardizeGeo(planeGeo);
    const targetGeo1 = standardizeGeo(object.geometry);

    const cutterMesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial());
    
    // Apply position and rotation to the cutter
    cutterMesh.rotation.set(
        THREE.MathUtils.degToRad(sliceArgs.rotation.x),
        THREE.MathUtils.degToRad(sliceArgs.rotation.y),
        THREE.MathUtils.degToRad(sliceArgs.rotation.z)
    );
    cutterMesh.position.set(sliceArgs.position.x, sliceArgs.position.y, sliceArgs.position.z);
    
    if (sliceArgs.mode === 'single') {
        // move cutting face to pos
        // already handled by translation + rotation + pos
    }

    cutterMesh.updateMatrixWorld(true);
    
    const targetMesh = new THREE.Mesh(targetGeo1, new THREE.MeshBasicMaterial());
    targetMesh.position.set(object.transform.position.x, object.transform.position.y, object.transform.position.z);
    targetMesh.rotation.set(
        THREE.MathUtils.degToRad(object.transform.rotation.x),
        THREE.MathUtils.degToRad(object.transform.rotation.y),
        THREE.MathUtils.degToRad(object.transform.rotation.z)
    );
    targetMesh.scale.set(object.transform.scale.x, object.transform.scale.y, object.transform.scale.z);
    targetMesh.updateMatrixWorld(true);

    const bTarget = new Brush(targetMesh.geometry, new THREE.MeshBasicMaterial());
    bTarget.position.copy(targetMesh.position);
    bTarget.rotation.copy(targetMesh.rotation);
    bTarget.scale.copy(targetMesh.scale);
    bTarget.updateMatrixWorld(true);

    const bCutter = new Brush(cutterMesh.geometry, new THREE.MeshBasicMaterial());
    bCutter.position.copy(cutterMesh.position);
    bCutter.rotation.copy(cutterMesh.rotation);
    bCutter.scale.copy(cutterMesh.scale);
    bCutter.updateMatrixWorld(true);

    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ['position', 'normal'];
    
    const res = evaluator.evaluate(bTarget, bCutter, sliceArgs.mode === 'single' ? SUBTRACTION : INTERSECTION);
    
    const geo = res.geometry.clone();
    if (geo.attributes.position && geo.attributes.position.count === 0) { geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); geo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { geo.computeVertexNormals(); }
    return mergeVertices(geo, 1e-4);
  },

  createSplitCutterGeometry: (splitArgs: SplitState, size: number = 5000): THREE.BufferGeometry => {
    let cutterGeo: THREE.BufferGeometry;

    if (splitArgs.jointType === 'flat') {
        cutterGeo = new THREE.BoxGeometry(size, size, size);
        cutterGeo.translate(0, 0, size/2); 
    } else {
        const shape = new THREE.Shape();
        shape.moveTo(-size/2, size);
        shape.lineTo(size/2, size);
        shape.lineTo(size/2, 0);

        if (splitArgs.jointType === 'dovetail') {
            const hw = splitArgs.jointSize / 2;
            const d = splitArgs.jointDepth;
            const slope = hw * 0.4;
            shape.lineTo(hw, 0);
            shape.lineTo(hw + slope, -d);
            shape.lineTo(-hw - slope, -d);
            shape.lineTo(-hw, 0);
        } else if (splitArgs.jointType === 'puzzle') {
            const R = splitArgs.jointSize / 2;
            const hw = R / 2; // neck half-width
            const d = splitArgs.jointDepth;
            const intersectY = -d + Math.sqrt(R*R - hw*hw);
            
            shape.lineTo(hw, 0);
            shape.lineTo(hw, intersectY);
            
            const startAngle = Math.acos(hw / R); // Should be PI/3
            const endAngle = Math.PI - startAngle; // 2*PI/3
            
            shape.absarc(0, -d, R, startAngle, endAngle, true);
            shape.lineTo(-hw, 0);
        }

        shape.lineTo(-size/2, 0);
        shape.lineTo(-size/2, size);

        const extrudeSettings = {
            depth: size, 
            bevelEnabled: false,
        };
        cutterGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        cutterGeo.translate(0, 0, -size/2); 
        cutterGeo.rotateX(Math.PI / 2); // Now Y maps to Z, and depth goes along Y
    }
    
    return cutterGeo;
  },

  // We'll create a new geometries based on the split definition
  performSplit: (
    object: SceneObject,
    splitArgs: SplitState
  ): { partA: THREE.BufferGeometry, partB: THREE.BufferGeometry } | null => {
    
    // We create a large box as our cut plane/tool
    // Then we add the joint feature to the box.
    const size = 5000;
    
    let cutterGeo = csgService.createSplitCutterGeometry(splitArgs, size);

    cutterGeo = standardizeGeo(cutterGeo);
    let targetGeo2 = standardizeGeo(object.geometry);

    const cutterMesh = new THREE.Mesh(cutterGeo, new THREE.MeshBasicMaterial());
    
    // We apply position and rotation to the cutter
    const rot = splitArgs.rotation;
    cutterMesh.rotation.set(
        THREE.MathUtils.degToRad(rot.x),
        THREE.MathUtils.degToRad(rot.y),
        THREE.MathUtils.degToRad(rot.z)
    );
    const pos = splitArgs.position;
    cutterMesh.position.set(pos.x, pos.y, pos.z);
    cutterMesh.updateMatrixWorld(true);

    const targetMesh = new THREE.Mesh(targetGeo2, new THREE.MeshBasicMaterial());
    // Object's own transform
    targetMesh.position.set(object.transform.position.x, object.transform.position.y, object.transform.position.z);
    targetMesh.rotation.set(
        THREE.MathUtils.degToRad(object.transform.rotation.x),
        THREE.MathUtils.degToRad(object.transform.rotation.y),
        THREE.MathUtils.degToRad(object.transform.rotation.z)
    );
    targetMesh.scale.set(object.transform.scale.x, object.transform.scale.y, object.transform.scale.z);
    targetMesh.updateMatrixWorld(true);

    const bTarget = new Brush(targetMesh.geometry, new THREE.MeshBasicMaterial());
    bTarget.position.copy(targetMesh.position);
    bTarget.rotation.copy(targetMesh.rotation);
    bTarget.scale.copy(targetMesh.scale);
    bTarget.updateMatrixWorld(true);

    const bCutter = new Brush(cutterMesh.geometry, new THREE.MeshBasicMaterial());
    bCutter.position.copy(cutterMesh.position);
    bCutter.rotation.copy(cutterMesh.rotation);
    bCutter.scale.copy(cutterMesh.scale);
    bCutter.updateMatrixWorld(true);
    
    let bCutterClearance = undefined;
    if (splitArgs.clearance > 0 && splitArgs.jointType !== 'flat') {
         // Create a slightly larger cutter for clearance on the receiving side
         // This is complex, simply scaling joint feature isn't trivial. 
         // For now we'll skip exact clearance or implement it via a scale trick:
         // bCutterClearance = ...
    }

    const evaluator = new Evaluator();
    evaluator.useGroups = false;
    evaluator.attributes = ['position', 'normal'];
    
    // Part A: Target MINUS Cutter
    const partABrush = evaluator.evaluate(bTarget, bCutter, SUBTRACTION);

    // Part B: Target INTERSECT Cutter
    const partBBrush = evaluator.evaluate(bTarget, bCutter, INTERSECTION);

    const partAGeo = partABrush.geometry.clone();
    if (partAGeo.attributes.position && partAGeo.attributes.position.count === 0) { partAGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); partAGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { partAGeo.computeVertexNormals(); }

    const partBGeo = partBBrush.geometry.clone();
    if (partBGeo.attributes.position && partBGeo.attributes.position.count === 0) { partBGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); partBGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { partBGeo.computeVertexNormals(); }

    return { partA: partAGeo, partB: partBGeo };
  },

  performExtend: (
    object: SceneObject,
    extendArgs: import('../types').ExtendState
  ): THREE.BufferGeometry | null => {
    const size = 5000;
    const { amount, position, rotation } = extendArgs;
    
    // Convert euler angles to radians for rotations
    const rx = THREE.MathUtils.degToRad(rotation.x);
    const ry = THREE.MathUtils.degToRad(rotation.y);
    const rz = THREE.MathUtils.degToRad(rotation.z);

    const targetGeo = standardizeGeo(object.geometry);
    const targetMesh = new THREE.Mesh(targetGeo, new THREE.MeshBasicMaterial());
    targetMesh.position.set(object.transform.position.x, object.transform.position.y, object.transform.position.z);
    targetMesh.rotation.set(
        THREE.MathUtils.degToRad(object.transform.rotation.x),
        THREE.MathUtils.degToRad(object.transform.rotation.y),
        THREE.MathUtils.degToRad(object.transform.rotation.z)
    );
    targetMesh.scale.set(object.transform.scale.x, object.transform.scale.y, object.transform.scale.z);
    targetMesh.updateMatrixWorld(true);

    const bTarget = new Brush(targetMesh.geometry, new THREE.MeshBasicMaterial());
    bTarget.position.copy(targetMesh.position);
    bTarget.rotation.copy(targetMesh.rotation);
    bTarget.scale.copy(targetMesh.scale);
    bTarget.updateMatrixWorld(true);

    const evalCSG = new Evaluator();
    evalCSG.useGroups = false;
    evalCSG.attributes = ['position', 'normal'];

    const getCutter = (tz: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshBasicMaterial());
        mesh.geometry.translate(0, 0, tz);
        mesh.rotation.set(rx, ry, rz);
        mesh.position.set(position.x, position.y, position.z);
        mesh.updateMatrixWorld(true);
        const b = new Brush(mesh.geometry, new THREE.MeshBasicMaterial());
        b.position.copy(mesh.position);
        b.rotation.copy(mesh.rotation);
        b.updateMatrixWorld(true);
        return b;
    };

    const bCutterA = getCutter(size/2);
    const bCutterB = getCutter(-size/2);

    const partA = evalCSG.evaluate(bTarget, bCutterA, SUBTRACTION);
    const partB = evalCSG.evaluate(bTarget, bCutterB, SUBTRACTION);

    const sliceThickness = 0.2;
    const bCutterSMax = getCutter(size/2 + sliceThickness/2);
    const bCutterSMin = getCutter(-size/2 - sliceThickness/2);

    let sliceBrush = evalCSG.evaluate(bTarget, bCutterSMax, SUBTRACTION);
    sliceBrush = evalCSG.evaluate(sliceBrush, bCutterSMin, SUBTRACTION);

    // Now transform to local space of the cutter
    const cutterRef = new THREE.Object3D();
    cutterRef.rotation.set(rx, ry, rz);
    cutterRef.position.set(position.x, position.y, position.z);
    cutterRef.updateMatrixWorld(true);

    const worldToCutter = cutterRef.matrixWorld.clone().invert();
    const targetToCutter = worldToCutter.multiply(bTarget.matrixWorld);
    const cutterToTarget = targetToCutter.clone().invert();
    
    // Process Slice
    sliceBrush.geometry.applyMatrix4(targetToCutter);
    sliceBrush.geometry.scale(1, 1, amount / sliceThickness);
    sliceBrush.geometry.translate(0, 0, amount / 2);
    sliceBrush.geometry.applyMatrix4(cutterToTarget);

    // Process Part B (move it by amount)
    partB.geometry.applyMatrix4(targetToCutter);
    partB.geometry.translate(0, 0, amount);
    partB.geometry.applyMatrix4(cutterToTarget);

    // Merge them together
    let finalBrush = evalCSG.evaluate(partA, sliceBrush, ADDITION);
    finalBrush = evalCSG.evaluate(finalBrush, partB, ADDITION);

    const finalGeo = finalBrush.geometry.clone();
    
    // Bring back to the target's original transform space so when it replaces the object,
    // its transform properties (rotation, scale, pos) still apply correctly.
    // Actually, `bTarget` was in world space. `finalGeo` is in world space.
    // If we want to keep the object's transform in the SceneObject the same,
    // we should apply the inverse of the object's world matrix to finalGeo.
    // removed applyMatrix4

    if (finalGeo.attributes.position && finalGeo.attributes.position.count === 0) { finalGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); finalGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { finalGeo.computeVertexNormals(); }
    return mergeVertices(finalGeo, 1e-4);
  },

  mergeObjects: (objects: import('../types').SceneObject[]): THREE.BufferGeometry | null => {
    if (objects.length === 0) return null;
    
    const evalCSG = new Evaluator();
    evalCSG.useGroups = false;
    evalCSG.attributes = ['position', 'normal'];

    let currentBrush: Brush | null = null;

    for (const obj of objects) {
       const geo = standardizeGeo(obj.geometry);
       const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
       mesh.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
       mesh.rotation.set(
           THREE.MathUtils.degToRad(obj.transform.rotation.x),
           THREE.MathUtils.degToRad(obj.transform.rotation.y),
           THREE.MathUtils.degToRad(obj.transform.rotation.z)
       );
       mesh.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
       mesh.updateMatrixWorld(true);

       const brush = new Brush(mesh.geometry, new THREE.MeshBasicMaterial());
       brush.position.copy(mesh.position);
       brush.rotation.copy(mesh.rotation);
       brush.scale.copy(mesh.scale);
       brush.updateMatrixWorld(true);

       if (!currentBrush) {
           currentBrush = brush;
       } else {
           currentBrush = evalCSG.evaluate(currentBrush, brush, ADDITION);
       }
    }

    if (!currentBrush) return null;

    const mergedGeo = currentBrush.geometry.clone();
    mergedGeo.applyMatrix4(currentBrush.matrixWorld);
    // Re-center geometry? We could, but then it moves everything. Better keep the absolute coordinate space!
    // But since it's an object with transform 0,0,0, its vertices are essentially in world space.
    if (mergedGeo.attributes.position && mergedGeo.attributes.position.count === 0) { mergedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); mergedGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { mergedGeo.computeVertexNormals(); }
    return mergeVertices(mergedGeo, 1e-4);
  },

  subtractObjects: (targetGeo: THREE.BufferGeometry, cutterGeo: THREE.BufferGeometry, targetTransform: any, cutterTransform: any): THREE.BufferGeometry | null => {
     const gTarget = standardizeGeo(targetGeo);
     const gCutter = standardizeGeo(cutterGeo);

     const bTarget = new Brush(gTarget, new THREE.MeshBasicMaterial());
     bTarget.position.set(targetTransform.position.x, targetTransform.position.y, targetTransform.position.z);
     bTarget.rotation.set(
         THREE.MathUtils.degToRad(targetTransform.rotation.x),
         THREE.MathUtils.degToRad(targetTransform.rotation.y),
         THREE.MathUtils.degToRad(targetTransform.rotation.z)
     );
     bTarget.scale.set(targetTransform.scale.x, targetTransform.scale.y, targetTransform.scale.z);
     bTarget.updateMatrixWorld(true);

     const bCutter = new Brush(gCutter, new THREE.MeshBasicMaterial());
     bCutter.position.set(cutterTransform.position.x, cutterTransform.position.y, cutterTransform.position.z);
     bCutter.rotation.set(
         THREE.MathUtils.degToRad(cutterTransform.rotation.x),
         THREE.MathUtils.degToRad(cutterTransform.rotation.y),
         THREE.MathUtils.degToRad(cutterTransform.rotation.z)
     );
     bCutter.scale.set(cutterTransform.scale.x, cutterTransform.scale.y, cutterTransform.scale.z);
     bCutter.updateMatrixWorld(true);

     const evalCSG = new Evaluator();
     evalCSG.useGroups = false;
     evalCSG.attributes = ['position', 'normal'];
     const res = evalCSG.evaluate(bTarget, bCutter, SUBTRACTION);
     
     if (!res) return null;
     
     const finalGeo = res.geometry.clone();
     // removed applyMatrix4
     if (finalGeo.attributes.position && finalGeo.attributes.position.count === 0) { finalGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); finalGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { finalGeo.computeVertexNormals(); }

     return mergeVertices(finalGeo, 1e-4);
  },

  intersectObjects: (targetGeo: THREE.BufferGeometry, cutterGeo: THREE.BufferGeometry, targetTransform: any, cutterTransform: any): THREE.BufferGeometry | null => {
     const gTarget = standardizeGeo(targetGeo);
     const gCutter = standardizeGeo(cutterGeo);

     const bTarget = new Brush(gTarget, new THREE.MeshBasicMaterial());
     bTarget.position.set(targetTransform.position.x, targetTransform.position.y, targetTransform.position.z);
     bTarget.rotation.set(
         THREE.MathUtils.degToRad(targetTransform.rotation.x),
         THREE.MathUtils.degToRad(targetTransform.rotation.y),
         THREE.MathUtils.degToRad(targetTransform.rotation.z)
     );
     bTarget.scale.set(targetTransform.scale.x, targetTransform.scale.y, targetTransform.scale.z);
     bTarget.updateMatrixWorld(true);

     const bCutter = new Brush(gCutter, new THREE.MeshBasicMaterial());
     bCutter.position.set(cutterTransform.position.x, cutterTransform.position.y, cutterTransform.position.z);
     bCutter.rotation.set(
         THREE.MathUtils.degToRad(cutterTransform.rotation.x),
         THREE.MathUtils.degToRad(cutterTransform.rotation.y),
         THREE.MathUtils.degToRad(cutterTransform.rotation.z)
     );
     bCutter.scale.set(cutterTransform.scale.x, cutterTransform.scale.y, cutterTransform.scale.z);
     bCutter.updateMatrixWorld(true);

     const evalCSG = new Evaluator();
     evalCSG.useGroups = false;
     evalCSG.attributes = ['position', 'normal'];
     const res = evalCSG.evaluate(bTarget, bCutter, INTERSECTION);
     
     if (!res) return null;
     
     const finalGeo = res.geometry.clone();
     // removed applyMatrix4
     if (finalGeo.attributes.position && finalGeo.attributes.position.count === 0) { finalGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); finalGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { finalGeo.computeVertexNormals(); }

     return mergeVertices(finalGeo, 1e-4);
  },

  unionObjects: (targetGeo: THREE.BufferGeometry, cutterGeo: THREE.BufferGeometry, targetTransform: any, cutterTransform: any): THREE.BufferGeometry | null => {
     const gTarget = standardizeGeo(targetGeo);
     const gCutter = standardizeGeo(cutterGeo);

     const bTarget = new Brush(gTarget, new THREE.MeshBasicMaterial());
     bTarget.position.set(targetTransform.position.x, targetTransform.position.y, targetTransform.position.z);
     bTarget.rotation.set(
         THREE.MathUtils.degToRad(targetTransform.rotation.x),
         THREE.MathUtils.degToRad(targetTransform.rotation.y),
         THREE.MathUtils.degToRad(targetTransform.rotation.z)
     );
     bTarget.scale.set(targetTransform.scale.x, targetTransform.scale.y, targetTransform.scale.z);
     bTarget.updateMatrixWorld(true);

     const bCutter = new Brush(gCutter, new THREE.MeshBasicMaterial());
     bCutter.position.set(cutterTransform.position.x, cutterTransform.position.y, cutterTransform.position.z);
     bCutter.rotation.set(
         THREE.MathUtils.degToRad(cutterTransform.rotation.x),
         THREE.MathUtils.degToRad(cutterTransform.rotation.y),
         THREE.MathUtils.degToRad(cutterTransform.rotation.z)
     );
     bCutter.scale.set(cutterTransform.scale.x, cutterTransform.scale.y, cutterTransform.scale.z);
     bCutter.updateMatrixWorld(true);

     const evalCSG = new Evaluator();
     evalCSG.useGroups = false;
     evalCSG.attributes = ['position', 'normal'];
     const res = evalCSG.evaluate(bTarget, bCutter, ADDITION);
     
     if (!res) return null;
     
     const finalGeo = res.geometry.clone();
     // removed applyMatrix4
     if (finalGeo.attributes.position && finalGeo.attributes.position.count === 0) { finalGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0); finalGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0)); } else { finalGeo.computeVertexNormals(); }

     return mergeVertices(finalGeo, 1e-4);
  },

  unionGeometries: (geo1: THREE.BufferGeometry, geo2: THREE.BufferGeometry): THREE.BufferGeometry => {
     const g1 = standardizeGeo(geo1);
     const g2 = standardizeGeo(geo2);

     const b1 = new Brush(g1, new THREE.MeshBasicMaterial());
     const b2 = new Brush(g2, new THREE.MeshBasicMaterial());
     b1.updateMatrixWorld();
     b2.updateMatrixWorld();
     const evalCSG = new Evaluator();
     evalCSG.useGroups = false;
     evalCSG.attributes = ['position', 'normal'];
     const res = evalCSG.evaluate(b1, b2, ADDITION);
     return res.geometry.clone();
  }
};
