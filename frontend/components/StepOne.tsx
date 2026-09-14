"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Room } from "@/app/page";

// The static LOADER_STEPS were removed; dynamic progress messages work better for long-polling.

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
  generateExtra?: (rid: string, imgs: File[], auds: File[], imgUrls: string[], audUrls: string[]) => Promise<void>;
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
  generateExtra,
}: StepOneProps) {
  const isLoading = activeRoom.loadingVision || activeRoom.loadingAudio || activeRoom.loadingDraft;
  const [recordingMode, setRecordingMode] = React.useState<"upload" | "extra" | null>(null);

  // Extra Context State
  const [extraImages, setExtraImages] = React.useState<File[]>([]);
  const [extraImagePreviews, setExtraImagePreviews] = React.useState<string[]>([]);
  const [extraAudio, setExtraAudio] = React.useState<File[]>([]);
  const [extraAudioUrls, setExtraAudioUrls] = React.useState<string[]>([]);
  const extraImgRef = React.useRef<HTMLInputElement>(null);

  // Keep refs to these to prevent the closure stale-state bug on stopRecording.
  // See React docs on refs for keeping mutable values around without triggering re-renders.
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);

  const onExtraImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newFiles: File[] = [];
    const newPreviews: string[] = [];

    // Loop through files and convert HEIC on the fly if needed.
    // iOS users always upload HEIC and it breaks browser preview.
    // Sending it to a quick local conversion endpoint first.
    for (const file of files) {
      newFiles.push(file);
      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        try {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("http://localhost:8000/api/convert-heic", { method: "POST", body: fd });
          if (res.ok) {
            const blob = await res.blob();
            newPreviews.push(URL.createObjectURL(blob));
          } else {
            // fallback if conversion fails
            newPreviews.push(URL.createObjectURL(file));
          }
        } catch {
          newPreviews.push(URL.createObjectURL(file));
        }
      } else {
        newPreviews.push(URL.createObjectURL(file));
      }
    }

    setExtraImages(prev => [...prev, ...newFiles]);
    setExtraImagePreviews(prev => [...prev, ...newPreviews]);
    e.target.value = "";
  };

  const removeExtraImage = (index: number) => {
    setExtraImages(prev => prev.filter((_, i) => i !== index));
    setExtraImagePreviews(prev => {
      // Revoke these Object URLs to prevent memory leaks.
      // MDN docs for URL.createObjectURL explicitly say to do this.
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExtraAudio = (index: number) => {
    setExtraAudio(prev => prev.filter((_, i) => i !== index));
    setExtraAudioUrls(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const submitExtra = async () => {
    if (generateExtra) {
      await generateExtra(activeRoom.id, extraImages, extraAudio, extraImagePreviews, extraAudioUrls);
      setExtraImages([]);
      setExtraImagePreviews([]);
      setExtraAudio([]);
      setExtraAudioUrls([]);
    }
  };

  const startRecording = async (mode: "upload" | "extra") => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // webm is standard for MediaRecorder across most browsers now.
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });

        if (mode === "upload") {
          addAudioFile?.(activeRoom.id, file);
        } else if (mode === "extra") {
          setExtraAudio(prev => [...prev, file]);
          setExtraAudioUrls(prev => [...prev, URL.createObjectURL(file)]);
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
      // Have to manually stop tracks so the red recording dot goes away in the browser tab
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm anim-fade-up">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-xs font-semibold text-[var(--warm-gray)] uppercase tracking-widest whitespace-nowrap">
            Room Name:
          </span>
          <Input
            type="text"
            value={activeRoom.name}
            onChange={(e) => patchRoom(activeRoom.id, { name: e.target.value })}
            className="h-9 max-w-[240px] bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)] text-sm font-medium hover:bg-[#2a2d2f] focus:bg-[#2a2d2f] transition-colors"
            placeholder="e.g. Living Room"
            disabled={isLoading}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => deleteRoom(activeRoom.id)}
          className="text-red-400 hover:text-red-300 hover:bg-red-950/30 font-medium self-end sm:self-auto cursor-pointer transition-colors"
          disabled={isLoading}
        >
          Delete Room
        </Button>
      </div>

      {isLoading ? (
        /* ── CUSTOM LOADER ── */
        <Card className="max-w-md mx-auto bg-[var(--card)] border-[var(--border)] anim-fade-up">
          <CardContent className="py-14 flex flex-col items-center gap-8">
            {/* Spinning ring - Using absolute positioning trick for the 2-tone effect from Tailwind docs */}
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-[3px] border-[var(--border)]" />
              <div className="absolute inset-0 rounded-full border-[3px] border-transparent border-t-[var(--amber)] animate-spin" />
            </div>

            {/* dynamic progress message */}
            <div className="space-y-4 w-full max-w-xs text-center">
              <p className="text-sm font-medium text-[var(--warm-text)] animate-pulse">
                {activeRoom.progressMessage || "Processing..."}
              </p>
            </div>

            <p className="text-xs text-[var(--warm-gray)]">
              Usually takes about 30 seconds... please wait...
            </p>
          </CardContent>
        </Card>
      ) : activeRoom.editableResult ? (
        /* ── REVIEW STATE (two-column grid) ── */
        <div className="anim-fade-up">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--warm-gray)] mb-4">
            <span className="text-[var(--amber)]">Step 1</span> — Verify output for <span className="text-[var(--amber)]">{activeRoom.name}</span>
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* left col: source media */}
            <Card className="bg-[var(--card)] border-[var(--border)]">
              <CardHeader className="border-b border-[var(--border)]">
                <CardTitle className="text-[var(--parchment)]" style={{ fontFamily: 'var(--font-heading)' }}>Source Media</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-4">
                <div>
                  <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]">
                    Site Photograph
                  </Label>
                  {activeRoom.imagePreviews.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {activeRoom.imagePreviews.map((preview, i) => (
                        <img
                          key={i}
                          src={preview}
                          alt={`${activeRoom.name} photo ${i + 1}`}
                          className="h-28 w-28 flex-shrink-0 rounded-lg object-cover bg-[var(--muted)] border border-[var(--border)]"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-28 rounded-lg bg-[var(--muted)] flex items-center justify-center text-sm text-[var(--warm-gray)]">
                      No images uploaded
                    </div>
                  )}
                </div>
                <div>
                  <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]">
                    Voice Note
                  </Label>
                  {activeRoom.audioUrls.length > 0 ? (
                    <div className="space-y-2">
                      {activeRoom.audioUrls.map((url, i) => (
                        <audio
                          key={i}
                          controls
                          src={url}
                          className="w-full h-8 rounded-md bg-[var(--muted)]"
                        />
                      ))}
                    </div>
                  ) : (
                    <audio controls className="w-full h-8 rounded-md bg-[var(--muted)]" />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* right col: editable output */}
            <Card className="bg-[var(--card)] border-[var(--border)]">
              <CardHeader className="border-b border-[var(--border)]">
                <CardTitle className="text-[var(--parchment)]" style={{ fontFamily: 'var(--font-heading)' }}>Analysis Review</CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <div className="space-y-2">
                  <Label
                    htmlFor={`t-${activeRoom.id}`}
                    className="block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]"
                  >
                    Audio Transcription
                  </Label>
                  <Textarea
                    id={`t-${activeRoom.id}`}
                    rows={4}
                    value={activeRoom.editableResult.raw_transcription}
                    onChange={(e) => setTranscription(activeRoom.id, e.target.value)}
                    className="resize-none text-sm bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)] focus:border-[var(--amber)]/50 focus:ring-1 focus:ring-[var(--amber)]/50 transition-colors"
                  />
                </div>
                <div>
                  <Label
                    htmlFor={`v-${activeRoom.id}`}
                    className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]"
                  >
                    Vision Analysis
                  </Label>
                  <Textarea
                    id={`v-${activeRoom.id}`}
                    rows={4}
                    value={activeRoom.editableResult.raw_vision}
                    onChange={(e) => setVision(activeRoom.id, e.target.value)}
                    className="resize-none text-sm bg-[var(--muted)] border-[var(--border)] text-[var(--foreground)] focus:border-[var(--amber)]/50 focus:ring-1 focus:ring-[var(--amber)]/50 transition-colors"
                  />
                </div>

                {/* ── Add More Context Panel ── */}
                <div className="pt-4 border-t border-[var(--border)] mt-4">
                  <h4 className="text-xs font-bold text-[var(--warm-gray)] uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-heading)' }}>Add More Context</h4>

                  {/* Extra Images Preview */}
                  {extraImagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {extraImagePreviews.map((preview, i) => (
                        <div key={i} className="relative">
                          <img src={preview} className="h-16 w-16 rounded-lg object-cover border border-[var(--border)] bg-[var(--muted)]" />
                          <button onClick={() => removeExtraImage(i)} className="absolute -top-2 -right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] cursor-pointer shadow-sm transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Extra Audio Preview */}
                  {extraAudioUrls.length > 0 && (
                    <div className="flex flex-col gap-2 mb-3">
                      {extraAudioUrls.map((url, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <audio src={url} controls className="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--muted)]" />
                          <button onClick={() => removeExtraAudio(i)} className="text-red-400 hover:text-red-300 cursor-pointer text-sm font-bold transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <input type="file" accept="image/*" multiple className="hidden" ref={extraImgRef} onChange={onExtraImagePick} />
                    <Button variant="outline" size="sm" onClick={() => extraImgRef.current?.click()} className="cursor-pointer border-[var(--border)] bg-transparent text-[var(--parchment)] hover:bg-[#2a2d2f]">
                      + Photo
                    </Button>

                    {recordingMode === "extra" ? (
                      <Button variant="destructive" size="sm" onClick={stopRecording} className="animate-pulse cursor-pointer">
                        Stop Recording
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => startRecording("extra")} disabled={recordingMode !== null} className="cursor-pointer border-[var(--border)] bg-transparent text-[var(--parchment)] hover:bg-[#2a2d2f]">
                        ⏺ Record Audio
                      </Button>
                    )}

                    <div className="flex-1 min-w-[20px]"></div>

                    <Button
                      variant="default"
                      size="sm"
                      onClick={submitExtra}
                      disabled={extraImages.length === 0 && extraAudio.length === 0}
                      className="cursor-pointer bg-[var(--amber)] text-[var(--charcoal-deep)] hover:bg-[var(--amber-hover)] transition-colors"
                    >
                      Submit Context
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* ── UPLOAD STATE ── */
        <Card className="max-w-lg mx-auto bg-[var(--card)] border-[var(--border)] anim-fade-up">
          <CardHeader className="border-b border-[var(--border)]">
            <CardTitle className="text-[var(--parchment)]" style={{ fontFamily: 'var(--font-heading)' }}>
              Upload Media — {activeRoom.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            {/* image dropzone — triggers hidden file input */}
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]">
                Site Photograph
              </Label>
              {activeRoom.imagePreviews.length > 0 && (
                <div className="flex gap-3 mb-3 overflow-x-auto pb-2">
                  {activeRoom.imagePreviews.map((preview, i) => (
                    <div key={i} className="relative shrink-0 group">
                      <img
                        src={preview}
                        alt={`Preview ${i + 1}`}
                        className="h-20 w-20 rounded-lg object-cover border border-[var(--border)] bg-[var(--muted)] shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          // Prevent triggering the dropzone upload again
                          e.stopPropagation();
                          removeImage?.(activeRoom.id, i);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-[10px] shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div
                onClick={() => imgRef.current?.click()}
                className="flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--amber)]/30 bg-transparent text-sm text-[var(--warm-text)] transition-all hover:border-[var(--amber)]/60 hover:bg-[var(--amber)]/5"
              >
                Click to add images
              </div>
            </div>

            {/* audio section */}
            <div>
              <Label className="mb-1.5 block text-[10px] font-semibold tracking-widest uppercase text-[var(--warm-gray)]">
                Voice Recording
              </Label>
              {activeRoom.audioUrls.length > 0 && (
                <div className="space-y-2 mb-3">
                  {activeRoom.audioUrls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <audio controls src={url} className="h-8 flex-1 rounded-md border border-[var(--border)] bg-[var(--muted)]" />
                      <button
                        type="button"
                        onClick={() => removeAudio?.(activeRoom.id, i)}
                        className="h-8 w-8 rounded-full border border-red-500/20 bg-red-500/10 text-red-400 flex items-center justify-center hover:bg-red-500/20 transition-colors"
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
                  className="flex-1 flex h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-[var(--amber)]/30 bg-transparent text-sm text-[var(--warm-text)] transition-all hover:border-[var(--amber)]/60 hover:bg-[var(--amber)]/5"
                >
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
                      className="flex-1 h-full bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20 font-semibold cursor-pointer transition-colors"
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
              className="w-full bg-[var(--amber)] text-[var(--charcoal-deep)] hover:bg-[var(--amber-hover)] transition-colors"
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
