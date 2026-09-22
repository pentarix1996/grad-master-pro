import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Course } from '../src/types/index.ts';
import { cloneCourse } from '../src/lib/cloneCourse.ts';

const makeCourse = (): Course => ({
  id: 'course-original',
  name: 'Matemáticas',
  evaluations: [{
    id: 'evaluation-1', name: 'Primera evaluación', weight: 100,
    sections: [{
      id: 'section-1', name: 'Exámenes', weight: 100,
      subsections: [
        { id: 'activity-1', name: 'Parcial' },
        { id: 'activity-2', name: 'Proyecto' },
        { id: 'activity-3', name: 'Recuperación' },
        { id: 'activity-4', name: 'Pendiente' },
      ],
    }],
  }],
  students: [{
    id: 'student-1', name: 'Ana',
    grades: { 'activity-1': 8.5, 'activity-2': 'NE', 'activity-3': 0, 'activity-4': '' },
    overrideGrades: { 'evaluation-1': 9 },
    dismissedWarnings: ['evaluation-1'],
    notes: [{ id: 'note-1', text: 'Buen progreso', date: '22/9/2026' }],
  }, { id: 'student-2', name: 'Luis', grades: {} }],
});

test('copies all course data and keeps grade and warning references valid', () => {
  const original = makeCourse();
  const copy = cloneCourse(original, '  Matemáticas B  ');
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.name, 'Matemáticas B');
  assert.deepEqual({ ...copy, id: original.id, name: original.name }, original);
  const evaluation = copy.evaluations[0];
  assert.equal(copy.students[0].grades[evaluation.sections[0].subsections[0].id], 8.5);
  assert.equal(copy.students[0].overrideGrades?.[evaluation.id], 9);
  assert.ok(copy.students[0].dismissedWarnings?.includes(evaluation.id));
});

test('editing or deleting nested data in either course leaves the other independent', () => {
  const original = makeCourse();
  const snapshot = structuredClone(original);
  const copy = cloneCourse(original, 'Copia');
  copy.evaluations[0].sections[0].subsections[0].name = 'Otro examen';
  copy.evaluations[0].weight = 50;
  copy.students[0].grades['activity-1'] = 2;
  copy.students[0].overrideGrades!['evaluation-1'] = 3;
  copy.students[0].notes![0].text = 'Otra nota';
  copy.students[0].dismissedWarnings!.push('evaluation-2');
  copy.students.pop();
  assert.deepEqual(original, snapshot);

  const copySnapshot = structuredClone(copy);
  original.evaluations.splice(0);
  original.students[0].notes!.splice(0);
  assert.deepEqual(copy, copySnapshot);
});

test('handles empty courses, legacy sections and repeated clones', () => {
  const empty: Course = { id: 'empty', name: 'Vacío', evaluations: [], students: [] };
  assert.deepEqual(cloneCourse(empty, 'Copia').students, []);
  const original = makeCourse();
  original.sections = structuredClone(original.evaluations[0].sections);
  const first = cloneCourse(original, 'Copia');
  const second = cloneCourse(original, 'Copia');
  const third = cloneCourse(first, 'Copia de copia');
  assert.equal(new Set([original.id, first.id, second.id, third.id]).size, 4);
  assert.deepEqual(first.sections, original.sections);
  first.sections![0].name = 'Cambio';
  assert.equal(original.sections[0].name, 'Exámenes');
  assert.equal(second.sections![0].name, 'Exámenes');
});

test('rejects blank names without changing the original', () => {
  const original = makeCourse();
  const snapshot = structuredClone(original);
  for (const name of ['', '   ', '\n\t']) {
    assert.throws(() => cloneCourse(original, name), /nombre/);
  }
  assert.deepEqual(original, snapshot);
});
