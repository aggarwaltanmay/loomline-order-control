const patterns = [
  ["Machine breakdown", /இயந்திர|மெஷின்|மிஷின்|machine|motor|breakdown/i],
  ["Material delay", /துணி|நூல்|பொருள்|fabric|yarn|material/i],
  ["Quality issue", /தரம்|குறை|பிழை|defect|quality|reject/i],
  ["Printing delay", /அச்சு|பிரிண்ட்|print/i],
  ["Washing delay", /சலவை|வாஷ்|wash/i],
  ["Staffing", /தொழிலாளர்|வேலைக்கார|ஆள்|staff|worker/i],
];

export function classifyFallback(note) {
  const match = patterns.find(([,re]) => re.test(note));
  return { category: match?.[0] ?? "Needs review", englishSummary: null, confidence: match ? "rule" : "unavailable" };
}
