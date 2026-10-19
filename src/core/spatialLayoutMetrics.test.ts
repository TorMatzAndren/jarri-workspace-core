import { measureSpatialLayout } from "./spatialLayoutMetrics";

function check(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const single = measureSpatialLayout([
  { x: 0, y: 0, width: 100, height: 100 },
]);

check(single.boundingArea === 10000, "single bounding area");
check(single.emptyArea === 0, "single has no waste");
check(single.utilization === 1, "single full utilization");
check(single.enclosedVoidCount === 0, "single has no void");
check(single.clusterCount === 1, "single forms one cluster");
check(single.occupiedPerimeter === 400, "single perimeter");

const touching = measureSpatialLayout([
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 100, y: 0, width: 100, height: 100 },
]);

check(touching.utilization === 1, "touching panels fill bounds");
check(touching.adjacentPairs === 1, "touching adjacency");
check(touching.clusterCount === 1, "touching cluster");
check(touching.occupiedPerimeter === 600, "shared edge excluded");

const separated = measureSpatialLayout([
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 200, y: 0, width: 100, height: 100 },
], 24);

check(separated.adjacentPairs === 0, "separated panels not adjacent");
check(separated.clusterCount === 2, "two separate clusters");
check(separated.enclosedVoidArea === 0, "open gap is not enclosed");

const protruding = measureSpatialLayout([
  { x: 0, y: 0, width: 100, height: 100 },
  { x: 100, y: 0, width: 100, height: 100 },
  { x: 0, y: 100, width: 100, height: 100 },
]);

check(protruding.enclosedVoidCount === 0,
  "L-shaped protrusion does not enclose a void");
check(protruding.emptyArea === 10000,
  "protrusion contributes exterior bounding waste");

const ring = measureSpatialLayout([
  { x: 0, y: 0, width: 300, height: 100 },
  { x: 0, y: 200, width: 300, height: 100 },
  { x: 0, y: 100, width: 100, height: 100 },
  { x: 200, y: 100, width: 100, height: 100 },
]);

check(ring.enclosedVoidCount === 1, "ring encloses one void");
check(ring.enclosedVoidArea === 10000, "ring void area exact");
check(ring.clusterCount === 1, "ring panels connected");

let rejectedOverlap = false;
try {
  measureSpatialLayout([
    { x: 0, y: 0, width: 100, height: 100 },
    { x: 50, y: 50, width: 100, height: 100 },
  ]);
} catch {
  rejectedOverlap = true;
}
check(rejectedOverlap, "overlap rejected");

const captured = [
  { x: -2784, y: -288, width: 1416, height: 1416 },
  { x: -1344, y: -288, width: 1152, height: 1488 },
  { x: 2640, y: 24, width: 768, height: 624 },
  { x: 24, y: 2064, width: 1512, height: 1080 },
  { x: 3432, y: 24, width: 528, height: 624 },
  { x: 1560, y: 2064, width: 1488, height: 1080 },
];

const measured = measureSpatialLayout(captured, 24);

check(measured.boundingArea === 23145408,
  "captured bounding area");
check(measured.panelArea === 7767936,
  "captured panel area");

console.log("===== SPATIAL LAYOUT REFERENCE =====");
console.log(JSON.stringify(measured, null, 2));
console.log("PASS: Spatial geometry evaluator tests");
