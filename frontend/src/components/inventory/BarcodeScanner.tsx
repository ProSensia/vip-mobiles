"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, Keyboard, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Fully client-side barcode/QR decoding (ZXing, no network calls) — reads
// the QR/barcode printed on a new mobile's box. IMEI (from the phone's
// *#06# screen) is just digits on a display, not itself a scannable code,
// so manual entry is the primary path there and camera scanning is the
// primary path for box QR/barcodes — both are always available here.
export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void; switchTorch?: (on: boolean) => Promise<void> } | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;
    detectedRef.current = false;
    setCameraError(null);
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, err, controls) => {
        if (controlsRef.current !== controls) {
          controlsRef.current = controls;
          setHasTorch(!!controls.switchTorch);
        }
        if (cancelled || detectedRef.current) return;
        if (result) {
          detectedRef.current = true;
          controls.stop();
          onDetected(result.getText());
        }
        // NotFoundException fires on every frame with nothing decodable yet — that's normal, not an error.
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Camera access was denied — allow it in your browser settings, or type the code manually."
            : "Couldn't start the camera on this device — type the code manually instead."
        );
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function toggleTorch() {
    if (!controlsRef.current?.switchTorch) return;
    try {
      await controlsRef.current.switchTorch(!torchOn);
      setTorchOn((t) => !t);
    } catch {
      // Torch isn't supported on this device/browser — silently ignore.
    }
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = manualValue.trim();
    if (!trimmed) return;
    onDetected(trimmed);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("camera")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${mode === "camera" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-muted"}`}
        >
          <Camera className="h-4 w-4" /> Scan Camera
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${mode === "manual" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-muted"}`}
        >
          <Keyboard className="h-4 w-4" /> Type Manually
        </button>
      </div>

      {mode === "camera" ? (
        cameraError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {cameraError}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
            <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-gold-400/70" />
            {hasTorch && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full ${torchOn ? "bg-gold-500 text-ink-950" : "bg-ink-900/80 text-cream"}`}
                aria-label="Toggle flashlight"
              >
                <Zap className="h-4 w-4" />
              </button>
            )}
            <p className="absolute inset-x-0 bottom-3 text-center text-xs text-cream/80">Point the camera at the QR/barcode</p>
          </div>
        )
      ) : (
        <form onSubmit={submitManual} className="flex gap-2">
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Enter IMEI or code"
            inputMode="numeric"
            autoFocus
          />
          <Button type="submit">Use Code</Button>
        </form>
      )}
    </div>
  );
}
