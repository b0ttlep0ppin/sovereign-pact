// A consumable's icon (itemIcons.ts): its shape in its colour, outlined in black.
import { ITEM_ICONS, ITEM_SHAPES } from "./itemIcons";
import { PixelArt } from "./PixelArt";

const PLAIN: readonly [string, string] = ["pouch", "#8a7a68"];

export default function ItemIcon({ id, size = 24 }: { id: string; size?: number }) {
  const [shape, color] = ITEM_ICONS[id] ?? PLAIN;
  return <PixelArt rows={ITEM_SHAPES[shape]} size={size} color={color} className="sp-item-icon" />;
}
