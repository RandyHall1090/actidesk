"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DESK_LAYOUTS, type DeskLayout } from "@/lib/packages/layouts";
import { createClient } from "@/lib/supabase/client";
import {
  blankSlots,
  fromDeskLayout,
  type DesignerSlotState,
  type SlotId,
} from "./designerState";
import { DesignerBox } from "./DesignerBox";
import { formatDeskLayout, toDeskLayoutFields } from "./exportLayout";
import { saveLayout, deleteLayout } from "./actions";

type SourceMode = "existing-layout" | "existing-background" | "upload";

const DEFAULT_ASPECT_RATIO = "1344 / 768";

function isBuiltIn(id: string): boolean {
  return DESK_LAYOUTS.some((l) => l.id === id);
}

export function LayoutDesignerClient({
  orgId,
  layouts,
}: {
  orgId: string;
  // Built-in (shared by every tenant) + this org's own saved custom ones --
  // see getOrgLayouts.ts. Refining a built-in one and clicking Save always
  // creates a new custom layout (built-ins aren't rows in the "layouts"
  // table); refining one of this org's own custom ones updates it in place.
  layouts: DeskLayout[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const customLayouts = layouts.filter((l) => !isBuiltIn(l.id));
  const existingBackgrounds = Array.from(
    new Set(layouts.map((l) => l.backgroundImage)),
  );

  const [sourceMode, setSourceMode] = useState<SourceMode>("existing-layout");
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [slots, setSlots] = useState<DesignerSlotState[]>([]);
  const [activeSlotId, setActiveSlotId] = useState<SlotId | null>(null);
  const [exportId, setExportId] = useState("");
  const [exportLabel, setExportLabel] = useState("");
  const [exportAspectRatio, setExportAspectRatio] = useState(DEFAULT_ASPECT_RATIO);
  const [includeLetterAndBrochures, setIncludeLetterAndBrochures] = useState(true);
  const [copied, setCopied] = useState(false);

  // Set only when refining one of THIS org's own saved layouts -- tells
  // Save to update that row instead of creating a new one. Cleared by
  // every other load path (a built-in, a fresh background, an upload),
  // since those always produce a new custom layout on Save.
  const [loadedCustomLayoutId, setLoadedCustomLayoutId] = useState<string | null>(null);
  // The raw File for "candidate image" mode -- kept so Save can actually
  // upload it; the object URL alone (for the live preview) doesn't carry
  // real bytes anywhere. Cleared once that exact file has been uploaded so
  // a second Save (e.g. after nudging a position) reuses the same
  // already-uploaded URL instead of uploading it again.
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const objectUrlRef = useRef<string | null>(null);
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  function resetSaveFeedback() {
    setSaveState("idle");
    setSaveError(null);
  }

  function loadExistingLayout(layoutId: string) {
    const layout = layouts.find((l) => l.id === layoutId);
    if (!layout) return;
    setBackgroundImage(layout.backgroundImage);
    setSlots(fromDeskLayout(layout));
    setExportAspectRatio(layout.aspectRatio);
    setIncludeLetterAndBrochures(!!(layout.letter && layout.brochures));
    setExportId(layout.id);
    setExportLabel(layout.label);
    setLoadedCustomLayoutId(isBuiltIn(layout.id) ? null : layout.id);
    setPendingFile(null);
    resetSaveFeedback();
  }

  function loadExistingBackground(src: string) {
    setBackgroundImage(src);
    setSlots(blankSlots());
    setExportAspectRatio(DEFAULT_ASPECT_RATIO);
    setExportId("");
    setExportLabel("");
    setLoadedCustomLayoutId(null);
    setPendingFile(null);
    resetSaveFeedback();
  }

  function loadUploadedFile(file: File) {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setBackgroundImage(url);
    setSlots(blankSlots());
    setExportId("");
    setExportLabel("");
    setLoadedCustomLayoutId(null);
    setPendingFile(file);
    resetSaveFeedback();
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
        sourceMode === "upload" && pendingFile
          ? "/desk-scene/desk-background-vN.webp  // TODO: real committed path once this image is added"
          : (backgroundImage ?? ""),
      aspectRatio: exportAspectRatio,
      slots,
      includeLetterAndBrochures,
    });
  }

  async function handleSave() {
    if (slots.length === 0) return;
    const label = exportLabel.trim();
    if (!label) {
      setSaveState("error");
      setSaveError("Give this layout a label first.");
      return;
    }

    setSaveState("saving");
    setSaveError(null);
    try {
      let finalBackgroundImage = backgroundImage ?? "";

      // Only actually uploads once per chosen file -- a re-save after just
      // nudging a position (pendingFile already cleared below) reuses the
      // already-uploaded public URL instead of uploading it again.
      if (sourceMode === "upload" && pendingFile) {
        const ext = pendingFile.name.split(".").pop()?.toLowerCase() || "webp";
        const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from("layout-backgrounds")
          .upload(path, pendingFile, { upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data } = supabase.storage
          .from("layout-backgrounds")
          .getPublicUrl(path);
        finalBackgroundImage = data.publicUrl;
      }

      const fields = toDeskLayoutFields(slots, includeLetterAndBrochures);
      const result = await saveLayout({
        id: loadedCustomLayoutId ?? undefined,
        label,
        backgroundImage: finalBackgroundImage,
        aspectRatio: exportAspectRatio,
        ...fields,
      });

      if (!result.ok) {
        setSaveState("error");
        setSaveError(result.error);
        return;
      }

      setBackgroundImage(finalBackgroundImage);
      setPendingFile(null);
      setLoadedCustomLayoutId(result.id);
      setSaveState("saved");
      router.refresh();
    } catch (err) {
      setSaveState("error");
      setSaveError(err instanceof Error ? err.message : "Couldn't save the layout.");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const result = await deleteLayout(id);
    setDeletingId(null);
    if (!result.ok) {
      setSaveState("error");
      setSaveError(result.error);
      return;
    }
    if (loadedCustomLayoutId === id) {
      setLoadedCustomLayoutId(null);
    }
    router.refresh();
  }

  const idCollision = exportId && layouts.some((l) => l.id === exportId);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
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
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              >
                <option value="" disabled>
                  Pick a layout…
                </option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label} {isBuiltIn(l.id) ? `(${l.id})` : "(your own)"}
                  </option>
                ))}
              </select>
            )}
            {sourceMode === "existing-background" && (
              <select
                defaultValue=""
                onChange={(e) => loadExistingBackground(e.target.value)}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
              >
                <option value="" disabled>
                  Pick a background…
                </option>
                {existingBackgrounds.map((src) => (
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
                  className="block w-full text-sm text-neutral-700 dark:text-neutral-300"
                />
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Previewed locally while you position everything — nothing
                  is uploaded until you click <strong>Save</strong> below.
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Canvas — drag to move, corner handle to resize
          </h3>
          {!backgroundImage ? (
            <div className="flex aspect-video items-center justify-center rounded-md border-2 border-dashed border-neutral-300 dark:border-neutral-600 text-sm text-neutral-400 dark:text-neutral-500">
              Choose a background above to begin.
            </div>
          ) : (
            <div
              ref={containerRef}
              className="relative w-full overflow-hidden rounded-md shadow"
              style={{ aspectRatio: exportAspectRatio }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- either a static public asset, an already-uploaded public Storage URL, or a local blob: object URL, none of which next/image can optimize meaningfully here */}
              <img
                src={backgroundImage}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onLoad={(e) => {
                  if (!(sourceMode === "upload" && pendingFile)) return;
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
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Slot values
            </h3>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-neutral-500 dark:text-neutral-400">
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
                  <tr key={slot.id} className="border-t border-neutral-100 dark:border-neutral-800">
                    <td className="py-1 pr-2 font-medium text-neutral-700 dark:text-neutral-300">
                      {slot.label}
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.left}
                        onChange={(e) =>
                          updateSlot({ ...slot, left: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 dark:border-neutral-600 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.top}
                        onChange={(e) =>
                          updateSlot({ ...slot, top: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 dark:border-neutral-600 px-1 py-0.5"
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={slot.width}
                        onChange={(e) =>
                          updateSlot({ ...slot, width: e.target.value })
                        }
                        className="w-16 rounded border border-neutral-300 dark:border-neutral-600 px-1 py-0.5"
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
                        className="w-14 rounded border border-neutral-300 dark:border-neutral-600 px-1 py-0.5"
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
                        className="w-16 rounded border border-neutral-300 dark:border-neutral-600 px-1 py-0.5"
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
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Save
          </h3>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              label
            </span>
            <input
              value={exportLabel}
              onChange={(e) => {
                setExportLabel(e.target.value);
                resetSaveFeedback();
              }}
              placeholder="New Layout"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>
          <label className="mt-2 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              aspectRatio
            </span>
            <input
              value={exportAspectRatio}
              onChange={(e) => setExportAspectRatio(e.target.value)}
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
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

          <button
            type="button"
            onClick={handleSave}
            disabled={slots.length === 0 || saveState === "saving"}
            className="mt-3 w-full rounded-md bg-neutral-900 dark:bg-neutral-100 px-4 py-2 text-sm font-medium text-white dark:text-neutral-900 transition-opacity disabled:opacity-50"
          >
            {saveState === "saving"
              ? "Saving…"
              : loadedCustomLayoutId
                ? "Save changes"
                : "Save as a new layout"}
          </button>
          {saveState === "saved" && (
            <p className="mt-2 text-sm text-green-600 dark:text-green-400">
              Saved — selectable now in New Package and Templates.
            </p>
          )}
          {saveState === "error" && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{saveError}</p>
          )}
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {loadedCustomLayoutId
              ? "Updates this saved layout in place."
              : "Creates a new layout owned by your organization — nobody else sees it."}
          </p>
        </div>

        {customLayouts.length > 0 && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              Your saved layouts
            </h3>
            <ul className="space-y-2">
              {customLayouts.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium text-neutral-800 dark:text-neutral-200">
                    {l.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDelete(l.id)}
                    disabled={deletingId === l.id}
                    className="shrink-0 text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    {deletingId === l.id ? "Deleting…" : "Delete"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <details className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Developer: ship as a new built-in layout instead
          </summary>
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            For a layout every tenant should have (not just your own org),
            copy the code below and paste it into <code>DESK_LAYOUTS</code>{" "}
            in <code>src/lib/packages/layouts.ts</code> for a developer to
            deploy, instead of clicking Save.
          </p>
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium text-neutral-700 dark:text-neutral-300">
              id
            </span>
            <input
              value={exportId}
              onChange={(e) => setExportId(e.target.value)}
              placeholder="desk-v4"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
            />
          </label>
          {idCollision && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              &ldquo;{exportId}&rdquo; already exists — pick a different id.
            </p>
          )}
          <pre className="mt-3 max-h-96 overflow-auto rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 p-3 text-xs text-neutral-800 dark:text-neutral-200">
            {exportText()}
          </pre>
          <button
            type="button"
            onClick={handleCopy}
            disabled={slots.length === 0}
            className="mt-2 w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 transition-opacity hover:bg-neutral-50 dark:hover:bg-neutral-950 disabled:opacity-50"
          >
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </details>
      </div>
    </div>
  );
}
