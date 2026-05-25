import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Calculator } from 'lucide-react';
import { generateId, cn, parseLocalizedNumber } from '../lib/utils';

interface Criterion {
  id: string;
  name: string;
  weight: number;
  score: number | ''; // 0-10
}

interface RubricModalProps {
  initialGrade: number | string;
  onSave: (grade: number) => void;
  onClose: () => void;
  title?: string;
}

export const RubricModal: React.FC<RubricModalProps> = ({ initialGrade, onSave, onClose, title = "Rúbrica de Evaluación" }) => {
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: generateId(), name: 'Criterio 1', weight: 100, score: initialGrade !== '' && !Number.isNaN(parseLocalizedNumber(initialGrade)) ? parseLocalizedNumber(initialGrade) : '' }
  ]);

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weight || 0), 0);
  const isValidWeight = totalWeight === 100;

  const finalScore = criteria.reduce((sum, c) => {
    const s = typeof c.score === 'number' ? c.score : 0;
    return sum + (s * (c.weight || 0) / 100);
  }, 0);

  const addCriterion = () => {
    setCriteria([...criteria, { id: generateId(), name: 'Nuevo Criterio', weight: 0, score: '' }]);
  };

  const updateCriterion = (id: string, field: keyof Criterion, value: string | number) => {
    setCriteria(criteria.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCriterion = (id: string) => {
    setCriteria(criteria.filter(c => c.id !== id));
  };

  const handleSave = () => {
    if (isValidWeight) {
      onSave(Number(finalScore.toFixed(2)));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 border border-slate-200 dark:border-slate-800"
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Calculator size={20} />
            </div>
            <h2 className="text-xl font-heading font-bold text-slate-800 dark:text-slate-100">{title}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-6 max-h-[50vh] overflow-y-auto pr-2">
          <AnimatePresence>
            {criteria.map((c) => (
              <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={c.id} className="flex gap-2 items-start bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="flex-1 space-y-2">
                  <input
                    type="text"
                    placeholder="Nombre de Criterio"
                    value={c.name}
                    onChange={e => updateCriterion(c.id, 'name', e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                  />
                  <div className="flex items-center gap-2">
                    <div className="relative w-1/2">
                      <input
                        type="text" inputMode="decimal"
                        placeholder="Nota (0-10)"
                        value={c.score}
                        onChange={e => updateCriterion(c.id, 'score', e.target.value === '' ? '' : parseLocalizedNumber(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="relative w-1/2 flex items-center gap-1">
                      <input
                        type="number" min="0" max="100"
                        placeholder="Peso (%)"
                        value={c.weight === 0 ? '' : c.weight}
                        onChange={e => updateCriterion(c.id, 'weight', Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm outline-none focus:border-indigo-500"
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => removeCriterion(c.id)} className="text-red-400 hover:text-red-500 p-1 cursor-pointer">
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            onClick={addCriterion}
            className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-700 text-sm font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Plus size={16} /> Añadir Criterio
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 pt-4">
          <div>
            <div className={cn("text-xs font-semibold", isValidWeight ? "text-green-600" : "text-red-500")}>
              Peso Total: {totalWeight}% {isValidWeight ? '✓' : '(Debe ser 100%)'}
            </div>
            <div className="text-xl font-heading font-bold font-mono text-slate-800 dark:text-slate-100">
              Final: {finalScore.toFixed(2)}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={!isValidWeight}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors cursor-pointer"
          >
            Guardar Nota
          </button>
        </div>
      </motion.div>
    </div>
  );
};
