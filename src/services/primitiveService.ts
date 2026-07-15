import * as THREE from 'three';

export type PrimitiveType = 
    | 'box' | 'circle' | 'sphere' | 'cylinder' | 'cone' | 'tube'
    | 'tetrahedron' | 'octahedron' | 'icosahedron' | 'dodecahedron'
    | 'hexagon' | 'star' | 'heart' | 'capsule' | 'wedge';

export const primitiveNames: Record<PrimitiveType, string> = {
    box: 'Würfel / Rechteck',
    circle: 'Kreis / Flach',
    sphere: 'Kugel',
    cylinder: 'Zylinder',
    cone: 'Kegel',
    tube: 'Röhre',
    tetrahedron: 'Tetraeder',
    octahedron: 'Oktaeder',
    icosahedron: 'Ikosaeder',
    dodecahedron: 'Dodekaeder',
    hexagon: 'Sechseck Prisma',
    star: 'Stern',
    heart: 'Herz',
    capsule: 'Kapsel',
    wedge: 'Keil (Dreieck)'
};

export const primitiveService = {
    createPrimitive: (type: PrimitiveType, size: number = 20): THREE.BufferGeometry => {
        let geo: THREE.BufferGeometry;
        switch (type) {
            case 'box':
                geo = new THREE.BoxGeometry(size, size, size);
                break;
            case 'circle':
                geo = new THREE.CylinderGeometry(size / 2, size / 2, 2, 32);
                break;
            case 'sphere':
                geo = new THREE.SphereGeometry(size / 2, 32, 16);
                break;
            case 'cylinder':
                geo = new THREE.CylinderGeometry(size / 2, size / 2, size, 32);
                break;
            case 'cone':
                geo = new THREE.ConeGeometry(size / 2, size, 32);
                break;
            case 'tube':
                geo = new THREE.TorusGeometry(size / 2, size / 4, 16, 100);
                break;
            case 'tetrahedron':
                geo = new THREE.TetrahedronGeometry(size / 2);
                break;
            case 'octahedron':
                geo = new THREE.OctahedronGeometry(size / 2);
                break;
            case 'icosahedron':
                geo = new THREE.IcosahedronGeometry(size / 2);
                break;
            case 'dodecahedron':
                geo = new THREE.DodecahedronGeometry(size / 2);
                break;
            case 'hexagon':
                geo = new THREE.CylinderGeometry(size / 2, size / 2, size, 6);
                break;
            case 'star': {
                const shape = new THREE.Shape();
                const outerRadius = size / 2;
                const innerRadius = size / 4;
                const points = 5;
                for (let i = 0; i < points * 2; i++) {
                    const r = i % 2 === 0 ? outerRadius : innerRadius;
                    const a = (i / (points * 2)) * Math.PI * 2;
                    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
                    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                }
                shape.closePath();
                const extrudeSettings = { depth: size / 4, bevelEnabled: false };
                geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.center();
                break;
            }
            case 'heart': {
                const x = 0, y = 0;
                const s = size / 20;
                const shape = new THREE.Shape();
                shape.moveTo( x + 5*s, y + 5*s );
                shape.bezierCurveTo( x + 5*s, y + 5*s, x + 4*s, y, x, y );
                shape.bezierCurveTo( x - 6*s, y, x - 6*s, y + 7*s,x - 6*s, y + 7*s );
                shape.bezierCurveTo( x - 6*s, y + 11*s, x - 3*s, y + 15.4*s, x + 5*s, y + 19*s );
                shape.bezierCurveTo( x + 12*s, y + 15.4*s, x + 16*s, y + 11*s, x + 16*s, y + 7*s );
                shape.bezierCurveTo( x + 16*s, y + 7*s, x + 16*s, y, x + 10*s, y );
                shape.bezierCurveTo( x + 7*s, y, x + 5*s, y + 5*s, x + 5*s, y + 5*s );
                const extrudeSettings = { depth: size / 4, bevelEnabled: false };
                geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.rotateZ(Math.PI);
                geo.center();
                break;
            }
            case 'capsule':
                geo = new THREE.CapsuleGeometry(size / 4, size / 2, 4, 16);
                break;
            case 'wedge': {
                const shape = new THREE.Shape();
                shape.moveTo(-size/2, -size/2);
                shape.lineTo(size/2, -size/2);
                shape.lineTo(-size/2, size/2);
                shape.closePath();
                const extrudeSettings = { depth: size, bevelEnabled: false };
                geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                geo.center();
                break;
            }
            default:
                geo = new THREE.BoxGeometry(size, size, size);
        }
        
        geo.computeVertexNormals();
        return geo;
    }
};
