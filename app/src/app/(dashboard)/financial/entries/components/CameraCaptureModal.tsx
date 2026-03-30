/**
 * CameraCaptureModal Component
 * Sprint 12 — Camera viewfinder with receipt positioning guide.
 * Uses getUserMedia for back camera (mobile) or webcam (desktop).
 * Captures a still frame and returns it as a File to the parent.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, RotateCcw, Check } from 'lucide-react';
import { Modal, ModalActions } from '@/components/ui/Modal';
import Button from '@/components/ui/Button';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

export function CameraCaptureModal({ isOpen, onClose, onCapture }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [retryCount, setRetryCount] = useState(0);

  // Start camera stream
  // Start camera when modal opens or facing mode changes
  // Start/restart camera when modal opens, facing changes, or retry triggered
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    // Stop any existing stream before starting new one
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Use an async IIFE so setState calls happen inside async callbacks (not synchronously)
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1920 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) {
              videoRef.current?.play();
              setCameraReady(true);
            }
          };
        }
      } catch (err: unknown) {
        if (cancelled) return;
        const error = err as { name?: string; message?: string };
        if (error.name === 'NotAllowedError') {
          setCameraError('Camera access denied. Please allow camera access in your browser settings.');
        } else if (error.name === 'NotFoundError') {
          setCameraError('No camera found on this device.');
        } else {
          setCameraError('Unable to access camera. Please check your permissions.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode, retryCount]);

  // Capture the current frame — downscale to OCR-friendly size to avoid large uploads
  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Target: longest side ≤ 1600px — sharp enough for OCR, keeps file ~300-800 KB
    const MAX_DIMENSION = 1600;
    let targetW = video.videoWidth;
    let targetH = video.videoHeight;

    if (targetW > MAX_DIMENSION || targetH > MAX_DIMENSION) {
      if (targetW > targetH) {
        targetH = Math.round((targetH / targetW) * MAX_DIMENSION);
        targetW = MAX_DIMENSION;
      } else {
        targetW = Math.round((targetW / targetH) * MAX_DIMENSION);
        targetH = MAX_DIMENSION;
      }
    }

    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use high-quality downscaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, targetW, targetH);

    // 0.90 quality on a 1600px image ≈ 300-800 KB — plenty for OCR, light on the server
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);
    setCapturedImage(dataUrl);

    // Pause the video
    video.pause();
  };

  // Retake — resume camera
  const handleRetake = () => {
    setCapturedImage(null);
    if (videoRef.current && streamRef.current) {
      videoRef.current.play();
    }
  };

  // Confirm capture — convert to File and pass to parent
  const handleConfirm = useCallback(() => {
    if (!capturedImage) return;

    // Convert data URL to blob
    const byteString = atob(capturedImage.split(',')[1]);
    const mimeType = 'image/jpeg';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    const timestamp = new Date().getTime();
    const file = new File([blob], `receipt-${timestamp}.jpg`, { type: mimeType });

    onCapture(file);
  }, [capturedImage, onCapture]);

  // Switch between front and back camera
  const handleFlipCamera = () => {
    setCameraReady(false);
    setCameraError(null);
    setCapturedImage(null);
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Close and clean up
  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCapturedImage(null);
    setCameraError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Take Photo" size="lg">
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      <div className="space-y-4">
        {cameraError ? (
          /* Error state */
          <div className="text-center py-8">
            <Camera className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-4">
              {cameraError}
            </p>
            <Button variant="secondary" size="sm" onClick={() => {
              setCameraReady(false);
              setCameraError(null);
              setCapturedImage(null);
              setRetryCount((c) => c + 1);
            }}>
              Try Again
            </Button>
          </div>
        ) : (
          /* Camera viewfinder */
          <div className="relative bg-black rounded-lg overflow-hidden">
            {/* Video element */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full aspect-[3/4] sm:aspect-video object-cover ${capturedImage ? 'hidden' : 'block'}`}
            />

            {/* Captured preview */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captured receipt"
                className="w-full aspect-[3/4] sm:aspect-video object-contain bg-black"
              />
            )}

            {/* Receipt positioning guide overlay — only when camera is live */}
            {cameraReady && !capturedImage && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Semi-transparent edges */}
                <div className="absolute inset-0 bg-black/30" />
                {/* Clear center cutout */}
                <div
                  className="absolute left-[10%] right-[10%] top-[8%] bottom-[8%] bg-transparent"
                  style={{
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.3)',
                    borderRadius: '12px',
                  }}
                />
                {/* Corner markers */}
                <div className="absolute left-[10%] top-[8%] w-8 h-8 border-t-3 border-l-3 border-white rounded-tl-lg" style={{ borderWidth: '3px 0 0 3px' }} />
                <div className="absolute right-[10%] top-[8%] w-8 h-8 border-t-3 border-r-3 border-white rounded-tr-lg" style={{ borderWidth: '3px 3px 0 0' }} />
                <div className="absolute left-[10%] bottom-[8%] w-8 h-8 border-b-3 border-l-3 border-white rounded-bl-lg" style={{ borderWidth: '0 0 3px 3px' }} />
                <div className="absolute right-[10%] bottom-[8%] w-8 h-8 border-b-3 border-r-3 border-white rounded-br-lg" style={{ borderWidth: '0 3px 3px 0' }} />
                {/* Guide text */}
                <div className="absolute bottom-[3%] left-0 right-0 text-center">
                  <span className="text-xs font-medium text-white/80 bg-black/40 px-3 py-1 rounded-full">
                    Position receipt within the frame
                  </span>
                </div>
              </div>
            )}

            {/* Loading state before camera is ready */}
            {!cameraReady && !cameraError && !capturedImage && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <Camera className="w-10 h-10 text-gray-400 mx-auto mb-2 animate-pulse" />
                  <p className="text-sm text-gray-400">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        {!cameraError && (
          <div className="flex items-center justify-center gap-3">
            {!capturedImage ? (
              /* Live camera controls */
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleFlipCamera}
                  disabled={!cameraReady}
                  aria-label="Switch camera"
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!cameraReady}
                  className="w-16 h-16 rounded-full border-4 border-white dark:border-gray-300 bg-white dark:bg-gray-200 hover:bg-gray-100 dark:hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 flex items-center justify-center shadow-lg"
                  aria-label="Take photo"
                >
                  <div className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 transition-colors" />
                </button>
                <div className="w-10" /> {/* Spacer for centering */}
              </>
            ) : (
              /* Review controls */
              <>
                <Button variant="secondary" onClick={handleRetake}>
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </Button>
                <Button onClick={handleConfirm}>
                  <Check className="w-4 h-4" />
                  Use Photo
                </Button>
              </>
            )}
          </div>
        )}

        <ModalActions>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
        </ModalActions>
      </div>
    </Modal>
  );
}

export default CameraCaptureModal;
