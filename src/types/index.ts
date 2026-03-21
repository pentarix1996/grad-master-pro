export interface Subsection {
  id: string;
  name: string;
}

export interface Section {
  id: string;
  name: string;
  weight: number | '';
  subsections: Subsection[];
}

export interface Evaluation {
  id: string;
  name: string;
  weight: number | '';
  sections: Section[];
}

export interface GradeMap {
  [key: string]: number | string; // subsectionId -> grade
}

export interface Student {
  id: string;
  name: string;
  grades: GradeMap;
  overrideGrades?: { [evaluationId: string]: number | '' };
  dismissedWarnings?: string[];
}

export interface Course {
  id: string;
  name: string;
  evaluations: Evaluation[];
  students: Student[];
  // Legacy support
  sections?: Section[];
}
