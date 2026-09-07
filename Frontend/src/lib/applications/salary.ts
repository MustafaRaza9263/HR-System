export const DEFAULT_SALARY_CURRENCY = "PKR";

export const SALARY_CURRENCIES = [
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "AED", name: "UAE Dirham" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "INR", name: "Indian Rupee" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "JPY", name: "Japanese Yen" },
] as const;

export const SALARY_CURRENCY_CODES = SALARY_CURRENCIES.map((item) => item.code);

const MAX_SALARY_DIGITS = 15;

export function parseSalaryDigits(raw: string) {
  return raw.replace(/\D/g, "").slice(0, MAX_SALARY_DIGITS);
}

export function formatSalaryDigits(digits: string) {
  const clean = parseSalaryDigits(digits);
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatSalaryAmount(value: number, currency?: string | null) {
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  return currency ? `${currency} ${amount}` : amount;
}
