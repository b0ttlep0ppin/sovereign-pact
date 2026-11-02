// The splash before the first screen (SPEC §1): how the capital fell through the rift, why the King's
// chair is empty, and why the Great Houses must swear a pact they each mean to win. The lines rise one
// by one; a click, Enter or Escape skips to the end, and the button goes on.
import { useEffect, useState } from "react";
import "./Prologue.css";

export const PROLOGUE: string[] = [
  "Nobody agrees on the hour the rift opened. The bells of the capital were ringing for a feast, and then they were ringing for nothing at all.",
  "The sky split above the palace. The city, its walls and the Great Houses within them fell through, into a country with no map that does not want them.",
  "The King was not found. His throne waits in a hall that grows colder every Year, and no one has seen the crown since.",
  "What is left of the court is the Houses: old, proud, and owed a great deal. None of them can hold the city alone. So they swear a pact, to share the walls, the grain and the dead, and to go out through the Rift Gate together.",
  "Every House will keep its oath. Every House is also counting. If the city endures, one of them will sit on that empty throne.",
];

const STEP_MS = 2200;

export default function Prologue({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(1);
  const all = shown >= PROLOGUE.length;
  useEffect(() => {
    if (all) return;
    const t = setTimeout(() => setShown((n) => n + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [shown, all]);
  const skip = () => (all ? onDone() : setShown(PROLOGUE.length));
  return (
    <div
      className="sp-prologue"
      role="dialog"
      aria-label="The Sovereign Pact"
      tabIndex={-1}
      ref={(el) => el?.focus()}
      onClick={() => !all && setShown(PROLOGUE.length)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "Escape" || e.key === " ") {
          e.preventDefault();
          skip();
        }
      }}
    >
      <div className="sp-prologue__rift" aria-hidden="true" />
      <div className="sp-prologue__embers" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i * 0.7) % 6}s`, animationDuration: `${6 + (i % 5)}s` }} />
        ))}
      </div>
      <div className="sp-prologue__page">
        <h1 className="sp-prologue__title">The Sovereign Pact</h1>
        {PROLOGUE.map((line, i) => (
          <p key={i} className={i < shown ? "is-shown" : undefined} aria-hidden={i >= shown}>
            {line}
          </p>
        ))}
        <div className="sp-prologue__actions">
          <button
            type="button"
            className="sp-button"
            onClick={(e) => {
              e.stopPropagation();
              onDone();
            }}
          >
            {all ? "Enter the city" : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
