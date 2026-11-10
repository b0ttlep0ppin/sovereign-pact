// The Sovereign Pact on its own: the browser hosts the whole campaign, running the same rules the Vibe
// Pulse room server would. Seats are played hot-seat in this browser, any of them by a bot; the
// campaign autosaves at every checkpoint (the start of each Settlement Phase) and can be exported to,
// or imported from, a save file (SPEC §4.4). This browser also keeps the whole table after every move,
// so a reload or a new build picks up mid-Year, mid-expedition, even mid-battle (Josh 2026-11-10).
import { useEffect, useMemo, useState } from "react";
import { createRng, type RoomPlayer } from "@vibepulse/shared";
import { restore, sovereignPact, type SovMove, type SovSave, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import SovereignPact from "./games/sovereign-pact";
import Prologue from "./games/sovereign-pact/Prologue";

const g = sovereignPact;
const SAVE_KEY = "sovereign-pact:save";
const LIVE_KEY = "sovereign-pact:live";

interface Table {
  /** Which seats bots play, by seat index. */
  bots: boolean[];
  state: SovState;
}

interface StoredSave {
  bots: boolean[];
  save: SovSave;
  savedAt: string;
}

const seatIds = (n: number) => Array.from({ length: n }, (_, i) => `seat${i + 1}`);

function readStored(): StoredSave | null {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as StoredSave) : null;
  } catch {
    return null;
  }
}

function writeStored(stored: StoredSave): void {
  try {
    globalThis.localStorage?.setItem(SAVE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the campaign plays on without an autosave.
  }
}

interface LiveSave {
  bots: boolean[];
  state: SovState;
  savedAt: string;
}

/** The kept table as text, for a bug report where downloads are blocked (an artifact's frame). */
function CopyTable() {
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    let raw = "";
    try {
      raw = globalThis.localStorage?.getItem(LIVE_KEY) ?? "";
    } catch {
      // Storage blocked: nothing to copy.
    }
    setText(raw);
    globalThis.navigator?.clipboard?.writeText(raw).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  };
  return (
    <>
      <button type="button" className="app__button" onClick={copy}>
        Copy this table for a bug report
      </button>
      {text !== null ? (
        <>
          <p>{copied ? "Copied. Paste it into the chat." : "Select all of this and copy it:"}</p>
          <textarea readOnly value={text} rows={4} aria-label="The table, as text" onFocus={(e) => e.currentTarget.select()} />
        </>
      ) : null}
    </>
  );
}

/** The table as it stood after the last move, if it still opens under these rules (a new build may have changed them). */
function readLive(): LiveSave | null {
  try {
    const raw = globalThis.localStorage?.getItem(LIVE_KEY);
    const live = raw ? (JSON.parse(raw) as LiveSave) : null;
    if (!live || !Array.isArray(live.bots) || live.state?.players?.length !== live.bots.length || g.result(live.state)) return null;
    for (const p of live.state.players) g.view(live.state, p);
    return live;
  } catch {
    return null;
  }
}

function writeLive(table: Table): void {
  try {
    globalThis.localStorage?.setItem(LIVE_KEY, JSON.stringify({ bots: table.bots, state: table.state, savedAt: new Date().toISOString() }));
  } catch {
    // Storage full or blocked: the checkpoint autosave still holds the Year's start.
  }
}

const PHASE_AT: Record<string, string> = { founding: "founding the Houses", omens: "reading the omens", settlement: "in the Settlement", expedition: "on the expedition", reckoning: "at the Reckoning" };

/** Where a kept table stands: "Houses A and B, Year 3, on the expedition". */
function describeLive(s: SovState): string {
  const names = s.houses.map((h) => h.name);
  const who = names.length === 1 ? `House ${names[0]}` : `Houses ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${who}, Year ${s.year}, ${PHASE_AT[s.phase] ?? s.phase}`;
}

/** Starts or continues a campaign: `save` is anything a checkpoint wrote; a bad one starts fresh. */
function startTable(bots: boolean[], options: Record<string, string>, save?: unknown): Table {
  const seed = Math.floor(Math.random() * 2 ** 32);
  return { bots, state: g.setup(seatIds(bots.length), createRng(seed), undefined, options, save) };
}

export function App() {
  const [table, setTable] = useState<Table | null>(null);
  const [viewing, setViewing] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const state = table?.state ?? null;
  const players: RoomPlayer[] = useMemo(
    () => (table ? seatIds(table.bots.length).map((id, i) => ({ id, name: `Seat ${i + 1}`, ready: true, bot: table.bots[i]!, connected: true, wins: 0 })) : []),
    [table],
  );

  // Autosave each checkpoint, and keep the whole table after every move.
  useEffect(() => {
    if (!table) return;
    writeLive(table);
    const save = g.checkpoint!(table.state);
    if (save) writeStored({ bots: table.bots, save, savedAt: new Date().toISOString() });
  }, [table]);

  // Bots take their turns a beat apart, so a person can watch the Year turn.
  useEffect(() => {
    if (!table || g.result(table.state)) return;
    const seat = g.activePlayers(table.state).map((p) => seatIds(table.bots.length).indexOf(p)).find((i) => table.bots[i]);
    if (seat === undefined) return;
    const timer = setTimeout(() => {
      const who = seatIds(table.bots.length)[seat]!;
      const move = g.botMove!(table.state, who, createRng(table.state.rng + table.state.phaseMoves));
      const r = g.applyMove(table.state, who, move);
      if (r.ok) setTable({ ...table, state: r.state });
    }, 350);
    return () => clearTimeout(timer);
  }, [table]);

  const send = (move: SovMove) => {
    if (!table) return;
    const r = g.applyMove(table.state, seatIds(table.bots.length)[viewing]!, move);
    if (r.ok) {
      setTable({ ...table, state: r.state });
      setError(null);
    } else setError(r.error);
  };

  const me = table ? seatIds(table.bots.length)[viewing]! : "";
  // The story so far, once each time the game is opened.
  const [prologue, setPrologue] = useState(true);

  return (
    <div className="app">
      <header className="app__bar">
        <h1 className="app__title">The Sovereign Pact</h1>
        <span className="app__spacer" />
        {table ? (
          <>
            <label className="app__seat">
              Viewing{" "}
              <select value={viewing} onChange={(e) => setViewing(Number(e.target.value))}>
                {table.state.houses.map((h, i) => (
                  <option key={i} value={i}>
                    House {h.name}
                    {table.bots[i] ? " (bot)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="app__button" onClick={() => exportSave()}>
              Export save
            </button>
            <button type="button" className="app__button" onClick={() => setTable(null)}>
              Leave
            </button>
          </>
        ) : null}
      </header>
      <main className="app__main">
        {state && table ? (
          <SovereignPact
            view={g.view(state, me)}
            me={me}
            players={players}
            isMyTurn={g.activePlayers(state).includes(me)}
            sendMove={send}
            lastError={error ? { code: "illegal_move", message: error } : null}
          />
        ) : prologue ? (
          <Prologue onDone={() => setPrologue(false)} />
        ) : (
          <NewCampaign
            onStart={(t) => {
              setTable(t);
              setViewing(Math.max(0, t.bots.indexOf(false)));
            }}
          />
        )}
      </main>
    </div>
  );
}

function exportSave(): void {
  const stored = readStored();
  if (!stored) return;
  const blob = new Blob([JSON.stringify(stored.save)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sovereign-pact-year-${stored.save.campaign.year}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function NewCampaign({ onStart }: { onStart: (t: Table) => void }) {
  const [houses, setHouses] = useState(2);
  const [bots, setBots] = useState<boolean[]>([false, true, true, true]);
  const [display, setDisplay] = useState("crunch");
  const [length, setLength] = useState("full");
  const [stored] = useState(readStored);
  const [live] = useState(readLive);
  const [importError, setImportError] = useState<string | null>(null);
  const seated = bots.slice(0, houses);

  const importFile = async (file: File) => {
    try {
      const save: unknown = JSON.parse(await file.text());
      const n = (save as SovSave)?.campaign?.houses?.length;
      if (!n || !restore(save, seatIds(n))) throw new Error("not a save");
      // The first seat is yours; bots play the rest until you change it on a new campaign.
      onStart(startTable(Array.from({ length: n }, (_, i) => i > 0), {}, save));
    } catch {
      setImportError("That file isn't a Sovereign Pact save.");
    }
  };

  return (
    <div className="app__new">
      {live || stored ? (
        <section className="app__card sp-panel">
          <h2>Continue</h2>
          {live ? (
            <>
              <p>{describeLive(live.state)}</p>
              <button type="button" className="sp-button" onClick={() => onStart({ bots: live.bots, state: live.state })}>
                Continue where you left off
              </button>
              <CopyTable />
            </>
          ) : null}
          {stored ? (
            <>
              <p>{g.describeSave!(stored.save)}</p>
              <button type="button" className={live ? "app__button" : "sp-button"} onClick={() => onStart(startTable(stored.bots, {}, stored.save))}>
                {live ? `Go back to the start of Year ${stored.save.campaign.year}` : "Continue the campaign"}
              </button>
            </>
          ) : null}
        </section>
      ) : null}
      <section className="app__card sp-panel">
        <h2>New campaign</h2>
        <label>
          Great Houses{" "}
          <select value={houses} onChange={(e) => setHouses(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Who plays each House</legend>
          {seated.map((bot, i) => (
            <label key={i}>
              Seat {i + 1}{" "}
              <select value={bot ? "bot" : "you"} onChange={(e) => setBots(bots.map((b, j) => (j === i ? e.target.value === "bot" : b)))}>
                <option value="you">A person (hot-seat)</option>
                <option value="bot">A bot</option>
              </select>
            </label>
          ))}
        </fieldset>
        {g.options!.map((o) => (
          <label key={o.id}>
            {o.label}{" "}
            <select value={o.id === "display" ? display : length} onChange={(e) => (o.id === "display" ? setDisplay : setLength)(e.target.value)}>
              {o.choices.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <button type="button" className="sp-button" onClick={() => onStart(startTable(seated, { display, length }))}>
          Swear the Pact
        </button>
      </section>
      <section className="app__card sp-panel">
        <h2>Import a save</h2>
        <input type="file" accept="application/json,.json" aria-label="Save file" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        {importError ? <p role="alert">{importError}</p> : null}
      </section>
    </div>
  );
}
