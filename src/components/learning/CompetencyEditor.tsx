import { useState } from "react";
import { Check, X } from "lucide-react";
import type { Competency, Course } from "../../types";
import { activitiesFor } from "../../lib/learningInsights";

export default function CompetencyEditor({
  course,
  competency,
  onSave,
  onClose,
}: {
  course: Course;
  competency?: Competency;
  onSave: (competency: Competency) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(competency?.name ?? "");
  const [description, setDescription] = useState(competency?.description ?? "");
  const [target, setTarget] = useState(competency?.target ?? 5);
  const [ids, setIds] = useState(competency?.subsectionIds ?? []);
  const activities = activitiesFor(course);
  return (
    <form
      className="learning-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (
          !name.trim() ||
          !ids.length ||
          !Number.isFinite(target) ||
          target < 0 ||
          target > 10
        )
          return;
        onSave({
          id: competency?.id ?? crypto.randomUUID(),
          name: name.trim(),
          description: description.trim(),
          target,
          subsectionIds: ids,
        });
      }}
    >
      <div className="learning-row">
        <div>
          <span className="learning-eyebrow">DISEÑO DEL APRENDIZAJE</span>
          <h3>{competency ? "Editar competencia" : "Nueva competencia"}</h3>
        </div>
        <button
          className="learning-icon"
          type="button"
          aria-label="Cerrar editor"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="learning-editor-fields">
        <label>
          Nombre
          <input
            required
            autoFocus
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej. Razonamiento matemático"
          />
        </label>
        <label>
          Objetivo sobre 10
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            required
            value={target}
            onChange={(event) => setTarget(event.target.valueAsNumber)}
          />
        </label>
      </div>
      <label>
        Qué demuestra el alumno
        <textarea
          rows={2}
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Describe la capacidad que quieres observar…"
        />
      </label>
      <fieldset>
        <legend>
          Actividades que aportan evidencias · {ids.length} seleccionadas
        </legend>
        <div className="learning-activity-options">
          {activities.map((activity) => (
            <label key={activity.id} className="learning-check">
              <input
                type="checkbox"
                checked={ids.includes(activity.id)}
                onChange={(event) =>
                  setIds((previous) =>
                    event.target.checked
                      ? [...previous, activity.id]
                      : previous.filter((id) => id !== activity.id),
                  )
                }
              />
              <span>
                {activity.name}
                <small>{activity.context}</small>
              </span>
            </label>
          ))}
        </div>
        {!activities.length && (
          <p>
            Añade actividades en la configuración del curso para poder
            vincularlas.
          </p>
        )}
      </fieldset>
      <div className="learning-row">
        <small>
          Media de las evidencias numéricas. Los registros vacíos y NE no
          cuentan.
        </small>
        <button
          type="submit"
          className="learning-button primary"
          disabled={!name.trim() || !ids.length}
        >
          <Check size={16} />
          Guardar competencia
        </button>
      </div>
    </form>
  );
}
