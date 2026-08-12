"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Room } from "@/app/page";

// removed static LOADER_STEPS

interface StepOneProps {
  activeRoom: Room;
  patchRoom: (id: string, patch: Partial<Room>) => void;
  deleteRoom: (id: string) => void;
  setTranscription: (id: string, text: string) => void;
  setVision: (id: string, text: string) => void;
  generate: () => void;
  imgRef: React.RefObject<HTMLInputElement | null>;
  audRef: React.RefObject<HTMLInputElement | null>;
  addAudioFile?: (rid: string, file: File) => void;
  appendTranscription?: (rid: string, text: string) => void;
  removeImage?: (rid: string, index: number) => void;
  removeAudio?: (rid: string, index: number) => void;
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
  addAudioFile,
  appendTranscription,
  removeImage,
  removeAudio,
}: StepOneProps) {
  const isLoading = activeRoom.loadingVision || activeRoom.loadingAudio || activeRoom.loadingDraft;
  const [recordingMode, setRecordingMode] = React.useState<"upload" | "review" | null>(null);
  const [isTranscribingExtra, setIsTranscribingExtra] = React.useState(false);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  const startRecording = async (mode: "upload" | "review") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

        if (mode === "upload") {
          addAudioFile?.(activeRoom.id, file);
        } else if (mode === "review") {
          setIsTranscribingExtra(true);
          try {
            const fd = new FormData();
            fd.append("audios", file, file.name);
            const res = await fetch("http://localhost:8000/api/transcribe-audio", {
              method: "POST",
              body: fd
            });
            if (!res.ok) throw new Error("Transcription failed");
            const data = await res.json();
            if (data.raw_transcription) {
              appendTranscription?.(activeRoom.id, data.raw_transcription);
            }
          } catch (err) {
            console.error(err);
            alert("Failed to transcribe extra audio.");
          } finally {
            setIsTranscribingExtra(false);
          }
        }
        setRecordingMode(null);
      };

      recorder.start();
      setRecordingMode(mode);
    } catch (err) {
      console.error(err);
      alert("Could not access microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingMode) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const steps = [
    { label: "Analysing site photograph…", done: !activeRoom.loadingVision && (activeRoom.loadingAudio || activeRoom.loadingDraft || activeRoom.editableResult) },
    { label: "Transcribing voice recording…", done: !activeRoom.loadingAudio && (activeRoom.loadingDraft || activeRoom.editableResult) },
    { label: "Drafting scope of work…", done: !activeRoom.loadingDraft && activeRoom.editableResult },
  ];

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
            disabled={isLoading}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteRoom(activeRoom.id)}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium self-end sm:self-auto"
          disabled={isLoading}
        >
          Delete Room
        </Button>
      </div>

      {isLoading ? (
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
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  {step.done ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[10px] font-bold">
                      ✓
                    </span>
                  ) : (
                    <span className="block h-2 w-2 ml-1 rounded-full bg-stone-300 animate-pulse" />
                  )}
                  <span
                    className={`text-sm ${step.done ? 'text-stone-700 font-medium' : 'text-stone-500 animate-pulse'}`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-stone-400">
              Usually takes about 30 seconds... please wait...
            </p>
          </CardContent>
        </Card>
      ) : activeRoom.editableResult ? (
        /* ── REVIEW STATE (two-column grid) ── */
        <>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400">
            Step 1 — Verify output for {activeRoom.name}
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
                  {activeRoom.imagePreviews.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {activeRoom.imagePreviews.map((preview, i) => (
                        <img
                          key={i}
                          src={preview}
                          alt={`${activeRoom.name} photo ${i + 1}`}
                          className="h-28 w-28 flex-shrink-0 rounded-lg object-cover bg-stone-100 border border-stone-200"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg bg-stone-100 flex items-center justify-center text-sm text-stone-400">
                      No images uploaded
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                    Voice Note
                  </Label>
                  {activeRoom.audioUrls.length > 0 ? (
                    <div className="space-y-2">
                      {activeRoom.audioUrls.map((url, i) => (
                        <audio
                          key={i}
                          controls
                          src={url}
                          className="w-full h-8"
                        />
                      ))}
                    </div>
                  ) : (
                    <audio controls className="w-full h-8" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* right col: editable output */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Analysis Review</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor={`t-${activeRoom.id}`}
                    className="block text-[10px] font-semibold tracking-widest uppercase text-stone-400"
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
                  <div className="flex justify-end">
                    {recordingMode === "review" ? (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="animate-pulse"
                        onClick={stopRecording}
                      >
                        Stop Recording
                      </Button>
                    ) : isTranscribingExtra ? (
                      <Button variant="secondary" size="sm" disabled>
                        Transcribing...
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-stone-600 hover:text-stone-900 cursor-pointer"
                        onClick={() => startRecording("review")}
                        disabled={recordingMode !== null}
                      >
                        ⏺ Record Extra Notes
                      </Button>
                    )}
                  </div>
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
              {activeRoom.imagePreviews.length > 0 && (
                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                  {activeRoom.imagePreviews.map((preview, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <img
                        src={preview}
                        alt={`Preview ${i + 1}`}
                        className="h-20 w-20 rounded-md object-cover border border-stone-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage?.(activeRoom.id, i);
                        }}
                        className="absolute -top-2 -right-2 bg-stone-900 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                onClick={() => imgRef.current?.click()}
                className="flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white text-sm text-stone-500 transition hover:border-stone-400 hover:bg-stone-50">
                Click to add images
              </div>
            </div>

            {/* audio section */}
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-stone-400">
                Voice Recording
              </Label>
              {activeRoom.audioUrls.length > 0 && (
                <div className="space-y-2 mb-3">
                  {activeRoom.audioUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <audio controls src={url} className="h-8 flex-1" />
                      <button
                        type="button"
                        onClick={() => removeAudio?.(activeRoom.id, i)}
                        className="h-8 w-8 rounded-full border border-red-200 bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 hover:text-red-700 transition-colors"
                        title="Remove audio"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-3">
                <div
                  onClick={() => audRef.current?.click()}
                  className="flex-1 flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white text-sm text-stone-500 transition hover:border-stone-400 hover:bg-stone-50">
                  Click to add audio files
                </div>
                <div className="flex flex-col gap-2 w-28">
                  {recordingMode === "upload" ? (
                    <Button
                      variant="destructive"
                      className="flex-1 h-full animate-pulse font-semibold"
                      onClick={stopRecording}
                    >
                      Stop Rec
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="flex-1 h-full bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-red-200 font-semibold cursor-pointer"
                      onClick={() => startRecording("upload")}
                      disabled={recordingMode !== null}
                    >
                      ⏺ Record
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <Button
              className="w-full bg-stone-900 text-white hover:bg-stone-800"
              size="lg"
              disabled={isLoading}
              onClick={generate}
            >
              {isLoading ? "Generating..." : "Upload & Generate"}
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
}
