import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  GitBranch,
  Maximize2,
  Minimize2,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  Route,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, LayoutGroup, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { useReactToPrint } from "react-to-print";
import type { Competency, Course } from "../../types";
import { competencyEvidence, evaluationSummary, formatScore, numericGrade } from "../../lib/learningInsights";
import CompetencyEditor from "./CompetencyEditor";
import type { SceneMode, SceneNode } from "./LearningScene";
import { CalmContext, EASE_OUT, formatCount, SPRING } from "./calm";
import {
  AnimatedNumber,
  Burst,
  EmptyIllustration,
  RevealTitle,
  RollingText,
  ScoreDial,
  ScrambleText,
} from "./LearningMotion";
import "./learning.css";

const LearningScene = lazy(() => import("./LearningScene"));

type Mode = "tree" | "journey" | "tutoring";
type Tone = "achieved" | "developing" | "pending";

const modes = [
  { id: "tree" as const, name: "Competencias", icon: GitBranch, number: "01" },
  { id: "journey" as const, name: "Progreso", icon: Route, number: "02" },
  { id: "tutoring" as const, name: "Tutorías", icon: Users, number: "03" },
];
const titles = {
  tree: ["Árbol de competencias.", "Explora las capacidades que están creciendo en tu curso."],
  journey: ["El aprendizaje deja un recorrido.", "Avanza por las evaluaciones y observa cómo cambia el resultado."],
  tutoring: [
    "Una conversación con perspectiva.",
    "Resultados, fortalezas y próximos pasos para una tutoría centrada en el alumno.",
  ],
};
const slideNames = ["Punto de partida", "Competencias", "Evolución", "Próximos pasos"];
const PLAY_INTERVAL = 2600;

const toneFor = (score: number | null, target = 5): Tone =>
  score === null ? "pending" : score >= target ? "achieved" : "developing";
const pad = (value: number) => String(value).padStart(2, "0");

const panelVariants = {
  initial: { opacity: 0, y: 14, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE_OUT } },
  exit: { opacity: 0, y: -8, filter: "blur(4px)", transition: { duration: 0.18 } },
};
const listVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
};
const rowVariants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};
const slideVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 46, filter: "blur(6px)" }),
  center: { opacity: 1, x: 0, filter: "blur(0px)", transition: { duration: 0.5, ease: EASE_OUT } },
  exit: (direction: number) => ({ opacity: 0, x: direction * -36, filter: "blur(4px)", transition: { duration: 0.2 } }),
};

export default function LearningStudio({ course, onUpdate }: { course: Course; onUpdate: (course: Course) => void }) {
  const uid = useId();
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
  const [direction, setDirection] = useState(1);
  const [presenting, setPresenting] = useState(false);
  const [agreement, setAgreement] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [celebrate, setCelebrate] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const visual = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const student = course.students.find((person) => person.id === studentId);
  const competencies = course.competencies ?? [];
  const evidence = useMemo(
    () =>
      (course.competencies ?? []).map((competency) => ({
        competency,
        ...competencyEvidence(course, competency, student),
      })),
    [course, student],
  );
  const timeline = useMemo(
    () =>
      course.evaluations.map((item) => ({
        evaluation: item,
        ...evaluationSummary(course, item, student),
      })),
    [course, student],
  );
  const selectedEvidence = evidence[Math.min(active, evidence.length - 1)];
  const selectedMoment = timeline[Math.min(active, timeline.length - 1)];
  const available = timeline.filter((moment) => moment.score !== null);
  const latest = available.at(-1);
  const change = available.length > 1 ? latest!.score! - available[0].score! : null;
  const sceneMode: SceneMode = mode === "tree" || (mode === "tutoring" && slide === 1) ? "tree" : "journey";
  const allNodes = useMemo<SceneNode[]>(
    () =>
      sceneMode === "tree"
        ? evidence.map((item, index) => ({
            id: item.competency.id,
            label: item.competency.name,
            score: item.score,
            target: item.competency.target,
            count: item.activities.length,
            ordinal: index + 1,
          }))
        : timeline.map((moment) => ({
            id: moment.evaluation.id,
            label: moment.evaluation.name,
            score: moment.score,
          })),
    [sceneMode, evidence, timeline],
  );
  const pageStart = Math.min(Math.floor(active / 6) * 6, Math.max(0, allNodes.length - 6));
  const nodes = useMemo(() => allNodes.slice(pageStart, pageStart + 6), [allNodes, pageStart]);
  const selectNode = useCallback(
    (index: number) => {
      setActive(pageStart + index);
      setPlaying(false);
    },
    [pageStart],
  );
  const print = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Tutoria_${course.name}`,
    pageStyle: "@page { size: A4; margin: 18mm; } body { background: white !important; color: #142c3b !important; }",
  });

  useEffect(() => {
    if (!playing || mode !== "journey" || reducedMotion || active >= timeline.length - 1) return;
    const timer = window.setInterval(() => {
      setActive((previous) => (previous >= timeline.length - 1 ? previous : previous + 1));
    }, PLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [playing, mode, timeline.length, reducedMotion, active]);
  const isPlaying = playing && active < timeline.length - 1;

  const goToSlide = (next: number) => {
    const target = Math.max(0, Math.min(3, next));
    setDirection(target >= slide ? 1 : -1);
    setSlide(target);
    setActive(0);
  };

  const exitPresentation = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    returnFocus.current?.focus();
  }, []);

  useEffect(() => {
    if (!presenting) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitPresentation();
        return;
      }
      const editing =
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement;
      if (!editing && event.key === "ArrowRight") {
        event.preventDefault();
        setDirection(1);
        setSlide((value) => Math.min(3, value + 1));
        setActive(0);
      }
      if (!editing && event.key === "ArrowLeft") {
        event.preventDefault();
        setDirection(-1);
        setSlide((value) => Math.max(0, value - 1));
        setActive(0);
      }
      if (event.key === "Tab") {
        const focusable = root.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea, select, input, [tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === root.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) exitPresentation();
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
    setDirection(1);
    if (next === "tutoring" && !studentId) setStudentId(course.students[0]?.id ?? "");
  };

  const saveAgreement = () => {
    if (!student || !agreement.trim()) return;
    onUpdate({
      ...course,
      students: course.students.map((person) =>
        person.id === student.id
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
          : person,
      ),
    });
    setAgreement("");
    setSavedMessage("Acuerdo guardado en las notas del alumno.");
    setCelebrate((value) => value + 1);
  };

  const togglePresentation = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (presenting) {
      exitPresentation();
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    root.current?.style.setProperty("--present-x", `${rect.left + rect.width / 2}px`);
    root.current?.style.setProperty("--present-y", `${rect.top + rect.height / 2}px`);
    returnFocus.current = document.activeElement as HTMLElement;
    setPresenting(true);
    void root.current?.requestFullscreen?.().catch(() => undefined);
  };

  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = visual.current;
    if (!element || reducedMotion) return;
    const rect = element.getBoundingClientRect();
    element.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
    element.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
  };

  const headerTitle = presenting ? slideNames[slide] : titles[mode][0];
  const headerText = presenting ? "Un espacio para entender, escuchar y acordar." : titles[mode][1];
  const eyebrow = presenting
    ? `${course.name} / ${student?.name ?? ""}`
    : `${modes.find((item) => item.id === mode)?.number} / ${course.name}`;
  const stageKey = allNodes.length === 0 ? `empty-${sceneMode}` : flat ? "flat" : "scene";
  const evidenceTone: Tone = selectedEvidence
    ? toneFor(selectedEvidence.score, selectedEvidence.competency.target)
    : "pending";

  return (
    <CalmContext.Provider value={reducedMotion}>
      <MotionConfig reducedMotion={reducedMotion ? "always" : "never"}>
        <section
          ref={root}
          tabIndex={-1}
          data-mode={mode}
          className={`learning-studio${presenting ? " is-presenting" : ""}${reducedMotion ? " is-calm" : ""}`}
          aria-label="Espacio de aprendizaje"
          role={presenting ? "dialog" : undefined}
          aria-modal={presenting || undefined}
        >
          <motion.div
            className="learning-masthead"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
          >
            <span>
              <Sparkles size={16} className="learning-twinkle" /> ESPACIO DE APRENDIZAJE
            </span>
            <span className="learning-edition">{presenting ? "MODO TUTORÍA" : "UNA NUEVA PERSPECTIVA"}</span>
          </motion.div>

          {!presenting && (
            <motion.nav
              className="learning-tabs"
              aria-label="Experiencias de aprendizaje"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              {modes.map((item) => (
                <button key={item.id} aria-pressed={mode === item.id} onClick={() => switchMode(item.id)}>
                  <span>{item.number}</span>
                  <item.icon size={18} className="learning-tab-icon" />
                  {item.name}
                  {mode === item.id && (
                    <motion.span layoutId={`${uid}-tab`} className="learning-tab-indicator" transition={SPRING} />
                  )}
                </button>
              ))}
            </motion.nav>
          )}

          <header className="learning-header">
            <div className="learning-aurora" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="learning-header-copy">
              <ScrambleText className="learning-eyebrow" text={eyebrow} />
              <AnimatePresence mode="wait" initial={true}>
                <RevealTitle key={headerTitle} text={headerTitle} />
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.p
                  key={headerText}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: 0.3, duration: 0.5, ease: EASE_OUT } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                >
                  {headerText}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="learning-header-actions">
              <AnimatePresence initial={false}>
                {mode === "tree" && (
                  <motion.button
                    type="button"
                    className="learning-button primary learning-add-competency"
                    onClick={() => setEditor("new")}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileTap={{ scale: 0.96 }}
                  >
                    <Plus size={18} className="learning-plus" />
                    Añadir competencia
                  </motion.button>
                )}
              </AnimatePresence>
              {!presenting && (
                <label className="learning-select-label">
                  {mode === "tutoring" ? "Alumno de la tutoría" : "Perspectiva"}
                  <select
                    value={studentId}
                    onChange={(event) => {
                      setStudentId(event.target.value);
                      setActive(0);
                      setPlaying(false);
                      setAgreement("");
                      setSavedMessage("");
                    }}
                  >
                    {mode !== "tutoring" && <option value="">Todo el grupo</option>}
                    {!course.students.length && mode === "tutoring" && <option value="">Sin alumnos</option>}
                    {course.students.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {mode === "tutoring" && (
                <motion.button
                  className="learning-button"
                  disabled={!student}
                  onClick={togglePresentation}
                  whileTap={{ scale: 0.96 }}
                >
                  {presenting ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                  {presenting ? "Salir" : "Presentar"}
                </motion.button>
              )}
            </div>
          </header>

          <AnimatePresence initial={false}>
            {editor !== null && (
              <motion.div
                className="learning-editor-shell"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } }}
                exit={{ height: 0, opacity: 0, transition: { duration: 0.3, ease: EASE_OUT } }}
              >
                <CompetencyEditor
                  key={editor === "new" ? "new" : editor.id}
                  course={course}
                  competency={editor === "new" ? undefined : editor}
                  onClose={() => setEditor(null)}
                  onSave={(competency) => {
                    const exists = competencies.some((item) => item.id === competency.id);
                    onUpdate({
                      ...course,
                      competencies: exists
                        ? competencies.map((item) => (item.id === competency.id ? competency : item))
                        : [...competencies, competency],
                    });
                    setActive(
                      exists ? competencies.findIndex((item) => item.id === competency.id) : competencies.length,
                    );
                    setEditor(null);
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="learning-workspace"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE_OUT }}
          >
            <div className="learning-visual" ref={visual} onPointerMove={trackPointer}>
              <div className="learning-visual-top">
                <span className="learning-live-dot" />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={student?.name ?? "group"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    {student?.name ?? "VISTA DEL GRUPO"}
                  </motion.span>
                </AnimatePresence>
                <div className="learning-view-toggle">
                  {[
                    { label: "3D", value: false },
                    { label: "Vista 2D", value: true },
                  ].map((option) => (
                    <button key={option.label} aria-pressed={flat === option.value} onClick={() => setFlat(option.value)}>
                      {flat === option.value && (
                        <motion.span layoutId={`${uid}-view`} className="learning-toggle-pill" transition={SPRING} />
                      )}
                      <span>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="learning-stage">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={stageKey}
                    className="learning-stage-layer"
                    initial={{ opacity: 0, scale: 0.97, filter: "blur(8px)" }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE_OUT } }}
                    exit={{ opacity: 0, scale: 1.02, filter: "blur(6px)", transition: { duration: 0.2 } }}
                  >
                    {allNodes.length === 0 ? (
                      <div className="learning-empty">
                        <EmptyIllustration variant={sceneMode} />
                        <h3>{sceneMode === "tree" ? "El crecimiento empieza aquí." : "Tu recorrido está por comenzar."}</h3>
                        <p>
                          {sceneMode === "tree"
                            ? "Define competencias y vincúlalas a las actividades del curso. Cada rama mostrará las evidencias disponibles."
                            : "Añade evaluaciones en la configuración para explorar su evolución."}
                        </p>
                        {mode === "tree" && (
                          <motion.button
                            className="learning-button primary"
                            onClick={() => setEditor("new")}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0, transition: { delay: 1.2 } }}
                            whileTap={{ scale: 0.96 }}
                          >
                            <Plus size={16} />
                            Crear primera competencia
                          </motion.button>
                        )}
                      </div>
                    ) : flat ? (
                      <div className="learning-flat">
                        <span className="learning-eyebrow">
                          {sceneMode === "tree" ? "DATOS DE LAS COMPETENCIAS" : "DATOS DEL RECORRIDO"}
                        </span>
                        <motion.div className="learning-flat-list" variants={listVariants} initial="hidden" animate="show">
                          {allNodes.map((node, index) => {
                            const tone = toneFor(node.score, node.target ?? 5);
                            return (
                              <motion.button
                                key={node.id}
                                variants={rowVariants}
                                onClick={() => {
                                  setActive(index);
                                  setPlaying(false);
                                }}
                                aria-pressed={active === index}
                              >
                                {active === index && (
                                  <motion.span layoutId={`${uid}-flat`} className="learning-row-highlight" transition={SPRING} />
                                )}
                                <span>
                                  {pad(index + 1)} · {node.label}
                                </span>
                                <span className="learning-bar">
                                  <motion.i
                                    className={`tone-${tone}`}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: (node.score ?? 0) / 10 }}
                                    transition={{ duration: 1, delay: 0.15 + index * 0.06, ease: EASE_OUT }}
                                  />
                                  <b style={{ left: `${(node.target ?? 5) * 10}%` }} />
                                </span>
                                <strong>
                                  <AnimatedNumber value={node.score} />
                                </strong>
                              </motion.button>
                            );
                          })}
                        </motion.div>
                      </div>
                    ) : (
                      <Suspense
                        fallback={
                          <div className="learning-empty" role="status">
                            <span className="learning-loader" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                            Preparando la escena…
                          </div>
                        }
                      >
                        <LearningScene
                          mode={sceneMode}
                          nodes={nodes}
                          activeIndex={Math.max(0, active - pageStart)}
                          reducedMotion={reducedMotion}
                          onSelect={selectNode}
                        />
                      </Suspense>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="learning-visual-bottom">
                <span>{flat ? "Los mismos datos, en una vista accesible." : "Arrastra para girar · Selecciona un nodo"}</span>
                <button
                  className="learning-motion-switch"
                  onClick={() => setQuiet((value) => !value)}
                  aria-pressed={reducedMotion}
                  disabled={!!prefersReducedMotion}
                >
                  {reducedMotion ? <Pause size={13} /> : <Sparkles size={13} className="learning-twinkle" />}
                  Movimiento {reducedMotion ? "reducido" : "suave"}
                  <span className="learning-switch" aria-hidden="true">
                    <motion.i layout transition={SPRING} />
                  </span>
                </button>
              </div>
              <div className="learning-legend">
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
                {allNodes.length > 6 && (
                  <span>
                    Vista {pageStart + 1}–{Math.min(pageStart + 6, allNodes.length)} de {allNodes.length}
                  </span>
                )}
              </div>
            </div>

            <aside className="learning-detail">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={mode} variants={panelVariants} initial="initial" animate="animate" exit="exit">
                  {mode === "tree" && (
                    <>
                      <span className="learning-eyebrow">MAPA DE COMPETENCIAS</span>
                      <LayoutGroup id={`${uid}-nodes`}>
                        <motion.div className="learning-node-list" variants={listVariants} initial="hidden" animate="show">
                          {evidence.map((item, index) => (
                            <motion.button
                              key={item.competency.id}
                              variants={rowVariants}
                              onClick={() => {
                                setActive(index);
                                setDeleteId(null);
                              }}
                              aria-pressed={active === index}
                            >
                              {active === index && (
                                <motion.span layoutId={`${uid}-node`} className="learning-row-highlight" transition={SPRING} />
                              )}
                              <span className={`learning-status-dot ${item.status}`} />
                              <span className="learning-grow">{item.competency.name}</span>
                              <strong>
                                <AnimatedNumber value={item.score} />
                              </strong>
                              <ChevronRight size={15} />
                            </motion.button>
                          ))}
                        </motion.div>
                      </LayoutGroup>
                      <AnimatePresence mode="wait" initial={false}>
                        {selectedEvidence ? (
                          <motion.div
                            key={selectedEvidence.competency.id}
                            className="learning-evidence"
                            variants={panelVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                          >
                            <span className="learning-eyebrow">EVIDENCIAS VINCULADAS</span>
                            <h3>{selectedEvidence.competency.name}</h3>
                            <p>
                              {selectedEvidence.competency.description ||
                                "Explora las actividades que sustentan esta competencia."}
                            </p>
                            <div className="learning-dial-row">
                              <ScoreDial
                                score={selectedEvidence.score}
                                target={selectedEvidence.competency.target}
                                tone={evidenceTone}
                              />
                              <div className="learning-dial-meta">
                                <span className={`learning-tone-label tone-${evidenceTone}`}>
                                  {evidenceTone === "achieved"
                                    ? "Objetivo alcanzado"
                                    : evidenceTone === "developing"
                                      ? "En desarrollo"
                                      : "Sin evidencias"}
                                </span>
                                <span>
                                  <strong>{formatScore(selectedEvidence.competency.target)}</strong>
                                  objetivo
                                </span>
                                <span>
                                  <strong>
                                    {selectedEvidence.recorded}/{selectedEvidence.total}
                                  </strong>
                                  notas puestas
                                </span>
                              </div>
                            </div>
                            <motion.div
                              className="learning-evidence-activities"
                              variants={listVariants}
                              initial="hidden"
                              animate="show"
                            >
                              {selectedEvidence.activities.map((activity) => {
                                const grade = student ? numericGrade(student.grades[activity.id]) : null;
                                return (
                                  <motion.div key={activity.id} variants={rowVariants}>
                                    <span>
                                      {activity.name}
                                      <small>{activity.context}</small>
                                    </span>
                                    {student && (
                                      <strong className={`tone-${toneFor(grade, selectedEvidence.competency.target)}`}>
                                        {formatScore(grade)}
                                      </strong>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </motion.div>
                            <div className="learning-row">
                              <button className="learning-text-button" onClick={() => setEditor(selectedEvidence.competency)}>
                                <Pencil size={14} />
                                Editar
                              </button>
                              <button
                                className="learning-text-button"
                                onClick={() => setDeleteId(selectedEvidence.competency.id)}
                              >
                                <Trash2 size={14} />
                                Eliminar
                              </button>
                            </div>
                            <AnimatePresence>
                              {deleteId === selectedEvidence.competency.id && (
                                <motion.div
                                  className="learning-notice danger"
                                  initial={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                                  animate={{ opacity: 1, height: "auto", marginTop: 15, marginBottom: 15 }}
                                  exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                                  transition={{ duration: 0.35, ease: EASE_OUT }}
                                >
                                  <div>
                                    <p>Se eliminará la competencia. Las actividades y sus notas se conservan.</p>
                                    <button
                                      className="learning-button"
                                      onClick={() => {
                                        onUpdate({
                                          ...course,
                                          competencies: competencies.filter((item) => item.id !== deleteId),
                                        });
                                        setDeleteId(null);
                                        setActive(0);
                                      }}
                                    >
                                      Eliminar competencia
                                    </button>
                                    <button className="learning-text-button" onClick={() => setDeleteId(null)}>
                                      Cancelar
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        ) : (
                          <motion.p key="none" className="learning-muted" variants={panelVariants} initial="initial" animate="animate">
                            Las competencias aparecerán aquí cuando las definas.
                          </motion.p>
                        )}
                      </AnimatePresence>
                      <p className="learning-footnote">
                        <CircleHelp size={14} />
                        El indicador es la media simple de las evidencias numéricas vinculadas; no modifica las
                        calificaciones del curso.
                      </p>
                    </>
                  )}

                  {mode === "journey" && (
                    <>
                      <span className="learning-eyebrow">
                        ESTACIÓN <RollingText text={pad(Math.min(active + 1, timeline.length))} /> / {pad(timeline.length)}
                      </span>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.h3
                          key={selectedMoment?.evaluation.id ?? "none"}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3, ease: EASE_OUT }}
                        >
                          {selectedMoment?.evaluation.name ?? "Sin evaluaciones"}
                        </motion.h3>
                      </AnimatePresence>
                      <div className="learning-dial-row">
                        <ScoreDial
                          score={selectedMoment?.score ?? null}
                          target={5}
                          tone={toneFor(selectedMoment?.score ?? null)}
                        />
                        <div className="learning-dial-meta">
                          <span className={`learning-tone-label tone-${toneFor(selectedMoment?.score ?? null)}`}>
                            {student ? "Resultado del alumno" : "Media de alumnos con datos"}
                          </span>
                          {selectedMoment?.score === null && <span>Sin evidencias numéricas</span>}
                          <span>
                            <strong>5</strong>
                            referencia
                          </span>
                        </div>
                      </div>
                      <div className="learning-metrics">
                        <div>
                          <strong>
                            <AnimatedNumber value={selectedMoment?.recorded ?? 0} format={formatCount} />
                          </strong>
                          <span>Notas registradas</span>
                        </div>
                        <div>
                          <strong>
                            <AnimatedNumber value={selectedMoment?.pending ?? 0} format={formatCount} />
                          </strong>
                          <span>Pendientes</span>
                        </div>
                      </div>
                      <LayoutGroup id={`${uid}-timeline`}>
                        <motion.div
                          className="learning-timeline is-route"
                          variants={listVariants}
                          initial="hidden"
                          animate="show"
                        >
                          {timeline.map((moment, index) => (
                            <motion.button
                              key={moment.evaluation.id}
                              variants={rowVariants}
                              aria-pressed={active === index}
                              data-passed={index <= active}
                              style={{ "--i": index } as CSSProperties}
                              onClick={() => {
                                setActive(index);
                                setPlaying(false);
                              }}
                            >
                              {active === index && (
                                <motion.span layoutId={`${uid}-moment`} className="learning-row-highlight" transition={SPRING} />
                              )}
                              <span className="learning-route-stop" aria-hidden="true" />
                              <span className="learning-index">{pad(index + 1)}</span>
                              <span className="learning-grow">{moment.evaluation.name}</span>
                              <strong>{formatScore(moment.score)}</strong>
                            </motion.button>
                          ))}
                        </motion.div>
                      </LayoutGroup>
                      <div className="learning-row">
                        <motion.button
                          className="learning-icon"
                          aria-label="Evaluación anterior"
                          disabled={active === 0}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setActive((value) => value - 1);
                            setPlaying(false);
                          }}
                        >
                          <ArrowLeft size={18} />
                        </motion.button>
                        <motion.button
                          className={`learning-button primary learning-play${isPlaying ? " is-playing" : ""}`}
                          disabled={timeline.length < 2 || reducedMotion}
                          whileTap={{ scale: 0.96 }}
                          onClick={() => {
                            if (active >= timeline.length - 1) setActive(0);
                            setPlaying(!isPlaying);
                          }}
                        >
                          {isPlaying && (
                            <span
                              key={active}
                              className="learning-play-progress"
                              style={{ animationDuration: `${PLAY_INTERVAL}ms` }}
                              aria-hidden="true"
                            />
                          )}
                          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                          {isPlaying ? "Pausar" : "Recorrer"}
                        </motion.button>
                        <motion.button
                          className="learning-icon"
                          aria-label="Evaluación siguiente"
                          disabled={active >= timeline.length - 1}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setActive((value) => value + 1);
                            setPlaying(false);
                          }}
                        >
                          <ArrowRight size={18} />
                        </motion.button>
                      </div>
                      <p className="learning-footnote">
                        El orden sigue las evaluaciones del curso. Las notas pendientes siguen el cálculo del libro; las
                        evaluaciones sin datos no se representan como cero.
                      </p>
                    </>
                  )}

                  {mode === "tutoring" && (
                    <>
                      <span className="learning-eyebrow">
                        TUTORÍA / <RollingText text={pad(slide + 1)} />
                      </span>
                      <h3>{student?.name ?? "Añade un alumno al curso"}</h3>
                      {!student ? (
                        <p>Selecciona un alumno con el que preparar la conversación.</p>
                      ) : (
                        <div className="learning-slides">
                          <AnimatePresence mode="wait" initial={false} custom={direction}>
                            <motion.div
                              key={slide}
                              custom={direction}
                              variants={slideVariants}
                              initial="enter"
                              animate="center"
                              exit="exit"
                            >
                              {slide === 0 && (
                                <>
                                  <p>Empezamos por lo que sabemos.</p>
                                  <div className="learning-dial-row">
                                    <ScoreDial
                                      score={latest?.score ?? null}
                                      target={5}
                                      tone={toneFor(latest?.score ?? null)}
                                      size={presenting ? 190 : 132}
                                    />
                                    <div className="learning-dial-meta">
                                      <span className={`learning-tone-label tone-${toneFor(latest?.score ?? null)}`}>
                                        Último resultado
                                      </span>
                                      <span>{latest?.evaluation.name ?? "Aún no hay resultados registrados"}</span>
                                    </div>
                                  </div>
                                  <div className={`learning-notice learning-trend${change !== null && change < 0 ? " is-down" : ""}`}>
                                    {change !== null && (
                                      <motion.span
                                        className="learning-trend-icon"
                                        initial={{ scale: 0, rotate: -40 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.3 }}
                                      >
                                        {change >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                                      </motion.span>
                                    )}
                                    <div>
                                      <strong>
                                        {change === null ? (
                                          "Un punto de partida"
                                        ) : (
                                          <>
                                            {change >= 0 ? "+" : "−"}
                                            <AnimatedNumber value={Math.abs(change)} /> puntos de evolución
                                          </>
                                        )}
                                      </strong>
                                      <p>
                                        {change === null
                                          ? "Necesitamos dos evaluaciones con datos para observar un cambio."
                                          : "Diferencia entre la primera y la última evaluación con datos."}
                                      </p>
                                    </div>
                                  </div>
                                </>
                              )}
                              {slide === 1 && (
                                <>
                                  <p>Fortalezas y capacidades que podemos seguir desarrollando.</p>
                                  {evidence.length ? (
                                    <LayoutGroup id={`${uid}-strengths`}>
                                      <motion.div className="learning-timeline" variants={listVariants} initial="hidden" animate="show">
                                        {evidence.map((item, index) => (
                                          <motion.button
                                            key={item.competency.id}
                                            variants={rowVariants}
                                            aria-pressed={active === index}
                                            onClick={() => setActive(index)}
                                          >
                                            {active === index && (
                                              <motion.span layoutId={`${uid}-strength`} className="learning-row-highlight" transition={SPRING} />
                                            )}
                                            <span className={`learning-status-dot ${item.status}`} />
                                            <span className="learning-grow">
                                              {item.competency.name}
                                              <small>
                                                {item.score === null
                                                  ? "Sin evidencias"
                                                  : item.status === "achieved"
                                                    ? "Objetivo alcanzado"
                                                    : "En desarrollo"}
                                              </small>
                                              <span className="learning-bar slim">
                                                <motion.i
                                                  className={`tone-${item.status}`}
                                                  initial={{ scaleX: 0 }}
                                                  animate={{ scaleX: (item.score ?? 0) / 10 }}
                                                  transition={{ duration: 1, delay: 0.2 + index * 0.07, ease: EASE_OUT }}
                                                />
                                                <b style={{ left: `${item.competency.target * 10}%` }} />
                                              </span>
                                            </span>
                                            <strong>{formatScore(item.score)}</strong>
                                          </motion.button>
                                        ))}
                                      </motion.div>
                                    </LayoutGroup>
                                  ) : (
                                    <p className="learning-notice">
                                      Define las competencias en su pestaña para preparar esta parte de la tutoría.
                                    </p>
                                  )}
                                </>
                              )}
                              {slide === 2 && (
                                <>
                                  <p>Qué ha cambiado a lo largo del curso.</p>
                                  <LayoutGroup id={`${uid}-evolution`}>
                                    <motion.div
                                      className="learning-timeline is-route"
                                      variants={listVariants}
                                      initial="hidden"
                                      animate="show"
                                    >
                                      {timeline.map((moment, index) => (
                                        <motion.button
                                          key={moment.evaluation.id}
                                          variants={rowVariants}
                                          aria-pressed={active === index}
                                          data-passed={index <= active}
                                          style={{ "--i": index } as CSSProperties}
                                          onClick={() => setActive(index)}
                                        >
                                          {active === index && (
                                            <motion.span layoutId={`${uid}-evolution-row`} className="learning-row-highlight" transition={SPRING} />
                                          )}
                                          <span className="learning-route-stop" aria-hidden="true" />
                                          <span className="learning-index">{index + 1}</span>
                                          <span className="learning-grow">{moment.evaluation.name}</span>
                                          <strong>{formatScore(moment.score)}</strong>
                                        </motion.button>
                                      ))}
                                    </motion.div>
                                  </LayoutGroup>
                                  <p className="learning-footnote">
                                    Los resultados respetan las notas reales introducidas en el libro. No se muestran
                                    comparaciones con otros alumnos.
                                  </p>
                                </>
                              )}
                              {slide === 3 && (
                                <>
                                  <p>Convertimos la conversación en un acuerdo concreto.</p>
                                  <div className="learning-notice">
                                    <strong>Para conversar</strong>
                                    <p>¿Qué ha funcionado? ¿Qué vamos a practicar? ¿Cuándo revisaremos el avance?</p>
                                  </div>
                                  <label className="learning-agreement">
                                    Acuerdo y fecha de revisión
                                    <textarea
                                      rows={4}
                                      maxLength={2000}
                                      placeholder="Ej. Practicar dos problemas por semana y revisar el avance el viernes…"
                                      value={agreement}
                                      onChange={(event) => setAgreement(event.target.value)}
                                    />
                                  </label>
                                  <div className="learning-burst-host">
                                    <motion.button
                                      className="learning-button primary full"
                                      onClick={saveAgreement}
                                      disabled={!agreement.trim()}
                                      whileTap={{ scale: 0.97 }}
                                    >
                                      <Check size={16} />
                                      Guardar acuerdo
                                    </motion.button>
                                    <Burst trigger={celebrate} />
                                  </div>
                                  <motion.button className="learning-button full" onClick={() => print()} whileTap={{ scale: 0.97 }}>
                                    <Printer size={16} />
                                    Resumen de tutoría
                                  </motion.button>
                                </>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>
                      )}
                      <div className="learning-slide-controls">
                        <motion.button
                          className="learning-icon"
                          aria-label="Paso anterior"
                          disabled={slide === 0}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => goToSlide(slide - 1)}
                        >
                          <ArrowLeft size={18} />
                        </motion.button>
                        <div>
                          {slideNames.map((name, index) => (
                            <button
                              key={name}
                              aria-label={`Paso ${index + 1}: ${name}`}
                              aria-pressed={slide === index}
                              data-done={index < slide}
                              onClick={() => goToSlide(index)}
                            >
                              {slide === index && (
                                <motion.span layoutId={`${uid}-slide`} className="learning-slide-pill" transition={SPRING} />
                              )}
                            </button>
                          ))}
                        </div>
                        <motion.button
                          className="learning-icon"
                          aria-label="Paso siguiente"
                          disabled={slide === 3 || !student}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => goToSlide(slide + 1)}
                        >
                          <ArrowRight size={18} />
                        </motion.button>
                      </div>
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.span
                          key={slide}
                          className="learning-slide-name"
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                        >
                          {slideNames[slide]}
                        </motion.span>
                      </AnimatePresence>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </aside>
          </motion.div>

          <div className="learning-footer">
            <span>
              <span className="learning-live-dot" />
              Datos del curso · {course.students.length} alumnos · {course.evaluations.length} evaluaciones
            </span>
            <span>
              {mode === "tutoring"
                ? "Las notas privadas del alumno no se proyectan."
                : "Una perspectiva visual. Las evidencias, siempre a mano."}
            </span>
          </div>
          <div className="learning-announcement" role="status">
            <AnimatePresence>
              {savedMessage && (
                <motion.div
                  key={savedMessage}
                  className="learning-toast"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                >
                  <span className="learning-toast-check">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <motion.path
                        d="M5 12.5l4.2 4.2L19 7"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45, delay: 0.15, ease: EASE_OUT }}
                      />
                    </svg>
                  </span>
                  {savedMessage}
                  <button className="learning-icon" aria-label="Ocultar mensaje" onClick={() => setSavedMessage("")}>
                    <X size={15} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="learning-print-host">
            <div ref={printRef} className="learning-print">
              <p>GRADEMASTER PRO · RESUMEN DE TUTORÍA</p>
              <h1>{course.name}</h1>
              <h2>{student?.name}</h2>
              <p>{new Date().toLocaleDateString("es-ES")}</p>
              <h3>Evolución</h3>
              <table>
                <thead>
                  <tr>
                    <th>Evaluación</th>
                    <th>Resultado / 10</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.map((moment) => (
                    <tr key={moment.evaluation.id}>
                      <td>{moment.evaluation.name}</td>
                      <td>{formatScore(moment.score)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <h3>Competencias</h3>
              {evidence.map((item) => (
                <p key={item.competency.id}>
                  {item.competency.name}: {formatScore(item.score)} / 10 · Objetivo {item.competency.target}
                </p>
              ))}
              <h3>Acuerdos de tutoría</h3>
              {student?.notes
                ?.filter((note) => note.text.startsWith("Tutoría · "))
                .map((note) => (
                  <p key={note.id}>
                    {note.date} — {note.text.slice(10)}
                  </p>
                ))}
              {agreement.trim() && <p>Borrador: {agreement}</p>}
              <p>
                Los registros sin datos numéricos se indican con un guion. Las notas privadas no se incluyen en el
                resumen de tutoría.
              </p>
            </div>
          </div>
        </section>
      </MotionConfig>
    </CalmContext.Provider>
  );
}
