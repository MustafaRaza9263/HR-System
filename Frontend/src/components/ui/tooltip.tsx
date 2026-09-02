"use client";

import {
  arrow,
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

interface TooltipProps {
  children: ReactNode;
  label: string;
  className?: string;
  disabled?: boolean;
}

const ARROW_OPPOSITE = {
  top: "bottom",
  right: "left",
  bottom: "top",
  left: "right",
} as const;

export function Tooltip({ children, label, className = "", disabled = false }: TooltipProps) {
  const arrowRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const visible = open && !disabled;

  const { refs, floatingStyles, context, middlewareData, placement } = useFloating({
    middleware: [
      offset(8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      arrow({ element: arrowRef, padding: 6 }),
    ],
    onOpenChange: setOpen,
    open: visible,
    placement: "top",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { enabled: !disabled, move: false });
  const focus = useFocus(context, { enabled: !disabled });
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, role]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const side = (placement.split("-")[0] ?? "top") as keyof typeof ARROW_OPPOSITE;
  const arrowX = middlewareData.arrow?.x;
  const arrowY = middlewareData.arrow?.y;
  const arrowStyle: CSSProperties = {
    left: arrowX == null ? undefined : `${arrowX}px`,
    top: arrowY == null ? undefined : `${arrowY}px`,
    [ARROW_OPPOSITE[side]]: "-4px",
  };

  return (
    <>
      <div
        className={`inline-flex ${className}`.trim()}
        ref={refs.setReference}
        {...getReferenceProps()}
      >
        {children}
      </div>

      {visible ? (
        <FloatingPortal>
          <div
            className="pointer-events-none z-[1200] w-max max-w-[min(20rem,calc(100vw-1rem))] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900"
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
          >
            {label}
            <span
              aria-hidden
              className="absolute h-2 w-2 rotate-45 bg-gray-900 dark:bg-gray-100"
              ref={arrowRef}
              style={arrowStyle}
            />
          </div>
        </FloatingPortal>
      ) : null}
    </>
  );
}
