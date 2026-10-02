import { useEffect, useRef, useState } from "react";
import { LearningEngine } from "./learningEngine";
import type { SceneMode, SceneNode } from "./learningEngine";

export type { SceneMode, SceneNode } from "./learningEngine";

interface Props {
  mode: SceneMode;
  nodes: SceneNode[];
  activeIndex: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

export default function LearningScene({
  mode,
  nodes,
  activeIndex,
  reducedMotion,
  onSelect,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const engine = useRef<LearningEngine | null>(null);
  const select = useRef(onSelect);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  // The engine lives for the whole mount; data changes are streamed into it.
  useEffect(() => {
    const container = host.current;
    const layer = labels.current;
    if (!container || !layer) return;
    let instance: LearningEngine;
    try {
      instance = new LearningEngine(container, layer, {
        onSelect: (index) => select.current(index),
        onFail: () => setFailed(true),
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    engine.current = instance;
    queueMicrotask(() => setFailed(false));
    return () => {
      instance.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    engine.current?.setReduced(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    engine.current?.sync(mode, nodes);
  }, [mode, nodes]);

  useEffect(() => {
    engine.current?.setActive(activeIndex);
  }, [activeIndex, mode, nodes]);

  return (
    <div className="learning-canvas" ref={host}>
      <div className="learning-scene-labels" ref={labels} aria-hidden="true" />
      {failed && (
        <div className="learning-render-fallback" role="status">
          <strong>La vista de datos sigue disponible</strong>
          <p>
            Tu navegador no ha podido iniciar la escena 3D. Selecciona «Vista
            2D» para continuar.
          </p>
        </div>
      )}
    </div>
  );
}
