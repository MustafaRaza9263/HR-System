export function titleCaseUtm(value: string) {
  return value.replace(/[a-z0-9]+/gi, (part) => part.charAt(0).toUpperCase() + part.slice(1));
}

export function formatSource(source: string | null | undefined) {
  const trimmed = (source ?? "").trim();
  return titleCaseUtm(trimmed || "website");
}

export function formatCampaign(campaign: string | null | undefined) {
  const trimmed = (campaign ?? "").trim().toLowerCase();
  if (!trimmed || trimmed === "organic") return "Organic";
  return titleCaseUtm(trimmed);
}

export function formatSourceCampaign(source: string | null | undefined, campaign: string | null | undefined) {
  return `${formatSource(source)} · ${formatCampaign(campaign)}`;
}
