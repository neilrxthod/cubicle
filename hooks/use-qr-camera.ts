"use client";

import { useEffect, useRef, useState } from "react";
import { decodeVideoFrame } from "@/lib/scan/decode-frame";

async function getRearCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: { facingMode: { ideal: "environment" } } },
    { audio: false, video: true },
  ];
  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("Camera unavailable");
}

export type QrCameraStatus =
  | "idle"
  | "starting"
  | "live"
  | "denied"
  | "unsupported";

/**
 * Rear camera + decode loop. Production only — local dev uses the simulator.
 */
export function useQrCamera({
  enabled,
  paused,
  onCode,
}: {
  enabled: boolean;
  paused: boolean;
  onCode: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pausedRef = useRef(paused);
  const onCodeRef = useRef(onCode);
  const [status, setStatus] = useState<QrCameraStatus>("idle");

  if (!enabled && status !== "idle") {
    setStatus("idle");
  } else if (enabled && status === "idle") {
    setStatus("starting");
  }

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let lastAttempt = 0;
    let decoding = false;
    let video: HTMLVideoElement | null = null;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) setStatus("unsupported");
        return;
      }

      try {
        stream = await getRearCameraStream();
      } catch (error) {
        if (cancelled) return;
        const name = error instanceof DOMException ? error.name : "";
        setStatus(
          name === "NotAllowedError" || name === "PermissionDeniedError"
            ? "denied"
            : "unsupported",
        );
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      try {
        await video.play();
      } catch {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      if (cancelled) return;
      setStatus("live");

      const tick = (now: number) => {
        if (cancelled) return;
        raf = requestAnimationFrame(tick);
        if (pausedRef.current || decoding) return;
        if (now - lastAttempt < 140) return;
        if (!video || video.readyState < 2) return;
        lastAttempt = now;
        decoding = true;
        void decodeVideoFrame(video)
          .then((text) => {
            if (text && !cancelled && !pausedRef.current) {
              onCodeRef.current(text);
            }
          })
          .finally(() => {
            decoding = false;
          });
      };
      raf = requestAnimationFrame(tick);
    }

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (video) video.srcObject = null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [enabled]);

  return { videoRef, status };
}
