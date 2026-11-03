// The menus' sounds (Josh 2026-11-03: "menu and confirmation sfx for equipping gear, changing jobs, learning
// abilities and selecting moves in battle, or general when making selections"). One listener on the page
// hears every button, tab, box and list in the game: each plays the cue it (or a parent) names in
// `data-sfx` (two at once, split by a space), or by default a latch for a choice, a cloth whoosh for Back and a page for a tab ("none"
// keeps one quiet). Pointing at a command or a Job ticks. The cues are cut from BOOM's construction kits.
import { useEffect } from "react";
import { canPlay, playCue } from "./sfx";

/** Menu sounds sit under the battle's. */
const GAIN = 0.8;
/** The same cue twice within this many ms plays once (a click that also changes a box). */
const GAP = 45;

let volume = 0;
const played = new Map<string, number>();

/** Plays a menu cue now, at the sound effects volume; several, split by spaces, play together. */
export function uiSound(cues: string): void {
  for (const cue of cues.split(" ")) play(cue);
}

function play(cue: string): void {
  if (!cue || cue === "none" || volume <= 0 || !canPlay()) return;
  const now = performance.now();
  if (now - (played.get(cue) ?? -Infinity) < GAP) return;
  played.set(cue, now);
  playCue(cue, volume * GAIN);
}

const BACK = /^\W*(back|cancel|close|undo|never mind|turn back|take back|take off|unseal|withdraw|decline|refuse|skip)\b/i;
/** What a control sounds like when chosen: its own `data-sfx`, else by what it is. */
export function cueFor(el: Element): string {
  const named = el.closest("[data-sfx]")?.getAttribute("data-sfx");
  if (named) return named;
  if (el instanceof HTMLInputElement && el.type === "checkbox" && !el.checked) return "ui_back";
  if (el.getAttribute("role") === "tab" || el.tagName === "SUMMARY") return "ui_page";
  if (BACK.test(el.textContent ?? "") || /^(back|close)/i.test(el.getAttribute("aria-label") ?? "")) return "ui_back";
  return "ui_select";
}

/** What ticks under the pointer. */
const HOVER = ".sp-command__choice, .sp-jobs__job, [data-sfx-hover]";
const CLICKS = "button, [role=button], [role=tab], summary, a[href]";
const off = (el: Element) => (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true";
const inGame = (t: EventTarget | null): t is Element => t instanceof Element && !!t.closest(".sp");

/** Turns the menus' sounds on at `vol` (0 for none), for as long as the game is on screen. */
export function useUiSounds(vol: number): void {
  useEffect(() => {
    volume = vol;
  }, [vol]);
  useEffect(() => {
    let over: Element | null = null;
    // Capturing hears a click before React handles it and the screen changes under it.
    const click = (e: MouseEvent) => {
      const el = inGame(e.target) ? e.target.closest(CLICKS) : null;
      if (el && !off(el)) uiSound(cueFor(el));
    };
    const change = (e: Event) => {
      const t = e.target;
      if (!inGame(t)) return;
      if (t instanceof HTMLSelectElement) uiSound(cueFor(t));
      else if (t instanceof HTMLInputElement && (t.type === "checkbox" || t.type === "radio")) uiSound(cueFor(t));
      else if (t instanceof HTMLInputElement && t.type === "range") uiSound("ui_move");
    };
    const hover = (e: MouseEvent) => {
      const el = inGame(e.target) ? e.target.closest(HOVER) : null;
      if (el === over) return;
      over = el;
      if (el && !off(el)) uiSound("ui_move");
    };
    document.addEventListener("click", click, true);
    document.addEventListener("change", change, true);
    document.addEventListener("mouseover", hover, true);
    return () => {
      document.removeEventListener("click", click, true);
      document.removeEventListener("change", change, true);
      document.removeEventListener("mouseover", hover, true);
      volume = 0;
    };
  }, []);
}
