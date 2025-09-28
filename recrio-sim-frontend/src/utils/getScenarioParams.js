export function getScenarioParams() {
  const qs = new URLSearchParams(window.location.search);
  const org = (qs.get("org") || "sga").toLowerCase();          // e.g., "sga"
  const role = (qs.get("role") || "swe").toLowerCase();        // "swe" | "de" | "ml"
  const postingId = qs.get("postingId") || null;
  const applicationId = qs.get("applicationId") || null;
  const ts = qs.get("ts") || null;   // optional (future: signed links)
  const sig = qs.get("sig") || null; // optional (future: signed links)

  return { org, role, postingId, applicationId, ts, sig };
}