import type { Course, Evaluation, Student } from '../types';
import { parseLocalizedNumber } from './utils';

export const RISK_LEVEL = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;

export type RiskLevel = (typeof RISK_LEVEL)[keyof typeof RISK_LEVEL];

export interface StudentEvaluationSnapshot {
  evaluationId: string;
  evaluationName: string;
  grade: number;
  calculatedGrade: number;
  hasOverride: boolean;
  classAverage: number;
  diffFromClassAverage: number;
}

export interface StudentGradeMetrics {
  totalCells: number;
  blankCount: number;
  neCount: number;
  zeroCount: number;
  zeroRatio: number;
}

export interface StudentRiskProfile {
  studentId: string;
  studentName: string;
  level: RiskLevel;
  score: number;
  finalGrade: number;
  reasons: string[];
  suggestedActions: string[];
  metrics: StudentGradeMetrics;
  latestDrop: number;
}

export const calculateEvaluationGrade = (student: Student, evaluation: Evaluation) => {
  let weightedSum = 0;

  evaluation.sections.forEach(section => {
    let validCount = 0;
    let sum = 0;

    section.subsections.forEach(sub => {
      const rawVal = student.grades[sub.id];
      if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') return;

      validCount++;
      const val = parseLocalizedNumber(rawVal || '0');
      sum += Number.isNaN(val) ? 0 : Math.max(0, val);
    });

    const avg = validCount > 0 ? sum / validCount : 0;
    const weight = section.weight === '' ? 0 : section.weight;
    weightedSum += avg * (weight / 100);
  });

  return weightedSum;
};

export const calculateEvaluationDisplayGrade = (student: Student, evaluation: Evaluation) => {
  const calculatedGrade = calculateEvaluationGrade(student, evaluation);
  const overrideGrade = student.overrideGrades?.[evaluation.id];
  const hasOverride = overrideGrade !== undefined && overrideGrade !== '';

  return {
    calculatedGrade,
    grade: hasOverride ? (overrideGrade as number) : calculatedGrade,
    hasOverride,
  };
};

export const calculateFinalCourseGrade = (student: Student, course: Course) => {
  let finalGrade = 0;

  course.evaluations.forEach(evaluation => {
    const { grade } = calculateEvaluationDisplayGrade(student, evaluation);
    const weight = evaluation.weight === '' ? 0 : evaluation.weight;
    finalGrade += grade * (weight / 100);
  });

  return finalGrade;
};

export const isEvaluationStarted = (course: Course, evaluation: Evaluation) => {
  return course.students.some(student => {
    const overrideGrade = student.overrideGrades?.[evaluation.id];
    if (overrideGrade !== undefined && overrideGrade !== '') return true;

    return evaluation.sections.some(section => {
      return section.subsections.some(subsection => {
        const rawVal = student.grades[subsection.id];
        if (rawVal === undefined || rawVal === null || rawVal === '') return false;
        if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') return false;

        return !Number.isNaN(parseLocalizedNumber(rawVal));
      });
    });
  });
};

export const getStartedEvaluations = (course: Course) => {
  return course.evaluations.filter(evaluation => isEvaluationStarted(course, evaluation));
};

export const calculateCurrentCourseGrade = (student: Student, course: Course) => {
  const startedEvaluations = getStartedEvaluations(course);
  const totalStartedWeight = startedEvaluations.reduce((sum, evaluation) => {
    return sum + (evaluation.weight === '' ? 0 : evaluation.weight);
  }, 0);

  if (totalStartedWeight === 0) return 0;

  return startedEvaluations.reduce((sum, evaluation) => {
    const { grade } = calculateEvaluationDisplayGrade(student, evaluation);
    const weight = evaluation.weight === '' ? 0 : evaluation.weight;
    return sum + grade * (weight / totalStartedWeight);
  }, 0);
};

export const calculateEvaluationClassAverage = (course: Course, evaluation: Evaluation) => {
  if (course.students.length === 0) return 0;

  const total = course.students.reduce((sum, student) => {
    return sum + calculateEvaluationDisplayGrade(student, evaluation).grade;
  }, 0);

  return total / course.students.length;
};

export const getStudentEvaluationTimeline = (student: Student, course: Course): StudentEvaluationSnapshot[] => {
  return getStartedEvaluations(course).map(evaluation => {
    const { calculatedGrade, grade, hasOverride } = calculateEvaluationDisplayGrade(student, evaluation);
    const classAverage = calculateEvaluationClassAverage(course, evaluation);

    return {
      evaluationId: evaluation.id,
      evaluationName: evaluation.name,
      grade: Number(grade.toFixed(2)),
      calculatedGrade: Number(calculatedGrade.toFixed(2)),
      hasOverride,
      classAverage: Number(classAverage.toFixed(2)),
      diffFromClassAverage: Number((grade - classAverage).toFixed(2)),
    };
  });
};

export const getStudentGradeMetrics = (student: Student, course: Course): StudentGradeMetrics => {
  let totalCells = 0;
  let blankCount = 0;
  let neCount = 0;
  let zeroCount = 0;

  getStartedEvaluations(course).forEach(evaluation => {
    evaluation.sections.forEach(section => {
      section.subsections.forEach(subsection => {
        totalCells++;
        const rawVal = student.grades[subsection.id];

        if (rawVal === undefined || rawVal === null || rawVal === '') {
          blankCount++;
          return;
        }

        if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') {
          neCount++;
          return;
        }

        const val = parseLocalizedNumber(rawVal);
        if (!Number.isNaN(val) && val === 0) zeroCount++;
      });
    });
  });

  return {
    totalCells,
    blankCount,
    neCount,
    zeroCount,
    zeroRatio: totalCells > 0 ? zeroCount / totalCells : 0,
  };
};

const uniq = (values: string[]) => Array.from(new Set(values));

export const getStudentRiskProfile = (student: Student, course: Course): StudentRiskProfile => {
  const timeline = getStudentEvaluationTimeline(student, course);
  const metrics = getStudentGradeMetrics(student, course);
  const finalGrade = calculateCurrentCourseGrade(student, course);
  const reasons: string[] = [];
  const suggestedActions: string[] = [];
  let score = 0;
  let latestDrop = 0;

  if (timeline.length === 0) {
    return {
      studentId: student.id,
      studentName: student.name,
      level: RISK_LEVEL.LOW,
      score: 0,
      finalGrade: 0,
      reasons: [],
      suggestedActions: [],
      metrics,
      latestDrop: 0,
    };
  }

  if (finalGrade < 5) {
    score += 3;
    reasons.push(`Nota final actual por debajo de 5 (${finalGrade.toFixed(2)})`);
    suggestedActions.push('Planificar actividad de recuperación o refuerzo');
  } else if (finalGrade >= 4.5 && finalGrade < 5) {
    score += 2;
    reasons.push(`Está cerca del aprobado (${finalGrade.toFixed(2)})`);
    suggestedActions.push('Priorizar seguimiento: puede recuperar con una intervención corta');
  }

  for (let index = 1; index < timeline.length; index++) {
    const drop = timeline[index - 1].grade - timeline[index].grade;
    if (drop > latestDrop) latestDrop = drop;
  }

  if (latestDrop >= 1.5) {
    score += 3;
    reasons.push(`Bajada de ${latestDrop.toFixed(2)} puntos respecto a una evaluación anterior`);
    suggestedActions.push('Revisar cambio de rendimiento entre evaluaciones');
  }

  const latestSnapshot = timeline[timeline.length - 1];
  if (latestSnapshot && latestSnapshot.diffFromClassAverage <= -1) {
    score += 2;
    reasons.push(`${Math.abs(latestSnapshot.diffFromClassAverage).toFixed(2)} puntos por debajo de la media de clase en la última evaluación`);
    suggestedActions.push('Comparar con la evolución media del grupo');
  }

  if (metrics.zeroCount >= 3 || metrics.zeroRatio >= 0.25) {
    score += 3;
    reasons.push(`${metrics.zeroCount} notas con 0: posible patrón de no entrega`);
    suggestedActions.push('Revisar entregas no realizadas y acordar recuperación de tareas');
  } else if (metrics.zeroCount > 0) {
    score += 1;
    reasons.push(`${metrics.zeroCount} nota${metrics.zeroCount === 1 ? '' : 's'} con 0`);
    suggestedActions.push('Comprobar si el 0 corresponde a no entrega');
  }

  if (metrics.blankCount >= 3) {
    score += 2;
    reasons.push(`${metrics.blankCount} notas sin registrar`);
    suggestedActions.push('Completar notas pendientes antes de tomar decisiones');
  }

  if (metrics.neCount >= 3) {
    score += 1;
    reasons.push(`${metrics.neCount} registros marcados como NE`);
    suggestedActions.push('Verificar si los NE responden a adaptación, ausencia o exención');
  }

  const hasOverrideDrift = getStartedEvaluations(course).some(evaluation => {
    const override = student.overrideGrades?.[evaluation.id];
    if (override === undefined || override === '') return false;
    return Math.abs((override as number) - calculateEvaluationGrade(student, evaluation)) > 1;
  });

  if (hasOverrideDrift) {
    score += 1;
    reasons.push('Alguna Nota Real difiere más de 1 punto de la nota calculada');
    suggestedActions.push('Justificar la Nota Real con una anotación');
  }

  const level = score >= 5 ? RISK_LEVEL.HIGH : score >= 2 ? RISK_LEVEL.MEDIUM : RISK_LEVEL.LOW;

  return {
    studentId: student.id,
    studentName: student.name,
    level,
    score,
    finalGrade,
    reasons,
    suggestedActions: uniq(suggestedActions),
    metrics,
    latestDrop,
  };
};

export const getCourseRiskProfiles = (course: Course) => {
  return course.students
    .map(student => getStudentRiskProfile(student, course))
    .sort((a, b) => b.score - a.score || a.finalGrade - b.finalGrade || a.studentName.localeCompare(b.studentName));
};
