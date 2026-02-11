/**
 * Dialog Component (shadcn/ui style)
 * Dialog/Modal component with shadcn/ui compatible API
 */

'use client';

import React, { Fragment } from 'react';
import { Dialog as HeadlessDialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog
        as="div"
        className="relative z-50"
        onClose={() => onOpenChange?.(false)}
      >
        {children}
      </HeadlessDialog>
    </Transition>
  );
}

export function DialogContent({ children, className = '' }: DialogContentProps) {
  return (
    <>
      {/* Backdrop */}
      <Transition.Child
        as={Fragment}
        enter="ease-out duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="ease-in duration-200"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70" />
      </Transition.Child>

      {/* Dialog container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <HeadlessDialog.Panel
              className={`
                w-full max-w-md transform overflow-visible rounded-lg
                bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl
                border border-gray-200 dark:border-gray-700 transition-all
                ${className}
              `}
            >
              {children}
            </HeadlessDialog.Panel>
          </Transition.Child>
        </div>
      </div>
    </>
  );
}

export function DialogHeader({ children, className = '' }: DialogHeaderProps) {
  return (
    <div className={`flex flex-col space-y-1.5 mb-4 ${className}`}>
      {children}
    </div>
  );
}

export function DialogTitle({ children, className = '' }: DialogTitleProps) {
  return (
    <HeadlessDialog.Title
      as="h3"
      className={`text-lg font-semibold leading-none tracking-tight text-gray-900 dark:text-gray-100 ${className}`}
    >
      {children}
    </HeadlessDialog.Title>
  );
}

export function DialogDescription({ children, className = '' }: DialogDescriptionProps) {
  return (
    <HeadlessDialog.Description
      className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}
    >
      {children}
    </HeadlessDialog.Description>
  );
}

export function DialogFooter({ children, className = '' }: DialogFooterProps) {
  return (
    <div className={`flex items-center justify-end gap-2 mt-6 ${className}`}>
      {children}
    </div>
  );
}

// Trigger is typically a button that opens the dialog - just a passthrough
export function DialogTrigger({ children, ...props }: any) {
  return <>{children}</>;
}
