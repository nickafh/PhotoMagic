export function sanitizeAddress(input: string) {
  const s = (input || "").trim();

  // keep letters, numbers, spaces, dashes
  const cleaned = s
    .replace(/[^\w\s-]/g, "") // remove special chars except dash/underscore
    .replace(/\s+/g, "_")     // spaces -> dash
    .replace(/-+/g, "-")      // collapse multiple dashes
    .replace(/_+/g, "_")      // collapse underscores
    .replace(/^-|-$/g, "");   // trim dashes

  return cleaned.slice(0, 100) || "listing";
}

export function pad3(n: number) {
  return String(n).padStart(3, "0");
}