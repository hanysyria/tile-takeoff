/**
 * Tests for the browser port. Run with: node --test web/
 *
 * These mirror tests/test_cutting.py deliberately. If the two implementations
 * ever disagree about a quantity, one of them is wrong and somebody orders the
 * wrong amount of tile — so the reference case is asserted in both languages.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareStandardSizes,
  fitToFloor,
  parseDimensions,
  recommend,
  takeoff,
  tilesPerSlab,
  zeroWasteOptions,
} from './cutting.js';

const close = (a, b, tolerance = 1e-9) => Math.abs(a - b) <= tolerance;

test('parseDimensions accepts the separators people actually type', () => {
  for (const text of ['295x175', '295X175', '295 x 175', '295×175', '295*175']) {
    assert.deepEqual(parseDimensions(text), [295, 175]);
  }
  assert.deepEqual(parseDimensions('147.5x87.5'), [147.5, 87.5]);
});

test('parseDimensions rejects nonsense instead of guessing', () => {
  for (const text of ['295', '0x175', '-295x175', 'axb', '']) {
    assert.throws(() => parseDimensions(text));
  }
});

test('every zero-waste option really wastes nothing', () => {
  const options = zeroWasteOptions(295, 175);
  assert.ok(options.length > 0);
  for (const option of options) {
    assert.ok(close(option.wasteFraction(295, 175), 0));
  }
});

test('options stay inside the practical size range', () => {
  for (const option of zeroWasteOptions(295, 175, 40, 150)) {
    assert.ok(Math.min(option.widthCm, option.heightCm) >= 40 - 1e-9);
    assert.ok(Math.max(option.widthCm, option.heightCm) <= 150 + 1e-9);
  }
});

test('options are sorted largest first', () => {
  const areas = zeroWasteOptions(295, 175).map((o) => o.areaM2);
  assert.deepEqual(areas, [...areas].sort((a, b) => b - a));
});

test('an impossible range yields nothing rather than a bad answer', () => {
  assert.deepEqual(zeroWasteOptions(295, 175, 200, 210), []);
  assert.equal(recommend(295, 175, null, null, 200, 210), null);
});

test('reference case: 295x175 recommends 147.5x87.5, 4 per slab', () => {
  const best = recommend(295, 175);
  assert.ok(best);
  assert.equal(best.widthCm, 147.5);
  assert.equal(best.heightCm, 87.5);
  assert.equal(best.perSlab, 4);
  assert.ok(close(best.areaM2, 1.290625));
});

test('a room breaks ties without shrinking the tile', () => {
  const plain = recommend(295, 175);
  const withRoom = recommend(295, 175, 1050, 810);
  assert.ok(close(plain.areaM2, withRoom.areaM2));
});

test('floor borders are the true remainders and never negative', () => {
  const fit = fitToFloor(147.5, 87.5, 1050, 810);
  assert.ok(close(fit.borderAcrossCm, 1050 - fit.coursesAcross * fit.tileWidthCm));
  assert.ok(close(fit.borderUpCm, 810 - fit.coursesUp * fit.tileHeightCm));
  assert.ok(fit.borderAcrossCm >= 0 && fit.borderUpCm >= 0);
});

test('a tile bigger than the room lays no courses', () => {
  const fit = fitToFloor(200, 200, 150, 150);
  assert.equal(fit.coursesAcross, 0);
  assert.equal(fit.coursesUp, 0);
});

test('tilesPerSlab tries both orientations and counts only whole tiles', () => {
  assert.equal(tilesPerSlab(295, 175, 60, 120), tilesPerSlab(295, 175, 120, 60));
  assert.equal(tilesPerSlab(295, 175, 300, 300), 0);
  assert.equal(tilesPerSlab(295, 175, 60, 60), 8);
});

test('standard-size waste is always a sane fraction', () => {
  for (const [, , count, waste] of compareStandardSizes(295, 175)) {
    assert.ok(waste >= 0 && waste <= 1);
    assert.ok(count >= 0);
  }
});

test('rounding never goes down and an allowance never shrinks an order', () => {
  const q = takeoff(98, 1.290625, 5.1625, 0.1);
  assert.ok(q.tilesNeeded * 1.290625 >= 98);
  assert.ok(q.slabsWithAllowance >= q.slabsBare);
  assert.equal(takeoff(98, 1.290625, 5.1625, 0).slabsWithAllowance, q.slabsBare);
});

test('reference case: 98 m² needs 76 tiles and 21 slabs at 10%', () => {
  const q = takeoff(98, 1.290625, 5.1625, 0.1);
  assert.equal(q.tilesNeeded, 76);
  assert.equal(q.slabsWithAllowance, 21);
});
