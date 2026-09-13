import type { SlotPosition } from "@/lib/packages/layouts";
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
  const get = (id: SlotId) => args.slots.find((s) => s.id === id)!;
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
