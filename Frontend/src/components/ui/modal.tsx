"use client";

import { X } from "lucide-react";
import {
  type FormEventHandler,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

const SHEET_QUERY = "(max-width: 767px)";
const OPEN_UNLOCK_MS = 340;
const CLOSE_SHEET_MS = 320;
const CLOSE_DESKTOP_MS = 180;

function isMobileSheet() {
  return window.matchMedia(SHEET_QUERY).matches;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function prepareSheetTransform(panel: HTMLElement | null) {
  if (!panel) return;
  panel.style.setProperty("--hr-sheet-y", `${panel.offsetHeight + 16}px`);
  if (isMobileSheet()) panel.style.height = `${panel.offsetHeight}px`;
}

interface ModalBaseProps {
  title: ReactNode;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode | ((close: () => void) => ReactNode);
  maxWidth?: string;
  height?: string;
  bodyClassName?: string;
  panelClassName?: string;
  closeDisabled?: boolean;
  padded?: boolean;
}

type ModalProps =
  | (ModalBaseProps & { as?: "div"; onSubmit?: never })
  | (ModalBaseProps & { as: "form"; onSubmit: FormEventHandler<HTMLFormElement> });

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
  height = "max-h-[92dvh] md:max-h-[90vh]",
  bodyClassName = "",
  panelClassName = "",
  closeDisabled = false,
  padded = true,
  as = "div",
  onSubmit,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | HTMLFormElement | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [scrollFades, setScrollFades] = useState({ top: false, bottom: false });
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const modalState = isVisible && !isClosing ? "open" : "closed";

  const updateScrollFades = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    const next = {
      top: body.scrollTop > 1,
      bottom: body.scrollTop + body.clientHeight < body.scrollHeight - 1,
    };
    setScrollFades((current) => (current.top === next.top && current.bottom === next.bottom ? current : next));
  }, []);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const mutation = new MutationObserver(updateScrollFades);
    const resize = new ResizeObserver(updateScrollFades);
    body.addEventListener("scroll", updateScrollFades, { passive: true });
    mutation.observe(body, { childList: true, subtree: true, characterData: true });
    resize.observe(body);
    window.addEventListener("resize", updateScrollFades);
    const frame = requestAnimationFrame(updateScrollFades);
    return () => {
      cancelAnimationFrame(frame);
      body.removeEventListener("scroll", updateScrollFades);
      mutation.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [updateScrollFades]);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setIsVisible(true);
      return;
    }
    let openFrame = 0;
    let unlockTimer = 0;
    const measureFrame = requestAnimationFrame(() => {
      const panel = panelRef.current;
      const mobile = isMobileSheet();
      prepareSheetTransform(panel);
      openFrame = requestAnimationFrame(() => {
        setIsVisible(true);
        if (mobile) {
          unlockTimer = window.setTimeout(() => {
            if (panelRef.current) panelRef.current.style.height = "";
          }, OPEN_UNLOCK_MS);
        }
      });
    });
    return () => {
      cancelAnimationFrame(measureFrame);
      cancelAnimationFrame(openFrame);
      window.clearTimeout(unlockTimer);
    };
  }, []);

  const handleClose = useCallback(() => {
    if (closeDisabled || isClosing) return;
    if (prefersReducedMotion()) {
      onClose();
      return;
    }
    const mobile = isMobileSheet();
    prepareSheetTransform(panelRef.current);
    setIsClosing(true);
    setIsVisible(false);
    window.setTimeout(onClose, mobile ? CLOSE_SHEET_MS : CLOSE_DESKTOP_MS);
  }, [onClose, closeDisabled, isClosing]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [handleClose]);

  const setPanelRef = useCallback((node: HTMLDivElement | HTMLFormElement | null) => {
    panelRef.current = node;
  }, []);

  if (!mounted) return null;

  const panelClass = [
    "relative flex w-full min-h-0 max-h-full flex-col overflow-hidden rounded-t-3xl border border-gray-200 bg-white shadow-2xl",
    "dark:border-gray-700 dark:bg-gray-900 md:rounded-2xl",
    "hr-modal-panel",
    maxWidth,
    height,
    panelClassName,
  ].join(" ");

  const inner = (
    <>
      <div className="shrink-0">
        <div className="flex justify-center pb-1 pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-700" />
        </div>
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4 dark:border-gray-800 md:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold leading-tight text-gray-950 dark:text-white" id={titleId}>
              {title}
            </h2>
            {subtitle ? <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</div> : null}
          </div>
          <button
            aria-label="Close modal"
            className="icon-button"
            disabled={closeDisabled}
            onClick={handleClose}
            type="button"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-10 bg-linear-to-b from-white to-transparent transition-opacity duration-200 dark:from-gray-900 ${
            scrollFades.top ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-linear-to-t from-white to-transparent transition-opacity duration-200 dark:from-gray-900 ${
            scrollFades.bottom ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`min-h-0 flex-1 overscroll-contain ${padded ? "overflow-y-auto px-5 py-4 md:px-6" : "overflow-hidden"} ${bodyClassName}`}
          ref={bodyRef}
        >
          {children}
        </div>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-gray-200 bg-gray-50 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] dark:border-gray-700 dark:bg-gray-800/70 md:px-6 md:pb-4">
          {typeof footer === "function" ? footer(handleClose) : footer}
        </div>
      ) : null}
    </>
  );

  const panel =
    as === "form" ? (
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className={panelClass}
        data-state={modalState}
        onSubmit={onSubmit}
        ref={setPanelRef}
        role="dialog"
      >
        {inner}
      </form>
    ) : (
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={panelClass}
        data-state={modalState}
        ref={setPanelRef}
        role="dialog"
      >
        {inner}
      </div>
    );

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center overflow-hidden px-0 pt-8 md:items-center md:px-4 md:py-6">
      <div aria-hidden className="hr-modal-backdrop absolute inset-0" data-state={modalState} onClick={handleClose} />
      {panel}
    </div>,
    document.body,
  );
}
