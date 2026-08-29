"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface CollapsedTooltipProps {
  children: ReactNode;
  enabled: boolean;
  label: string;
  className?: string;
}

export function CollapsedTooltip({
  children,
  enabled,
  label,
  className = "",
}: CollapsedTooltipProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const bounds = trigger.getBoundingClientRect();
    setPosition({
      top: bounds.top + bounds.height / 2,
      left: bounds.right + 10,
    });
  }, []);

  function show() {
    if (!enabled) return;
    updatePosition();
    setVisible(true);
  }

  function hide() {
    setVisible(false);
  }

  useEffect(() => {
    if (!enabled || !visible) return;

    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [enabled, updatePosition, visible]);

  return (
    <>
      <div
        className={className}
        onBlur={hide}
        onFocus={show}
        onMouseEnter={show}
        onMouseLeave={hide}
        ref={triggerRef}
      >
        {children}
      </div>

      {enabled && visible && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[200] -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
              role="tooltip"
              style={position}
            >
              {label}
              <span
                aria-hidden
                className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-100"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
