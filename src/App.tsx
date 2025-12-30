import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Settings, 
  Users, 
  ChevronLeft, 
  Save, 
  Download, 
  Upload, 
  GraduationCap, 
  MoreHorizontal,
  AlertCircle,
  CheckCircle2,
  X,
  Pencil,
  AlertTriangle,
  Sun,
  Moon,
  PieChart,
  ListChecks,
  Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// --- UTILS & HOOKS ---

const generateId = () => Math.random().toString(36).substr(2, 9);

function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

const cn = (...classes) => classes.filter(Boolean).join(' ');

// --- COMPONENTES UI (Mini Design System) ---

const Button = ({ children, variant = 'primary', className, ...props }) => {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50 disabled:pointer-events-none ring-offset-white dark:ring-offset-slate-900";
  const variants = {
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

const Input = ({ className, ...props }) => (
  <input 
    className={cn(
      "flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
      "dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:placeholder:text-slate-400 dark:ring-offset-slate-950",
      className
    )} 
    {...props} 
  />
);

const Card = ({ children, className }) => (
  <div className={cn("rounded-xl border border-slate-200 bg-white text-slate-950 shadow-sm dark:bg-slate-900 dark:border-slate-800 dark:text-slate-50", className)}>
    {children}
  </div>
);

const Dialog = ({ isOpen, onClose, title, children }) => {
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

// --- COMPONENTES DE NEGOCIO ---

// 1. Configurador de Curso (Secciones y Pesos)
const CourseConfig = ({ course, onUpdate }) => {
  const totalWeight = course.sections.reduce((acc, curr) => acc + (curr.weight === '' ? 0 : parseInt(curr.weight || 0)), 0);
  const isWeightValid = totalWeight === 100;

  const addSection = () => {
    const newSection = {
      id: generateId(),
      name: 'Nueva Sección',
      weight: 0,
      subsections: [{ id: generateId(), name: 'Item 1' }]
    };
    onUpdate({ ...course, sections: [...course.sections, newSection] });
  };

  const updateSection = (id, field, value) => {
    let finalValue = value;
    if (field === 'weight') {
        if (value === '') finalValue = '';
        else finalValue = parseInt(value);
    }
    const newSections = course.sections.map(s => s.id === id ? { ...s, [field]: finalValue } : s);
    onUpdate({ ...course, sections: newSections });
  };

  const removeSection = (id) => {
    onUpdate({ ...course, sections: course.sections.filter(s => s.id !== id) });
  };

  const addSubsection = (sectionId) => {
    const newSections = course.sections.map(s => {
      if (s.id === sectionId) {
        return { 
          ...s, 
          subsections: [...s.subsections, { id: generateId(), name: `Item ${s.subsections.length + 1}` }] 
        };
      }
      return s;
    });
    onUpdate({ ...course, sections: newSections });
  };

  const removeSubsection = (sectionId, subId) => {
     const newSections = course.sections.map(s => {
      if (s.id === sectionId) {
        return { 
          ...s, 
          subsections: s.subsections.filter(sub => sub.id !== subId)
        };
      }
      return s;
    });
    onUpdate({ ...course, sections: newSections });
  };

  const updateSubsectionName = (sectionId, subId, name) => {
    const newSections = course.sections.map(s => {
      if (s.id === sectionId) {
        return { 
          ...s, 
          subsections: s.subsections.map(sub => sub.id === subId ? { ...sub, name } : sub)
        };
      }
      return s;
    });
    onUpdate({ ...course, sections: newSections });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
            <PieChart size={24} />
          </div>
          <div>
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Distribución de Ponderación</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">La suma debe ser 100% para cálculos exactos.</p>
          </div>
        </div>
        <div className={cn("px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2", isWeightValid ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400")}>
          {isWeightValid ? <CheckCircle2 size={16}/> : <AlertCircle size={16}/>}
          {totalWeight}%
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence>
          {course.sections.map((section, index) => (
            <motion.div 
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              key={section.id} 
              className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-white dark:bg-slate-900 shadow-sm"
            >
              <div className="flex flex-col md:flex-row gap-4 mb-4 items-start md:items-center">
                <div className="flex-1 w-full">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-1.5">
                    <Target size={12} /> Nombre Categoría
                  </label>
                  <Input 
                    value={section.name} 
                    onChange={(e) => updateSection(section.id, 'name', e.target.value)} 
                    placeholder="Ej: Exámenes"
                  />
                </div>
                <div className="w-full md:w-32">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1.5 mb-1.5">
                    Peso (%)
                  </label>
                  <div className="relative">
                    <Input 
                      type="number" 
                      min="0" max="100"
                      value={section.weight === 0 ? '' : section.weight} 
                      onChange={(e) => updateSection(section.id, 'weight', e.target.value)}
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-2.5 text-slate-400 text-sm">%</span>
                  </div>
                </div>
                <Button variant="ghost" className="mt-6 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20" onClick={() => removeSection(section.id)}>
                  <Trash2 size={18} />
                </Button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-md space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <ListChecks size={14} /> Sub-ítems a evaluar
                  </span>
                  <button onClick={() => addSubsection(section.id)} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1">
                    <Plus size={12} /> Añadir Item
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {section.subsections.map(sub => (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} key={sub.id} className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1">
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
        <Plus className="mr-2" size={20} /> Añadir Nueva Sección (Ej: Tareas, Proyectos)
      </Button>
    </div>
  );
};

// 2. Tabla de Calificaciones
const Gradebook = ({ course, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [studentNameInput, setStudentNameInput] = useState('');

  const calculateStats = (student) => {
    let weightedSum = 0;
    let hasWarning = false;
    
    const sectionAverages = course.sections.map(section => {
      const subGrades = section.subsections.map(sub => {
          const val = parseFloat(student.grades[sub.id]) || 0;
          if (val > 10) hasWarning = true;
          return val;
      });
      const sum = subGrades.reduce((a, b) => a + b, 0);
      const avg = section.subsections.length > 0 ? sum / section.subsections.length : 0;
      
      const weight = section.weight === '' ? 0 : section.weight;
      weightedSum += avg * (weight / 100);
      
      return { id: section.id, avg };
    });

    return { sectionAverages, finalGrade: weightedSum, hasWarning };
  };

  const handleGradeChange = (studentId, subsectionId, value) => {
    if (value === '') {
        updateStudentGrade(studentId, subsectionId, '');
        return;
    }

    const numValue = parseFloat(value);
    // CLAMP ESTRICTO 0-100
    const finalVal = isNaN(numValue) ? 0 : Math.min(Math.max(0, numValue), 100);
    
    updateStudentGrade(studentId, subsectionId, finalVal);
  };

  const updateStudentGrade = (studentId, subsectionId, val) => {
    const newStudents = course.students.map(s => {
        if (s.id === studentId) {
          return { 
            ...s, 
            grades: { ...s.grades, [subsectionId]: val } 
          };
        }
        return s;
      });
      onUpdate({ ...course, students: newStudents });
  }

  const openAddStudentModal = () => {
      setEditingStudentId(null);
      setStudentNameInput('');
      setIsStudentModalOpen(true);
  };

  const openEditStudentModal = (student) => {
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

  const deleteStudent = (id) => {
    if (confirm("¿Eliminar este alumno?")) {
      onUpdate({ ...course, students: course.students.filter(s => s.id !== id) });
    }
  };

  const filteredStudents = course.students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGradeColorClass = (grade) => {
      if (grade < 5) return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      if (grade >= 5 && grade < 7) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      if (grade >= 7) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300";
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="relative w-full sm:w-64">
          <Input 
            placeholder="Buscar alumno..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          <Users className="absolute left-3 top-2.5 text-slate-400" size={16} />
        </div>
        <Button onClick={openAddStudentModal} className="w-full sm:w-auto">
          <Plus size={16} className="mr-2" /> Agregar Alumno
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm bg-white dark:bg-slate-900">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50 dark:bg-slate-950 z-10 w-48 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">Alumno</th>
              {course.sections.map(section => (
                <React.Fragment key={section.id}>
                  {section.subsections.map(sub => (
                    <th key={sub.id} className="px-2 py-3 min-w-[80px] text-center font-medium border-l border-slate-100 dark:border-slate-800">
                      <div className="truncate max-w-[100px] text-slate-700 dark:text-slate-300" title={sub.name}>{sub.name}</div>
                      <div className="text-[10px] text-slate-400 normal-case">{section.name}</div>
                    </th>
                  ))}
                  <th className="px-2 py-3 bg-indigo-50/50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 min-w-[60px] text-center font-bold border-l border-indigo-100 dark:border-indigo-900/30">
                    Avg ({section.weight || 0}%)
                  </th>
                </React.Fragment>
              ))}
              <th className="px-4 py-3 font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] text-center">
                Nota Final
              </th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <AnimatePresence>
              {filteredStudents.map((student) => {
                const stats = calculateStats(student);
                const gradeColor = getGradeColorClass(stats.finalGrade);

                return (
                  <React.Fragment key={student.id}>
                    <motion.tr 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors group relative"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-between group/name">
                            <span className="truncate pr-2">{student.name}</span>
                            <button 
                              onClick={() => openEditStudentModal(student)}
                              className="text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover/name:opacity-100 transition-opacity"
                              title="Editar nombre"
                            >
                                <Pencil size={14} />
                            </button>
                        </div>
                      </td>
                      
                      {course.sections.map(section => {
                        const sectionStat = stats.sectionAverages.find(s => s.id === section.id);
                        return (
                          <React.Fragment key={section.id}>
                            {section.subsections.map(sub => (
                              <td key={sub.id} className="px-1 py-2 border-l border-slate-100 dark:border-slate-800">
                                <input
                                  type="number"
                                  min="0" 
                                  max="100"
                                  className="w-full text-center bg-transparent focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-500 rounded-sm py-1 outline-none transition-all hover:bg-slate-100 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 placeholder-slate-300 dark:placeholder-slate-600"
                                  value={student.grades[sub.id] === undefined ? '' : student.grades[sub.id]}
                                  onChange={(e) => handleGradeChange(student.id, sub.id, e.target.value)}
                                  placeholder="-"
                                />
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50/30 dark:bg-indigo-900/10 border-l border-indigo-100 dark:border-indigo-900/30">
                              {sectionStat?.avg.toFixed(1)}
                            </td>
                          </React.Fragment>
                        );
                      })}

                      <td className="px-4 py-3 text-center sticky right-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/50 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center justify-center gap-2">
                          <span className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              gradeColor
                          )}>
                              {stats.finalGrade.toFixed(2)}
                          </span>
                          {stats.hasWarning && (
                              <div className="text-amber-500 animate-pulse" title="Ver detalle abajo">
                                  <AlertTriangle size={16} />
                              </div>
                          )}
                        </div>
                      </td>
                      <td className="px-2">
                         <button onClick={() => deleteStudent(student.id)} className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Trash2 size={16} />
                         </button>
                      </td>
                    </motion.tr>
                    
                    {/* Fila de advertencia condicional */}
                    {stats.hasWarning && (
                        <motion.tr 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                            <td colSpan="100%" className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30 px-4 py-2">
                                <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                                    <AlertTriangle size={14} />
                                    <span>Atención: Este alumno tiene notas superiores a 10. Verifica si es un error de entrada o un crédito extra.</span>
                                </div>
                            </td>
                        </motion.tr>
                    )}
                  </React.Fragment>
                );
              })}
            </AnimatePresence>
            {filteredStudents.length === 0 && (
              <tr>
                <td colSpan="100%" className="text-center py-8 text-slate-400 dark:text-slate-500 italic">
                  No hay alumnos registrados. Comienza agregando uno.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Crear/Editar Alumno */}
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
              onChange={(e) => setStudentNameInput(e.target.value)} 
              placeholder="Ej: Juan Pérez" 
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && saveStudent()}
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
    </div>
  );
};

// --- APP PRINCIPAL ---

export default function App() {
  const [courses, setCourses] = useLocalStorage('gradebook_courses', []);
  // Modo oscuro persistente
  const [darkMode, setDarkMode] = useLocalStorage('gradebook_theme', false);
  
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [isNewCourseModalOpen, setIsNewCourseModalOpen] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [view, setView] = useState('dashboard');

  const activeCourse = useMemo(() => 
    courses.find(c => c.id === activeCourseId), 
  [courses, activeCourseId]);

  const toggleTheme = () => setDarkMode(!darkMode);

  const createCourse = () => {
    if (!newCourseName.trim()) return;
    const newCourse = {
      id: generateId(),
      name: newCourseName,
      sections: [
        { id: generateId(), name: 'Exámenes', weight: 60, subsections: [{id: generateId(), name: 'Parcial 1'}] },
        { id: generateId(), name: 'Tareas', weight: 40, subsections: [{id: generateId(), name: 'Tarea 1'}] }
      ],
      students: []
    };
    setCourses([...courses, newCourse]);
    setNewCourseName('');
    setIsNewCourseModalOpen(false);
  };

  const updateCourse = (updatedCourse) => {
    setCourses(courses.map(c => c.id === updatedCourse.id ? updatedCourse : c));
  };

  const deleteCourse = (id, e) => {
    e.stopPropagation();
    if(confirm('¿Estás seguro de borrar este curso y todas sus notas?')) {
      setCourses(courses.filter(c => c.id !== id));
    }
  };

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(courses));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", "gradebook_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const importData = (event) => {
    const fileReader = new FileReader();
    fileReader.readAsText(event.target.files[0], "UTF-8");
    fileReader.onload = e => {
      try {
        const importedCourses = JSON.parse(e.target.result);
        if(Array.isArray(importedCourses)) {
          setCourses(importedCourses);
          alert('Datos importados correctamente');
        }
      } catch (err) {
        alert('Error al leer el archivo JSON');
      }
    };
  };

  return (
    <div className={cn("min-h-screen font-sans transition-colors duration-300", darkMode ? "dark bg-slate-950" : "bg-slate-50")}>
      <div className="dark:text-slate-100 transition-colors duration-300">
        {/* Header Global */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {activeCourse ? (
                <Button variant="ghost" onClick={() => { setActiveCourseId(null); setView('dashboard'); }} className="px-2">
                  <ChevronLeft className="mr-1" size={20}/> Volver
                </Button>
              ) : (
                <div className="bg-indigo-600 p-2 rounded-lg">
                  <GraduationCap className="text-white" size={24} />
                </div>
              )}
              <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {activeCourse ? activeCourse.name : 'GradeMaster Pro'}
              </h1>
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
                      <input type="file" className="hidden" onChange={importData} accept=".json"/>
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
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{course.name}</h3>
                            <button 
                              onClick={(e) => deleteCourse(course.id, e)}
                              className="text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors p-1"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                          <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-2">
                              <Users size={16} /> <span>{course.students.length} Alumnos</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Settings size={16} /> <span>{course.sections.length} Secciones de evaluación</span>
                            </div>
                          </div>
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
                
                {/* Tabs de Navegación del Curso */}
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
                    Configuración Evaluación
                  </button>
                </div>

                {/* Contenido Dinámico */}
                <Card className="p-6 min-h-[500px]">
                  {view === 'grades' ? (
                    <Gradebook course={activeCourse} onUpdate={updateCourse} />
                  ) : (
                    <CourseConfig course={activeCourse} onUpdate={updateCourse} />
                  )}
                </Card>

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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre de la asignatura</label>
              <Input 
                value={newCourseName} 
                onChange={(e) => setNewCourseName(e.target.value)} 
                placeholder="Ej: Matemáticas Avanzadas" 
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setIsNewCourseModalOpen(false)}>Cancelar</Button>
              <Button onClick={createCourse}>Crear Curso</Button>
            </div>
          </div>
        </Dialog>
      </div>
    </div>
  );
}