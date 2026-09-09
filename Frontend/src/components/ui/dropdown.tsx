"use client";

import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size as floatingSize,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
  leading?: ReactNode;
  meta?: string;
  keywords?: string;
  group?: string;
  heading?: boolean;
}

type DropdownSize = "sm" | "md";

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  size?: DropdownSize;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
  triggerClassName?: string;
  compactTrigger?: boolean;
  menuMinWidth?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

const MENU_MAX_HEIGHT = 256;
const GROUPED_MENU_MAX_HEIGHT = 360;
const SEARCH_THRESHOLD = 8;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function optionMatches(option: DropdownOption, clean: string) {
  const haystack = `${option.label} ${option.meta ?? ""} ${option.keywords ?? ""} ${option.value} ${option.group ?? ""}`;
  return haystack.toLocaleLowerCase().includes(clean);
}

function filterDropdownOptions(options: DropdownOption[], query: string): DropdownOption[] {
  const clean = query.trim().toLocaleLowerCase();
  if (!clean) return options;

  const result: DropdownOption[] = [];
  let index = 0;
  while (index < options.length) {
    const option = options[index]!;
    if (option.heading) {
      const heading = option;
      const items: DropdownOption[] = [];
      index += 1;
      while (index < options.length) {
        const next = options[index]!;
        if (next.heading || next.group !== heading.value) break;
        items.push(next);
        index += 1;
      }
      const headingHit = optionMatches(heading, clean);
      const itemHits = items.filter((item) => optionMatches(item, clean));
      if (headingHit || itemHits.length > 0) {
        result.push(heading);
        result.push(...(headingHit ? items : itemHits));
      }
      continue;
    }
    if (optionMatches(option, clean)) result.push(option);
    index += 1;
  }
  return result;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  searchable,
  size = "sm",
  id,
  name,
  required,
  className,
  triggerClassName,
  compactTrigger = false,
  menuMinWidth,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DropdownProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const searchId = `${generatedId}-search`;
  const triggerId = id ?? `${generatedId}-trigger`;
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef("");
  const typeaheadTimer = useRef<number>(0);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [referenceEl, setReferenceEl] = useState<HTMLElement | null>(null);
  const [floatingEl, setFloatingEl] = useState<HTMLElement | null>(null);

  const selected = options.find((option) => option.value === value);
  const showSearch = searchable ?? options.length >= SEARCH_THRESHOLD;
  const menuMaxHeight = options.some((option) => option.heading) ? GROUPED_MENU_MAX_HEIGHT : MENU_MAX_HEIGHT;
  const filtered = useMemo(() => filterDropdownOptions(options, query), [options, query]);

  function openMenu() {
    const selectedIndex = filtered.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setQuery("");
  }

  const { floatingStyles, context } = useFloating({
    elements: { floating: floatingEl, reference: referenceEl },
    open,
    onOpenChange: (next) => {
      if (next) openMenu();
      else closeMenu();
    },
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(6),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
      floatingSize({
        padding: 8,
        apply({ availableHeight, rects, elements }) {
          Object.assign(elements.floating.style, {
            width: `${Math.max(rects.reference.width, menuMinWidth ?? 0)}px`,
            maxHeight: `${Math.min(menuMaxHeight, Math.max(72, availableHeight))}px`,
          });
        },
      }),
    ],
  });

  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);

  const focusTrigger = useCallback(() => {
    window.setTimeout(() => {
      document.getElementById(triggerId)?.focus();
    }, 0);
  }, [triggerId]);

  const selectOption = useCallback(
    (option: DropdownOption) => {
      if (option.disabled) return;
      onChange(option.value);
      closeMenu();
      focusTrigger();
    },
    [focusTrigger, onChange],
  );

  useEffect(() => {
    if (!open || !showSearch) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    const option = optionRefs.current[activeIndex];
    const listbox = document.getElementById(listboxId);
    if (!option || !listbox) return;
    const optionRect = option.getBoundingClientRect();
    const listboxRect = listbox.getBoundingClientRect();
    if (optionRect.bottom > listboxRect.bottom) {
      listbox.scrollTop += optionRect.bottom - listboxRect.bottom;
    } else if (optionRect.top < listboxRect.top) {
      listbox.scrollTop -= listboxRect.top - optionRect.top;
    }
  }, [activeIndex, open, filtered, listboxId]);

  useEffect(() => {
    return () => window.clearTimeout(typeaheadTimer.current);
  }, []);

  function moveActive(delta: number) {
    if (filtered.length === 0) return;
    setActiveIndex((current) => {
      let next = current;
      for (let step = 0; step < filtered.length; step += 1) {
        next = (next + delta + filtered.length) % filtered.length;
        if (!filtered[next]?.disabled) return next;
      }
      return current;
    });
  }

  function typeahead(character: string) {
    window.clearTimeout(typeaheadTimer.current);
    typeaheadRef.current = `${typeaheadRef.current}${character.toLocaleLowerCase()}`;
    typeaheadTimer.current = window.setTimeout(() => {
      typeaheadRef.current = "";
    }, 500);
    const buffer = typeaheadRef.current;
    const from = activeIndex + 1;
    const pool = [...filtered.slice(from), ...filtered.slice(0, from)];
    const match = pool.find((option) => !option.disabled && option.label.toLocaleLowerCase().startsWith(buffer));
    if (!match) return;
    setActiveIndex(filtered.indexOf(match));
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (open) moveActive(1);
      else openMenu();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (open) moveActive(-1);
      else openMenu();
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) {
        const option = filtered[activeIndex];
        if (option) selectOption(option);
      } else {
        openMenu();
      }
      return;
    }
    if (event.key === "Home" && open) {
      event.preventDefault();
      const index = filtered.findIndex((option) => !option.disabled);
      if (index >= 0) setActiveIndex(index);
      return;
    }
    if (event.key === "End" && open) {
      event.preventDefault();
      for (let index = filtered.length - 1; index >= 0; index -= 1) {
        if (!filtered[index]?.disabled) {
          setActiveIndex(index);
          break;
        }
      }
      return;
    }
    if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      if (!open) openMenu();
      typeahead(event.key);
    }
  }

  function onMenuKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      const index = filtered.findIndex((option) => !option.disabled);
      if (index >= 0) setActiveIndex(index);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      for (let index = filtered.length - 1; index >= 0; index -= 1) {
        if (!filtered[index]?.disabled) {
          setActiveIndex(index);
          break;
        }
      }
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) selectOption(option);
      return;
    }
    if (!showSearch && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      typeahead(event.key);
    }
  }

  const triggerHeight = size === "md" ? "h-12" : "h-11";
  const referenceProps = getReferenceProps();
  const floatingProps = getFloatingProps();

  return (
    <div className={cx("relative min-w-0", className)}>
      {name ? <input name={name} required={required} tabIndex={-1} type="hidden" value={value} /> : null}
      <button
        aria-activedescendant={open && filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-controls={open ? listboxId : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={
          ariaLabel ??
          (compactTrigger && selected ? [selected.label, selected.meta].filter(Boolean).join(" ") : undefined)
        }
        aria-labelledby={ariaLabelledBy}
        className={cx(
          "flex w-full items-center rounded border text-left text-sm outline-none transition",
          triggerHeight,
          triggerClassName
            ? cx(
                triggerClassName,
                open && "border-neutral-500",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
              )
            : cx(
                size === "md" ? "shadow-sm" : "",
                open
                  ? "border-indigo-500 ring-3 ring-indigo-500/10"
                  : "border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-600",
                disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-gray-400 dark:hover:border-gray-500",
                "bg-white px-3.5 dark:bg-gray-800 dark:text-white",
              ),
        )}
        disabled={disabled}
        id={triggerId}
        role="combobox"
        type="button"
        {...referenceProps}
        onClick={(event) => {
          const inherited = referenceProps.onClick;
          if (typeof inherited === "function") inherited(event);
          if (disabled) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={(event) => {
          const inherited = referenceProps.onKeyDown;
          if (typeof inherited === "function") inherited(event);
          onTriggerKeyDown(event);
        }}
        ref={setReferenceEl}
      >
        {selected?.leading ? <span className="mr-2 shrink-0">{selected.leading}</span> : null}
        <span className={cx("min-w-0 flex-1 truncate", selected ? "text-gray-900 dark:text-white" : "text-gray-400")}>
          {selected
            ? compactTrigger
              ? (selected.meta ?? selected.label)
              : [selected.label, selected.meta].filter(Boolean).join(" ")
            : placeholder}
        </span>
        <ChevronDown
          aria-hidden
          className={cx("ml-2 h-4 w-4 shrink-0 text-gray-400 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open ? (
        <FloatingPortal>
          <div
            className="dropdown-menu z-[1200] flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.14),0_2px_8px_rgba(15,23,42,0.06)] dark:border-gray-700 dark:bg-gray-900 dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
            {...floatingProps}
            onKeyDown={(event) => {
              const inherited = floatingProps.onKeyDown;
              if (typeof inherited === "function") inherited(event);
              onMenuKeyDown(event);
            }}
            ref={setFloatingEl}
            style={floatingStyles}
          >
            {showSearch ? (
              <div className="shrink-0 border-b border-gray-100 p-2 dark:border-gray-800">
                <label className="relative block">
                  <span className="sr-only">Search options</span>
                  <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    autoComplete="off"
                    className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-500 focus:bg-white focus:ring-3 focus:ring-indigo-500/10 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:focus:bg-gray-800"
                    id={searchId}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder={options.some((option) => option.heading) ? "Search roles or departments" : "Search"}
                    ref={searchRef}
                    value={query}
                  />
                </label>
              </div>
            ) : null}

            <div
              aria-activedescendant={filtered[activeIndex] ? `${listboxId}-option-${activeIndex}` : undefined}
              aria-labelledby={ariaLabelledBy ?? triggerId}
              className="min-h-0 flex-1 overflow-y-auto p-1"
              id={listboxId}
              role="listbox"
              tabIndex={showSearch ? -1 : 0}
            >
              {filtered.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-gray-500">No matches</p>
              ) : (
                filtered.map((option, index) => {
                  const isSelected = option.value === value;
                  const isActive = index === activeIndex;
                  if (option.heading) {
                    return (
                      <div
                        aria-label={`${option.label} department`}
                        aria-selected={isSelected}
                        className={cx(
                          "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide transition",
                          isActive && !isSelected && "bg-gray-100 dark:bg-gray-800",
                          isSelected && "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
                          !isActive && !isSelected && "text-gray-400 dark:text-gray-500",
                        )}
                        id={`${listboxId}-option-${index}`}
                        key={`${option.value}-${index}`}
                        onClick={() => selectOption(option)}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActiveIndex(index)}
                        ref={(node) => {
                          optionRefs.current[index] = node;
                        }}
                        role="option"
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {isSelected ? <Check aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
                      </div>
                    );
                  }
                  return (
                    <div
                      aria-disabled={option.disabled || undefined}
                      aria-selected={isSelected}
                      className={cx(
                        "flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition",
                        option.disabled && "cursor-not-allowed opacity-40",
                        isActive && !isSelected && "bg-gray-100 dark:bg-gray-800",
                        isSelected && "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                        !isActive && !isSelected && "text-gray-800 dark:text-gray-100",
                      )}
                      id={`${listboxId}-option-${index}`}
                      key={`${option.value}-${index}`}
                      onClick={() => selectOption(option)}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => {
                        if (!option.disabled) setActiveIndex(index);
                      }}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                    >
                      {option.leading ? <span className="shrink-0">{option.leading}</span> : null}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {option.meta ? <span className="shrink-0 text-xs text-gray-400">{option.meta}</span> : null}
                      {isSelected ? <Check aria-hidden className="h-4 w-4 shrink-0" /> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </FloatingPortal>
      ) : null}
    </div>
  );
}
