"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Room } from "@/app/page";

// step labels shown while backend is processing
const LOADER_STEPS = [
  "Analysing site photograph…",
  "Transcribing voice recording…",
  "Drafting scope of work…",
];

interface StepOneProps {
  activeRoom: Room;
  patchRoom: (id: string, patch: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  setTranscription: (id: string, text: string) => void;
  setVision: (id: string, text: string) => void;
  generate: () => void;
  imgRef: React.RefObject<HTMLInputElement | null>;
  audRef: React.RefObject<HTMLInputElement | null>;
}

export default function StepOne({
  activeRoom,
  patchRoom,
  deleteRoom,
  setTranscription,
  setVision,
  generate,
  imgRef,
  audRef,
}: StepOneProps) {
  return (
    <>
      {/* Room settings: Rename & Delete */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-stone-500 uppercase tracking-wider whitespace-nowrap">
            Room Name:
          </span>
          <Input
            type="text"
            value={activeRoom.name}
            onChange={(e) => patchRoom(activeRoom.id, { name: e.target.value })}
            className="h-9 max-w-[240px] bg-stone-50 border border-stone-200 text-sm font-medium hover:bg-stone-100 focus:bg-white transition-colors"
            placeholder="e.g. Living Room"
            disabled={activeRoom.loading}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteRoom(activeRoom.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium self-end sm:self-auto"
          disabled={activeRoom.loading}
        >
          Delete Room
        </Button>
      </div>

      {activeRoom.loading ? (
        /* ── CUSTOM LOADER ── */
        <Card className="max-w-md mx-auto">
          <CardContent className="py-14 flex flex-col items-center gap-8">
            {/* spinning ring */}
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-[3px] border-stone-200" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-stone-700 animate-spin" />
            </div>

            {/* animated step labels */}
            <div className="space-y-4 w-full max-w-xs">
              {LOADER_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span
                    className="block h-2 w-2 rounded-full bg-stone-300 animate-pulse"
                    style={{ animationDelay: `${i * 1.6}s` }}
                  />
                  <span
                    className="text-sm text-stone-500 animate-pulse"
                    style={{ animationDelay: `${i * 1.6}s` }}
                  >
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-stone-400">
              Usually takes about 5 seconds
            </p>
          </CardContent>
        </Card>
      ) : activeRoom.editableResult ? (
        /* ── REVIEW STATE (two-column grid) ── */
        <>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400">
            Step 1 — Verify AI output for {activeRoom.name}
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* left col: source media */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Source Media</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                    Site Photograph
                  </Label>
                  {activeRoom.imagePreview ? (
                    <img
                      src={activeRoom.imagePreview}
                      alt={`${activeRoom.name} site photo`}
                      className="h-44 w-full rounded-lg object-cover bg-stone-100"
                    />
                  ) : (
                    <div className="h-44 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400">
                      No image uploaded
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                    Voice Note
                  </Label>
                  {activeRoom.audioUrl ? (
                    <audio
                      controls
                      src={activeRoom.audioUrl}
                      className="w-full"
                    />
                  ) : (
                    <audio controls className="w-full" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* right col: editable output */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>AI Inference Review</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div>
                  <Label
                    htmlFor={`t-${activeRoom.id}`}
                    className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400"
                  >
                    Audio Transcription
                  </Label>
                  <Textarea
                    id={`t-${activeRoom.id}`}
                    rows={4}
                    value={
                      activeRoom.editableResult.raw_transcription
                    }
                    onChange={(e) =>
                      setTranscription(
                        activeRoom.id,
                        e.target.value
                      )
                    }
                    className="resize-none text-sm bg-white"
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`v-${activeRoom.id}`}
                    className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400"
                  >
                    Vision Analysis
                  </Label>
                  <Textarea
                    id={`v-${activeRoom.id}`}
                    rows={4}
                    value={activeRoom.editableResult.raw_vision}
                    onChange={(e) =>
                      setVision(activeRoom.id, e.target.value)
                    }
                    className="resize-none text-sm bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* ── UPLOAD STATE ── */
        <Card className="max-w-lg mx-auto">
          <CardHeader className="border-b">
            <CardTitle>
              Upload Media — {activeRoom.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {/* image dropzone — triggers hidden file input */}
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                Site Photograph
              </Label>
              <div
                onClick={() => imgRef.current?.click()}
                className="flex h-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white text-sm text-stone-500 transition hover:border-stone-400 hover:bg-stone-50">
                {activeRoom.imageFile ? (
                  <span className="font-medium text-stone-700">
                    ✓ {activeRoom.imageFile.name}
                  </span>
                ) : (
                  "Click to select an image"
                )}
              </div>
            </div>

            {/* audio dropzone */}
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                Voice Recording
              </Label>
              <div
                onClick={() => audRef.current?.click()}
                className="flex h-28 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white text-sm text-stone-500 transition hover:border-stone-400 hover:bg-stone-50">
                {activeRoom.audioFile ? (
                  <span className="font-medium text-stone-700">
                    ✓ {activeRoom.audioFile.name}
                  </span>
                ) : (
                  "Click to select an audio file"
                )}
              </div>
            </div>

            <Button onClick={generate} className="w-full">
              Upload & Generate
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
