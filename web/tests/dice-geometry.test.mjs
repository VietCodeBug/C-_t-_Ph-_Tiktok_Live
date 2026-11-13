import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDieMesh, dieResultQuaternion } from '../src/dice.js';

test('the physical die has six correctly numbered faces and 21 modeled pips', () => {
  const die = createDieMesh();
  assert.equal(die.name, 'physical-die');
  const faces = die.children.filter(o => o.userData.value);
  assert.equal(faces.length, 6);
  for (const face of faces) {
    assert.equal(face.children.filter(o => o.name === 'modeled-pip').length, face.userData.value);
    const resultNormal = face.userData.normal.clone().applyQuaternion(face.quaternion)
      .applyQuaternion(dieResultQuaternion(face.userData.value));
    assert.ok(resultNormal.distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-10,
      `result ${face.userData.value} must turn its actual pips towards the front camera`);
  }
  die.traverse(o => {
    if (!o.isMesh) return;
    assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));
    assert.equal(o.material.map, null, 'the die is geometry, without face image textures');
  });
});

test('invalid results cannot select a physical die orientation', () => {
  for (const value of [0, 7, 1.5, NaN, undefined]) assert.throws(() => dieResultQuaternion(value), /1–6/);
});
