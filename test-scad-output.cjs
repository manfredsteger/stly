const { createOpenSCAD } = require('openscad-wasm-prebuilt');

async function test() {
  const instance = await createOpenSCAD({
      print: (text) => console.log("STDOUT:", text),
      printErr: (text) => console.log("STDERR:", text)
  });
  const stl = await instance.renderToStl('minkowski() { cube([10,10,10]); sphere(r=2, $fn=50); }');
  console.log("DONE!");
}
test();
