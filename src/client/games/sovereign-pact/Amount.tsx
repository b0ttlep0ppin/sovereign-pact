// An amount to give, pledge or bid: − and + buttons, a slider when there is a ceiling, and the number
// itself, which can be typed into but looks like a counter, not a form field. Whatever is typed is
// clamped to the range, and a fresh number replaces the old one (no "015").
import { useState } from "react";

interface Props {
  /** What the amount is of; names the number for screen readers ("Gold", "Bid on the Sword"). */
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** How far − and + move it. */
  step?: number;
}

export default function Amount({ label, value, onChange, min = 0, max, step = 1 }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.max(min, max === undefined ? n : Math.min(max, n));
  const set = (n: number) => onChange(clamp(Math.floor(n)));
  const slides = max !== undefined && max > min;
  return (
    <span className="sp-amount">
      <button type="button" className="sp-amount__step" aria-label={`Less ${label}`} disabled={value <= min} onClick={() => set(value - step)}>
        −
      </button>
      {slides ? <input type="range" className="sp-amount__slider" aria-label={`${label}, slider`} min={min} max={max} value={value} onChange={(e) => set(Number(e.target.value))} /> : null}
      <button type="button" className="sp-amount__step" aria-label={`More ${label}`} disabled={max !== undefined && value >= max} onClick={() => set(value + step)}>
        +
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="sp-amount__value"
        aria-label={label}
        size={Math.max(2, String(max ?? value).length)}
        value={draft ?? String(value)}
        onFocus={(e) => {
          setDraft(String(value));
          e.target.select();
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          setDraft(digits);
          if (digits) set(Number(digits));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "ArrowUp") set(value + step);
          if (e.key === "ArrowDown") set(value - step);
        }}
      />
    </span>
  );
}
