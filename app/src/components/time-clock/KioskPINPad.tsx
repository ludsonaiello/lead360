'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Delete, CornerDownLeft } from 'lucide-react';

const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 6;

interface KioskPINPadProps {
  onSubmit: (pin: string) => void;
  disabled?: boolean;
  error?: string | null;
  errorVariant?: 'error' | 'warning';
  remainingAttempts?: number | null;
}

export default function KioskPINPad({
  onSubmit,
  disabled = false,
  error,
  errorVariant = 'error',
  remainingAttempts,
}: KioskPINPadProps) {
  const [pin, setPin] = useState('');

  const handleDigit = useCallback(
    (digit: string) => {
      if (disabled) return;
      setPin((prev) => (prev.length < MAX_PIN_LENGTH ? prev + digit : prev));
    },
    [disabled],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setPin((prev) => prev.slice(0, -1));
  }, [disabled]);

  const handleSubmit = useCallback(() => {
    if (disabled || pin.length < MIN_PIN_LENGTH) return;
    onSubmit(pin);
  }, [disabled, pin, onSubmit]);

  // Keyboard support — digits, backspace, enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, handleDigit, handleBackspace, handleSubmit]);

  const canSubmit = pin.length >= MIN_PIN_LENGTH && !disabled;

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xs mx-auto">
      {/* PIN dots display */}
      <div
        className="flex items-center justify-center gap-3 h-14 w-full rounded-xl bg-gray-800/60 border border-gray-700 px-4"
        role="status"
        aria-label={`PIN entry, ${pin.length} of ${MAX_PIN_LENGTH} digits entered`}
        aria-live="polite"
      >
        {Array.from({ length: MAX_PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-3.5 h-3.5 rounded-full transition-all duration-150 ${
              i < pin.length
                ? 'bg-white scale-110'
                : 'bg-gray-600 scale-100'
            }`}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-center" role="alert">
          <p
            className={`text-sm font-medium ${
              errorVariant === 'warning' ? 'text-amber-400' : 'text-red-400'
            }`}
          >
            {error}
          </p>
          {remainingAttempts != null && (
            <p className="text-red-400/70 text-xs mt-1">
              {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>
      )}

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-3 w-full" role="group" aria-label="PIN keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => handleDigit(digit)}
            className="flex items-center justify-center min-h-[72px] min-w-[72px] rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
            aria-label={`digit ${digit}`}
          >
            {digit}
          </button>
        ))}

        {/* Bottom row: Backspace, 0, Enter */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || pin.length === 0}
          onClick={handleBackspace}
          className="flex items-center justify-center min-h-[72px] min-w-[72px] rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-white transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          aria-label="Delete last digit"
        >
          <Delete className="w-6 h-6" />
        </button>

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => handleDigit('0')}
          className="flex items-center justify-center min-h-[72px] min-w-[72px] rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 active:scale-95 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-950"
          aria-label="digit 0"
        >
          0
        </button>

        <button
          type="button"
          tabIndex={-1}
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`flex items-center justify-center min-h-[72px] min-w-[72px] rounded-2xl text-white text-lg font-bold transition-all duration-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-950 ${
            canSubmit
              ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 active:scale-95 focus:ring-emerald-400'
              : 'bg-gray-800 opacity-40 cursor-not-allowed'
          }`}
          aria-label="Submit PIN"
        >
          <CornerDownLeft className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
