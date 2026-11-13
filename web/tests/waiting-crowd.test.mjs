import test from 'node:test';
import assert from 'node:assert/strict';
import { createTownLayout } from '../src/layouts.js';
import { planWaitingCrowd } from '../src/waiting-crowd.js';

const people = count => Array.from({ length: count }, (_, i) => ({ userId: `u${i}`, seat: `P${i+21}`, actorIndex: i % 20, present: true, enrolled: true }));
test('80 waiting customers have distinct courtyard places spread through the neighborhood', () => {
  const layout = createTownLayout('CHO_VIA_HE', 42), plan = planWaitingCrowd(layout, people(80));
  assert.equal(plan.people.length, 80); assert.equal(plan.groups.length, 8);
  assert.equal(new Set(plan.people.map(person => person.position.join(':'))).size, 80);
  assert.ok(plan.groups.every(group => group.count === 10));
  assert.ok(plan.people.every(person => layout.waitingAreas.some(area => area.id === person.areaId)));
});
test('a promoted customer leaves a free place without moving everyone else between courtyards', () => {
  const layout = createTownLayout('CHO_VIA_HE', 42), all = people(80), before = planWaitingCrowd(layout, all);
  const after = planWaitingCrowd(layout, [...all.slice(1), { ...all[0], userId: 'new-user', seat: 'P999' }], before.assignments);
  const positions = new Map(before.people.map(person => [person.id, person.position]));
  for (const person of after.people) if (positions.has(person.id)) assert.deepEqual(person.position, positions.get(person.id));
  assert.equal(after.assignments.get('new-user'), before.assignments.get('u0'));
});
test('large waiting rooms stay unique and bounded inside their courtyard with a reduced sprite size', () => {
  const layout = createTownLayout('CHO_VIA_HE', 19), plan = planWaitingCrowd(layout, people(980));
  assert.equal(plan.people.length, 980); assert.equal(new Set(plan.people.map(person => person.position.join(':'))).size, 980);
  assert.ok(plan.people.every(person => person.scale < 1));
  assert.ok(plan.people.every(person => {
    const area = layout.waitingAreas.find(area => area.id === person.areaId);
    return Math.hypot(person.position[0] - area.position[0], person.position[2] - area.position[2]) < area.radius;
  }));
});
test('waiting visuals ignore removed or duplicate members and never create placeholders', () => {
  const layout = createTownLayout('CHO_VIA_HE', 42), list = people(2);
  const plan = planWaitingCrowd(layout, [...list, list[0], { ...list[1], userId: 'gone', present: false }]);
  assert.equal(plan.people.length, 2); assert.equal(planWaitingCrowd(layout, []).people.length, 0);
  assert.equal(planWaitingCrowd({ waitingAreas: [] }, list).people.length, 0);
});
