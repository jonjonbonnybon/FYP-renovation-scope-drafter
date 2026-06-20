"use client";

/* eslint-disable @next/next/no-img-element, jsx-a11y/media-has-caption */

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
  cost: number;
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
  imageFile: File | null;
  audioFile: File | null;
  imagePreview: string | null;
  audioUrl: string | null;
  editableResult: ApiResult | null;
  loading: boolean;
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
    if (field === "quantity" || field === "cost")
      return { ...r, [field]: Number(value) || 0 };
    return { ...r, [field]: value };
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
      (r.editableResult?.scope_of_work.reduce((a, item) => a + item.cost, 0) ??
        0),
    0
  );

  // ── room mgmt ──────────────────────────────────

  const addRoom = () => {
    roomCount.current += 1;
    const room: Room = {
      id: crypto.randomUUID(),
      name: `Room ${roomCount.current}`,
      imageFile: null,
      audioFile: null,
      imagePreview: null,
      audioUrl: null,
      editableResult: null,
      loading: false,
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

    if (roomToDelete.imagePreview) {
      URL.revokeObjectURL(roomToDelete.imagePreview);
    }
    if (roomToDelete.audioUrl) {
      URL.revokeObjectURL(roomToDelete.audioUrl);
    }

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

  const onImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !activeRoomId) return;
    patchRoom(activeRoomId, {
      imageFile: f,
      imagePreview: URL.createObjectURL(f),
    });
    e.target.value = ""; // lets user re-pick same file
  };

  const onAudioPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !activeRoomId) return;
    patchRoom(activeRoomId, {
      audioFile: f,
      audioUrl: URL.createObjectURL(f),
    });
    e.target.value = "";
  };

  // ── api call ───────────────────────────────────

  const generate = async () => {
    if (!activeRoom) return;
    patchRoom(activeRoom.id, { loading: true });

    try {
      const fd = new FormData();
      fd.append(
        "image",
        activeRoom.imageFile ?? new Blob(["x"], { type: "image/png" }),
        "photo.png"
      );
      fd.append(
        "audio",
        activeRoom.audioFile ?? new Blob(["x"], { type: "audio/wav" }),
        "rec.wav"
      );

      const res = await fetch("http://localhost:8000/api/generate-scope", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: ApiResult = await res.json();
      patchRoom(activeRoom.id, { editableResult: data, loading: false });
    } catch (err) {
      console.error(err);
      alert("Cannot reach backend on port 8000 — is it running?");
      patchRoom(activeRoom.id, { loading: false });
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

  const exportPdf = () => {
    const payload = doneRooms.map((r) => ({
      room: r.name,
      ...r.editableResult,
    }));
    console.log("Export payload:", payload);
    alert("Payload logged to console — PDF generation goes here.");
  };

  // ─────────────────── RENDER ────────────────────

  return (
    <main className="min-h-screen bg-stone-50">
      {/* hidden native file inputs — triggered by the dropzone divs */}
      <input
        ref={imgRef}
        type="file"
        accept="image/*,.png,.jpg,.jpeg,.heic"
        className="hidden"
        onChange={onImagePick}
      />
      <input
        ref={audRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a"
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
            Upload site photos and voice notes room by room. The models analyse
            everything and draft a scope of work you can review before exporting.
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
                  {room.loading && (
                    <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  {room.editableResult && !room.loading && (
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
                setVision={setVision}
                generate={generate}
                imgRef={imgRef}
                audRef={audRef}
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
                />
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}
