import type { DeskLayout, SlotPosition } from "@/lib/packages/layouts";
import type { DesignerSlotState, SlotId } from "./designerState";

function fmtSlot(pos: SlotPosition): string {
  const parts = [
    `left: "${pos.left}"`,
    `top: "${pos.top}"`,
    `width: "${pos.width}"`,
  ];
  if (pos.rotate) parts.push(`rotate: ${pos.rotate}`);
  if (pos.aspect) parts.push(`aspect: "${pos.aspect}"`);
  return `{ ${parts.join(", ")} }`;
}

// Strips the designer-only fields (id/label/optional) off a DesignerSlotState,
// leaving exactly the real SlotPosition shape stored in layouts.ts / the
// "layouts" table.
function toPos(slot: DesignerSlotState): SlotPosition {
  const { left, top, width, rotate, aspect } = slot;
  return { left, top, width, rotate, aspect };
}

function getSlot(slots: DesignerSlotState[], id: SlotId): DesignerSlotState {
  return slots.find((s) => s.id === id)!;
}

/**
 * Formats a ready-to-paste DeskLayout object literal, matching the exact
 * multi-line style and key order already used in layouts.ts (video, audio,
 * magazine, business_card -- the file's real literal order, not the
 * DeskLayout type's declared order).
 */
export function formatDeskLayout(args: {
  id: string;
  label: string;
  backgroundImage: string;
  aspectRatio: string;
  slots: DesignerSlotState[];
  includeLetterAndBrochures: boolean;
}): string {
  const get = (id: SlotId) => getSlot(args.slots, id);
  const lines = [
    `{`,
    `  id: "${args.id}",`,
    `  label: "${args.label}",`,
    `  backgroundImage: "${args.backgroundImage}",`,
    `  aspectRatio: "${args.aspectRatio}",`,
    `  nameplate: ${fmtSlot(get("nameplate"))},`,
    `  slots: {`,
    `    video: ${fmtSlot(get("video"))},`,
    `    video_2: ${fmtSlot(get("video_2"))},`,
    `    audio: ${fmtSlot(get("audio"))},`,
    `    magazine: ${fmtSlot(get("magazine"))},`,
    `    business_card: ${fmtSlot(get("business_card"))},`,
    `  },`,
  ];
  if (args.includeLetterAndBrochures) {
    lines.push(`  letter: ${fmtSlot(get("letter"))},`);
    lines.push(`  brochures: [`);
    for (const n of [1, 2, 3, 4]) {
      lines.push(`    ${fmtSlot(get(`brochure_${n}` as SlotId))},`);
    }
    lines.push(`  ],`);
  }
  lines.push(`},`);
  return lines.join("\n");
}

/**
 * The same data formatDeskLayout() stringifies, but as a real object -- for
 * the Save button (T15), which sends it as a JSON payload to a server
 * action rather than asking a developer to paste code into layouts.ts.
 */
export function toDeskLayoutFields(
  slots: DesignerSlotState[],
  includeLetterAndBrochures: boolean,
): Pick<DeskLayout, "nameplate" | "slots" | "letter" | "brochures"> {
  const get = (id: SlotId) => toPos(getSlot(slots, id));
  const base = {
    nameplate: get("nameplate"),
    slots: {
      video: get("video"),
      video_2: get("video_2"),
      audio: get("audio"),
      magazine: get("magazine"),
      business_card: get("business_card"),
    },
  };
  if (!includeLetterAndBrochures) {
    return { ...base, letter: undefined, brochures: undefined };
  }
  return {
    ...base,
    letter: get("letter"),
    brochures: [1, 2, 3, 4].map((n) => get(`brochure_${n}` as SlotId)),
  };
}
