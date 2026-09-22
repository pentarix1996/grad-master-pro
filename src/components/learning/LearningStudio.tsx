import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronRight, CircleHelp, GitBranch, Maximize2, Minimize2, Pause, Pencil, Play, Plus, Printer, Route, Sparkles, Trash2, Users, X, } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import type { Competency, Course } from "../../types";
import { competencyEvidence, evaluationSummary, formatScore, numericGrade, } from "../../lib/learningInsights";
import CompetencyEditor from "./CompetencyEditor";
import type { SceneMode, SceneNode } from "./LearningScene";
import "./learning.css";
const LearningScene = lazy(() => import("./LearningScene"));
type Mode = "tree" | "journey" | "tutoring";
const modes = [
    { id: "tree" as const, name: "Competencias", icon: GitBranch, number: "01" },
    { id: "journey" as const, name: "Progreso", icon: Route, number: "02" },
    { id: "tutoring" as const, name: "Tutorías", icon: Users, number: "03" },
];
const titles = {
    tree: [
        "Árbol de competencias.",
        "Explora las capacidades que están creciendo en tu curso.",
    ],
    journey: [
        "El aprendizaje deja un recorrido.",
        "Avanza por las evaluaciones y observa cómo cambia el resultado.",
    ],
    tutoring: [
        "Una conversación con perspectiva.",
        "Resultados, fortalezas y próximos pasos para una tutoría centrada en el alumno.",
    ],
};
const slideNames = [
    "Punto de partida",
    "Competencias",
    "Evolución",
    "Próximos pasos",
];
export default function LearningStudio({ course, onUpdate, }: {
    course: Course;
    onUpdate: (course: Course) => void;
}) {
    const [mode, setMode] = useState<Mode>("tree");
    const [studentId, setStudentId] = useState("");
    const [active, setActive] = useState(0);
    const [editor, setEditor] = useState<Competency | "new" | null>(null);
    const [flat, setFlat] = useState(false);
    const [quiet, setQuiet] = useState(false);
    const prefersReducedMotion = useReducedMotion();
    const reducedMotion = quiet || !!prefersReducedMotion;
    const [playing, setPlaying] = useState(false);
    const [slide, setSlide] = useState(0);
    const [presenting, setPresenting] = useState(false);
    const [agreement, setAgreement] = useState("");
    const [savedMessage, setSavedMessage] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const root = useRef<HTMLElement>(null);
    const printRef = useRef<HTMLDivElement>(null);
    const returnFocus = useRef<HTMLElement | null>(null);
    const student = course.students.find((person) => person.id === studentId);
    const competencies = course.competencies ?? [];
    const evidence = useMemo(() => (course.competencies ?? []).map((competency) => ({
        competency,
        ...competencyEvidence(course, competency, student),
    })), [course, student]);
    const timeline = useMemo(() => course.evaluations.map((item) => ({
        evaluation: item,
        ...evaluationSummary(course, item, student),
    })), [course, student]);
    const selectedEvidence = evidence[Math.min(active, evidence.length - 1)];
    const selectedMoment = timeline[Math.min(active, timeline.length - 1)];
    const available = timeline.filter((moment) => moment.score !== null);
    const latest = available.at(-1);
    const change = available.length > 1 ? latest!.score! - available[0].score! : null;
    const sceneMode: SceneMode = mode === "tree" || (mode === "tutoring" && slide === 1)
        ? "tree"
        : "journey";
    const allNodes = useMemo<SceneNode[]>(() => sceneMode === "tree"
        ? evidence.map((item, index) => ({
            id: item.competency.id,
            label: item.competency.name,
            score: item.score,
            target: item.competency.target,
            count: item.activities.length,
            ordinal: index + 1,
        }))
        :
            timeline.map((moment) => ({
                id: moment.evaluation.id,
                label: moment.evaluation.name,
                score: moment.score,
            })), [sceneMode, evidence, timeline]);
    const pageStart = Math.min(Math.floor(active / 6) * 6, Math.max(0, allNodes.length - 6));
    const nodes = useMemo(() => allNodes.slice(pageStart, pageStart + (6)), [allNodes, pageStart, sceneMode]);
    const selectNode = useCallback((index: number) => {
        setActive(pageStart + index);
        setPlaying(false);
    }, [pageStart]);
    const print = useReactToPrint({
        contentRef: printRef,
        documentTitle: `${"Tutoria"}_${course.name}`,
        pageStyle: "@page { size: A4; margin: 18mm; } body { background: white !important; color: #142c3b !important; }",
    });
    useEffect(() => {
        if (!playing ||
            mode !== "journey" ||
            reducedMotion ||
            active >= timeline.length - 1)
            return;
        const timer = window.setInterval(() => {
            setActive((previous) => {
                if (previous >= timeline.length - 1)
                    return previous;
                return previous + 1;
            });
        }, 2600);
        return () => clearInterval(timer);
    }, [playing, mode, timeline.length, reducedMotion, active]);
    const isPlaying = playing && active < timeline.length - 1;
    const exitPresentation = useCallback(() => {
        setPresenting(false);
        if (document.fullscreenElement)
            void document.exitFullscreen().catch(() => undefined);
        returnFocus.current?.focus();
    }, []);
    useEffect(() => {
        if (!presenting)
            return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        root.current?.focus();
        const keyboard = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                exitPresentation();
                return;
            }
            const editing = event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLSelectElement;
            if (!editing && event.key === "ArrowRight") {
                event.preventDefault();
                setSlide((value) => Math.min(3, value + 1));
                setActive(0);
            }
            if (!editing && event.key === "ArrowLeft") {
                event.preventDefault();
                setSlide((value) => Math.max(0, value - 1));
                setActive(0);
            }
            if (event.key === "Tab") {
                const focusable = root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea, select, input, [tabindex="0"]');
                if (!focusable?.length)
                    return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey &&
                    (document.activeElement === first ||
                        document.activeElement === root.current)) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        const fullscreen = () => {
            if (!document.fullscreenElement)
                exitPresentation();
        };
        document.addEventListener("keydown", keyboard);
        document.addEventListener("fullscreenchange", fullscreen);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener("keydown", keyboard);
            document.removeEventListener("fullscreenchange", fullscreen);
        };
    }, [presenting, exitPresentation]);
    const switchMode = (next: Mode) => {
        setMode(next);
        setActive(0);
        setPlaying(false);
        setEditor(null);
        setSavedMessage("");
        setSlide(0);
        if (next === "tutoring" && !studentId)
            setStudentId(course.students[0]?.id ?? "");
    };
    const saveAgreement = () => {
        if (!student || !agreement.trim())
            return;
        onUpdate({
            ...course,
            students: course.students.map((person) => person.id === student.id
                ? {
                    ...person,
                    notes: [
                        ...(person.notes ?? []),
                        {
                            id: crypto.randomUUID(),
                            date: new Date().toLocaleDateString("es-ES"),
                            text: `Tutoría · ${agreement.trim()}`,
                        },
                    ],
                }
                : person),
        });
        setAgreement("");
        setSavedMessage("Acuerdo guardado en las notas del alumno.");
    };
    return (<section ref={root} tabIndex={-1} className={`learning-studio${presenting ? " is-presenting" : ""}`} aria-label="Espacio de aprendizaje" role={presenting ? "dialog" : undefined} aria-modal={presenting || undefined}>
      <div className="learning-masthead">
        <span>
          <Sparkles size={16}/> ESPACIO DE APRENDIZAJE
        </span>
        <span className="learning-edition">
          {presenting ? "MODO TUTORÍA" : "UNA NUEVA PERSPECTIVA"}
        </span>
      </div>
      {!presenting && (<nav className="learning-tabs" aria-label="Experiencias de aprendizaje">
          {modes.map((item) => (<button key={item.id} aria-pressed={mode === item.id} onClick={() => switchMode(item.id)}>
              <span>{item.number}</span>
              <item.icon size={18}/>
              {item.name}
            </button>))}
        </nav>)}
      <header className="learning-header">
        <div>
          <span className="learning-eyebrow">
            {presenting
            ? `${course.name} / ${student?.name}`
            : `${modes.find((item) => item.id === mode)?.number} / ${course.name}`}
          </span>
          <h2>{presenting ? slideNames[slide] : titles[mode][0]}</h2>
          <p>
            {presenting
            ? "Un espacio para entender, escuchar y acordar."
            : titles[mode][1]}
          </p>
        </div>
        <div className="learning-header-actions">
          {mode === "tree" && (
            <button
              type="button"
              className="learning-button primary learning-add-competency"
              onClick={() => setEditor("new")}
            >
              <Plus size={18} />
              Añadir competencia
            </button>
          )}
          {!presenting && (<label className="learning-select-label">
              {mode === "tutoring" ? "Alumno de la tutoría" : "Perspectiva"}
              <select value={studentId} onChange={(event) => {
                setStudentId(event.target.value);
                setActive(0);
                setPlaying(false);
                setAgreement("");
                setSavedMessage("");
            }}>
                {mode !== "tutoring" && <option value="">Todo el grupo</option>}
                {!course.students.length && mode === "tutoring" && (<option value="">Sin alumnos</option>)}
                {course.students.map((person) => (<option key={person.id} value={person.id}>
                    {person.name}
                  </option>))}
              </select>
            </label>)}
          
          {mode === "tutoring" && (<button className="learning-button" disabled={!student} onClick={() => {
                if (presenting) {
                    exitPresentation();
                    return;
                }
                returnFocus.current = document.activeElement as HTMLElement;
                setPresenting(true);
                void root.current?.requestFullscreen?.().catch(() => undefined);
            }}>
              {presenting ? <Minimize2 size={17}/> : <Maximize2 size={17}/>}
              {presenting ? "Salir" : "Presentar"}
            </button>)}
        </div>
      </header>

      {editor !== null && (<CompetencyEditor key={editor === "new" ? "new" : editor.id} course={course} competency={editor === "new" ? undefined : editor} onClose={() => setEditor(null)} onSave={(competency) => {
                const exists = competencies.some((item) => item.id === competency.id);
                onUpdate({
                    ...course,
                    competencies: exists
                        ? competencies.map((item) => item.id === competency.id ? competency : item)
                        : [...competencies, competency],
                });
                setActive(exists
                    ? competencies.findIndex((item) => item.id === competency.id)
                    : competencies.length);
                setEditor(null);
            }}/>)}

      <div className="learning-workspace">
        <div className="learning-visual">
          <div className="learning-visual-top">
            <span className="learning-live-dot"/>
            {(student?.name ?? "VISTA DEL GRUPO")}
            <div className="learning-view-toggle">
              <button aria-pressed={!flat} onClick={() => setFlat(false)}>
                3D
              </button>
              <button aria-pressed={flat} onClick={() => setFlat(true)}>
                Vista 2D
              </button>
            </div>
          </div>
          {allNodes.length === 0 ? (<div className="learning-empty">
              <GitBranch size={44} strokeWidth={1}/>
              <h3>
                {sceneMode === "tree"
                ? "El crecimiento empieza aquí."
                : "Tu recorrido está por comenzar."}
              </h3>
              <p>
                {sceneMode === "tree"
                ? "Define competencias y vincúlalas a las actividades del curso. Cada rama mostrará las evidencias disponibles."
                : "Añade evaluaciones en la configuración para explorar su evolución."}
              </p>
              {mode === "tree" && (<button className="learning-button primary" onClick={() => setEditor("new")}>
                  <Plus size={16}/>
                  Crear primera competencia
                </button>)}
            </div>) : flat ? (<div className="learning-flat">
              <span className="learning-eyebrow">
                {"DATOS DEL RECORRIDO"}
              </span>
              {(allNodes.map((node, index) => (<button key={node.id} onClick={() => {
                    setActive(index);
                    setPlaying(false);
                }} aria-pressed={active === index}>
                    <span>
                      {String(index + 1).padStart(2, "0")} · {node.label}
                    </span>
                    <span className="learning-bar">
                      <i style={{
                    width: `${(node.score ?? 0) * 10}%`,
                    background: node.score === null ||
                        node.score >= (node.target ?? 5)
                        ? "var(--learning-mint)"
                        : "var(--learning-amber)",
                }}/>
                    </span>
                    <strong>{formatScore(node.score)}</strong>
                  </button>)))}
            </div>) : (<Suspense fallback={<div className="learning-empty" role="status">
                  Preparando la escena…
                </div>}>
              <LearningScene mode={sceneMode} nodes={nodes} activeIndex={Math.max(0, active - pageStart)} reducedMotion={reducedMotion} onSelect={selectNode}/>
            </Suspense>)}
          <div className="learning-visual-bottom">
            <span>
              {flat
            ? "Los mismos datos, en una vista accesible."
            : "Arrastra para girar · Selecciona un nodo"}
            </span>
            <button onClick={() => setQuiet((value) => !value)} aria-pressed={reducedMotion} disabled={!!prefersReducedMotion}>
              {reducedMotion ? <Pause size={13}/> : <Sparkles size={13}/>}
              Movimiento {reducedMotion ? "reducido" : "suave"}
            </button>
          </div>
          {(<div className="learning-legend">
              <span>
                <i />
                {sceneMode === "tree" ? "Objetivo alcanzado" : "5 o más"}
              </span>
              <span>
                <i />
                En desarrollo
              </span>
              <span>
                <i />
                Sin datos
              </span>
              {allNodes.length > 6 && (<span>
                  Vista {pageStart + 1}–
                  {Math.min(pageStart + 6, allNodes.length)} de{" "}
                  {allNodes.length}
                </span>)}
            </div>)}
        </div>

        <aside className="learning-detail" key={mode}>
          {mode === "tree" && (<>
              <span className="learning-eyebrow">MAPA DE COMPETENCIAS</span>
              <div className="learning-node-list">
                {evidence.map((item, index) => (<button key={item.competency.id} onClick={() => {
                    setActive(index);
                    setDeleteId(null);
                }} aria-pressed={active === index}>
                    <span className={`learning-status-dot ${item.status}`}/>
                    <span>{item.competency.name}</span>
                    <strong>{formatScore(item.score)}</strong>
                    <ChevronRight size={15}/>
                  </button>))}
              </div>
              {selectedEvidence ? (<div className="learning-evidence">
                  <span className="learning-eyebrow">
                    EVIDENCIAS VINCULADAS
                  </span>
                  <h3>{selectedEvidence.competency.name}</h3>
                  <p>
                    {selectedEvidence.competency.description ||
                    "Explora las actividades que sustentan esta competencia."}
                  </p>
                  <div className="learning-score">
                    {formatScore(selectedEvidence.score)}
                    <small>/ 10</small>
                  </div>
                  <p>
                    {selectedEvidence.recorded} de {selectedEvidence.total}{" "}
                    Notas puestas · Objetivo{" "}
                    {selectedEvidence.competency.target}
                  </p>
                  <div className="learning-evidence-activities">
                    {selectedEvidence.activities.map((activity) => (<div key={activity.id}>
                        <span>
                          {activity.name}
                          <small>{activity.context}</small>
                        </span>
                        {student && (<strong>
                            {formatScore(numericGrade(student.grades[activity.id]))}
                          </strong>)}
                      </div>))}
                  </div>
                  <div className="learning-row">
                    <button className="learning-text-button" onClick={() => setEditor(selectedEvidence.competency)}>
                      <Pencil size={14}/>
                      Editar
                    </button>
                    <button className="learning-text-button" onClick={() => setDeleteId(selectedEvidence.competency.id)}>
                      <Trash2 size={14}/>
                      Eliminar
                    </button>
                  </div>
                  {deleteId === selectedEvidence.competency.id && (<div className="learning-notice">
                      <p>
                        Se eliminará la competencia. Las actividades y sus notas
                        se conservan.
                      </p>
                      <button className="learning-button" onClick={() => {
                        onUpdate({
                            ...course,
                            competencies: competencies.filter((item) => item.id !== deleteId),
                        });
                        setDeleteId(null);
                        setActive(0);
                    }}>
                        Eliminar competencia
                      </button>
                      <button className="learning-text-button" onClick={() => setDeleteId(null)}>
                        Cancelar
                      </button>
                    </div>)}
                </div>) : (<p className="learning-muted">
                  Las competencias aparecerán aquí cuando las definas.
                </p>)}
              <p className="learning-footnote">
                <CircleHelp size={14}/>
                El indicador es la media simple de las evidencias numéricas
                vinculadas; no modifica las calificaciones del curso.
              </p>
            </>)}

          {mode === "journey" && (<>
              <span className="learning-eyebrow">
                ESTACIÓN{" "}
                {String(Math.min(active + 1, timeline.length)).padStart(2, "0")}{" "}
                / {String(timeline.length).padStart(2, "0")}
              </span>
              <h3>{selectedMoment?.evaluation.name ?? "Sin evaluaciones"}</h3>
              <div className="learning-score">
                {formatScore(selectedMoment?.score ?? null)}
                <small>/ 10</small>
              </div>
              <p>
                {student
                ? "Resultado del alumno"
                : "Media de alumnos con datos"}
                {selectedMoment?.score === null
                ? " · Sin evidencias numéricas"
                : ""}
              </p>
              <div className="learning-metrics">
                <div>
                  <strong>{selectedMoment?.recorded ?? 0}</strong>
                  <span>Notas registradas</span>
                </div>
                <div>
                  <strong>{selectedMoment?.pending ?? 0}</strong>
                  <span>Pendientes</span>
                </div>
              </div>
              <div className="learning-timeline">
                {timeline.map((moment, index) => (<button key={moment.evaluation.id} aria-pressed={active === index} onClick={() => {
                    setActive(index);
                    setPlaying(false);
                }}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <span>{moment.evaluation.name}</span>
                    <strong>{formatScore(moment.score)}</strong>
                  </button>))}
              </div>
              <div className="learning-row">
                <button className="learning-icon" aria-label="Evaluación anterior" disabled={active === 0} onClick={() => {
                setActive((value) => value - 1);
                setPlaying(false);
            }}>
                  <ArrowLeft size={18}/>
                </button>
                <button className="learning-button primary" disabled={timeline.length < 2 || reducedMotion} onClick={() => {
                if (active >= timeline.length - 1)
                    setActive(0);
                setPlaying(!isPlaying);
            }}>
                  {isPlaying ? <Pause size={16}/> : <Play size={16}/>}
                  {isPlaying ? "Pausar" : "Recorrer"}
                </button>
                <button className="learning-icon" aria-label="Evaluación siguiente" disabled={active >= timeline.length - 1} onClick={() => {
                setActive((value) => value + 1);
                setPlaying(false);
            }}>
                  <ArrowRight size={18}/>
                </button>
              </div>
              <p className="learning-footnote">
                El orden sigue las evaluaciones del curso. Las notas pendientes
                siguen el cálculo del libro; las evaluaciones sin datos no se
                representan como cero.
              </p>
            </>)}

          

          {mode === "tutoring" && (<>
              <span className="learning-eyebrow">
                TUTORÍA / {String(slide + 1).padStart(2, "0")}
              </span>
              <h3>{student?.name ?? "Añade un alumno al curso"}</h3>
              {!student ? (<p>Selecciona un alumno con el que preparar la conversación.</p>) : (<>
                  {slide === 0 && (<>
                      <p>Empezamos por lo que sabemos.</p>
                      <div className="learning-score">
                        {formatScore(latest?.score ?? null)}
                        <small>/ 10</small>
                      </div>
                      <p>
                        {latest?.evaluation.name ??
                        "Aún no hay resultados registrados"}
                      </p>
                      <div className="learning-notice">
                        <strong>
                          {change === null
                        ? "Un punto de partida"
                        : `${change >= 0 ? "+" : ""}${formatScore(change)} puntos de evolución`}
                        </strong>
                        <p>
                          {change === null
                        ? "Necesitamos dos evaluaciones con datos para observar un cambio."
                        : "Diferencia entre la primera y la última evaluación con datos."}
                        </p>
                      </div>
                    </>)}
                  {slide === 1 && (<>
                      <p>
                        Fortalezas y capacidades que podemos seguir
                        desarrollando.
                      </p>
                      {evidence.length ? (<div className="learning-timeline">
                          {evidence.map((item, index) => (<button key={item.competency.id} aria-pressed={active === index} onClick={() => setActive(index)}>
                              <span className={`learning-status-dot ${item.status}`}/>
                              <span>
                                {item.competency.name}
                                <small>
                                  {item.score === null
                                ? "Sin evidencias"
                                : item.status === "achieved"
                                    ? "Objetivo alcanzado"
                                    : "En desarrollo"}
                                </small>
                              </span>
                              <strong>{formatScore(item.score)}</strong>
                            </button>))}
                        </div>) : (<p className="learning-notice">
                          Define las competencias en su pestaña para preparar
                          esta parte de la tutoría.
                        </p>)}
                    </>)}
                  {slide === 2 && (<>
                      <p>Qué ha cambiado a lo largo del curso.</p>
                      <div className="learning-timeline">
                        {timeline.map((moment, index) => (<button key={moment.evaluation.id} aria-pressed={active === index} onClick={() => setActive(index)}>
                            <span>{index + 1}</span>
                            <span>{moment.evaluation.name}</span>
                            <strong>{formatScore(moment.score)}</strong>
                          </button>))}
                      </div>
                      <p className="learning-footnote">
                        Los resultados respetan las notas reales introducidas en
                        el libro. No se muestran comparaciones con otros
                        alumnos.
                      </p>
                    </>)}
                  {slide === 3 && (<>
                      <p>Convertimos la conversación en un acuerdo concreto.</p>
                      <div className="learning-notice">
                        <strong>Para conversar</strong>
                        <p>
                          ¿Qué ha funcionado? ¿Qué vamos a practicar? ¿Cuándo
                          revisaremos el avance?
                        </p>
                      </div>
                      <label className="learning-agreement">
                        Acuerdo y fecha de revisión
                        <textarea rows={4} maxLength={2000} placeholder="Ej. Practicar dos problemas por semana y revisar el avance el viernes…" value={agreement} onChange={(event) => setAgreement(event.target.value)}/>
                      </label>
                      <button className="learning-button primary full" onClick={saveAgreement} disabled={!agreement.trim()}>
                        <Check size={16}/>
                        Guardar acuerdo
                      </button>
                      <button className="learning-button full" onClick={() => print()}>
                        <Printer size={16}/>
                        Resumen de tutoría
                      </button>
                    </>)}
                </>)}
              <div className="learning-slide-controls">
                <button className="learning-icon" aria-label="Paso anterior" disabled={slide === 0} onClick={() => {
                setSlide((value) => value - 1);
                setActive(0);
            }}>
                  <ArrowLeft size={18}/>
                </button>
                <div>
                  {slideNames.map((name, index) => (<button key={name} aria-label={`Paso ${index + 1}: ${name}`} aria-pressed={slide === index} onClick={() => {
                    setSlide(index);
                    setActive(0);
                }}/>))}
                </div>
                <button className="learning-icon" aria-label="Paso siguiente" disabled={slide === 3 || !student} onClick={() => {
                setSlide((value) => value + 1);
                setActive(0);
            }}>
                  <ArrowRight size={18}/>
                </button>
              </div>
              <span className="learning-slide-name">{slideNames[slide]}</span>
            </>)}
        </aside>
      </div>
      <div className="learning-footer">
        <span>
          <span className="learning-live-dot"/>
          Datos del curso · {course.students.length} alumnos ·{" "}
          {course.evaluations.length} evaluaciones
        </span>
        <span>
          {mode === "tutoring"
            ? "Las notas privadas del alumno no se proyectan."
            : "Una perspectiva visual. Las evidencias, siempre a mano."}
        </span>
      </div>
      <div className="learning-announcement" role="status">
        {savedMessage && (<>
            <Check size={16}/>
            {savedMessage}
            <button className="learning-icon" aria-label="Ocultar mensaje" onClick={() => setSavedMessage("")}>
              <X size={15}/>
            </button>
          </>)}
      </div>

      <div className="learning-print-host">
        <div ref={printRef} className="learning-print">
          <p>
            GRADEMASTER PRO ·{" "}
            {"RESUMEN DE TUTORÍA"}
          </p>
          <h1>{course.name}</h1>
          <h2>{student?.name}</h2>
          <p>{new Date().toLocaleDateString("es-ES")}</p>
          {(<>
              <h3>Evolución</h3>
              <table>
                <thead>
                  <tr>
                    <th>Evaluación</th>
                    <th>Resultado / 10</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((moment) => (<tr key={moment.evaluation.id}>
                      <td>{moment.evaluation.name}</td>
                      <td>{formatScore(moment.score)}</td>
                    </tr>))}
                </tbody>
              </table>
              <h3>Competencias</h3>
              {evidence.map((item) => (<p key={item.competency.id}>
                  {item.competency.name}: {formatScore(item.score)} / 10 ·
                  Objetivo {item.competency.target}
                </p>))}
              <h3>Acuerdos de tutoría</h3>
              {student?.notes
                ?.filter((note) => note.text.startsWith("Tutoría · "))
                .map((note) => (<p key={note.id}>
                    {note.date} — {note.text.slice(10)}
                  </p>))}
              {agreement.trim() && <p>Borrador: {agreement}</p>}
            </>)}
          <p>
            Los registros sin datos numéricos se indican con un guion. Las notas
            privadas no se incluyen en el resumen de tutoría.
          </p>
        </div>
      </div>
    </section>);
}
