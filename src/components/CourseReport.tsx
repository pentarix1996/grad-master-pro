import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Download, TrendingUp, TrendingDown, BookOpen, Users, BrainCircuit } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import type { Course } from '../types';
import { cn } from '../lib/utils';

interface CourseReportProps {
  course: Course;
  onClose: () => void;
}

export const CourseReport: React.FC<CourseReportProps> = ({ course, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Informe_Claustro_${course.name.replace(/\s+/g, '_')}`,
  });

  // Cálculo de estadísticas globales
  const evaluationsStats = course.evaluations.map(ev => {
    let approved = 0;
    let failed = 0;
    let totalSum = 0;

    const studentGrades = course.students.map(student => {
      let evalSum = 0;
      ev.sections.forEach(sec => {
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
        evalSum += avg * (weight / 100);
      });

      const override = student.overrideGrades?.[ev.id];
      const finalGrade = override !== undefined && override !== '' ? (override as number) : evalSum;

      if (finalGrade >= 5) approved++;
      else failed++;

      totalSum += finalGrade;
      return { studentId: student.id, name: student.name, grade: Number(finalGrade.toFixed(2)) };
    });

    const average = course.students.length > 0 ? totalSum / course.students.length : 0;

    return {
      evaluation: ev,
      approved,
      failed,
      average: Number(average.toFixed(2)),
      studentGrades
    };
  });

  // Agrupación por alumno para ver diferencias
  const studentOverviews = course.students.map(student => {
    const gradesPerEval = evaluationsStats.map(stat => {
      const g = stat.studentGrades.find(sg => sg.studentId === student.id)?.grade || 0;
      return { 
        evalName: stat.evaluation.name, 
        grade: g,
        classAvg: stat.average,
        diff: Number((g - stat.average).toFixed(2))
      };
    });

    // Calcular nota final ponderada global (si aplica)
    let globalFinal = 0;
    gradesPerEval.forEach((g, i) => {
      const w = course.evaluations[i]?.weight || 0;
      globalFinal += g.grade * ((w as number) / 100);
    });

    return {
      name: student.name,
      evaluations: gradesPerEval,
      globalFinal: Number(globalFinal.toFixed(2))
    };
  });

  const getDiffColor = (diff: number) => {
    if (diff > 0) return 'text-green-600';
    if (diff < 0) return 'text-red-600';
    return 'text-slate-500';
  };

  const getStatusColor = (grade: number) => {
    if (grade >= 7) return 'text-green-600';
    if (grade >= 5) return 'text-amber-600';
    return 'text-red-600';
  };

  // Necesitamos estilos para impresión
  const printStyles = `
    @media print {
      @page { size: A4; margin: 15mm; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-break { page-break-before: always; }
      .no-break { page-break-inside: avoid; break-inside: avoid; }
      .avoid-break-after { page-break-after: avoid; break-after: avoid; }
      .print-footer { position: fixed; bottom: 0; width: 100%; text-align: center; border: none; margin: 0; padding: 0; font-size: 10px; color: #94a3b8; }
    }
  `;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <style>{printStyles}</style>
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-5xl bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 flex flex-col max-h-[90vh]"
      >
        {/* Encabezado App UI */}
        <div className="flex items-center justify-between p-6 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 rounded-t-xl sticky top-0 z-10">
          <div>
            <h2 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Generador Informe Claustro</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Previsualización del PDF de informe de curso</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePrint()}
              className="px-6 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
            >
              <Download size={18} /> Generar PDF para Imprimir o Guardar
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg cursor-pointer transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Zona previsualización */}
        <div className="p-4 sm:p-8 overflow-y-auto bg-slate-100 dark:bg-slate-800">
          
          {/* EL DOCUMENTO A IMPRIMIR */}
          <div 
            ref={componentRef} 
            className="bg-white dark:bg-white text-slate-900 mx-auto shadow-sm"
            style={{ width: '100%', maxWidth: '210mm', minHeight: '297mm', padding: '15mm' }} // A4 proportions
          >
            {/* --- PÁGINA 1: PORTADA --- */}
            <div className="flex flex-col items-center justify-center min-h-[200mm] text-center">
              <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mb-8 text-white">
                <BrainCircuit size={48} />
              </div>
              <h1 className="text-5xl font-heading font-bold text-slate-900 tracking-tight mb-4">Informe de Evaluación</h1>
              <div className="h-1 w-24 bg-indigo-500 rounded-full mb-8"></div>
              
              <h2 className="text-3xl font-heading font-medium text-slate-700 mb-12">{course.name}</h2>
              
              <div className="grid grid-cols-2 gap-12 w-full max-w-md mx-auto text-left mt-12 bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div>
                  <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Alumnos</div>
                  <div className="text-2xl font-bold flex items-center gap-2"><Users size={24} className="text-indigo-400"/> {course.students.length}</div>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Evaluaciones</div>
                  <div className="text-2xl font-bold flex items-center gap-2"><BookOpen size={24} className="text-indigo-400"/> {course.evaluations.length}</div>
                </div>
                <div className="col-span-2 mt-4 pt-6 border-t border-slate-200">
                  <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Fecha de Emisión</div>
                  <div className="text-lg font-medium">{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
                </div>
              </div>
            </div>

            {/* --- PÁGINA 2: KPIs y Análisis General --- */}
            <div className="page-break pt-8">
              <h2 className="text-3xl font-heading font-bold border-b-2 border-slate-900 pb-2 mb-8">1. Resumen Analítico del Curso</h2>
              
              <div className="space-y-8">
                {evaluationsStats.map((stat, i) => (
                  <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-6 no-break">
                    <h3 className="text-xl font-heading font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md text-sm">Eval {i+1}</span>
                      {stat.evaluation.name} ({stat.evaluation.weight}%)
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 text-center">
                        <div className="text-sm font-semibold text-slate-500 uppercase">Media Clase</div>
                        <div className="text-3xl font-bold text-blue-600 mt-2">{stat.average}</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 text-center">
                        <div className="text-sm font-semibold text-slate-500 uppercase">Aprobados</div>
                        <div className="text-3xl font-bold text-green-600 mt-2">{stat.approved}</div>
                        <div className="text-xs text-slate-400 mt-1">{Math.round((stat.approved / course.students.length) * 100)}% de la clase</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 text-center">
                        <div className="text-sm font-semibold text-slate-500 uppercase">Suspensos</div>
                        <div className="text-3xl font-bold text-red-600 mt-2">{stat.failed}</div>
                        <div className="text-xs text-slate-400 mt-1">{Math.round((stat.failed / course.students.length) * 100)}% de la clase</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* --- PÁGINA 3+: Desglose por Alumnos --- */}
            <div className="pt-8 mt-8 border-t border-slate-200">
              <div className="avoid-break-after">
                <h2 className="text-3xl font-heading font-bold border-b-2 border-slate-900 pb-2 mb-4">2. Seguimiento Individual (Claustro)</h2>
                <p className="text-slate-600 mb-8 italic">Comparativa de cada alumno respecto a la media de la clase, para identificar rendimientos anómalos o áreas de mejora inmediata.</p>
              </div>
              
              <div className="flex flex-col gap-6">
                {studentOverviews.map((student, idx) => (
                  <div key={idx} className="border border-slate-300 rounded-lg p-5 no-break bg-white shadow-sm flex flex-col md:flex-row gap-6 items-start">
                    
                    {/* Alumno Info */}
                    <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 pb-4 md:pb-0 pr-4">
                      <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">{student.name}</h3>
                      <div className="text-sm text-slate-500 mb-1">Nota Ponderada Global</div>
                      <div className={cn("text-3xl font-bold font-mono", getStatusColor(student.globalFinal))}>
                        {student.globalFinal.toFixed(2)}
                      </div>
                    </div>

                    {/* Evaluaciones del Alumno */}
                    <div className="w-full md:w-2/3 flex flex-col gap-3">
                      {student.evaluations.map((evStat, eIdx) => {
                        const isImprovement = evStat.diff > 0;
                        const isDrop = evStat.diff < 0;
                        
                        return (
                          <div key={eIdx} className="flex items-center justify-between bg-slate-50 p-2 px-4 rounded border border-slate-100">
                            <div className="font-medium text-slate-700 text-sm">{evStat.evalName}</div>
                            
                            <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-[10px] uppercase text-slate-400 font-bold">Nota</div>
                                <div className={cn("font-bold text-base", getStatusColor(evStat.grade))}>{evStat.grade.toFixed(2)}</div>
                              </div>
                              
                              <div className="w-px h-8 bg-slate-200"></div>
                              
                              <div className="text-right w-24">
                                <div className="text-[10px] uppercase text-slate-400 font-bold">VS Media Clase</div>
                                <div className={cn("font-bold text-sm flex items-center justify-end gap-1", getDiffColor(evStat.diff))}>
                                  {evStat.diff > 0 ? '+' : ''}{evStat.diff.toFixed(2)} pts
                                  {isImprovement && <TrendingUp size={14} />}
                                  {isDrop && <TrendingDown size={14} />}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Footer invisible en pantalla, visible en PDF (manejado por print css usualmente, pero lo emulamos) */}
            <div className="print-footer mt-8 text-center text-xs text-slate-400 border-t border-slate-200 pt-4">
              Documento confidencial para junta de evaluación. GradMasterPro.
            </div>

          </div>
        </div>
      </motion.div>
    </div>
  );
};
