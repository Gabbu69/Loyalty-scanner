"use client";

import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  LoaderCircle,
  RefreshCw,
  ScanLine,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const LOYALTY_TOKEN_PATTERN = /^ls1_[A-Za-z0-9_-]{43}$/;

export type QrScannerStatus =
  | "idle"
  | "requesting"
  | "scanning"
  | "paused"
  | "invalid"
  | "permission-denied"
  | "unavailable"
  | "error";

export type QrScannerProps = {
  onDetected: (token: string) => void | Promise<void>;
  active?: boolean;
  testToken?: string | null;
  onStatusChange?: (status: QrScannerStatus) => void;
  className?: string;
};

type ScannerControls = {
  stop: () => void;
};

type CameraFailure = {
  status: Extract<
    QrScannerStatus,
    "permission-denied" | "unavailable" | "error"
  >;
  message: string;
};

export function isLoyaltyToken(value: string) {
  return LOYALTY_TOKEN_PATTERN.test(value.trim());
}

function stopVideoStream(video: HTMLVideoElement | null) {
  const stream = video?.srcObject;
  if (typeof MediaStream !== "undefined" && stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop());
  }

  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

function stopControls(controls: ScannerControls | null) {
  try {
    controls?.stop();
  } catch {
    // ZXing can already be stopped after a successful decode.
  }
}

function classifyCameraFailure(error: unknown): CameraFailure {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return {
      status: "permission-denied",
      message:
        "Camera access was blocked. Allow camera access in your browser settings, then try again.",
    };
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      status: "unavailable",
      message:
        "No camera was found on this device. Use manual customer lookup instead.",
    };
  }

  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      status: "error",
      message:
        "The camera is busy in another app. Close the other app, then try again.",
    };
  }

  return {
    status: "error",
    message:
      "The camera could not start. Check your connection and browser permissions, then try again.",
  };
}

export function QrScanner({
  onDetected,
  active = true,
  testToken,
  onStatusChange,
  className,
}: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const onStatusChangeRef = useRef(onStatusChange);
  const [status, setStatus] = useState<QrScannerStatus>(
    active ? "requesting" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [session, setSession] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const changeStatus = useCallback((nextStatus: QrScannerStatus) => {
    setStatus(nextStatus);
    onStatusChangeRef.current?.(nextStatus);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let decoded = false;
    let controls: ScannerControls | null = null;

    if (!active) {
      queueMicrotask(() => {
        if (!cancelled) changeStatus("idle");
      });
      stopVideoStream(video);
      return;
    }

    async function acceptDecodedValue(rawValue: string, scanControls?: ScannerControls) {
      if (cancelled || decoded) return;
      decoded = true;
      stopControls(scanControls ?? controls);
      stopVideoStream(video);

      const token = rawValue.trim();
      if (!isLoyaltyToken(token)) {
        setMessage(
          "This QR code is not a Loyalty Scan ID. Check the card and scan again.",
        );
        changeStatus("invalid");
        return;
      }

      setMessage(null);
      changeStatus("paused");

      try {
        await onDetectedRef.current(token);
      } catch {
        if (!cancelled) {
          setMessage(
            "The customer could not be checked. Check your connection and try again.",
          );
          changeStatus("error");
        }
      }
    }

    async function startCamera() {
      setMessage(null);

      if (testToken !== undefined && testToken !== null) {
        await acceptDecodedValue(testToken);
        return;
      }

      if (!window.isSecureContext) {
        setMessage(
          "Camera scanning needs a secure HTTPS connection. Use manual lookup on this connection.",
        );
        changeStatus("unavailable");
        return;
      }

      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(
          "Camera scanning is not supported by this browser. Use manual customer lookup instead.",
        );
        changeStatus("unavailable");
        return;
      }

      changeStatus("requesting");

      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (cancelled || !video) return;

        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 200,
          delayBetweenScanSuccess: 1_000,
        });

        controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1_280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result, _error, scanControls) => {
            if (result) {
              void acceptDecodedValue(result.getText(), scanControls);
            }
          },
        );

        if (cancelled) {
          stopControls(controls);
          stopVideoStream(video);
          return;
        }

        if (!decoded) changeStatus("scanning");
      } catch (error) {
        if (cancelled) return;
        const failure = classifyCameraFailure(error);
        setMessage(failure.message);
        changeStatus(failure.status);
        stopVideoStream(video);
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      stopControls(controls);
      stopVideoStream(video);
    };
  }, [active, changeStatus, session, testToken]);

  const retry = () => {
    setMessage(null);
    setSession((current) => current + 1);
  };

  const isFailure =
    status === "invalid" ||
    status === "permission-denied" ||
    status === "unavailable" ||
    status === "error";
  const statusLabel =
    status === "scanning"
      ? "Ready to scan"
      : status === "requesting"
        ? "Starting camera"
        : status === "paused"
          ? "Code captured"
          : status === "idle"
            ? "Scanner paused"
            : "Scanner needs attention";

  return (
    <Card
      data-status={status}
      className={cn("overflow-hidden shadow-none", className)}
    >
      <CardContent className="space-y-0 p-0">
        <div className="relative aspect-[4/3] min-h-72 overflow-hidden bg-slate-950">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Camera preview for scanning a customer loyalty ID"
            className={cn(
              "h-full w-full object-cover transition-opacity",
              status !== "scanning" && "opacity-35",
            )}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(2,6,23,0.28)] sm:inset-12"
          >
            <span className="absolute -left-1 -top-1 size-10 rounded-tl-3xl border-l-4 border-t-4 border-emerald-400" />
            <span className="absolute -right-1 -top-1 size-10 rounded-tr-3xl border-r-4 border-t-4 border-emerald-400" />
            <span className="absolute -bottom-1 -left-1 size-10 rounded-bl-3xl border-b-4 border-l-4 border-emerald-400" />
            <span className="absolute -bottom-1 -right-1 size-10 rounded-br-3xl border-b-4 border-r-4 border-emerald-400" />
            {status === "scanning" ? (
              <span className="absolute inset-x-4 top-1/2 h-0.5 bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)] motion-safe:animate-pulse" />
            ) : null}
          </div>

          <Badge className="absolute left-3 top-3 gap-1.5 bg-slate-950/80 text-white backdrop-blur">
            {status === "scanning" ? <ScanLine /> : null}
            {status === "requesting" ? (
              <LoaderCircle className="animate-spin" />
            ) : null}
            {status === "paused" ? <CheckCircle2 /> : null}
            {status === "idle" || isFailure ? <CameraOff /> : null}
            {statusLabel}
          </Badge>

          {status === "requesting" ? (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              <div className="flex items-center gap-2 rounded-full bg-slate-950/80 px-4 py-2 text-sm font-medium backdrop-blur">
                <LoaderCircle className="size-4 animate-spin" />
                Requesting camera access…
              </div>
            </div>
          ) : null}

          {status === "paused" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-emerald-950 shadow-lg">
                <CheckCircle2 className="size-9" />
              </span>
              <div>
                <p className="text-lg font-bold">Loyalty ID captured</p>
                <p className="text-sm text-white/75">The camera is paused.</p>
              </div>
              <Button type="button" variant="secondary" onClick={retry}>
                <RefreshCw />
                Scan another ID
              </Button>
            </div>
          ) : null}

          {status === "idle" ? (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-white">
              <div>
                <CameraOff className="mx-auto mb-3 size-10 text-white/70" />
                <p className="font-semibold">Camera paused</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 p-4 sm:p-5">
          <p role="status" className="sr-only">
            {statusLabel}. {message}
          </p>
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Camera className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Point the camera at the customer QR</p>
              <p className="text-sm text-muted-foreground">
                Hold the card steady inside the frame. The scanner stops after one code.
              </p>
            </div>
          </div>

          {isFailure && message ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>
                {status === "invalid"
                  ? "Not a Loyalty Scan ID"
                  : status === "permission-denied"
                    ? "Camera permission needed"
                    : status === "unavailable"
                      ? "Camera unavailable"
                      : "Scanner error"}
              </AlertTitle>
              <AlertDescription>{message}</AlertDescription>
              <div className="col-start-2 mt-2">
                <Button type="button" variant="outline" size="sm" onClick={retry}>
                  <RefreshCw />
                  Try again
                </Button>
              </div>
            </Alert>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
