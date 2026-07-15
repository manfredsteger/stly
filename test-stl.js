import fs from 'fs';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// create a dummy binary STL
const buffer = new ArrayBuffer(84 + 50);
const view = new DataView(buffer);
// 80 bytes header (0)
// 4 bytes num triangles = 1
view.setUint32(80, 1, true);
// 1 triangle = 50 bytes

const loader = new STLLoader();
const geo = loader.parse(buffer);
console.log("Parsed vertices:", geo.attributes.position.count);
