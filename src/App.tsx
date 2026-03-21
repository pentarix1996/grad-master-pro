import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Settings,
  Users,
  ChevronLeft,
  Download,
  Upload,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  X,
  Pencil,
  AlertTriangle,
  Sun,
  Moon,
  PieChart,
  ListChecks,
  Target,
  Info,
  TrendingDown,
  TrendingUp,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Course, Evaluation, Section, Student } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { cn, generateId } from './lib/utils';
import { ReportCard } from './components/ReportCard';
import { RubricModal } from './components/RubricModal';
import { CourseReport } from './components/CourseReport';
// --- COMPONENTES UI (Mini Design System) ---

const Button = ({ children, variant = 'primary', className, ...props }: any) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none ring-offset-white dark:ring-offset-slate-900";
  const variants: any = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-indigo-500 dark:hover:bg-indigo-600",
    secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
    ghost: "hover:bg-slate-100 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30",
    outline: "border border-slate-200 hover:bg-slate-100 text-slate-900 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
  };
  const sizes = "h-10 py-2 px-4";

  return (
    <button className={cn(base, variants[variant], sizes, className)} {...props}>
      {children}
    </button>
  );
};

const Input = ({ className, ...props }: any) => (
  <input
    className={cn(
      "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
      "dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-offset-slate-950",
      className
    )}
    {...props}
  />
);

const Card = ({ children, className }: any) => (
  <div className={cn("rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-50", className)}>
    {children}
  </div>
);

const Dialog = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900 dark:border dark:border-slate-800"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>
        {children}
      </motion.div>
    </div>
  );
};

// --- LOGICA DE CALCULO ---

const calculateEvaluationGrade = (student: Student, evaluation: Evaluation) => {
  let weightedSum = 0;

  evaluation.sections.forEach(section => {
    let validCount = 0;
    let sum = 0;

    section.subsections.forEach(sub => {
      const rawVal = student.grades[sub.id];
      if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') {
        return;
      }
      validCount++;
      const val = parseFloat((rawVal as string) || '0');
      sum += isNaN(val) ? 0 : Math.max(0, val);
    });

    const avg = validCount > 0 ? sum / validCount : 0;

    const weight = section.weight === '' ? 0 : section.weight;
    weightedSum += avg * (weight / 100);
  });

  return weightedSum;
};

const calculateFinalCourseGrade = (student: Student, course: Course) => {
  let finalGrade = 0;
  course.evaluations.forEach(ev => {
    const overrideGrade = student.overrideGrades?.[ev.id];
    const evalGrade = overrideGrade !== undefined && overrideGrade !== ''
      ? overrideGrade
      : calculateEvaluationGrade(student, ev);
    const weight = ev.weight === '' ? 0 : ev.weight;
    finalGrade += (evalGrade as number) * (weight / 100);
  });
  return finalGrade;
}

const calculatePureCourseGrade = (student: Student, course: Course) => {
  let finalGrade = 0;
  course.evaluations.forEach(ev => {
    const evalGrade = calculateEvaluationGrade(student, ev);
    const weight = ev.weight === '' ? 0 : ev.weight;
    finalGrade += evalGrade * (weight / 100);
  });
  return finalGrade;
}

// --- COMPONENTES DE NEGOCIO ---

// A. Configuración de una Evaluación Individual (Lo que antes era el Config Course)
const EvaluationConfig = ({ evaluation, onUpdate }: { evaluation: Evaluation, onUpdate: (e: Evaluation) => void }) => {
  const totalWeight = evaluation.sections.reduce((acc, curr) => acc + (curr.weight === '' ? 0 : parseInt((curr.weight || 0).toString())), 0);
  const isWeightValid = totalWeight === 100;

  const addSection = () => {
    const newSection: Section = {
      id: generateId(),
      name: 'Nueva Sección',
      weight: 0,
      subsections: [{ id: generateId(), name: 'Item 1' }]
    };
    onUpdate({ ...evaluation, sections: [...evaluation.sections, newSection] });
  };

  const updateSection = (id: string, field: keyof Section, value: any) => {
    let finalValue = value;
    if (field === 'weight') {
      if (value === '') finalValue = '';
      else finalValue = parseInt(value);
    }
    const newSections = evaluation.sections.map(s => s.id === id ? { ...s, [field]: finalValue } : s);
    onUpdate({ ...evaluation, sections: newSections });
  };

  const removeSection = (id: string) => {
    onUpdate({ ...evaluation, sections: evaluation.sections.filter(s => s.id !== id) });
  };

  const addSubsection = (sectionId: string) => {
    const newSections = evaluation.sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          subsections: [...s.subsections, { id: generateId(), name: `Item ${s.subsections.length + 1} ` }]
        };
      }
      return s;
    });
    onUpdate({ ...evaluation, sections: newSections });
  };

  const removeSubsection = (sectionId: string, subId: string) => {
    const newSections = evaluation.sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          subsections: s.subsections.filter(sub => sub.id !== subId)
        };
      }
      return s;
    });
    onUpdate({ ...evaluation, sections: newSections });
  };

  const updateSubsectionName = (sectionId: string, subId: string, name: string) => {
    const newSections = evaluation.sections.map(s => {
      if (s.id === sectionId) {
        return {
          ...s,
          subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, name } : sub)
        };
      }
      return s;
    });
    onUpdate({ ...evaluation, sections: newSections });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
            <ListChecks size={24} />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Configurar: {evaluation.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Define las secciones (exámenes, tareas) para esta evaluación.</p>
          </div>
        </div>
        <div className={cn("px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2", isWeightValid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
          {isWeightValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {totalWeight}% Distribuido
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {evaluation.sections.map((section, index) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              key={section.id}
              className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900/50 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center">
                <div className="flex-1 w-full">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-1.5">
                    <Target size={12} /> Nombre Sección
                  </label>
                  <Input
                    value={section.name}
                    onChange={(e: any) => updateSection(section.id, 'name', e.target.value)}
                    placeholder="Ej: Exámenes"
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-1.5">
                    Peso Local (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0" max="100"
                      value={section.weight === 0 ? '' : section.weight}
                      onChange={(e: any) => updateSection(section.id, 'weight', e.target.value)}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <Button variant="ghost" className="mt-6 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" onClick={() => removeSection(section.id)}>
                  <Trash2 size={18} />
                </Button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-md space-y-2 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ListChecks size={14} /> Items
                  </span>
                  <button onClick={() => addSubsection(section.id)} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                    <Plus size={12} /> Añadir Item
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {section.subsections.map(sub => (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={sub.id} className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 shadow-sm">
                      <input
                        className="flex-1 text-sm bg-transparent outline-none py-1 text-slate-700 dark:text-slate-200 placeholder-slate-400"
                        value={sub.name}
                        onChange={(e) => updateSubsectionName(section.id, sub.id, e.target.value)}
                        placeholder="Nombre item"
                      />
                      <button onClick={() => removeSubsection(section.id, sub.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400">
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Button onClick={addSection} variant="outline" className="w-full border-dashed border-2 py-6 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900/50">
        <Plus className="mr-2" size={20} /> Añadir Sección (Ej: Tareas, Proyectos)
      </Button>
    </div>
  );
};

// B. Configuración Global del Curso (Gestionar Evaluaciones)
const GlobalCourseConfig = ({ course, onUpdate }: { course: Course, onUpdate: (c: Course) => void }) => {
  const [editingEvalId, setEditingEvalId] = useState<string | null>(null);

  const totalWeight = course.evaluations.reduce((acc, curr) => acc + (curr.weight === '' ? 0 : parseInt((curr.weight || 0).toString())), 0);
  const isWeightValid = totalWeight === 100;

  const addEvaluation = () => {
    const newEval: Evaluation = {
      id: generateId(),
      name: 'Nueva Evaluación',
      weight: 0,
      sections: [
        { id: generateId(), name: 'Exámenes', weight: 100, subsections: [{ id: generateId(), name: 'Examen 1' }] }
      ]
    };
    onUpdate({ ...course, evaluations: [...course.evaluations, newEval] });
  };

  const updateEvaluation = (id: string, field: keyof Evaluation, value: any) => {
    let finalValue = value;
    if (field === 'weight') {
      if (value === '') finalValue = '';
      else finalValue = parseInt(value);
    }
    const newEvals = course.evaluations.map(e => e.id === id ? { ...e, [field]: finalValue } : e);
    onUpdate({ ...course, evaluations: newEvals });
  };

  const updateEvaluationContent = (updatedEval: Evaluation) => {
    const newEvals = course.evaluations.map(e => e.id === updatedEval.id ? updatedEval : e);
    onUpdate({ ...course, evaluations: newEvals });
  };

  if (editingEvalId) {
    const currentEval = course.evaluations.find(e => e.id === editingEvalId);
    if (!currentEval) return null;
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setEditingEvalId(null)} className="mb-2">
          <ChevronLeft size={18} className="mr-1" /> Volver a Evaluaciones
        </Button>
        <EvaluationConfig evaluation={currentEval} onUpdate={updateEvaluationContent} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
            <PieChart size={24} />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Evaluaciones del Curso</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Peso Total: {totalWeight}% (Debe ser 100%)</p>
          </div>
        </div>
        <div className={cn("px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2", isWeightValid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
          {isWeightValid ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {totalWeight}%
        </div>
      </div>

      <div className="grid gap-4">
        {course.evaluations.map((ev) => (
          <motion.div
            key={ev.id}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
          >
            <div className="flex-1 w-full">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Nombre</label>
              <Input
                value={ev.name}
                onChange={(e: any) => updateEvaluation(ev.id, 'name', e.target.value)}
              />
            </div>
            <div className="w-full md:w-32">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Peso (%)</label>
              <div className="relative">
                <Input
                  type="number"
                  min="0" max="100"
                  value={ev.weight === 0 ? '' : ev.weight}
                  onChange={(e: any) => updateEvaluation(ev.id, 'weight', e.target.value)}
                />
                <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Button onClick={() => setEditingEvalId(ev.id)} variant="secondary" className="gap-2">
                <Settings size={16} /> Configurar
              </Button>
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-600 dark:text-red-400 group"
                onClick={() => {
                  if (confirm('¿Borrar evaluación?')) {
                    onUpdate({
                      ...course,
                      evaluations: course.evaluations.filter(e => e.id !== ev.id)
                    })
                  }
                }}
              >
                <Trash2 size={18} />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>

      <Button onClick={addEvaluation} variant="outline" className="w-full border-dashed border-2 py-6 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-900/50">
        <Plus className="mr-2" size={20} /> Añadir Nueva Evaluación (Ej: 2ª Evaluación)
      </Button>
    </div>
  )
}

// C. Libro de Notas Individual (Por Evaluación)
const EvaluationGradebook = ({ course, evaluation, onUpdate }: { course: Course, evaluation: Evaluation, onUpdate: (c: Course) => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentNameInput, setStudentNameInput] = useState('');
  
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);
  const [rubricTarget, setRubricTarget] = useState<{ studentId: string, subsectionId: string, currentGrade: number | string } | null>(null);

  const openEditStudentModal = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentNameInput(student.name);
    setIsStudentModalOpen(true);
  };

  const saveStudent = () => {
    if (!studentNameInput.trim()) return;

    if (editingStudentId) {
      const newStudents = course.students.map(s =>
        s.id === editingStudentId ? { ...s, name: studentNameInput } : s
      );
      onUpdate({ ...course, students: newStudents });
    }
    setIsStudentModalOpen(false);
    setEditingStudentId(null);
    setStudentNameInput('');
  };

  const deleteStudent = (id: string) => {
    if (confirm("¿Eliminar este alumno?")) {
      onUpdate({ ...course, students: course.students.filter(s => s.id !== id) });
    }
  };

  const calculateStats = (student: Student) => {
    let weightedSum = 0;
    let hasWarning = false;

    const sectionAverages = evaluation.sections.map(section => {
      let validCount = 0;
      let sum = 0;

      section.subsections.forEach(sub => {
        const rawVal = student.grades[sub.id];
        if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') {
          return;
        }
        validCount++;
        const val = parseFloat((rawVal as string) || '0');
        if (val > 10) hasWarning = true;
        sum += isNaN(val) ? 0 : Math.max(0, val);
      });
      const avg = validCount > 0 ? sum / validCount : 0;

      const weight = section.weight === '' ? 0 : section.weight;
      weightedSum += avg * (weight / 100);

      return { id: section.id, avg };
    });

    return { sectionAverages, finalGrade: weightedSum, hasWarning };
  };

  const handleGradeChange = (studentId: string, subsectionId: string, value: string) => {
    if (value === '') {
      updateStudentGrade(studentId, subsectionId, '');
      return;
    }
    if (value.trim().toUpperCase() === 'NE') {
      updateStudentGrade(studentId, subsectionId, 'NE');
      return;
    }
    updateStudentGrade(studentId, subsectionId, value);
  };

  const updateStudentGrade = (studentId: string, subsectionId: string, val: number | string) => {
    const newStudents = course.students.map(s => {
      if (s.id === studentId) {
        return { ...s, grades: { ...s.grades, [subsectionId]: val } };
      }
      return s;
    });
    onUpdate({ ...course, students: newStudents });
  }

  const handleOverrideGradeChange = (studentId: string, value: string) => {
    const newStudents = course.students.map(s => {
      if (s.id === studentId) {
        const newVal = value === '' ? '' : parseFloat(value);
        const finalVal: number | '' = isNaN(newVal as number) ? '' : newVal;
        const overrideGrades: { [evaluationId: string]: number | '' } = { ...s.overrideGrades, [evaluation.id]: finalVal };
        return { ...s, overrideGrades };
      }
      return s;
    });
    onUpdate({ ...course, students: newStudents });
  };

  const dismissWarning = (studentId: string) => {
    const warningId = `${studentId}-${evaluation.id}`;
    const newStudents = course.students.map(s => {
      if (s.id === studentId) {
        const dismissed = s.dismissedWarnings || [];
        return { ...s, dismissedWarnings: [...dismissed, warningId] };
      }
      return s;
    });
    onUpdate({ ...course, students: newStudents });
  };

  const filteredStudents = course.students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradeColorClass = (grade: number) => {
    if (grade < 5) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-900/50";
    if (grade >= 5 && grade < 7) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-900/50";
    if (grade >= 7) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 ring-1 ring-green-200 dark:ring-green-900/50";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
  };

  const evaluationStats = useMemo(() => {
    if (!course.students || course.students.length === 0) return { approved: 0, failed: 0, avg: 0 };

    let approvedCount = 0;
    let sum = 0;

    course.students.forEach(s => {
      const override = s.overrideGrades?.[evaluation.id];
      const grade = override !== undefined && override !== '' ? override : calculateEvaluationGrade(s, evaluation);
      if (grade >= 5) approvedCount++;
      sum += grade;
    });

    const total = course.students.length;
    return {
      approved: (approvedCount / total) * 100,
      failed: ((total - approvedCount) / total) * 100,
      avg: sum / total
    };
  }, [course.students, evaluation]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-green-50 dark:bg-green-900/10 p-3 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col items-center justify-center">
          <div className="text-green-600 dark:text-green-400 text-xs font-semibold uppercase mb-0.5">Aprobados</div>
          <div className="text-xl font-bold text-green-700 dark:text-green-300">{evaluationStats.approved.toFixed(1)}%</div>
        </div>
        <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center">
          <div className="text-red-600 dark:text-red-400 text-xs font-semibold uppercase mb-0.5">Suspensos</div>
          <div className="text-xl font-bold text-red-700 dark:text-red-300">{evaluationStats.failed.toFixed(1)}%</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center">
          <div className="text-blue-600 dark:text-blue-400 text-xs font-semibold uppercase mb-0.5">Media Evaluación</div>
          <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{evaluationStats.avg.toFixed(2)}</div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl p-3 flex gap-3 text-sm text-blue-800 dark:text-blue-300 mb-4">
        <Info className="shrink-0 mt-0.5 text-blue-500 dark:text-blue-400" size={18} />
        <div>
          <span className="font-semibold block mb-0.5">Información sobre notas "NE"</span>
          Puedes escribir <strong>NE</strong> (No Evaluable) en la nota de cualquier alumno para que no cuente en la media de esa sección. Cualquier celda vacía u otro texto se calculará como un 0.
        </div>
      </div>

      <div className="relative w-full sm:w-64 mb-4">
        <Input
          placeholder="Buscar alumno..."
          value={searchTerm}
          onChange={(e: any) => setSearchTerm(e.target.value)}
          className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
        />
        <Users className="absolute left-3 top-2.5 text-slate-400" size={16} />
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50/80 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-slate-100 dark:border-slate-800">
                Alumno
              </th>
              {evaluation.sections.map(section => (
                <React.Fragment key={section.id}>
                  {section.subsections.map(sub => (
                    <th key={sub.id} className="px-2 py-3 min-w-[80px] text-center font-medium border-l border-slate-100 dark:border-slate-800">
                      <div className="truncate max-w-[100px] text-slate-700 dark:text-slate-300 font-semibold" title={sub.name}>{sub.name}</div>
                      <div className="text-[10px] text-slate-400 normal-case">{section.name}</div>
                    </th>
                  ))}
                  <th className="px-2 py-3 bg-indigo-50/40 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 min-w-[60px] text-center font-bold border-l border-indigo-100/50 dark:border-indigo-900/30">
                    Avg ({section.weight || 0}%)
                  </th>
                </React.Fragment>
              ))}
              <th className="px-3 py-3 font-bold text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800 text-center min-w-[90px] border-l border-slate-200 dark:border-slate-700">
                Nota {evaluation.name}
              </th>
              <th className="px-3 py-3 font-bold text-purple-700 dark:text-purple-300 bg-purple-50/50 dark:bg-purple-900/20 text-center min-w-[90px] border-l border-purple-200 dark:border-purple-800">
                Nota Real
              </th>
              <th className="px-2 py-3 w-20 text-center border-l border-slate-100 dark:border-slate-800">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredStudents.map((student) => {
              const stats = calculateStats(student);
              const overrideGrade = student.overrideGrades?.[evaluation.id];
              const hasOverride = overrideGrade !== undefined && overrideGrade !== '';
              const gradeDiff = hasOverride ? Math.abs((overrideGrade as number) - stats.finalGrade) : 0;
              const showOverrideWarning = hasOverride && gradeDiff > 1;
              const warningId = `${student.id}-${evaluation.id}`;
              const isWarningDismissed = student.dismissedWarnings?.includes(warningId);

              // Lógica de Alerta Temprana (Early Warning)
              let trendWarning = false;
              let trendImprovement = false;
              const evalIndex = course.evaluations.findIndex(e => e.id === evaluation.id);
              if (evalIndex > 0) {
                const prevEval = course.evaluations[evalIndex - 1];
                let prevEvalSum = 0;
                prevEval.sections.forEach(sec => {
                  let subSum = 0;
                  let validCount = 0;
                  sec.subsections.forEach(sub => {
                    const rawVal = student.grades[sub.id];
                    if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') return;
                    validCount++;
                    const val = parseFloat((rawVal as string) || '0');
                    subSum += isNaN(val) ? 0 : Math.max(0, val);
                  });
                  const avg = validCount > 0 ? subSum / validCount : 0;
                  const weight = sec.weight === '' ? 0 : sec.weight;
                  prevEvalSum += avg * (weight / 100);
                });
                const prevOverride = student.overrideGrades?.[prevEval.id];
                const prevFinal = prevOverride !== undefined && prevOverride !== '' ? prevOverride : prevEvalSum;
                const currentFinal = hasOverride ? overrideGrade : stats.finalGrade;
                
                if ((prevFinal as number) - (currentFinal as number) >= 1.5) {
                  trendWarning = true;
                } else if ((currentFinal as number) - (prevFinal as number) >= 1.5) {
                  trendImprovement = true;
                }
              }

              return (
                <React.Fragment key={student.id}>
                  <tr className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 border-r border-slate-100 dark:border-slate-800">
                      <button onClick={() => setSelectedStudentForReport(student)} className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-2 cursor-pointer text-left w-full transition-colors" title="Ver Perfil y PDF">
                        {student.name}
                      </button>
                    </td>
                    {evaluation.sections.map(section => {
                      const sectionStat = stats.sectionAverages.find(s => s.id === section.id);
                      return (
                        <React.Fragment key={section.id}>
                          {section.subsections.map(sub => (
                            <td key={sub.id} className="px-1 py-1 border-l border-slate-100 dark:border-slate-800 p-0 relative group/input">
                              <div className="flex items-center h-full w-full relative">
                                <input
                                  type="text"
                                  className="w-full h-full text-center bg-transparent focus:bg-indigo-50/30 dark:focus:bg-indigo-900/20 focus:ring-2 focus:ring-indigo-500 rounded-none py-2 outline-none transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600 font-mono text-sm uppercase"
                                  value={student.grades[sub.id] === undefined ? '' : student.grades[sub.id]}
                                  onChange={(e) => handleGradeChange(student.id, sub.id, e.target.value)}
                                  placeholder="-"
                                />
                                <button 
                                  onClick={() => setRubricTarget({ studentId: student.id, subsectionId: sub.id, currentGrade: student.grades[sub.id] === undefined ? '' : student.grades[sub.id] })}
                                  className="absolute right-1 opacity-0 group-hover/input:opacity-100 p-0.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-opacity cursor-pointer bg-white/80 dark:bg-slate-900/80 rounded" 
                                  title="Usar Rúbrica Analítica"
                                >
                                  <ListChecks size={14} />
                                </button>
                              </div>
                            </td>
                          ))}
                          <td className="px-2 py-2 text-center font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/20 dark:bg-indigo-900/10 border-l border-indigo-100/50 dark:border-indigo-900/30">
                            {sectionStat?.avg.toFixed(1)}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className="px-3 py-3 text-center border-l border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold shadow-sm",
                          getGradeColorClass(stats.finalGrade)
                        )}>
                          {stats.finalGrade.toFixed(2)}
                        </span>
                        {stats.hasWarning && (
                          <div className="text-amber-500 animate-pulse" title="Nota > 10 detectada">
                            <AlertTriangle size={14} />
                          </div>
                        )}
                        {trendWarning && (
                          <div className="text-red-500" title="Alerta Temprana: Fuerte caída de rendimiento (> 1.5 puntos respecto a anterior evaluación)">
                            <TrendingDown size={14} />
                          </div>
                        )}
                        {trendImprovement && (
                          <div className="text-green-500" title="Mejora Destacable: Fuerte subida de rendimiento (> 1.5 puntos respecto a anterior evaluación)">
                            <TrendingUp size={14} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-l border-purple-200 dark:border-purple-800 bg-purple-50/20 dark:bg-purple-900/10">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.01"
                          className={cn(
                            "w-16 text-center bg-white dark:bg-slate-800 border rounded-md py-1 px-1 text-sm font-mono transition-all focus:ring-2 focus:ring-purple-500 outline-none",
                            hasOverride
                              ? "border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300"
                              : "border-slate-200 dark:border-slate-700 text-slate-400"
                          )}
                          value={overrideGrade === undefined ? '' : overrideGrade}
                          onChange={(e) => handleOverrideGradeChange(student.id, e.target.value)}
                          placeholder="-"
                        />
                        {showOverrideWarning && !isWarningDismissed && (
                          <div className="relative group/warn">
                            <div className="text-amber-500 animate-pulse cursor-help" title="Diferencia > 1 punto">
                              <AlertTriangle size={14} />
                            </div>
                            <button
                              onClick={() => dismissWarning(student.id)}
                              className="absolute -top-1 -right-1 bg-slate-100 dark:bg-slate-700 rounded-full p-0.5 opacity-0 group-hover/warn:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/30"
                              title="Cerrar aviso"
                            >
                              <X size={10} className="text-slate-500 hover:text-red-500" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-center border-l border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditStudentModal(student)}
                          className="text-slate-300 hover:text-indigo-600 dark:text-slate-600 dark:hover:text-indigo-400 p-1 transition-colors"
                          title="Editar alumno"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteStudent(student.id)}
                          className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1 transition-colors"
                          title="Eliminar alumno"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {stats.hasWarning && (
                    <tr className="bg-amber-50 dark:bg-amber-900/10">
                      <td colSpan={100} className="px-4 py-2 border-b border-amber-100 dark:border-amber-900/20">
                        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium justify-center">
                          <AlertTriangle size={12} />
                          <span>Atención: Se han detectado notas superiores a 10. Verifica si es correcto.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {showOverrideWarning && !isWarningDismissed && (
                    <tr className="bg-purple-50 dark:bg-purple-900/10">
                      <td colSpan={100} className="px-4 py-2 border-b border-purple-100 dark:border-purple-900/20">
                        <div className="flex items-center gap-2 text-xs text-purple-700 dark:text-purple-400 font-medium justify-center">
                          <AlertTriangle size={12} />
                          <span>Aviso: La Nota Real difiere en más de 1 punto de la nota calculada ({stats.finalGrade.toFixed(2)} vs {(overrideGrade as number).toFixed(2)})</span>
                          <button
                            onClick={() => dismissWarning(student.id)}
                            className="ml-2 text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 underline"
                          >
                            Ignorar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {selectedStudentForReport && (
        <ReportCard 
          student={selectedStudentForReport}
          course={course}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
      
      {rubricTarget && (
        <RubricModal
          initialGrade={rubricTarget.currentGrade}
          onSave={(val) => {
            handleGradeChange(rubricTarget.studentId, rubricTarget.subsectionId, val.toString());
            setRubricTarget(null);
          }}
          onClose={() => setRubricTarget(null)}
        />
      )}
      
      <Dialog
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title="Editar Alumno"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
            <Input
              value={studentNameInput}
              onChange={(e: any) => setStudentNameInput(e.target.value)}
              placeholder="Ej: Juan Pérez"
              autoFocus
              onKeyDown={(e: any) => e.key === 'Enter' && saveStudent()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveStudent}>Guardar Cambios</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
};


// D. Vista Global de Notas Finales y Selector
const GlobalGradebook = ({ course, onUpdate }: { course: Course, onUpdate: (c: Course) => void }) => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' or evaluationId
  const [searchTerm, setSearchTerm] = useState('');

  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentNameInput, setStudentNameInput] = useState('');
  const [isCourseReportOpen, setIsCourseReportOpen] = useState(false);
  const [selectedStudentForReport, setSelectedStudentForReport] = useState<Student | null>(null);

  const openAddStudentModal = () => {
    setEditingStudentId(null);
    setStudentNameInput('');
    setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentNameInput(student.name);
    setIsStudentModalOpen(true);
  };

  const saveStudent = () => {
    if (!studentNameInput.trim()) return;

    if (editingStudentId) {
      const newStudents = course.students.map(s =>
        s.id === editingStudentId ? { ...s, name: studentNameInput } : s
      );
      onUpdate({ ...course, students: newStudents });
    } else {
      onUpdate({
        ...course,
        students: [...course.students, { id: generateId(), name: studentNameInput, grades: {} }]
      });
    }
    setIsStudentModalOpen(false);
  };

  const deleteStudent = (id: string) => {
    if (confirm("¿Eliminar este alumno?")) {
      onUpdate({ ...course, students: course.students.filter(s => s.id !== id) });
    }
  };

  const getGradeColorClass = (grade: number) => {
    if (grade < 5) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    if (grade >= 5 && grade < 7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    if (grade >= 7) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
  };

  const filteredStudents = course.students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'summary'
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            <GraduationCap size={16} /> Resumen Final
          </button>
          {course.evaluations.map(ev => (
            <button
              key={ev.id}
              onClick={() => setActiveTab(ev.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                activeTab === ev.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              {ev.name}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setIsCourseReportOpen(true)} 
            className="bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 shadow-sm"
          >
            <FileText size={16} className="mr-2" /> Informe Claustro
          </Button>
          <Button onClick={openAddStudentModal}>
            <Plus size={16} className="mr-2" /> Alumno
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm min-h-[400px]">
        {activeTab === 'summary' ? (
          <div className="space-y-4">
            <div className="relative w-full sm:w-64 mb-4">
              <Input
                placeholder="Buscar alumno..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
              <Users className="absolute left-3 top-2.5 text-slate-400" size={16} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-950 z-10">Alumno</th>
                    {course.evaluations.map(ev => (
                      <th key={ev.id} className="px-4 py-3 text-center">
                        {ev.name} <span className="text-[10px] opacity-70">({ev.weight}%)</span>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center bg-indigo-50/20 dark:bg-indigo-900/10 text-indigo-800 dark:text-indigo-200 font-bold">Nota Curso</th>
                    <th className="px-4 py-3 text-center bg-purple-50/20 dark:bg-purple-900/10 text-purple-800 dark:text-purple-200 font-bold">Nota Curso Real</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.map(student => {
                    const pureGrade = calculatePureCourseGrade(student, course);
                    const finalGrade = calculateFinalCourseGrade(student, course);
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 flex justify-between items-center gap-2">
                          <button 
                            onClick={() => setSelectedStudentForReport(student)}
                            className="text-left hover:underline hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {student.name}
                          </button>
                          <button
                            onClick={() => openEditStudentModal(student)}
                            className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                        {course.evaluations.map(ev => {
                          const calculatedGrade = calculateEvaluationGrade(student, ev);
                          const overrideGrade = student.overrideGrades?.[ev.id];
                          const hasOverride = overrideGrade !== undefined && overrideGrade !== '';
                          const displayGrade = hasOverride ? overrideGrade as number : calculatedGrade;
                          return (
                            <td key={ev.id} className={cn(
                              "px-4 py-3 text-center",
                              hasOverride
                                ? "text-purple-600 dark:text-purple-400 font-medium"
                                : "text-slate-600 dark:text-slate-400"
                            )}>
                              <div className="flex items-center justify-center gap-1">
                                {displayGrade.toFixed(2)}
                                {hasOverride && (
                                  <span className="text-[10px] text-purple-400 dark:text-purple-500" title={`Calculada: ${calculatedGrade.toFixed(2)}`}>★</span>
                                )}
                              </div>
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center bg-indigo-50/10 dark:bg-indigo-900/5 font-bold text-indigo-600 dark:text-indigo-400">
                          {pureGrade.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center bg-purple-50/10 dark:bg-purple-900/10 font-bold">
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-sm",
                            getGradeColorClass(Math.trunc(finalGrade))
                          )}>
                            {Math.trunc(finalGrade)}
                          </span>
                        </td>
                        <td className="px-2 text-center">
                          <button onClick={() => deleteStudent(student.id)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          course.evaluations.map(ev => {
            if (activeTab !== ev.id) return null;
            return <EvaluationGradebook key={ev.id} course={course} evaluation={ev} onUpdate={onUpdate} />
          })
        )}
      </div>

      <Dialog
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        title={editingStudentId ? "Editar Alumno" : "Nuevo Alumno"}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
            <Input
              value={studentNameInput}
              onChange={(e: any) => setStudentNameInput(e.target.value)}
              placeholder="Ej: Juan Pérez"
              autoFocus
              onKeyDown={(e: any) => e.key === 'Enter' && saveStudent()}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="ghost" onClick={() => setIsStudentModalOpen(false)}>Cancelar</Button>
            <Button onClick={saveStudent}>
              {editingStudentId ? "Guardar Cambios" : "Añadir Alumno"}
            </Button>
          </div>
        </div>
      </Dialog>
      
      {isCourseReportOpen && (
        <CourseReport 
          course={course}
          onClose={() => setIsCourseReportOpen(false)}
        />
      )}
      
      {selectedStudentForReport && (
        <ReportCard 
          student={selectedStudentForReport}
          course={course}
          onClose={() => setSelectedStudentForReport(null)}
        />
      )}
    </div>
  );
}

// --- STATS COMPONENT ---

const CourseStats = ({ course, compact = false }: { course: Course, compact?: boolean }) => {
  const stats = useMemo(() => {
    if (!course.students || course.students.length === 0) return { approved: 0, failed: 0, avg: 0 };

    let approvedCount = 0;
    let sum = 0;

    course.students.forEach(s => {
      const finalGrade = calculateFinalCourseGrade(s, course);
      if (finalGrade >= 5) approvedCount++;
      sum += finalGrade;
    });

    const total = course.students.length;
    return {
      approved: (approvedCount / total) * 100,
      failed: ((total - approvedCount) / total) * 100,
      avg: sum / total
    };
  }, [course]);

  if (compact) {
    return (
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="text-center">
          <div className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase mb-0.5">Aprobados</div>
          <div className="text-sm font-bold text-green-700 dark:text-green-300">{stats.approved.toFixed(0)}%</div>
        </div>
        <div className="text-center border-l border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-red-600 dark:text-red-400 font-bold uppercase mb-0.5">Suspensos</div>
          <div className="text-sm font-bold text-red-700 dark:text-red-300">{stats.failed.toFixed(0)}%</div>
        </div>
        <div className="text-center border-l border-slate-100 dark:border-slate-800">
          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-0.5">Media</div>
          <div className="text-sm font-bold text-blue-700 dark:text-blue-300">{stats.avg.toFixed(1)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
      <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-xl border border-green-100 dark:border-green-900/30 flex flex-col items-center justify-center">
        <div className="text-green-600 dark:text-green-400 text-sm font-semibold uppercase mb-1">Alumnos Aprobados</div>
        <div className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.approved.toFixed(1)}%</div>
      </div>
      <div className="bg-red-50 dark:bg-red-900/10 p-4 rounded-xl border border-red-100 dark:border-red-900/30 flex flex-col items-center justify-center">
        <div className="text-red-600 dark:text-red-400 text-sm font-semibold uppercase mb-1">Alumnos Suspensos</div>
        <div className="text-3xl font-bold text-red-700 dark:text-red-300">{stats.failed.toFixed(1)}%</div>
      </div>
      <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 flex flex-col items-center justify-center">
        <div className="text-blue-600 dark:text-blue-400 text-sm font-semibold uppercase mb-1">Nota Media Curso</div>
        <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.avg.toFixed(2)}</div>
      </div>
    </div>
  );
};

// --- APP ---

export default function App() {
  const [courses, setCourses] = useLocalStorage<Course[]>('gradebook_courses', []);
  const [darkMode, setDarkMode] = useLocalStorage('gradebook_theme', false);

  // Sync dark mode with document element
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [isNewCourseModalOpen, setIsNewCourseModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [view, setView] = useState('grades'); // 'grades' | 'config'

  // Rename Course Modal State
  const [renamingCourse, setRenamingCourse] = useState<Course | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const openRenameModal = (course: Course, e: any) => {
    e.stopPropagation();
    setRenamingCourse(course);
    setRenameInput(course.name);
  };

  const handleRenameCourse = () => {
    if (renamingCourse && renameInput.trim()) {
      updateCourse({ ...renamingCourse, name: renameInput });
      setRenamingCourse(null);
    }
  };

  // MIGRACIÓN DE DATOS (Legacy Support)
  useEffect(() => {
    let migrated = false;
    const migratedCourses = courses.map(c => {
      // Si tiene 'sections' en la raíz pero no 'evaluations', se migra
      if (c.sections && (!c.evaluations || c.evaluations.length === 0)) {
        console.log("Migrating course:", c.name);
        migrated = true;
        return {
          ...c,
          evaluations: [
            {
              id: generateId(),
              name: 'Evaluación Principal',
              weight: 100,
              sections: c.sections
            }
          ],
          sections: undefined // Clean up
        } as Course;
      }
      // Si no tiene evaluaciones ni secciones, inicializa array vacío
      if (!c.evaluations) {
        return { ...c, evaluations: [] };
      }
      return c;
    });

    if (migrated) {
      setCourses(migratedCourses);
    }
  }, [courses, setCourses]);

  const activeCourse = useMemo(() =>
    courses.find(c => c.id === activeCourseId),
    [courses, activeCourseId]);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState('');

  // Sincronizar tempTitle cuando cambia el curso activo
  useEffect(() => {
    if (activeCourse) setTempTitle(activeCourse.name);
  }, [activeCourse]);

  const saveTitle = () => {
    if (activeCourse && tempTitle.trim()) {
      updateCourse({ ...activeCourse, name: tempTitle });
      setIsEditingTitle(false);
    }
  };

  const toggleTheme = () => setDarkMode((prev: boolean) => !prev);

  const createCourse = () => {
    if (!newCourseName.trim()) return;
    const newCourse: Course = {
      id: generateId(),
      name: newCourseName,
      evaluations: [
        {
          id: generateId(),
          name: '1ª Evaluación',
          weight: 33,
          sections: [{ id: generateId(), name: 'Exámenes', weight: 60, subsections: [{ id: generateId(), name: 'Parcial 1' }] }]
        },
        {
          id: generateId(),
          name: '2ª Evaluación',
          weight: 33,
          sections: []
        },
        {
          id: generateId(),
          name: '3ª Evaluación',
          weight: 34,
          sections: []
        }
      ],
      students: []
    };
    setCourses([...courses, newCourse]);
    setNewCourseName('');
    setIsNewCourseModalOpen(false);
  };

  const updateCourse = (updatedCourse: Course) => {
    setCourses(courses.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = (id: string, e: any) => {
    e.stopPropagation();
    if (confirm('¿Estás seguro de borrar este curso y todas sus notas?')) {
      setCourses(courses.filter(c => c.id !== id));
    }
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(courses));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "gradebook_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importData = (event: any) => {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = e => {
      try {
        const result = e.target?.result as string;
        const importedCourses = JSON.parse(result);
        if (Array.isArray(importedCourses)) {
          setCourses(importedCourses);
          alert('Datos importados correctamente');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON');
      }
    };
  };

  return (
    <div className={cn("min-h-screen font-sans transition-colors duration-300 bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50", darkMode && "dark")}>
      <div className="transition-colors duration-300">
        {/* Header Global */}
        <header className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-300 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeCourse ? (
                <>
                  <Button variant="ghost" onClick={() => { setActiveCourseId(null); setView('dashboard'); }} className="px-2 mr-2">
                    <ChevronLeft className="mr-1" size={20} /> Volver
                  </Button>

                  {isEditingTitle ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={tempTitle}
                        onChange={(e: any) => setTempTitle(e.target.value)}
                        className="h-8 w-64 px-2 py-1 text-lg font-bold"
                        autoFocus
                        onKeyDown={(e: any) => e.key === 'Enter' && saveTitle()}
                      />
                      <button onClick={saveTitle} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
                        <CheckCircle2 size={18} />
                      </button>
                      <button onClick={() => setIsEditingTitle(false)} className="p-1 rounded bg-red-100 text-red-700 hover:bg-red-200">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        {activeCourse.name}
                      </h1>
                      <button
                        onClick={() => { setTempTitle(activeCourse.name); setIsEditingTitle(true); }}
                        className="text-slate-400 hover:text-indigo-600 transition-all p-1" // Removed opacity-0 group-hover:opacity-100
                        title="Editar nombre del curso"
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-600/20 shadow-lg">
                    <GraduationCap className="text-white" size={24} />
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    GradeMaster Pro
                  </h1>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-all mr-2"
                title="Cambiar tema"
              >
                <motion.div
                  initial={false}
                  animate={{ rotate: darkMode ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </motion.div>
              </button>

              {!activeCourse && (
                <>
                  <label className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 h-10 px-4 text-slate-600 dark:text-slate-300">
                    <Upload size={18} className="mr-2" /> Importar
                    <input type="file" className="hidden" onChange={importData} accept=".json" />
                  </label>
                  <Button variant="outline" onClick={exportData}>
                    <Download size={18} className="mr-2" /> Exportar
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20">

          <AnimatePresence mode="wait">
            {/* DASHBOARD VIEW */}
            {!activeCourse && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mis Cursos</h2>
                    <p className="text-slate-500 dark:text-slate-400">Gestiona tus clases y calificaciones desde un solo lugar.</p>
                  </div>
                  <Button onClick={() => setIsNewCourseModalOpen(true)}>
                    <Plus size={20} className="mr-2" /> Nuevo Curso
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {courses.map(course => (
                      <motion.div
                        key={course.id}
                        layout
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        whileHover={{ y: -4 }}
                        onClick={() => { setActiveCourseId(course.id); setView('grades'); }}
                        className="cursor-pointer"
                      >
                        <Card className="h-full p-6 hover:shadow-md transition-shadow relative group border-t-4 border-t-indigo-500 dark:border-t-indigo-500">
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 line-clamp-1 mr-2" title={course.name}>{course.name}</h3>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={(e) => openRenameModal(course, e)}
                                className="text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400 transition-colors p-1"
                                title="Renombrar curso"
                              >
                                <Pencil size={18} />
                              </button>
                              <button
                                onClick={(e) => deleteCourse(course.id, e)}
                                className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-1"
                                title="Borrar curso"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Users size={16} /> <span>{course.students.length} Alumnos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <PieChart size={16} /> <span>{course.evaluations ? course.evaluations.length : 0} {course.evaluations && course.evaluations.length === 1 ? 'Evaluación' : 'Evaluaciones'}</span>
                            </div>
                          </div>

                          <CourseStats course={course} compact={true} />
                          <div className="mt-6 flex items-center text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                            Abrir Libro de Calificaciones →
                          </div>
                        </Card>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {courses.length === 0 && (
                    <div className="col-span-full text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="mx-auto w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mb-4">
                        <GraduationCap size={32} />
                      </div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">No hay cursos creados</h3>
                      <p className="text-slate-500 dark:text-slate-400 mb-4">Empieza creando tu primer curso para gestionar notas.</p>
                      <Button onClick={() => setIsNewCourseModalOpen(true)}>Crear Curso Ahora</Button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ACTIVE COURSE VIEW */}
            {activeCourse && (
              <motion.div
                key="active-course"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Sección de Estadísticas del Curso */}
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Target size={20} className="text-indigo-500" />
                    Estadísticas del Curso
                  </h3>
                  <CourseStats course={activeCourse} />
                </div>

                {/* Tabs de Navegación del Curso */}
                <div className="flex justify-between items-center">
                  <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit">
                    <button
                      onClick={() => setView('grades')}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        view === 'grades'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      Libro de Notas
                    </button>
                    <button
                      onClick={() => setView('config')}
                      className={cn(
                        "px-4 py-2 rounded-md text-sm font-medium transition-all",
                        view === 'config'
                          ? "bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                      )}
                    >
                      Configuración
                    </button>
                  </div>
                </div>

                {/* Contenido Dinámico */}
                <div className="min-h-[500px]">
                  {view === 'grades' ? (
                    <GlobalGradebook course={activeCourse} onUpdate={updateCourse} />
                  ) : (
                    <GlobalCourseConfig course={activeCourse} onUpdate={updateCourse} />
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Modal Nuevo Curso */}
        <Dialog
          isOpen={isNewCourseModalOpen}
          onClose={() => setIsNewCourseModalOpen(false)}
          title="Crear Nuevo Curso"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Curso</label>
              <Input
                value={newCourseName}
                onChange={(e: any) => setNewCourseName(e.target.value)}
                placeholder="Ej: Matemáticas 101"
                autoFocus
                onKeyDown={(e: any) => e.key === 'Enter' && createCourse()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsNewCourseModalOpen(false)}>Cancelar</Button>
              <Button onClick={createCourse}>Crear Curso</Button>
            </div>
          </div>
        </Dialog>

        {/* Modal Renombrar Curso */}
        <Dialog
          isOpen={!!renamingCourse}
          onClose={() => setRenamingCourse(null)}
          title="Renombrar Curso"
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nuevo Nombre</label>
              <Input
                value={renameInput}
                onChange={(e: any) => setRenameInput(e.target.value)}
                placeholder="Nombre del curso"
                autoFocus
                onKeyDown={(e: any) => e.key === 'Enter' && handleRenameCourse()}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setRenamingCourse(null)}>Cancelar</Button>
              <Button onClick={handleRenameCourse}>Guardar Cambios</Button>
            </div>
          </div>
        </Dialog>

      </div>
      
      {/* Indicador de Versión */}
      <div className="fixed bottom-4 right-4 text-xs font-mono text-slate-400 dark:text-slate-600 font-medium z-50 pointer-events-none">
        v1.1.0
      </div>
    </div>
  );
}