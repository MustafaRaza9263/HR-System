"use client";

import {
  AsYouType,
  formatIncompletePhoneNumber,
  parseIncompletePhoneNumber,
  validatePhoneNumberLength,
} from "libphonenumber-js/min";
import { useId, useState } from "react";
import flags from "react-phone-number-input/flags";
import {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
  parsePhoneNumber,
  type Country,
} from "react-phone-number-input/input";
import en from "react-phone-number-input/locale/en";

import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";

const DEFAULT_COUNTRY: Country = "PK";

const inputClass =
  "h-11 w-full rounded border border-neutral-300 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800";

const COUNTRY_OPTIONS: DropdownOption[] = getCountries()
  .map((code) => {
    const name = en[code] ?? code;
    const callingCode = getCountryCallingCode(code);
    const Flag = flags[code];
    return {
      value: code,
      label: name,
      meta: `+${callingCode}`,
      keywords: `${code} ${callingCode} +${callingCode}`,
      leading: Flag ? (
        <span className="inline-flex h-3.5 w-5 shrink-0 overflow-hidden rounded-xs ring-1 ring-black/10 dark:ring-white/15 [&_svg]:h-full [&_svg]:w-full">
          <Flag title={name} />
        </span>
      ) : undefined,
    };
  })
  .sort((a, b) => {
    if (a.value === DEFAULT_COUNTRY) return -1;
    if (b.value === DEFAULT_COUNTRY) return 1;
    return a.label.localeCompare(b.label);
  });

function countryFromValue(value: string, fallback: Country): Country {
  if (!value) return fallback;
  const parsed = parsePhoneNumber(value);
  if (parsed?.country && isSupportedCountry(parsed.country)) return parsed.country;
  return fallback;
}

function nationalFromE164(value: string, country: Country): string {
  if (!value) return "";
  const parsed = parsePhoneNumber(value);
  if (parsed?.nationalNumber) return String(parsed.nationalNumber);
  const prefix = `+${getCountryCallingCode(country)}`;
  if (value.startsWith(prefix)) return value.slice(prefix.length).replace(/\D/g, "");
  return value.replace(/\D/g, "");
}

function e164FromNational(national: string, country: Country): string {
  const digits = parseIncompletePhoneNumber(national);
  if (!digits) return "";
  const formatted = new AsYouType(country);
  formatted.input(digits);
  return formatted.getNumberValue() ?? `+${getCountryCallingCode(country)}${digits}`;
}

function clampNational(national: string, country: Country): string {
  let digits = parseIncompletePhoneNumber(national);
  while (digits && validatePhoneNumberLength(digits, country) === "TOO_LONG") {
    digits = digits.slice(0, -1);
  }
  return digits;
}

export function PhoneField({
  value,
  onChange,
  disabled = false,
  required = false,
  countryLabel = "Country",
  numberLabel = "Phone",
  autoComplete = "tel",
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  countryLabel?: string;
  numberLabel?: string;
  autoComplete?: string;
  invalid?: boolean;
}) {
  const generatedId = useId();
  const countryLabelId = `${generatedId}-country-label`;
  const numberId = `${generatedId}-number`;
  const [country, setCountry] = useState<Country>(() => countryFromValue(value, DEFAULT_COUNTRY));
  const [national, setNational] = useState(() => nationalFromE164(value, countryFromValue(value, DEFAULT_COUNTRY)));

  function emit(nextNational: string, nextCountry: Country) {
    const next = e164FromNational(nextNational, nextCountry);
    if (next !== value) onChange(next);
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
      <div className="w-30 shrink-0 sm:w-34">
        <span className="mb-2 block whitespace-nowrap text-sm font-semibold" id={countryLabelId}>
          {countryLabel}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        <Dropdown
          aria-labelledby={countryLabelId}
          compactTrigger
          disabled={disabled}
          menuMinWidth={280}
          onChange={(next) => {
            if (!isSupportedCountry(next)) return;
            const nextNational = clampNational(national, next);
            setCountry(next);
            setNational(nextNational);
            emit(nextNational, next);
          }}
          options={COUNTRY_OPTIONS}
          placeholder="Select…"
          searchable
          triggerClassName="border-neutral-300 bg-white px-2.5 text-neutral-800 hover:border-neutral-400 focus:border-neutral-500 sm:px-3.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-500"
          value={country}
        />
      </div>
      <div className="min-w-0">
        <label className="mb-2 block whitespace-nowrap text-sm font-semibold" htmlFor={numberId}>
          {numberLabel}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
        <input
          aria-invalid={invalid || undefined}
          autoComplete={autoComplete}
          className={inputClass}
          disabled={disabled}
          id={numberId}
          inputMode="tel"
          onChange={(event) => {
            const nextNational = clampNational(event.target.value, country);
            setNational(nextNational);
            emit(nextNational, country);
          }}
          type="tel"
          value={formatIncompletePhoneNumber(national, country)}
        />
      </div>
    </div>
  );
}
