import * as THREE from 'three';

export interface EdgeFeature {
  points: THREE.Vector3[];
}

const edgesCache = new Map<string, {
    geometry: THREE.BufferGeometry,
    adjacency: Map<string, THREE.Vector3[]>,
    segments: [THREE.Vector3, THREE.Vector3][]
}>();

const hashVec = (v: THREE.Vector3) => `${v.x.toFixed(4)},${v.y.toFixed(4)},${v.z.toFixed(4)}`;

export function getMeshEdges(mesh: THREE.Mesh) {
    if (!mesh.geometry) return null;
    
    const cacheKey = mesh.geometry.uuid;
    if (edgesCache.has(cacheKey)) {
        return edgesCache.get(cacheKey)!;
    }

    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 15);
    const adjacency = new Map<string, THREE.Vector3[]>();
    const segments: [THREE.Vector3, THREE.Vector3][] = [];
    const pos = edgesGeo.attributes.position;
    
    if (pos) {
        for (let i = 0; i < pos.count; i += 2) {
            const v1 = new THREE.Vector3().fromBufferAttribute(pos, i);
            const v2 = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
            
            segments.push([v1, v2]);
            
            const h1 = hashVec(v1);
            const h2 = hashVec(v2);
            
            if (!adjacency.has(h1)) adjacency.set(h1, []);
            if (!adjacency.has(h2)) adjacency.set(h2, []);
            
            adjacency.get(h1)!.push(v2);
            adjacency.get(h2)!.push(v1);
        }
    }
    
    const result = { geometry: edgesGeo, adjacency, segments };
    edgesCache.set(cacheKey, result);
    return result;
}

export function findConnectedEdgeSegments(mesh: THREE.Mesh, worldPoint: THREE.Vector3): THREE.Vector3[] {
    const edgeData = getMeshEdges(mesh);
    if (!edgeData) return [];
    const { geometry, adjacency, segments } = edgeData;
    
    // local point
    const localPoint = worldPoint.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
    
    // Find closest segment to the point
    let closestSegment: [THREE.Vector3, THREE.Vector3] | null = null;
    let minDist = Infinity;
    
    const line3 = new THREE.Line3();
    const closestPoint = new THREE.Vector3();
    
    for (const seg of segments) {
        line3.set(seg[0], seg[1]);
        line3.closestPointToPoint(localPoint, true, closestPoint);
        const dist = closestPoint.distanceToSquared(localPoint);
        if (dist < minDist) {
            minDist = dist;
            closestSegment = seg;
        }
    }
    
    if (!closestSegment || minDist > 100) { 
       return []; 
    }
    
    // Find all connected segments
    // A segment is connected if it shares a vertex.
    // We want to collect all segments that form a continuous edge.
    // Instead of BFS on vertices, we can do BFS on segments or just collect all vertices in the component and return all segments that have both vertices in the component.
    const visitedVertices = new Set<string>();
    const queue: THREE.Vector3[] = [closestSegment[0]];
    
    while(queue.length > 0) {
        const curr = queue.shift()!;
        const h = hashVec(curr);
        
        if (visitedVertices.has(h)) continue;
        visitedVertices.add(h);
        
        const neighbors = adjacency.get(h) || [];
        for (const n of neighbors) {
            if (!visitedVertices.has(hashVec(n))) {
                queue.push(n);
            }
        }
    }
    
    // Now collect all segments whose both vertices are in visitedVertices
    const connectedPoints: THREE.Vector3[] = [];
    for (const seg of segments) {
        if (visitedVertices.has(hashVec(seg[0])) && visitedVertices.has(hashVec(seg[1]))) {
            connectedPoints.push(seg[0].clone().applyMatrix4(mesh.matrixWorld));
            connectedPoints.push(seg[1].clone().applyMatrix4(mesh.matrixWorld));
        }
    }
    
    return connectedPoints;
}

export function getClosestVertexOnSegment(mesh: THREE.Mesh, worldPoint: THREE.Vector3): THREE.Vector3 | null {
    const edgeData = getMeshEdges(mesh);
    if (!edgeData) return null;
    
    const localPoint = worldPoint.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert());
    let closestVertex: THREE.Vector3 | null = null;
    let minDist = Infinity;
    
    const pos = edgeData.geometry.attributes.position;
    if (!pos) return null;
    
    const tempV = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        tempV.fromBufferAttribute(pos, i);
        const dist = tempV.distanceToSquared(localPoint);
        if (dist < minDist) {
            minDist = dist;
            closestVertex = tempV.clone();
        }
    }
    
    if (closestVertex && minDist < 100) {
        return closestVertex.applyMatrix4(mesh.matrixWorld);
    }
    return null;
}
