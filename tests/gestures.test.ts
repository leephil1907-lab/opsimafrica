import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HandGesture,
  pokeInside,
  dropZone,
  deliveryPosition,
  stockPosition,
} from '../src/receiving/gestures';

test('pinch hysteresis emits a single start/end and ignores pose jitter', () => {
  const g = new HandGesture();
  assert.equal(g.update(0.08, 0.19).pinchStart, false);
  assert.equal(g.update(0.025, 0.19).pinchStart, true);
  for (const distance of [0.028, 0.041, 0.032, 0.044]) {
    const s = g.update(distance, 0.19);
    assert.equal(s.pinched, true);
    assert.equal(s.pinchStart, false);
  }
  assert.equal(g.update(0.046, 0.19).pinchEnd, true);
  assert.equal(g.update(0.04, 0.19).pinched, false);
  assert.equal(g.update(0.01, 0.19).pinchStart, true);
});
test('closed-finger grabs latch and tracking loss cancels both gestures safely', () => {
  const g = new HandGesture();
  assert.equal(g.update(0.08, 0.1).grabStart, true);
  assert.equal(g.update(0.08, 0.14).gripped, true);
  assert.equal(g.update(0.08, 0.16).grabEnd, true);
  g.update(0.01, 0.09);
  const lost = g.update(0, 0, false);
  assert.equal(lost.pinchEnd, true);
  assert.equal(lost.grabEnd, true);
  assert.equal(lost.pinched, false);
  assert.equal(g.update(0.08, 0.18).pinchStart, false);
});
test('near poke uses face/depth bounds and retraction hysteresis', () => {
  assert.equal(pokeInside({ x: 0, y: 0, z: 0.08 }, 0.3, 0.12), false);
  assert.equal(pokeInside({ x: 0, y: 0, z: 0.01 }, 0.3, 0.12), true);
  assert.equal(pokeInside({ x: 0, y: 0, z: 0.04 }, 0.3, 0.12, true), true);
  assert.equal(pokeInside({ x: 0, y: 0, z: 0.06 }, 0.3, 0.12, true), false);
  assert.equal(pokeInside({ x: 0.2, y: 0, z: 0.01 }, 0.3, 0.12), false);
  assert.equal(pokeInside({ x: 0, y: 0.1, z: 0.01 }, 0.3, 0.12), false);
  assert.equal(pokeInside({ x: 0, y: 0, z: -0.1 }, 0.3, 0.12), false);
});
test('only labelled spatial storage bounds accept a drop', () => {
  assert.equal(dropZone({ x: -1.5, y: 0.95, z: -1.1 }), 'dry');
  assert.equal(dropZone({ x: 1.5, y: 0.95, z: -1.1 }), 'cold');
  assert.equal(dropZone({ x: 1.5, y: 0.95, z: 0.9 }), 'quarantine');
  assert.equal(dropZone({ x: 0, y: 0.95, z: 0 }), null);
  assert.equal(dropZone({ x: -1.5, y: 3, z: -1.1 }), null);
  assert.equal(dropZone({ x: 1.5, y: 0.1, z: 0.9 }), null);
});
test('twelve delivered cartons have distinct real positions and snapped shelf slots remain in their zones', () => {
  const positions = Array.from({ length: 12 }, (_, i) => deliveryPosition(i));
  assert.equal(new Set(positions.map((p) => p.join(','))).size, 12);
  for (const zone of ['dry', 'cold', 'quarantine'] as const)
    for (let i = 0; i < (zone === 'dry' ? 7 : 3); i++) {
      const [x, y, z] = stockPosition(zone, i);
      assert.equal(dropZone({ x, y, z }), zone);
    }
});
