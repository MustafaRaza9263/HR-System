"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  children: ReactNode;
  label: string;
  className?: string;
}

export function Tooltip({ children, label, className = "" }: TooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const bounds = trigger.getBoundingClientRect();
    setPosition({
      top: bounds.top - 8,
      left: bounds.left + bounds.width / 2,
    });
  }, []);

  function show() {
    updatePosition();
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  useEffect(() => {
    if (!visible) return;
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [updatePosition, visible]);

  useEffect(() => {
    if (visible) updatePosition();
  }, [label, updatePosition, visible]);

  return (
    <>
      <div
        className={`inline-flex ${className}`.trim()}
        onBlur={hide}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        ref={triggerRef}
      >
        {children}
      </div>

      {visible && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[1200] -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
              role="tooltip"
              style={position}
            >
              {label}
              <span
                aria-hidden
                className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-100"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
