import type { SovView } from "@vibepulse/shared/games/sovereign-pact";
import ScionSprite, { lookOf } from "./ScionSprite";

/** The head of a Scion's 64 px frame, as the town map and the log show it. */
const HEAD: [number, number, number, number] = [18, 13, 28, 28];

/** A Scion's face in a small frame, to know them by at a glance (Josh 2026-11-10). */
export default function ScionFace({ person, view, size = 36 }: { person: SovView["people"][number]; view: SovView; size?: number }) {
  return (
    <span className="sp-scion-face" style={{ width: size, height: size }} aria-hidden="true">
      <ScionSprite look={lookOf(person, view.houses[person.house]?.colors, view.items)} crop={HEAD} size={(size * 64) / HEAD[2]} />
    </span>
  );
}
