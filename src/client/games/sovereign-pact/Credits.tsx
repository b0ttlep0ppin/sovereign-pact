// The Credits (SPEC §15.2): every asset author, reachable from the main screen.
import { CREDITS } from "./credits";

export default function Credits() {
  return (
    <details className="sp-access sp-credits">
      <summary>Credits</summary>
      {CREDITS.map((c) => (
        <section key={c.title} aria-label={c.title}>
          <h3>{c.title}</h3>
          <ul>
            {c.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}
