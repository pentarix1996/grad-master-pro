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
  closure?: { completedAt: string; signature: string };
}

export interface Competency {
  id: string;
  name: string;
  description: string;
  target: number;
  subsectionIds: string[];
}

export interface GradeMap {
  [key: string]: number | string; // subsectionId -> grade
}

export interface StudentNote {
  id: string;
  text: string;
  date: string;
}

export interface Student {
  id: string;
  name: string;
  grades: GradeMap;
  overrideGrades?: { [evaluationId: string]: number | '' };
  dismissedWarnings?: string[];
  notes?: StudentNote[];
}

export interface Course {
  id: string;
  name: string;
  evaluations: Evaluation[];
  students: Student[];
  competencies?: Competency[];
  // Legacy support
  sections?: Section[];
}
