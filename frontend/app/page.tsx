// Main page — handles the room-based workflow for generating renovation scopes.
// This is a client component because it manages file uploads, audio recording,
// and streams SSE responses from the backend.
//
// Next.js App Router client components:
// https://nextjs.org/docs/app/building-your-application/rendering/client-components

"use client";

import { useState, useRef } from "react";

import { Button } from "@/components/ui/button";

import StepOne from "@/components/StepOne";
import StepTwo from "@/components/StepTwo";
import StepThree from "@/components/StepThree";

// ── types ─────────────────────────────────────────

export interface ScopeItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
}

export interface ApiResult {
  status: string;
  raw_transcription: string;
  raw_vision: string;
  scope_of_work: ScopeItem[];
}

export interface Room {
  id: string;
  name: string;
  imageFiles: File[];
  audioFiles: File[];
  imagePreviews: string[];
  audioUrls: string[];
  editableResult: ApiResult | null;
  loadingVision: boolean;
  loadingAudio: boolean;
  loadingDraft: boolean;
  progressMessage: string | null;
}

// ── helpers ───────────────────────────────────────

// recalculates total_cost when qty or unit_cost changes.
// do this client-side so the table updates feel instantly
function patchRow(
  rows: ScopeItem[],
  idx: number,
  field: keyof ScopeItem,
  value: string
): ScopeItem[] {
  return rows.map((r, i) => {
    if (i !== idx) return r;
    const newRow = { ...r };
    if (field === "quantity" || field === "unit_cost") {
      newRow[field] = Number(value) || 0;
      newRow.total_cost = newRow.quantity * newRow.unit_cost;
    } else {
      (newRow as any)[field] = value;
    }
    return newRow;
  });
}



// ── component ─────────────────────────────────────

export default function Home() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const roomCount = useRef(0);
  const imgRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);

  // derived — recalculated on every render which is fine for this scale.
  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const doneRooms = rooms.filter((r) => r.editableResult !== null);
  const grandTotal = doneRooms.reduce(
    (s, r) =>
      s +
      (r.editableResult?.scope_of_work.reduce((a, item) => a + item.total_cost, 0) ??
        0),
    0
  );

  // ── room mgmt ──────────────────────────────────

  const addRoom = () => {
    roomCount.current += 1;
    const room: Room = {
      id: crypto.randomUUID(),
      name: `Room ${roomCount.current}`,
      imageFiles: [],
      audioFiles: [],
      imagePreviews: [],
      audioUrls: [],
      editableResult: null,
      loadingVision: false,
      loadingAudio: false,
      loadingDraft: false,
      progressMessage: null,
    };
    setRooms((prev) => [...prev, room]);
    setActiveRoomId(room.id);
  };

  const patchRoom = (id: string, patch: Partial<Room>) =>
    setRooms((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );

  const deleteRoom = (id: string) => {
    const roomToDelete = rooms.find((r) => r.id === id);
    if (!roomToDelete) return;
    if (!confirm(`Are you sure you want to delete "${roomToDelete.name}"? All uploaded files and generated scope items will be lost.`)) {
      return;
    }

    // clean up blob URLs to avoid memory leaks
    // https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL
    roomToDelete.imagePreviews.forEach(p => URL.revokeObjectURL(p));
    roomToDelete.audioUrls.forEach(u => URL.revokeObjectURL(u));

    setRooms((prev) => {
      const next = prev.filter((r) => r.id !== id);
      if (activeRoomId === id) {
        if (next.length > 0) {
          setActiveRoomId(next[0].id);
        } else {
          setActiveRoomId(null);
        }
      }
      return next;
    });
  };

  // ── file pickers (wired to hidden inputs) ──────

  const onImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeRoomId) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    for (const file of files) {
      newFiles.push(file);
      // HEIC/HEIF needs server-side conversion because browsers
      // (especially Safari on macOS) sometimes can't render them natively.
      // send it to the backend which uses pillow-heif to convert to JPEG.
      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("http://localhost:8000/api/convert-heic", {
            method: "POST",
            body: fd
          });
          if (!res.ok) throw new Error("Conversion failed");
          const blob = await res.blob();
          newPreviews.push(URL.createObjectURL(blob));
        } catch (err) {
          console.error("HEIC conversion failed for preview:", err);
          newPreviews.push(URL.createObjectURL(file));
        }
      } else {
        newPreviews.push(URL.createObjectURL(file));
      }
    }

    setRooms(prev => prev.map(r => {
      if (r.id !== activeRoomId) return r;
      return {
        ...r,
        imageFiles: [...r.imageFiles, ...newFiles],
        imagePreviews: [...r.imagePreviews, ...newPreviews]
      };
    }));
    e.target.value = "";
  };

  const onAudioPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0 || !activeRoomId) return;

    setRooms(prev => prev.map(r => {
      if (r.id !== activeRoomId) return r;
      return {
        ...r,
        audioFiles: [...r.audioFiles, ...files],
        audioUrls: [...r.audioUrls, ...files.map(f => URL.createObjectURL(f))]
      };
    }));
    e.target.value = "";
  };

  const addAudioFile = (rid: string, file: File) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== rid) return r;
      return {
        ...r,
        audioFiles: [...r.audioFiles, file],
        audioUrls: [...r.audioUrls, URL.createObjectURL(file)]
      };
    }));
  };

  const removeImage = (rid: string, index: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== rid) return r;
      const updatedFiles = [...r.imageFiles];
      const updatedPreviews = [...r.imagePreviews];
      URL.revokeObjectURL(updatedPreviews[index]);
      updatedFiles.splice(index, 1);
      updatedPreviews.splice(index, 1);
      return { ...r, imageFiles: updatedFiles, imagePreviews: updatedPreviews };
    }));
  };

  const removeAudio = (rid: string, index: number) => {
    setRooms(prev => prev.map(r => {
      if (r.id !== rid) return r;
      const updatedFiles = [...r.audioFiles];
      const updatedUrls = [...r.audioUrls];
      URL.revokeObjectURL(updatedUrls[index]);
      updatedFiles.splice(index, 1);
      updatedUrls.splice(index, 1);
      return { ...r, audioFiles: updatedFiles, audioUrls: updatedUrls };
    }));
  };

  // ── api call ───────────────────────────────────
  // the backend streams SSE (server-sent events) with progress updates
  // so the user sees what's happening instead of staring at a spinner.
  // SSE format: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

  const generate = async () => {
    if (!activeRoom) return;
    patchRoom(activeRoom.id, {
      loadingVision: true,
      loadingAudio: true,
      loadingDraft: true,
      progressMessage: "Starting process...",
      editableResult: null
    });

    try {
      const fd = new FormData();
      // backend expects at least one file per field; sending a tiny
      // dummy if images or audio are skipped. the backend filters
      // these out by checking file size.
      if (activeRoom.imageFiles.length === 0) {
        fd.append("images", new Blob(["x"], { type: "image/png" }), "photo.png");
      } else {
        activeRoom.imageFiles.forEach(f => fd.append("images", f, f.name));
      }

      if (activeRoom.audioFiles.length === 0) {
        fd.append("audios", new Blob(["x"], { type: "audio/wav" }), "rec.wav");
      } else {
        activeRoom.audioFiles.forEach(f => fd.append("audios", f, f.name));
      }

      const res = await fetch("http://localhost:8000/api/process-room", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      // reading the SSE stream manually since fetch is used, not EventSource.
      // EventSource doesn't support POST requests.
      // ref: https://github.com/whatwg/html/issues/2177
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          // keep the last part in the buffer if it doesn't end with \n\n
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const dataStr = part.substring(6).trim();
              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.status === "progress") {
                    patchRoom(activeRoom.id, { progressMessage: parsed.message });
                  } else if (parsed.status === "success") {
                    patchRoom(activeRoom.id, {
                      editableResult: {
                        status: "success",
                        raw_transcription: parsed.raw_transcription,
                        raw_vision: parsed.raw_vision,
                        scope_of_work: parsed.scope_of_work
                      },
                      loadingVision: false,
                      loadingAudio: false,
                      loadingDraft: false,
                      progressMessage: null
                    });
                  } else if (parsed.status === "error") {
                    throw new Error(parsed.message);
                  }
                } catch (e) {
                  console.error("Error parsing SSE data", e, dataStr);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred or cannot reach backend on port 8000.");
      patchRoom(activeRoom.id, {
        loadingVision: false,
        loadingAudio: false,
        loadingDraft: false,
        progressMessage: null
      });
    }
  };

  // same flow as generate() but merges new results into existing scope.
  // used when the user adds extra photos/audio after initial generation.
  const generateExtra = async (roomId: string, extraImages: File[], extraAudio: File[], extraPreviews: string[], extraAudioUrls: string[]) => {
    const room = rooms.find(r => r.id === roomId);
    if (!room || !room.editableResult) return;
    if (extraImages.length === 0 && extraAudio.length === 0) return;

    patchRoom(roomId, {
      loadingVision: true,
      loadingAudio: true,
      loadingDraft: true,
      progressMessage: "Processing extra context...",
    });

    try {
      const fd = new FormData();
      if (extraImages.length === 0) {
        fd.append("images", new Blob(["x"], { type: "image/png" }), "photo.png");
      } else {
        extraImages.forEach(f => fd.append("images", f, f.name));
      }

      if (extraAudio.length === 0) {
        fd.append("audios", new Blob(["x"], { type: "audio/wav" }), "rec.wav");
      } else {
        extraAudio.forEach(f => fd.append("audios", f, f.name));
      }

      const res = await fetch("http://localhost:8000/api/process-room", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part.startsWith("data: ")) {
              const dataStr = part.substring(6).trim();
              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.status === "progress") {
                    patchRoom(roomId, { progressMessage: parsed.message });
                  } else if (parsed.status === "success") {
                    const currentResult = room.editableResult;
                    patchRoom(roomId, {
                      editableResult: {
                        status: "success",
                        raw_transcription: currentResult.raw_transcription + "\n\n" + parsed.raw_transcription,
                        raw_vision: currentResult.raw_vision + "\n\n" + parsed.raw_vision,
                        scope_of_work: [...currentResult.scope_of_work, ...parsed.scope_of_work]
                      },
                      imageFiles: [...room.imageFiles, ...extraImages],
                      imagePreviews: [...room.imagePreviews, ...extraPreviews],
                      audioFiles: [...room.audioFiles, ...extraAudio],
                      audioUrls: [...room.audioUrls, ...extraAudioUrls],
                      loadingVision: false,
                      loadingAudio: false,
                      loadingDraft: false,
                      progressMessage: null
                    });
                  } else if (parsed.status === "error") {
                    throw new Error(parsed.message);
                  }
                } catch (e) {
                  console.error("Error parsing SSE data", e, dataStr);
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error occurred generating extra notes.");
      patchRoom(roomId, {
        loadingVision: false,
        loadingAudio: false,
        loadingDraft: false,
        progressMessage: null
      });
    }
  };

  // ── render helpers ──────────────────────────────

  const setTranscription = (rid: string, v: string) =>
    setRooms((prev) =>
      prev.map((r) =>
        r.id === rid && r.editableResult
          ? {
            ...r,
            editableResult: { ...r.editableResult, raw_transcription: v },
          }
          : r
      )
    );

  const appendTranscription = (rid: string, text: string) => {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === rid && r.editableResult
          ? {
            ...r,
            editableResult: {
              ...r.editableResult,
              raw_transcription: r.editableResult.raw_transcription + (r.editableResult.raw_transcription ? "\n\n" : "") + text
            }
          }
          : r
      )
    );
  };

  const setVision = (rid: string, v: string) =>
    setRooms((prev) =>
      prev.map((r) =>
        r.id === rid && r.editableResult
          ? { ...r, editableResult: { ...r.editableResult, raw_vision: v } }
          : r
      )
    );

  const setScopeField = (
    rid: string,
    idx: number,
    field: keyof ScopeItem,
    v: string
  ) =>
    setRooms((prev) =>
      prev.map((r) =>
        r.id === rid && r.editableResult
          ? {
            ...r,
            editableResult: {
              ...r.editableResult,
              scope_of_work: patchRow(
                r.editableResult.scope_of_work,
                idx,
                field,
                v
              ),
            },
          }
          : r
      )
    );

  // ── export ─────────────────────────────────────
  // builds the JSON payload and POSTs to the backend which returns
  // a ReportLab-generated PDF. A blob is returned and a download is triggered.

  const fetchPdfBlob = async () => {
    const payload = {
      rooms: doneRooms.map((r) => ({
        room: r.name,
        raw_transcription: r.editableResult?.raw_transcription,
        raw_vision: r.editableResult?.raw_vision,
        ...r.editableResult,
      })),
      grand_total: grandTotal,
    };

    const res = await fetch("http://localhost:8000/api/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    return res.blob();
  };

  const exportPdf = async () => {
    try {
      const blob = await fetchPdfBlob();
      // programmatic download via a temp anchor element
      // ref: https://stackoverflow.com/questions/19327749
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `renovation_scope_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      alert("Failed to generate PDF. Make sure the backend is running.");
    }
  };

  const previewPdf = async () => {
    try {
      const blob = await fetchPdfBlob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
      // not revoking the URL here because the new tab needs it to load.
      // it'll get cleaned up when the tab closes or the session ends.
    } catch (err) {
      console.error("PDF preview failed:", err);
      alert("Failed to generate PDF. Make sure the backend is running.");
    }
  };

  // ─────────────────── RENDER ────────────────────

  return (
    <main className="min-h-screen bg-[var(--charcoal-deep)] noise-bg">
      {/* hidden native file inputs — triggered by the dropzone divs */}
      <input
        ref={imgRef}
        type="file"
        multiple
        accept="image/*,.png,.jpg,.jpeg,.heic,.heif,.webp"
        className="hidden"
        onChange={onImagePick}
      />
      <input
        ref={audRef}
        type="file"
        multiple
        accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg,.flac,.mp4"
        className="hidden"
        onChange={onAudioPick}
      />

      {rooms.length === 0 ? (
        /* ───── LANDING / EMPTY STATE ─────
         * this is the first thing contractors see.
         * designed to feel professional and trustworthy, not like a toy.
         */
        <div className="flex min-h-screen flex-col items-center justify-center p-8">
          {/* background gradient — subtle warmth bleeding from center */}
          <div
            className="pointer-events-none fixed inset-0 opacity-30"
            style={{
              background: "radial-gradient(ellipse at 50% 40%, rgba(212,168,83,0.12) 0%, transparent 70%)",
            }}
          />

          <div className="relative z-10 max-w-lg text-center">
            {/* staggered entrance — each element fades up with increasing delay.
             * using inline style for animation-delay because tailwind doesn't
             * have great support for arbitrary delays.
             * ref: https://developer.mozilla.org/en-US/docs/Web/CSS/animation-delay */}
            <p
              className="anim-fade-up text-[11px] font-semibold tracking-[0.25em] uppercase mb-4"
              style={{ color: "var(--amber)", animationDelay: "0.1s" }}
            >
              Site Survey → Scope of Work
            </p>

            <h1
              className="anim-fade-up text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--parchment)",
                animationDelay: "0.2s",
              }}
            >
              Renovation Scope Drafter
            </h1>

            <p
              className="anim-fade-up text-base leading-relaxed mb-8 max-w-md mx-auto"
              style={{ color: "var(--warm-text)", animationDelay: "0.3s" }}
            >
              Upload site photos and voice notes room by room. The system
              analyses everything and drafts a scope of work you can review,
              edit, and export.
            </p>

            {/* CTA — amber is the dominant action color throughout the app */}
            <div
              className="anim-fade-up"
              style={{ animationDelay: "0.45s" }}
            >
              <Button
                size="lg"
                onClick={addRoom}
                className="px-8 py-6 text-base font-semibold rounded-lg cursor-pointer transition-all duration-200 shadow-lg shadow-[var(--amber)]/10 hover:shadow-xl hover:shadow-[var(--amber)]/20 hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  backgroundColor: "var(--amber)",
                  color: "var(--charcoal-deep)",
                }}
              >
                + Add first room
              </Button>
            </div>

            {/* AI disclaimer — must be clearly visible per project requirements */}
            <div
              className="anim-fade-up mt-10 mx-auto max-w-sm rounded-lg px-4 py-3 text-left"
              style={{
                animationDelay: "0.6s",
                backgroundColor: "rgba(212,168,83,0.06)",
                border: "1px solid rgba(212,168,83,0.15)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-wider mb-1"
                style={{ color: "var(--amber)" }}
              >
                ⚠ AI-Assisted Tool
              </p>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--warm-gray)" }}>
                This tool uses AI to generate scope estimates from your site
                media. All output should be reviewed and verified by a qualified
                professional before use in any contract.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ───── STICKY HEADER ───── */}
          <header
            className="sticky top-0 z-20 border-b px-6 py-3 flex items-center justify-between"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "rgba(19,21,22,0.85)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <div>
              <p
                className="text-[10px] font-semibold tracking-[0.2em] uppercase"
                style={{ color: "var(--amber)" }}
              >
                Scope Drafter
              </p>
              <h1
                className="text-sm font-semibold"
                style={{
                  fontFamily: "var(--font-heading)",
                  color: "var(--parchment)",
                }}
              >
                Renovation Scope of Work
              </h1>
            </div>
          </header>

          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            {/* ───── ROOM TABS ─────
             * pill-style tabs for switching between rooms.
             * active tab gets the amber accent, others are muted. */}
            <div className="flex items-center gap-2 flex-wrap">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer ${room.id === activeRoomId
                    ? "shadow-sm"
                    : "hover:opacity-80"
                    }`}
                  style={
                    room.id === activeRoomId
                      ? {
                        backgroundColor: "var(--amber)",
                        color: "var(--charcoal-deep)",
                      }
                      : {
                        backgroundColor: "var(--charcoal-light)",
                        color: "var(--warm-text)",
                        border: "1px solid var(--border)",
                      }
                  }
                >
                  {room.name}
                  {/* loading indicator — amber pulse */}
                  {(room.loadingVision || room.loadingAudio || room.loadingDraft) && (
                    <span
                      className="ml-2 inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: "var(--amber)",
                        animation: "gentlePulse 1.5s ease-in-out infinite",
                      }}
                    />
                  )}
                  {/* done indicator — sage green dot */}
                  {room.editableResult && !(room.loadingVision || room.loadingAudio || room.loadingDraft) && (
                    <span
                      className="ml-2 inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: "var(--sage)" }}
                    />
                  )}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addRoom}
                className="rounded-full cursor-pointer border-dashed"
                style={{
                  borderColor: "var(--border)",
                  color: "var(--warm-gray)",
                  backgroundColor: "transparent",
                }}
              >
                + Add room
              </Button>
            </div>

            {/* ───── ACTIVE ROOM CONTENT ───── */}
            {activeRoom && (
              <StepOne
                activeRoom={activeRoom}
                patchRoom={patchRoom}
                deleteRoom={deleteRoom}
                setTranscription={setTranscription}
                appendTranscription={appendTranscription}
                setVision={setVision}
                generate={generate}
                generateExtra={generateExtra}
                imgRef={imgRef}
                audRef={audRef}
                addAudioFile={addAudioFile}
                removeImage={removeImage}
                removeAudio={removeAudio}
              />
            )}

            {/* ───── SCOPE TABLE + EXPORT (visible once any room is done) ───── */}
            {doneRooms.length > 0 && (
              <>
                <StepTwo
                  doneRooms={doneRooms}
                  grandTotal={grandTotal}
                  setScopeField={setScopeField}
                />

                <StepThree
                  doneRooms={doneRooms}
                  grandTotal={grandTotal}
                  exportPdf={exportPdf}
                  previewPdf={previewPdf}
                />
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
