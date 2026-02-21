"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Prevents closing by tapping the backdrop (e.g. boost confirmation). */
  disableBackdropClose?: boolean;
}

/**
 * Bottom-sheet modal — slides up from the bottom on a deep aubergine sheet.
 * Per CLAUDE.md §8: "Modals slide up from the bottom on a deep aubergine sheet."
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  disableBackdropClose = false,
}: ModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }
    return () => document.body.classList.remove("modal-open");
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full animate-slide-up rounded-t-2xl bg-aubergine border-t border-white/10 px-4 pb-8 pt-4 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
        {children}
      </div>
    </div>,
    document.body
  );
}
