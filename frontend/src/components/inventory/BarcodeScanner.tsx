"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { DecodeHintType, BarcodeFormat } from "@zxing/library";
import { Camera, Keyboard, AlertTriangle, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Fully client-side barcode/QR decoding (ZXing, no network calls) — reads
// the QR/barcode printed on a new mobile's box, or a barcode-printed IMEI
// on a used phone's SIM tray/back panel. Manual entry is always available
// too, since the *#06# on-screen IMEI is just digits, not itself scannable.
//
// ZXing's defaults favor speed over accuracy — fine for a well-lit QR code
// filling the frame, not for a small, slightly skewed barcode sticker under
// a shop's fluorescent lighting. TRY_HARDER plus an explicit rear-camera,
// higher-resolution, continuous-autofocus constraint set is what actually
// makes real-world scanning reliable; ZXing's own defaults were the reason
// scanning wasn't detecting anything.
const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.TRY_HARDER, true],
  [
    DecodeHintType.POSSIBLE_FORMATS,
    [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
      BarcodeFormat.DATA_MATRIX,
    ],
  ],
]);

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    // focusMode isn't in the standard MediaTrackConstraintSet type, but is
    // widely supported — without it many phone cameras default to a fixed
    // focus distance that's wrong for a barcode held close to the lens.
    advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet],
  },
};

export function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [manualValue, setManualValue] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void; switchTorch?: (on: boolean) => Promise<void> } | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (mode !== "camera") return;
    detectedRef.current = false;
    setCameraError(null);
    setStarting(true);
    // TRY_HARDER already makes each attempt more expensive — leave the
    // library's own default pacing between attempts rather than tightening
    // it, so this doesn't stutter on the low-end Android phones a shop
    // counter is likely to actually use.
    const reader = new BrowserMultiFormatReader(HINTS);
    let cancelled = false;

    reader
      .decodeFromConstraints(CAMERA_CONSTRAINTS, videoRef.current ?? undefined, (result, err, controls) => {
        if (controlsRef.current !== controls) {
          controlsRef.current = controls;
          setHasTorch(!!controls.switchTorch);
          setStarting(false);
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
        setStarting(false);
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
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium sm:py-2 ${mode === "camera" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-muted"}`}
        >
          <Camera className="h-4 w-4" /> Scan Camera
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm font-medium sm:py-2 ${mode === "manual" ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-ink-600 text-muted"}`}
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
          <div className="relative aspect-square w-full max-w-full overflow-hidden rounded-xl border border-ink-600 bg-ink-950">
            <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" muted playsInline />
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-950/80 text-cream/80">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-xs">Starting camera…</p>
              </div>
            )}
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
            {!starting && <p className="absolute inset-x-0 bottom-3 text-center text-xs text-cream/80">Point the camera at the QR/barcode</p>}
          </div>
        )
      ) : (
        <form onSubmit={submitManual} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Enter IMEI or code"
            inputMode="numeric"
            autoFocus
            className="flex-1"
          />
          <Button type="submit" className="w-full sm:w-auto">Use Code</Button>
        </form>
      )}
    </div>
  );
}
