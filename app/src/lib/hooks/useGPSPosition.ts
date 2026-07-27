'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type GPSStatus = 'idle' | 'acquiring' | 'confirmed' | 'denied' | 'unavailable';
export type GPSPermissionState = 'unknown' | 'granted' | 'prompt' | 'denied' | 'unsupported';

export interface GPSCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export class GPSAcquireError extends Error {
  constructor(
    public readonly kind: 'denied' | 'unavailable' | 'timeout' | 'unsupported',
    message: string,
  ) {
    super(message);
    this.name = 'GPSAcquireError';
  }
}

export interface GPSPosition {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  status: GPSStatus;
  error: string | null;
  permissionState: GPSPermissionState;
  request: () => void;
  requestFresh: () => Promise<GPSCoords>;
}

interface UseGPSPositionOptions {
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
  autoRequestIfGranted?: boolean;
}

const DEFAULT_OPTIONS: Required<UseGPSPositionOptions> = {
  enableHighAccuracy: true,
  timeoutMs: 10000,
  maximumAgeMs: 60000,
  autoRequestIfGranted: true,
};

export function useGPSPosition(options: UseGPSPositionOptions = {}): GPSPosition {
  const {
    enableHighAccuracy,
    timeoutMs,
    maximumAgeMs,
    autoRequestIfGranted,
  } = { ...DEFAULT_OPTIONS, ...options };

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<GPSStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<GPSPermissionState>('unknown');
  const mountedRef = useRef(true);
  const autoRequestedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const acquire = useCallback(
    (maximumAge: number): Promise<GPSCoords> =>
      new Promise<GPSCoords>((resolve, reject) => {
        if (typeof window === 'undefined') {
          reject(new GPSAcquireError('unsupported', 'Geolocation unavailable on server.'));
          return;
        }

        if (!('geolocation' in navigator)) {
          if (mountedRef.current) {
            setStatus('unavailable');
            setError('Geolocation is not supported on this device.');
          }
          reject(
            new GPSAcquireError('unsupported', 'Geolocation is not supported on this device.'),
          );
          return;
        }

        if (mountedRef.current) {
          setStatus('acquiring');
          setError(null);
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords: GPSCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            if (mountedRef.current) {
              setLatitude(coords.latitude);
              setLongitude(coords.longitude);
              setAccuracy(coords.accuracy);
              setStatus('confirmed');
              setError(null);
              setPermissionState('granted');
            }
            resolve(coords);
          },
          (err) => {
            let kind: GPSAcquireError['kind'] = 'unavailable';
            let message = err.message || 'Unable to acquire location.';
            if (err.code === err.PERMISSION_DENIED) {
              kind = 'denied';
              message = 'Location access was denied. Enable it in your browser settings.';
            } else if (err.code === err.POSITION_UNAVAILABLE) {
              kind = 'unavailable';
              message = 'Location unavailable. Move to an area with a clearer GPS signal.';
            } else if (err.code === err.TIMEOUT) {
              kind = 'timeout';
              message = 'Location request timed out. Try again.';
            }

            if (mountedRef.current) {
              if (kind === 'denied') {
                setStatus('denied');
                setPermissionState('denied');
              } else {
                setStatus('unavailable');
              }
              setError(message);
            }
            reject(new GPSAcquireError(kind, message));
          },
          {
            enableHighAccuracy,
            timeout: timeoutMs,
            maximumAge,
          },
        );
      }),
    [enableHighAccuracy, timeoutMs],
  );

  const request = useCallback(() => {
    acquire(maximumAgeMs).catch(() => {
      /* swallowed — state already updated */
    });
  }, [acquire, maximumAgeMs]);

  const requestFresh = useCallback((): Promise<GPSCoords> => acquire(0), [acquire]);

  // Query Permissions API on mount (where supported). This lets us know whether
  // the browser will prompt, is already granted, or has been blocked — WITHOUT
  // triggering the native permission dialog.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('geolocation' in navigator)) {
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setPermissionState('unsupported');
        setStatus('unavailable');
        setError('Geolocation is not supported on this device.');
      });
      return;
    }

    if (!('permissions' in navigator) || !navigator.permissions?.query) {
      // Older Safari has no Permissions API — treat as 'prompt' so the app
      // will show the onboarding modal and let the user trigger the request.
      queueMicrotask(() => {
        if (!mountedRef.current) return;
        setPermissionState('prompt');
      });
      return;
    }

    let status: PermissionStatus | null = null;
    const onChange = () => {
      if (!mountedRef.current || !status) return;
      setPermissionState(status.state as GPSPermissionState);
      if (status.state === 'denied') {
        setStatus('denied');
        setError('Location access was denied. Enable it in your browser settings.');
      }
    };

    navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((result) => {
        if (!mountedRef.current) return;
        status = result;
        setPermissionState(result.state as GPSPermissionState);
        if (result.state === 'denied') {
          setStatus('denied');
          setError('Location access was denied. Enable it in your browser settings.');
        }
        result.addEventListener('change', onChange);
      })
      .catch(() => {
        if (!mountedRef.current) return;
        setPermissionState('prompt');
      });

    return () => {
      if (status) status.removeEventListener('change', onChange);
    };
  }, []);

  // Auto-request position when permission is already granted. This keeps the
  // experience seamless for returning users and avoids an extra tap.
  useEffect(() => {
    if (!autoRequestIfGranted) return;
    if (permissionState !== 'granted') return;
    if (autoRequestedRef.current) return;
    if (status !== 'idle') return;
    autoRequestedRef.current = true;
    queueMicrotask(() => {
      if (!mountedRef.current) return;
      request();
    });
  }, [autoRequestIfGranted, permissionState, status, request]);

  return {
    latitude,
    longitude,
    accuracy,
    status,
    error,
    permissionState,
    request,
    requestFresh,
  };
}
