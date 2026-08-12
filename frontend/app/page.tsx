// Next.js App Router main entry page.
// References:
// - Next.js App Router Docs: https://nextjs.org/docs
// - Tailwind CSS styling: https://tailwindcss.com/docs
// - Shadcn UI Components: https://ui.shadcn.com/docs

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
}

// ── helpers ───────────────────────────────────────

// swap one field in a specific scope row
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

  // derived state
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

  const generate = async () => {
    if (!activeRoom) return;
    patchRoom(activeRoom.id, {
      loadingVision: true,
      loadingAudio: true,
      loadingDraft: true,
      editableResult: null
    });

    try {
      // 1. Vision Analysis
      const imgFd = new FormData();
      if (activeRoom.imageFiles.length === 0) {
        imgFd.append("images", new Blob(["x"], { type: "image/png" }), "photo.png");
      } else {
        activeRoom.imageFiles.forEach(f => imgFd.append("images", f, f.name));
      }

      const visionRes = await fetch("http://localhost:8000/api/analyze-vision", {
        method: "POST",
        body: imgFd,
      });
      if (!visionRes.ok) throw new Error(`Vision HTTP ${visionRes.status}`);
      const visionData = await visionRes.json();
      patchRoom(activeRoom.id, { loadingVision: false });

      // 2. Audio Transcription
      const audFd = new FormData();
      if (activeRoom.audioFiles.length === 0) {
        audFd.append("audios", new Blob(["x"], { type: "audio/wav" }), "rec.wav");
      } else {
        activeRoom.audioFiles.forEach(f => audFd.append("audios", f, f.name));
      }

      const audioRes = await fetch("http://localhost:8000/api/transcribe-audio", {
        method: "POST",
        body: audFd,
      });
      if (!audioRes.ok) throw new Error(`Audio HTTP ${audioRes.status}`);
      const audioData = await audioRes.json();
      patchRoom(activeRoom.id, { loadingAudio: false });

      // 3. Synthesize Draft
      const draftRes = await fetch("http://localhost:8000/api/synthesize-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_transcription: audioData.raw_transcription,
          raw_vision: visionData.raw_vision,
        }),
      });
      if (!draftRes.ok) throw new Error(`Draft HTTP ${draftRes.status}`);
      const draftData = await draftRes.json();

      const fullData: ApiResult = {
        status: "success",
        raw_transcription: audioData.raw_transcription,
        raw_vision: visionData.raw_vision,
        scope_of_work: draftData.scope_of_work
      };

      patchRoom(activeRoom.id, { editableResult: fullData, loadingDraft: false });
    } catch (err) {
      console.error(err);
      alert("Error occurred or cannot reach backend on port 8000.");
      patchRoom(activeRoom.id, { loadingVision: false, loadingAudio: false, loadingDraft: false });
    }
  };

  // ── scope editing ──────────────────────────────

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
      // Intentionally not revoking the URL immediately so the new tab can load it
    } catch (err) {
      console.error("PDF preview failed:", err);
      alert("Failed to generate PDF. Make sure the backend is running.");
    }
  };

  // ─────────────────── RENDER ────────────────────

  return (
    <main className="min-h-screen bg-stone-50">
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
        /* ───── EMPTY STATE ───── */
        <div className="flex min-h-screen flex-col items-center justify-center p-8">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400 mb-1">
            FYP Prototype
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
            Renovation Scope Drafter
          </h1>
          <p className="text-sm text-stone-500 mt-2 max-w-sm text-center leading-relaxed">
            Upload site photos and voice notes room by room. The system analyses
            everything and drafts a scope of work you can review before exporting.
          </p>
          <Button size="lg" className="mt-8" onClick={addRoom}>
            + Add first room
          </Button>
        </div>
      ) : (
        <>
          {/* ───── STICKY HEADER ───── */}
          <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400">
                FYP Prototype
              </p>
              <h1 className="text-sm font-semibold text-stone-800">
                Renovation Scope Drafter
              </h1>
            </div>
          </header>

          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            {/* ───── ROOM TABS ───── */}
            <div className="flex items-center gap-2 flex-wrap">
              {rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${room.id === activeRoomId
                    ? "bg-stone-800 text-white shadow-sm"
                    : "bg-white text-stone-700 ring-1 ring-stone-200 hover:ring-stone-400"
                    }`}
                >
                  {room.name}
                  {(room.loadingVision || room.loadingAudio || room.loadingDraft) && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {room.editableResult && !(room.loadingVision || room.loadingAudio || room.loadingDraft) && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  )}
                </button>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addRoom}
                className="rounded-full"
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
                imgRef={imgRef}
                audRef={audRef}
                addAudioFile={addAudioFile}
                removeImage={removeImage}
                removeAudio={removeAudio}
              />
            )}

            {/* ───── SCOPE OF WORK TABLE (all rooms) ───── */}
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
