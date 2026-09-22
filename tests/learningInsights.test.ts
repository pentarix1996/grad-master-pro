import assert from "node:assert/strict";
import { test } from "node:test";
import type { Course } from "../src/types/index.ts";
import {
  competencyEvidence,
  evaluationSignature,
  evaluationSummary,
  numericGrade,
} from "../src/lib/learningInsights.ts";
import { cloneCourse } from "../src/lib/cloneCourse.ts";

const fixture = (): Course => ({
  id: "course",
  name: "Matemáticas",
  evaluations: [
    {
      id: "eval",
      name: "Primera",
      weight: 100,
      sections: [
        {
          id: "section",
          name: "Pruebas",
          weight: 100,
          subsections: [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
            { id: "c", name: "C" },
          ],
        },
      ],
    },
  ],
  students: [{ id: "student", name: "Ana", grades: { a: 8, b: "NE", c: "" } }],
  competencies: [
    {
      id: "competency",
      name: "Resolver problemas",
      description: "Justifica una solución",
      target: 7,
      subsectionIds: ["a", "b", "c", "deleted"],
    },
  ],
});

test("numeric evidence distinguishes zero from blank, NE and invalid values", () => {
  assert.equal(numericGrade(0), 0);
  assert.equal(numericGrade(" 7,5 "), 7.5);
  for (const value of [
    undefined,
    "",
    " ",
    "NE",
    " ne ",
    "abc",
    "4abc",
    -1,
    11,
    Infinity,
  ])
    assert.equal(numericGrade(value), null);
});

test("competencies use linked numeric evidence only and ignore removed activities", () => {
  const course = fixture();
  const result = competencyEvidence(course, course.competencies![0]);
  assert.equal(result.score, 8);
  assert.equal(result.status, "achieved");
  assert.equal(result.recorded, 1);
  assert.equal(result.total, 3);
  course.students[0].grades.a = 0;
  assert.equal(competencyEvidence(course, course.competencies![0]).score, 0);
  assert.equal(
    competencyEvidence(course, course.competencies![0]).status,
    "developing",
  );
  course.students[0].grades.a = "NE";
  assert.equal(competencyEvidence(course, course.competencies![0]).score, null);
  assert.equal(
    competencyEvidence(course, course.competencies![0]).status,
    "pending",
  );
});

test("student perspective excludes other students and competency averages do not use overrides", () => {
  const course = fixture();
  course.students[0].overrideGrades = { eval: 2 };
  course.students.push({ id: "second", name: "Luis", grades: { a: 4 } });
  assert.equal(competencyEvidence(course, course.competencies![0]).score, 6);
  assert.equal(
    competencyEvidence(course, course.competencies![0], course.students[0])
      .score,
    8,
  );
  assert.equal(
    evaluationSummary(course, course.evaluations[0], course.students[0]).score,
    2,
  );
});

test("closing requires complete records and valid section weights, NE is a valid exemption", () => {
  const course = fixture();
  let summary = evaluationSummary(course, course.evaluations[0]);
  assert.equal(summary.pending, 1);
  assert.equal(summary.exempt, 1);
  assert.equal(summary.canClose, false);
  course.students[0].grades.c = 6;
  summary = evaluationSummary(course, course.evaluations[0]);
  assert.equal(summary.canClose, true);
  assert.equal(summary.score, 7);
  course.evaluations[0].sections[0].weight = 90;
  assert.equal(
    evaluationSummary(course, course.evaluations[0]).canClose,
    false,
  );
});

test("missing and exempt-only students are never presented as zero or as failed", () => {
  const course = fixture();
  course.students[0].grades = { a: "NE", b: "NE", c: "NE" };
  let summary = evaluationSummary(course, course.evaluations[0]);
  assert.equal(summary.score, null);
  assert.equal(summary.assessed, 0);
  assert.equal(summary.passed, 0);
  assert.equal(summary.canClose, true);
  course.students = [];
  summary = evaluationSummary(course, course.evaluations[0]);
  assert.equal(summary.score, null);
  assert.equal(summary.canClose, false);
});

test("closure signature detects changed grades, overrides, names and structure but not private notes", () => {
  const course = fixture();
  const evaluation = course.evaluations[0];
  const signature = evaluationSignature(course, evaluation);
  course.students[0].notes = [
    { id: "note", text: "Observación privada", date: "2026-09-22" },
  ];
  assert.equal(evaluationSignature(course, evaluation), signature);
  for (const change of [
    (copy: Course) => {
      copy.students[0].grades.a = 2;
    },
    (copy: Course) => {
      copy.students[0].overrideGrades = { eval: 9 };
    },
    (copy: Course) => {
      copy.students[0].name = "Nombre actualizado";
    },
    (copy: Course) => {
      copy.evaluations[0].sections[0].weight = 90;
    },
  ]) {
    const copy = structuredClone(course);
    change(copy);
    assert.notEqual(evaluationSignature(copy, copy.evaluations[0]), signature);
  }
});

test("cloning preserves independent competencies, closures and tutoring agreements", () => {
  const course = fixture();
  course.evaluations[0].closure = {
    completedAt: "2026-09-22",
    signature: evaluationSignature(course, course.evaluations[0]),
  };
  course.students[0].notes = [
    {
      id: "agreement",
      text: "Tutoría · Practicar el viernes",
      date: "2026-09-22",
    },
  ];
  const clone = cloneCourse(course, "Nuevo grupo");
  assert.deepEqual(clone.competencies, course.competencies);
  assert.deepEqual(clone.evaluations[0].closure, course.evaluations[0].closure);
  clone.competencies![0].subsectionIds.pop();
  clone.students[0].notes![0].text = "Cambio";
  assert.equal(course.competencies![0].subsectionIds.length, 4);
  assert.equal(
    course.students[0].notes[0].text,
    "Tutoría · Practicar el viernes",
  );
});
