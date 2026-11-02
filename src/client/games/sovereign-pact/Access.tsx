// Accessibility toggles (SPEC §15.8): reduce flashing, reduce motion, a color-blind palette with
// shapes on the numbers, larger damage numbers, and a battle log to read instead of watch. Each is a
// per-viewer convenience kept in this browser; the root carries them as data attributes for the CSS.
import { useState } from "react";

export interface Access {
  flash: boolean;
  motion: boolean;
  palette: boolean;
  big: boolean;
  log: boolean;
}

const KEY = "sovereign-pact:access";
const OFF: Access = { flash: false, motion: false, palette: false, big: false, log: false };
export const ACCESS_LABELS: Record<keyof Access, string> = {
  flash: "Reduce flashing",
  motion: "Reduce motion",
  palette: "Color-blind palette",
  big: "Larger damage numbers",
  log: "Full battle log",
};

function read(): Access {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...OFF, ...(JSON.parse(raw) as Partial<Access>) } : OFF;
  } catch {
    return OFF;
  }
}

/** The viewer's toggles, and a setter that keeps them for the next visit when storage allows. */
export function useAccess(): [Access, (key: keyof Access, on: boolean) => void] {
  const [access, setAccess] = useState(read);
  const set = (key: keyof Access, on: boolean) => {
    const next = { ...access, [key]: on };
    setAccess(next);
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    } catch {
      // Storage blocked: the choice lasts this visit.
    }
  };
  return [access, set];
}

/** The root's data attributes for the CSS. */
export const accessAttrs = (a: Access): Record<string, string | undefined> => ({
  "data-flash": a.flash ? "reduced" : undefined,
  "data-motion": a.motion ? "reduced" : undefined,
  "data-palette": a.palette ? "cb" : undefined,
  "data-numbers": a.big ? "big" : undefined,
});

export default function AccessPanel({ access, set }: { access: Access; set: (key: keyof Access, on: boolean) => void }) {
  return (
    <details className="sp-access">
      <summary>Accessibility</summary>
      <div className="sp-access__list">
        {(Object.keys(ACCESS_LABELS) as (keyof Access)[]).map((k) => (
          <label key={k} className="sp-check">
            <input type="checkbox" checked={access[k]} onChange={(e) => set(k, e.target.checked)} /> {ACCESS_LABELS[k]}
          </label>
        ))}
      </div>
    </details>
  );
}
