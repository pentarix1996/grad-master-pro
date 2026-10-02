import { createContext, useContext } from "react";

/** True when the studio should avoid non-essential motion. */
export const CalmContext = createContext(false);
export const useCalm = () => useContext(CalmContext);

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const SPRING = { type: "spring", stiffness: 420, damping: 36 } as const;

export const formatCount = (value: number | null) =>
  value === null ? "—" : String(Math.round(value));
