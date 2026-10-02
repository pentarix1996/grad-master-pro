import { Fragment, useEffect, useId, useState } from "react";
import { animate, AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import { formatScore } from "../../lib/learningInsights";
import { EASE_OUT, useCalm } from "./calm";

type Tone = "achieved" | "developing" | "pending";

/** Counts towards a value instead of jumping to it. */
export function AnimatedNumber({
  value,
  format = formatScore,
  className,
}: {
  value: number | null;
  format?: (value: number | null) => string;
  className?: string;
}) {
  const calm = useCalm();
  const motionValue = useMotionValue(value ?? 0);
  const text = useTransform(motionValue, (latest) => format(latest));
  useEffect(() => {
    if (value === null) {
      motionValue.set(0);
      return;
    }
    if (calm) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 1, ease: EASE_OUT });
    return () => controls.stop();
  }, [value, calm, motionValue]);
  if (value === null) return <span className={className}>{format(null)}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

const ARC = "M 50 6 A 44 44 0 1 1 49.99 6";

/** Circular gauge: arc for the score, a notch for the target. */
export function ScoreDial({
  score,
  target,
  tone,
  size = 132,
}: {
  score: number | null;
  target?: number;
  tone: Tone;
  size?: number;
}) {
  const calm = useCalm();
  const gradient = useId();
  const amount = score === null ? 0 : Math.min(1, Math.max(0, score / 10));
  const progress = useMotionValue(0);
  useEffect(() => {
    if (calm) {
      progress.set(amount);
      return;
    }
    const controls = animate(progress, amount, { duration: 1.25, ease: EASE_OUT });
    return () => controls.stop();
  }, [amount, calm, progress]);
  const cx = useTransform(progress, (p) => 50 + 44 * Math.sin(p * Math.PI * 2));
  const cy = useTransform(progress, (p) => 50 - 44 * Math.cos(p * Math.PI * 2));
  const sparkOpacity = useTransform(progress, (p) => (p > 0.005 ? 1 : 0));
  return (
    <div className={`learning-dial tone-${tone}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--dial-from)" />
            <stop offset="100%" stopColor="var(--dial-to)" />
          </linearGradient>
        </defs>
        <circle className="learning-dial__ticks" cx="50" cy="50" r="49" pathLength={100} />
        <circle className="learning-dial__track" cx="50" cy="50" r="44" />
        <motion.path
          className="learning-dial__arc"
          d={ARC}
          stroke={`url(#${gradient})`}
          style={{ pathLength: progress }}
        />
        {target !== undefined && (
          <g transform={`rotate(${Math.min(10, Math.max(0, target)) * 36} 50 50)`}>
            <path className="learning-dial__target" d="M 50 1.5 L 52.6 -2.2 L 47.4 -2.2 Z" />
            <line className="learning-dial__target-line" x1="50" y1="1.5" x2="50" y2="10.5" />
          </g>
        )}
        <motion.circle className="learning-dial__spark" r="3.4" cx={cx} cy={cy} style={{ opacity: sparkOpacity }} />
      </svg>
      <div className="learning-dial__value">
        <AnimatedNumber value={score} />
        <small>/ 10</small>
      </div>
    </div>
  );
}

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·";

/** Briefly scrambles characters before settling on the final text. */
export function ScrambleText({ text, className }: { text: string; className?: string }) {
  const calm = useCalm();
  const [state, setState] = useState({ source: text, output: text });
  useEffect(() => {
    if (calm) return;
    let frame = 0;
    let raf = 0;
    const total = 22;
    const tick = () => {
      frame += 1;
      const revealed = Math.floor((text.length * frame) / total);
      const output = text
        .split("")
        .map((char, index) =>
          index < revealed || char === " " ? char : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        )
        .join("");
      setState({ source: text, output });
      if (frame < total) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, calm]);
  const shown = calm || state.source !== text ? text : state.output;
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}

const wordVariants = {
  hidden: { y: "108%", rotate: 5, opacity: 0 },
  show: { y: "0%", rotate: 0, opacity: 1, transition: { duration: 0.75, ease: EASE_OUT } },
  exit: { y: "-70%", opacity: 0, transition: { duration: 0.22, ease: [0.7, 0, 0.84, 0] as const } },
};

/** Heading whose words rise into place one after another. */
export function RevealTitle({ text, className }: { text: string; className?: string }) {
  const words = text.split(" ");
  return (
    <motion.h2
      className={className}
      initial="hidden"
      animate="show"
      exit="exit"
      variants={{ show: { transition: { staggerChildren: 0.06 } }, exit: { transition: { staggerChildren: 0.02 } } }}
    >
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span className="learning-word" aria-hidden="true">
            <motion.span variants={wordVariants}>{word}</motion.span>
          </span>
          {index < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </motion.h2>
  );
}

/** Odometer-style characters that roll when they change. */
export function RollingText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`learning-roll ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      {text.split("").map((char, index) => (
        <span className="learning-roll__slot" aria-hidden="true" key={index}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={char}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: "0%", opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
            >
              {char}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}

const PIECES = Array.from({ length: 28 }, (_, index) => {
  const angle = (index / 28) * Math.PI * 2 + (index % 3) * 0.21;
  const distance = 70 + ((index * 37) % 60);
  return {
    x: Math.cos(angle) * distance,
    y: Math.sin(angle) * distance * 0.75 - 40,
    rotate: ((index * 97) % 360) - 180,
    width: index % 4 === 0 ? 10 : 6,
    height: index % 4 === 0 ? 4 : 6,
    color: ["var(--learning-mint)", "var(--learning-amber)", "#66d8d7", "#eaf2f2"][index % 4],
    round: index % 3 === 0,
  };
});

/** Celebratory particles that fly out of the element they are placed in. */
export function Burst({ trigger }: { trigger: number }) {
  const calm = useCalm();
  if (!trigger || calm) return null;
  return (
    <span className="learning-burst" key={trigger} aria-hidden="true">
      {PIECES.map((piece, index) => (
        <motion.i
          key={index}
          style={{
            width: piece.width,
            height: piece.height,
            background: piece.color,
            borderRadius: piece.round ? "50%" : 2,
          }}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
          animate={{
            x: piece.x,
            y: [0, piece.y, piece.y + 70],
            scale: 1,
            opacity: [1, 1, 0],
            rotate: piece.rotate,
          }}
          transition={{ duration: 1.35, ease: [0.2, 0.8, 0.3, 1], times: [0, 0.45, 1] }}
        />
      ))}
    </span>
  );
}

const draw = (delay: number, duration = 1.1) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: { pathLength: { delay, duration, ease: EASE_OUT }, opacity: { delay, duration: 0.2 } },
});
const pop = (delay: number) => ({
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay, type: "spring" as const, stiffness: 260, damping: 14 },
});

/** Small drawn illustration for empty states. */
export function EmptyIllustration({ variant }: { variant: "tree" | "journey" }) {
  return (
    <svg className="learning-empty-art" viewBox="0 0 160 120" aria-hidden="true">
      <motion.ellipse cx="80" cy="104" rx="56" ry="9" className="learning-empty-art__ground" {...pop(0.05)} />
      {variant === "tree" ? (
        <>
          <motion.path d="M80 104 C 79 88, 82 74, 80 56" className="learning-empty-art__stem" {...draw(0.25)} />
          <motion.path d="M80 76 C 66 72, 58 62, 56 50 C 70 52, 78 62, 80 76 Z" className="learning-empty-art__leaf" style={{ originX: "80px", originY: "76px" }} {...pop(1)} />
          <motion.path d="M80 66 C 94 62, 103 52, 106 40 C 92 41, 82 50, 80 66 Z" className="learning-empty-art__leaf" style={{ originX: "80px", originY: "66px" }} {...pop(1.2)} />
          <motion.circle cx="80" cy="52" r="5" className="learning-empty-art__bud" {...pop(1.45)} />
        </>
      ) : (
        <>
          <motion.path d="M24 92 C 44 92, 46 64, 66 64 S 92 80, 108 56 S 130 36, 138 36" className="learning-empty-art__route" {...draw(0.2, 1.6)} />
          {[
            [24, 92],
            [66, 64],
            [108, 56],
            [138, 36],
          ].map(([x, y], index) => (
            <motion.circle key={index} cx={x} cy={y} r={index === 3 ? 5 : 3.5} className={index === 3 ? "learning-empty-art__bud" : "learning-empty-art__stop"} {...pop(0.3 + index * 0.35)} />
          ))}
        </>
      )}
      {[
        [40, 40, 0],
        [124, 78, 0.8],
        [58, 20, 1.6],
        [112, 22, 2.2],
      ].map(([x, y, delay], index) => (
        <circle key={index} cx={x} cy={y} r="1.6" className="learning-empty-art__mote" style={{ animationDelay: `${delay}s` }} />
      ))}
    </svg>
  );
}
