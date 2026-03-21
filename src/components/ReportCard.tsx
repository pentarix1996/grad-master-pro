import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Download, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import type { Student, Course } from '../types';

interface ReportCardProps {
  student: Student;
  course: Course;
  onClose: () => void;
}

export const ReportCard: React.FC<ReportCardProps> = ({ student, course, onClose }) => {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Reporte_${student.name.replace(/\s+/g, '_')}`,
  });

  const data = course.evaluations.map(ev => {
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
    const studentFinal = override !== undefined && override !== '' ? override : evalSum;

    let classTotal = 0;
    course.students.forEach(s => {
      let sSum = 0;
      ev.sections.forEach(sec => {
        let subSum = 0;
        let validCount = 0;
        sec.subsections.forEach(sub => {
          const rawVal = s.grades[sub.id];
          if (typeof rawVal === 'string' && rawVal.trim().toUpperCase() === 'NE') return;
          validCount++;
          const val = parseFloat((rawVal as string) || '0');
          subSum += isNaN(val) ? 0 : Math.max(0, val);
        });
        const avg = validCount > 0 ? subSum / validCount : 0;
        const weight = sec.weight === '' ? 0 : sec.weight;
        sSum += avg * (weight / 100);
      });
      const sOverride = s.overrideGrades?.[ev.id];
      classTotal += sOverride !== undefined && sOverride !== '' ? (sOverride as number) : sSum;
    });
    
    const classAvg = course.students.length > 0 ? classTotal / course.students.length : 0;

    return {
      name: ev.name,
      Alumno: Number(studentFinal.toFixed(2)),
      Media: Number(classAvg.toFixed(2))
    };
  });

  const getStatusColor = (grade: number) => {
    if (grade >= 7) return 'text-green-600';
    if (grade >= 5) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 my-8 flex flex-col max-h-[90vh]"
      >
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-2xl font-heading font-bold text-slate-900 dark:text-white">Perfil del Alumno</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Análisis detallado de rendimiento</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePrint()}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:hover:bg-indigo-900/50 rounded-md text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download size={16} /> PDF
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto" ref={componentRef}>
          <div className="mb-8 flex items-center gap-4">
            <div className="h-16 w-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold font-heading">
              {student.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-3xl font-heading font-bold text-slate-900 dark:text-white">{student.name}</h1>
              <div className="flex items-center gap-2 text-slate-500 mt-1">
                <BookOpen size={16} />
                <span>Curso: {course.name}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-heading font-semibold mb-4 text-slate-800 dark:text-slate-200">Evolución vs Clase</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Alumno" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="Media" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-heading font-semibold text-slate-800 dark:text-slate-200">Desglose por Evaluación</h3>
              <div className="grid gap-3">
                {data.map((d, i) => {
                  const isImprovement = i > 0 && d.Alumno > data[i-1].Alumno;
                  const isDrop = i > 0 && d.Alumno < data[i-1].Alumno;
                  return (
                    <div key={d.name} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                      <div className="font-medium text-slate-700 dark:text-slate-200">{d.name}</div>
                      <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500 dark:text-slate-400">Media Clase: <strong className="text-slate-700 dark:text-slate-300">{d.Media}</strong></div>
                        <div className={`text-xl font-bold ${getStatusColor(d.Alumno)} flex items-center gap-2 pl-4 border-l border-slate-200 dark:border-slate-700`}>
                          <span className="text-xs text-slate-400 font-normal uppercase tracking-wider mr-1">Alumno:</span>
                          {d.Alumno}
                          {isImprovement && <TrendingUp size={16} className="text-green-500" />}
                          {isDrop && <TrendingDown size={16} className="text-red-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="text-center text-xs text-slate-400 mt-8 pt-4 border-t border-slate-100 dark:border-slate-800">
            Generado con GradMasterPro el {new Date().toLocaleDateString()}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
