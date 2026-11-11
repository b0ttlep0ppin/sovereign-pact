import { useState, type ReactNode } from "react";

/** One page of a tab bar: its id (remembered), its label, and its body (none hides the tab). */
export type Tab = [id: string, label: string, body: ReactNode];

/**
 * Pages shown one at a time, the last one opened remembered under `store`. The town's tabs use it, and
 * so do the sub-pages inside them (`sub`: a smaller bar), so a screen with a lot on it shows one part at
 * a time (Josh 2026-11-10: "the different settlement pages [could] have sub-pages").
 */
export default function Tabs({ tabs, store, label, sub }: { tabs: Tab[]; store: string; label: string; sub?: boolean }) {
  const live = tabs.filter(([, , body]) => body);
  const [tab, setTab] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(store) ?? "";
    } catch {
      return "";
    }
  });
  const shown = live.find(([id]) => id === tab) ?? live[0];
  const pick = (id: string) => {
    setTab(id);
    try {
      globalThis.localStorage?.setItem(store, id);
    } catch {
      // Storage blocked: the tab lasts this visit.
    }
  };
  // A single page needs no bar.
  if (sub && live.length === 1) return <>{shown?.[2]}</>;
  return (
    <div className={sub ? "sp-tabs sp-tabs--sub" : "sp-tabs"}>
      <div className="sp-tabs__bar" role="tablist" aria-label={label}>
        {live.map(([id, name]) => (
          <button key={id} type="button" role="tab" className="sp-tabs__tab" aria-selected={shown?.[0] === id} onClick={() => pick(id)}>
            {name}
          </button>
        ))}
      </div>
      <div className="sp-tabs__body" role="tabpanel" aria-label={shown?.[1]}>
        {shown?.[2]}
      </div>
    </div>
  );
}
