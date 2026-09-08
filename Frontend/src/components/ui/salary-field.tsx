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

const currencyTriggerClassName =
  "border-neutral-300 bg-white px-2.5 text-neutral-800 hover:border-neutral-400 focus:border-neutral-500 sm:px-3.5 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:border-gray-500";

function caretFromDigitCount(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index] ?? "")) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return formatted.length;
}

function resolveCurrency(currency: string) {
  return SALARY_CURRENCY_CODES.includes(currency as (typeof SALARY_CURRENCY_CODES)[number])
    ? currency
    : DEFAULT_SALARY_CURRENCY;
}

function SalaryAmountInput({
  amount,
  disabled,
  id,
  invalid,
  onAmountChange,
  placeholder = "0",
  labelledBy,
  ariaLabel,
  className,
}: {
  amount: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  onAmountChange: (value: string) => void;
  placeholder?: string;
  labelledBy?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <input
      aria-invalid={invalid || undefined}
      aria-label={ariaLabel}
      aria-labelledby={labelledBy}
      className={className ?? inputClass}
      disabled={disabled}
      id={id}
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
      placeholder={placeholder}
      type="text"
      value={formatSalaryDigits(amount)}
    />
  );
}

function CurrencySelect({
  currency,
  disabled,
  labelledBy,
  onCurrencyChange,
  triggerClassName,
}: {
  currency: string;
  disabled?: boolean;
  labelledBy: string;
  onCurrencyChange: (value: string) => void;
  triggerClassName?: string;
}) {
  return (
    <div className="w-30 shrink-0 sm:w-34">
      <span className="sr-only" id={labelledBy}>
        Currency
      </span>
      <Dropdown
        aria-labelledby={labelledBy}
        compactTrigger
        disabled={disabled}
        menuMinWidth={260}
        onChange={onCurrencyChange}
        options={CURRENCY_OPTIONS}
        searchable
        triggerClassName={triggerClassName ?? currencyTriggerClassName}
        value={resolveCurrency(currency)}
      />
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="mb-2 flex items-baseline gap-1.5">
      <label className="text-sm font-semibold" htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">(monthly)</span>
    </div>
  );
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

  return (
    <div>
      <FieldLabel htmlFor={amountId} label={label} required={required} />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <CurrencySelect
          currency={currency}
          disabled={disabled}
          labelledBy={currencyLabelId}
          onCurrencyChange={onCurrencyChange}
        />
        <SalaryAmountInput
          amount={amount}
          disabled={disabled}
          id={amountId}
          invalid={invalid}
          onAmountChange={onAmountChange}
        />
      </div>
    </div>
  );
}

export function SalaryRangeField({
  currency,
  minAmount,
  maxAmount,
  onCurrencyChange,
  onMinChange,
  onMaxChange,
  disabled = false,
  invalid = false,
  label = "Salary",
  required = false,
}: {
  currency: string;
  minAmount: string;
  maxAmount: string;
  onCurrencyChange: (value: string) => void;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  label?: string;
  required?: boolean;
}) {
  const generatedId = useId();
  const currencyLabelId = `${generatedId}-currency-label`;
  const minId = `${generatedId}-min`;
  const maxId = `${generatedId}-max`;
  const labelId = `${generatedId}-label`;
  const rangeInputClass =
    "h-11 w-full rounded-xl border border-gray-300 bg-white px-3.5 text-sm outline-none transition placeholder:text-gray-400 focus:border-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500";
  const rangeTriggerClassName =
    "border-gray-300 bg-white px-2.5 hover:border-gray-400 focus:border-indigo-500 sm:px-3.5 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:border-gray-500";

  return (
    <div>
      <div className="mb-2 flex items-baseline gap-1.5">
        <span className="text-sm font-semibold" id={labelId}>
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </span>
        <span className="text-sm font-normal text-neutral-400 dark:text-neutral-500">(monthly)</span>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sm:gap-4">
        <CurrencySelect
          currency={currency}
          disabled={disabled}
          labelledBy={currencyLabelId}
          onCurrencyChange={onCurrencyChange}
          triggerClassName={rangeTriggerClassName}
        />
        <SalaryAmountInput
          amount={minAmount}
          ariaLabel="Minimum salary"
          className={rangeInputClass}
          disabled={disabled}
          id={minId}
          invalid={invalid}
          onAmountChange={onMinChange}
          placeholder="Min"
        />
        <span className="text-sm text-neutral-400 dark:text-neutral-500" aria-hidden>
          –
        </span>
        <SalaryAmountInput
          amount={maxAmount}
          ariaLabel="Maximum salary"
          className={rangeInputClass}
          disabled={disabled}
          id={maxId}
          invalid={invalid}
          onAmountChange={onMaxChange}
          placeholder="Max"
        />
      </div>
    </div>
  );
}
