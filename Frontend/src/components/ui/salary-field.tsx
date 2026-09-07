"use client";

import { useId } from "react";

import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import {
  DEFAULT_SALARY_CURRENCY,
  formatSalaryDigits,
  parseSalaryDigits,
  SALARY_CURRENCIES,
  SALARY_CURRENCY_CODES,
} from "@/lib/applications/salary";

const CURRENCY_OPTIONS: DropdownOption[] = SALARY_CURRENCIES.map((item) => ({
  value: item.code,
  label: item.name,
  meta: item.code,
  keywords: `${item.code} ${item.name}`,
}));

const inputClass =
  "h-11 w-full rounded border border-neutral-300 bg-white px-3.5 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-neutral-500 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800";

function caretFromDigitCount(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index] ?? "")) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return formatted.length;
}

export function SalaryField({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  disabled = false,
  invalid = false,
  label = "Salary",
  required = false,
}: {
  amount: string;
  currency: string;
  onAmountChange: (value: string) => void;
  onCurrencyChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const currencyLabelId = `${generatedId}-currency-label`;
  const amountId = `${generatedId}-amount`;
  const selectedCurrency = SALARY_CURRENCY_CODES.includes(currency as (typeof SALARY_CURRENCY_CODES)[number])
    ? currency
    : DEFAULT_SALARY_CURRENCY;

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-1.5">
        <label className="text-sm font-semibold" htmlFor={amountId}>
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
        <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">(monthly)</span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <div className="w-30 shrink-0 sm:w-34">
          <span className="sr-only" id={currencyLabelId}>
            Currency
          </span>
          <Dropdown
            aria-labelledby={currencyLabelId}
            compactTrigger
            disabled={disabled}
            menuMinWidth={260}
            onChange={onCurrencyChange}
            options={CURRENCY_OPTIONS}
            searchable
            triggerClassName="border-neutral-300 bg-white px-2.5 text-neutral-800 hover:border-neutral-400 focus:border-neutral-500 sm:px-3.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-500"
            value={selectedCurrency}
          />
        </div>
        <input
          aria-invalid={invalid || undefined}
          className={inputClass}
          disabled={disabled}
          id={amountId}
          inputMode="numeric"
          onChange={(event) => {
            const input = event.target;
            const caret = input.selectionStart ?? input.value.length;
            const digitsBeforeCaret = parseSalaryDigits(input.value.slice(0, caret)).length;
            const next = parseSalaryDigits(input.value);
            onAmountChange(next);
            requestAnimationFrame(() => {
              const formatted = formatSalaryDigits(next);
              const nextCaret = caretFromDigitCount(formatted, digitsBeforeCaret);
              input.setSelectionRange(nextCaret, nextCaret);
            });
          }}
          placeholder="0"
          type="text"
          value={formatSalaryDigits(amount)}
        />
      </div>
    </div>
  );
}
