"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { Button } from "./Button";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Optional footer content (e.g. buttons) */
  footer?: React.ReactNode;
}

function handleKeyDown(e: React.KeyboardEvent, onClose: () => void) {
  if (e.key === "Escape") {
    onClose();
  }
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={(e) => handleKeyDown(e, onClose)}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-[var(--radius-lg)] bg-[var(--color-card-bg)] shadow-xl"
        onClick={handleBackdropClick}
        onKeyDown={(e) => handleKeyDown(e, onClose)}
        role="presentation"
      >
        <div className="p-card flex items-center justify-between border-b border-gray-200">
          <h2 id="modal-title" className="text-lg font-semibold text-[var(--color-text-dark)]">
            {title}
          </h2>
          <Button
            variant="icon"
            aria-label="Close modal"
            onClick={onClose}
            icon={<FiX className="size-5" />}
          />
        </div>
        <div className="p-card">{children}</div>
        {footer ? (
          <div className="p-card flex justify-end gap-2 border-t border-gray-200">{footer}</div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
