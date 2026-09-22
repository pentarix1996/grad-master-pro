import type {
  Competency,
  Course,
  Evaluation,
  Student,
} from "../types/index.ts";
import { calculateEvaluationDisplayGrade } from "./gradeAnalytics.ts";

export const numericGrade = (
  value: number | string | undefined,
): number | null => {
  if (
    value === undefined ||
    String(value).trim() === "" ||
    String(value).trim().toUpperCase() === "NE"
  )
    return null;
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null;
};

export const activitiesFor = (course: Course) =>
  course.evaluations.flatMap((evaluation) =>
    evaluation.sections.flatMap((section) =>
      section.subsections.map((activity) => ({
        ...activity,
        evaluationId: evaluation.id,
        context: `${evaluation.name} · ${section.name}`,
      })),
    ),
  );

export const competencyEvidence = (
  course: Course,
  competency: Competency,
  student?: Student,
) => {
  const students = student ? [student] : course.students;
  const ids = new Set(competency.subsectionIds);
  const activities = activitiesFor(course).filter((activity) =>
    ids.has(activity.id),
  );
  const values = activities
    .flatMap((activity) =>
      students.map((person) => numericGrade(person.grades[activity.id])),
    )
    .filter((value): value is number => value !== null);
  const score = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;
  return {
    score,
    recorded: values.length,
    total: activities.length * students.length,
    activities,
    status:
      score === null
        ? "pending"
        : score >= competency.target
          ? "achieved"
          : "developing",
  } as const;
};

export const evaluationSummary = (
  course: Course,
  evaluation: Evaluation,
  student?: Student,
) => {
  const students = student ? [student] : course.students;
  const activities = evaluation.sections.flatMap(
    (section) => section.subsections,
  );
  let pending = 0;
  let exempt = 0;
  let recorded = 0;
  const grades: number[] = [];
  students.forEach((person) => {
    let hasGrade =
      numericGrade(person.overrideGrades?.[evaluation.id]) !== null;
    activities.forEach((activity) => {
      const raw = person.grades[activity.id];
      if (String(raw).trim().toUpperCase() === "NE") exempt++;
      else if (numericGrade(raw) === null) pending++;
      else {
        recorded++;
        hasGrade = true;
      }
    });
    if (hasGrade)
      grades.push(calculateEvaluationDisplayGrade(person, evaluation).grade);
  });
  const validWeights =
    evaluation.sections.length > 0 &&
    evaluation.sections.every((section) => section.subsections.length > 0) &&
    Math.abs(
      evaluation.sections.reduce(
        (sum, section) => sum + Number(section.weight || 0),
        0,
      ) - 100,
    ) < 0.001;
  return {
    score: grades.length
      ? grades.reduce((sum, grade) => sum + grade, 0) / grades.length
      : null,
    pending,
    exempt,
    recorded,
    total: activities.length * students.length,
    assessed: grades.length,
    passed: grades.filter((grade) => grade >= 5).length,
    validWeights,
    canClose:
      students.length > 0 &&
      activities.length > 0 &&
      pending === 0 &&
      validWeights,
  };
};

export const evaluationSignature = (course: Course, evaluation: Evaluation) =>
  JSON.stringify({
    name: evaluation.name,
    weight: evaluation.weight,
    sections: evaluation.sections,
    students: course.students.map((student) => ({
      id: student.id,
      name: student.name,
      grades: evaluation.sections.flatMap((section) =>
        section.subsections.map((activity) => [
          activity.id,
          student.grades[activity.id] ?? "",
        ]),
      ),
      override: student.overrideGrades?.[evaluation.id] ?? "",
    })),
  });

export const formatScore = (score: number | null) =>
  score === null
    ? "—"
    : score.toLocaleString("es-ES", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
