"use client";

import { useEffect, useRef, useState } from "react";
import { DESK_LAYOUTS } from "@/lib/packages/layouts";
import {
  blankSlots,
  fromDeskLayout,
  type DesignerSlotState,
  type SlotId,
} from "./designerState";
import { DesignerBox } from "./DesignerBox";
import { formatDeskLayout } from "./exportLayout";

type SourceMode = "existing-layout" | "existing-background" | "upload";

const DEFAULT_ASPECT_RATIO = "1344 / 768";
const EXISTING_BACKGROUNDS = Array.from(
  new Set(DESK_LAYOUTS.map((l) => l.backgroundImage)),
);

export function LayoutDesignerClient() {
  const containerRef = useRef<HTMLDivElement>(null);

  const [sourceMode, setSourceMode] = useState<SourceMode>("existing-layout");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [slots, setSlots] = useState<DesignerSlotState[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<SlotId | null>(null);
  const [exportId, setExportId] = useState("");
  const [exportLabel, setExportLabel] = useState("");
  const [exportAspectRatio, setExportAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [includeLetterAndBrochures, setIncludeLetterAndBrochures] = useState(true);
  const [copied, setCopied] = useState(false);

  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function loadExistingLayout(layoutId: string) {
    const layout = DESK_LAYOUTS.find((l) => l.id === layoutId);
    if (!layout) return;
    setBackgroundImage(layout.backgroundImage);
    setSlots(fromDeskLayout(layout));
    setExportAspectRatio(layout.aspectRatio);
    setIncludeLetterAndBrochures(!!(layout.letter && layout.brochures));
    setExportId(layout.id);
    setExportLabel(layout.label);
  }

  function loadExistingBackground(src: string) {
    setBackgroundImage(src);
    setSlots(blankSlots());
    setExportAspectRatio(DEFAULT_ASPECT_RATIO);
    setExportId("");
    setExportLabel("");
  }

  function loadUploadedFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setBackgroundImage(url);
    setSlots(blankSlots());
    setExportId("");
    setExportLabel("");
  }

  function updateSlot(next: DesignerSlotState) {
    setSlots((prev) => prev.map((s) => (s.id === next.id ? next : s)));
  }

  async function handleCopy() {
    const text = exportText();
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function exportText(): string {
    if (slots.length === 0) return "// Choose a background above to begin.";
    return formatDeskLayout({
      id: exportId || "desk-vN",
      label: exportLabel || "New Layout",
      backgroundImage:
        sourceMode === "upload"
          ? "/desk-scene/desk-background-vN.webp  // TODO: real committed path once this image is added"
          : (backgroundImage ?? ""),
      aspectRatio: exportAspectRatio,
      slots,
      includeLetterAndBrochures,
    });
  }

  const idCollision = exportId && DESK_LAYOUTS.some((l) => l.id === exportId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Background
          </h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={sourceMode === "existing-layout"}
                onChange={() => setSourceMode("existing-layout")}
              />
              Refine an existing layout
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={sourceMode === "existing-background"}
                onChange={() => setSourceMode("existing-background")}
              />
              New layout, existing background
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={sourceMode === "upload"}
                onChange={() => setSourceMode("upload")}
              />
              New layout, candidate image
            </label>
          </div>

          <div className="mt-3">
            {sourceMode === "existing-layout" && (
              <select
                defaultValue=""
                onChange={(e) => loadExistingLayout(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
              >
                <option value="" disabled>
                  Pick a layout…
                </option>
                {DESK_LAYOUTS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} ({l.id})
                  </option>
                ))}
              </select>
            )}
            {sourceMode === "existing-background" && (
              <select
                defaultValue=""
                onChange={(e) => loadExistingBackground(e.target.value)}
                className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
              >
                <option value="" disabled>
                  Pick a background…
                </option>
                {EXISTING_BACKGROUNDS.map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            )}
            {sourceMode === "upload" && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) loadUploadedFile(file);
                  }}
                  className="block w-full text-sm text-neutral-700"
                />
                <p className="mt-1 text-xs text-amber-700">
                  Local preview only — this file is never uploaded anywhere.
                  Fill in the real <code>/desk-scene/...</code> path by hand
                  in the exported code once this image is actually committed
                  to the repo.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Canvas — drag to move, corner handle to resize
          </h3>
          {!backgroundImage ? (
            <div className="flex aspect-video items-center justify-center rounded-md border-2 border-dashed border-neutral-300 text-sm text-neutral-400">
              Choose a background above to begin.
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-md shadow"
              style={{ aspectRatio: exportAspectRatio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- either a static public asset or a local blob: object URL, neither of which next/image can optimize meaningfully here */}
              <img
                src={backgroundImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onLoad={(e) => {
                  if (sourceMode !== "upload") return;
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    setExportAspectRatio(
                      `${img.naturalWidth} / ${img.naturalHeight}`,
                    );
                  }
                }}
              />
              {slots.map((slot) => (
                <DesignerBox
                  key={slot.id}
                  slot={slot}
                  containerRef={containerRef}
                  isActive={activeSlotId === slot.id}
                  onChange={updateSlot}
                  onActivate={() => setActiveSlotId(slot.id)}
                />
              ))}
            </div>
          )}
        </div>

        {slots.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700">
              Slot values
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-neutral-500">
                  <th className="py-1 pr-2">Slot</th>
                  <th className="py-1 pr-2">Left</th>
                  <th className="py-1 pr-2">Top</th>
                  <th className="py-1 pr-2">Width</th>
                  <th className="py-1 pr-2">Rotate</th>
                  <th className="py-1 pr-2">Aspect</th>
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot.id} className="border-t border-neutral-100">
                    <td className="py-1 pr-2 font-medium text-neutral-700">
                      {slot.label}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.left}
                        onChange={(e) =>
                          updateSlot({ ...slot, left: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.top}
                        onChange={(e) =>
                          updateSlot({ ...slot, top: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.width}
                        onChange={(e) =>
                          updateSlot({ ...slot, width: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        min={-45}
                        max={45}
                        value={slot.rotate ?? 0}
                        onChange={(e) =>
                          updateSlot({
                            ...slot,
                            rotate: Number(e.target.value) || undefined,
                          })
                        }
                        className="w-14 rounded border border-neutral-300 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.aspect ?? ""}
                        placeholder="auto"
                        onChange={(e) =>
                          updateSlot({
                            ...slot,
                            aspect: e.target.value || undefined,
                          })
                        }
                        className="w-16 rounded border border-neutral-300 px-1 py-0.5"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700">
            Export
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">id</span>
            <input
              value={exportId}
              onChange={(e) => setExportId(e.target.value)}
              placeholder="desk-v4"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
          </label>
          {idCollision && (
            <p className="mt-1 text-xs text-red-600">
              &ldquo;{exportId}&rdquo; already exists in DESK_LAYOUTS — pick a
              different id.
            </p>
          )}
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              label
            </span>
            <input
              value={exportLabel}
              onChange={(e) => setExportLabel(e.target.value)}
              placeholder="New Layout"
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">
              aspectRatio
            </span>
            <input
              value={exportAspectRatio}
              onChange={(e) => setExportAspectRatio(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900"
            />
          </label>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeLetterAndBrochures}
              onChange={(e) => setIncludeLetterAndBrochures(e.target.checked)}
            />
            Include letter + brochures
          </label>

          <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-800">
            {exportText()}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            disabled={slots.length === 0}
            className="mt-2 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
          <p className="mt-2 text-xs text-neutral-500">
            Paste this into <code>DESK_LAYOUTS</code> in{" "}
            <code>src/lib/packages/layouts.ts</code> and deploy — this tool
            doesn&apos;t save anything itself.
          </p>
        </div>
      </div>
    </div>
  );
}
