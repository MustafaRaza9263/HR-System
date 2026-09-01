const SOURCE_KEY = "hr-utm-source";
const CAMPAIGN_KEY = "hr-utm-campaign";

export function captureUtmFromLocation() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const source = params.get("utm_source")?.trim();
  const campaign = params.get("utm_campaign")?.trim();
  if (source) window.sessionStorage.setItem(SOURCE_KEY, source);
  if (campaign) window.sessionStorage.setItem(CAMPAIGN_KEY, campaign);
}

export function getStoredUtm() {
  if (typeof window === "undefined") return { source: "", campaign: "" };
  return {
    source: window.sessionStorage.getItem(SOURCE_KEY) ?? "",
    campaign: window.sessionStorage.getItem(CAMPAIGN_KEY) ?? "",
  };
}
