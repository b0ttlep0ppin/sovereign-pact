// The Rift Gate's cards (SPEC §9.1, §15.2): each Year's offer laid out as cards, with each House's
// vote shown on the card it backs (votes are public, §15.7). In the Settlement Phase an unsealed
// House may vote, and change its vote until it seals.
import { Content, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { Emblem } from "./Emblem";

type Card = NonNullable<SovView["gate"]>["cards"][number];

export const CARD_TYPES: Record<Card["type"], { name: string; blurb: string; glyph: string }> = {
  mandatory: { name: "Mandatory", blurb: "Do or die: failing it costs the kingdom dearly.", glyph: "☠" },
  forced: { name: "Forced", blurb: "The Gate gives no choice this Year.", glyph: "⚠" },
  resource: { name: "Resource", blurb: "Materials, shop unlocks and recipes.", glyph: "⛏" },
  hunt: { name: "Hunt", blurb: "A named monster: Valor and a trophy.", glyph: "➹" },
  rescue: { name: "Rescue", blurb: "Bring the Lost home.", glyph: "⚑" },
  delve: { name: "Delve", blurb: "Relics, Lore and Essence; many events.", glyph: "⌘" },
  pilgrimage: { name: "Pilgrimage", blurb: "Blessings and Sanity; an Idol waits at the end.", glyph: "✧" },
};

/** What waits at the end of a card, where the card names it: a pool's own boss stays unknown (an Observatory's preview is not built yet, §9.1). */
export function quarryOf(card: Card): string | null {
  if (card.arcana) return `The ${Content.TAROT_BY_ID.get(card.arcana)?.name ?? card.arcana}`;
  if (card.quarry) return Content.QUARRY_BY_ID.get(card.quarry)?.title ?? null;
  if (card.idol) {
    const idol = Content.IDOL_BY_ID.get(card.idol);
    return idol ? (Content.BOSS_BY_ID.get(idol.boss)?.name ?? null) : null;
  }
  if (card.boss && card.type === "mandatory") return Content.BOSS_BY_ID.get(card.boss)?.name ?? null;
  return null;
}

export const cardSize = (card: Card) => (card.size === "2x4" ? "Two parties of 4" : `${card.size} Scions`);

interface Props {
  view: SovView;
  sendMove: (m: SovMove) => void;
  canVote: boolean;
}

export default function RiftGate({ view, sendMove, canVote }: Props) {
  const gate = view.gate;
  if (!gate?.cards.length) return null;
  const choosing = gate.cards.length > 1;
  return (
    <section className="sp-panel sp-gate" aria-label="The Rift Gate's cards">
      <h2>The Rift Gate</h2>
      <p className="sp-gate__lead">{choosing ? "The Gate offers these expeditions. The Houses vote; a tie costs Accord." : "The Gate opens on one road this Year."}</p>
      <ul className="sp-cards">
        {gate.cards.map((card, i) => {
          const t = CARD_TYPES[card.type];
          const backers = view.houses.filter((h) => gate.votes[h.index] === i);
          const mine = view.me !== null && gate.votes[view.me] === i;
          const end = quarryOf(card);
          return (
            <li key={i} className={`sp-card sp-card--${card.type}${mine ? " is-mine" : ""}`}>
              <header>
                <span className="sp-card__glyph" aria-hidden="true">
                  {t.glyph}
                </span>
                <strong>{t.name}</strong>
                <span className="sp-card__level" aria-label={`level ${card.level}`}>
                  {card.level}
                </span>
              </header>
              <p className="sp-card__pool">{Content.POOL_BY_ID.get(card.pool)?.name ?? card.pool}</p>
              {end ? <p className="sp-card__end">{end}</p> : null}
              <p className="sp-card__blurb">{t.blurb}</p>
              <p className="sp-card__size">{cardSize(card)}</p>
              {card.rescue?.length ? (
                <p className="sp-card__size">
                  For {card.rescue.map((id) => view.people.find((p) => p.id === id)?.name ?? "the Lost").join(", ")}
                </p>
              ) : null}
              {choosing ? (
                <footer>
                  <span className="sp-card__votes" aria-label={`${backers.length} vote${backers.length === 1 ? "" : "s"}`}>
                    {backers.map((h) => (
                      <span key={h.index} title={`House ${h.name}`}>
                        <Emblem emblem={h.emblem} colors={h.colors} size={20} />
                      </span>
                    ))}
                  </span>
                  {canVote ? (
                    <button type="button" className={`sp-button${mine ? "" : " sp-button--quiet"}`} aria-pressed={mine} onClick={() => sendMove({ type: "pick_card", card: i })}>
                      {mine ? "Your vote" : "Vote"}
                    </button>
                  ) : null}
                </footer>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
