/**
 * Parse user mission command into structured research requirements.
 * Never defaults to SaaS unless the user asked for it.
 */

export interface MissionRequirements {
  rawGoal: string;
  category: string;
  location: string | null;
  quantity: number | null;
  qualification: string | null;
  searchQueries: string[];
  mustMatchTerms: string[];
  excludeTerms: string[];
}

const LOCATION_HINTS =
  /\b(in|near|around|at)\s+([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,3}|[A-Za-z]+(?:\s+[A-Za-z]+){0,2})\b/;

const QUANTITY_HINTS = /\b(\d{1,3})\b/;

function extractCategory(goal: string): string {
  const g = goal.trim();
  let rest = g
    .replace(/^(find|research|search for|look for|get|list|discover|identify)\s+/i, "")
    .trim();
  rest = rest.replace(/^\d{1,3}\s+/, "").trim();
  rest = rest.split(/\b(?:in|near|around|at|for|that|who|which|with)\b/i)[0].trim();
  rest = rest.replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();
  if (rest.length >= 2) return rest;
  return g.replace(/\d+/g, "").trim() || "businesses";
}

function extractLocation(goal: string): string | null {
  const m = goal.match(LOCATION_HINTS);
  if (m?.[2]) {
    const loc = m[2].trim();
    if (/^(that|who|which|need|needs|may|the|a|an)\b/i.test(loc)) return null;
    return loc;
  }
  const known = goal.match(
    /\b(Lucknow|Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Pune|Kolkata|Jaipur|Ahmedabad|California|Texas|New York|Florida|Germany|UK|United States|USA|India|London|Dubai|Singapore)\b/i
  );
  return known ? known[1] : null;
}

function extractQuantity(goal: string): number | null {
  const m = goal.match(QUANTITY_HINTS);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n >= 1 && n <= 200) return n;
  return null;
}

function extractQualification(goal: string): string | null {
  const m = goal.match(/\b(?:that|who|which)\s+(.+)$/i);
  if (m?.[1]) return m[1].trim().replace(/[.,]+$/, "");
  if (/need|want|looking for|automation|website|marketing/i.test(goal)) {
    const idx = goal.search(/\b(need|want|looking for|may need)/i);
    if (idx >= 0) return goal.slice(idx).trim();
  }
  return null;
}

/** Category-aware query expansions (search terms only — not hardcoded results) */
function categorySearchHints(category: string, location: string | null): string[] {
  const c = category.toLowerCase();
  const loc = location || "";
  const out: string[] = [];

  if (/restaurant|cafe|café|food|dining|bakery/i.test(c)) {
    out.push(`${category} ${loc} zomato`.trim());
    out.push(`best ${category} in ${loc}`.trim());
    out.push(`${loc} ${category} directory`.trim());
  } else if (/gym|fitness|yoga/i.test(c)) {
    out.push(`${category} ${loc}`.trim());
    out.push(`best gyms fitness centers ${loc}`.trim());
  } else if (/real estate|realtor|property|broker/i.test(c)) {
    out.push(`${category} ${loc}`.trim());
    out.push(`real estate agencies ${loc}`.trim());
  } else if (/agency|agencies|marketing|dental|dentist/i.test(c)) {
    out.push(`${category} ${loc}`.trim());
    out.push(`${category} near ${loc}`.trim());
  } else if (/skincare|ecommerce|e-commerce|brand/i.test(c)) {
    out.push(`${category} online store`.trim());
    out.push(`${category} brands list`.trim());
  } else if (/saas|software/i.test(c)) {
    out.push(`${category} ${loc} companies`.trim());
    out.push(`list of ${category} ${loc}`.trim());
  }

  return out.filter(Boolean);
}

export function parseMissionRequirements(goal: string): MissionRequirements {
  const rawGoal = goal.trim();
  const category = extractCategory(rawGoal);
  const location = extractLocation(rawGoal);
  const quantity = extractQuantity(rawGoal);
  const qualification = extractQualification(rawGoal);

  const queries: string[] = [rawGoal];

  if (location) {
    queries.push(`${category} ${location}`);
    queries.push(`best ${category} in ${location}`);
    queries.push(`${category} in ${location} list`);
    queries.push(`${category} near ${location}`);
  } else {
    queries.push(category);
    queries.push(`list of ${category}`);
    queries.push(`${category} companies`);
  }

  queries.push(...categorySearchHints(category, location));

  if (qualification) {
    queries.push(
      location
        ? `${category} ${location} ${qualification}`
        : `${category} ${qualification}`
    );
  }

  const mustMatchTerms = category
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|with|that)$/.test(w));

  // Singular/plural variants
  for (const t of [...mustMatchTerms]) {
    if (t.endsWith("s") && t.length > 4) mustMatchTerms.push(t.slice(0, -1));
    else if (!t.endsWith("s")) mustMatchTerms.push(t + "s");
  }

  const askedSoftware =
    /saas|software|app|platform|startup tech|ai tool/i.test(rawGoal);
  const excludeTerms = askedSoftware
    ? []
    : ["saas", "software as a service", "b2b software platform"];

  return {
    rawGoal,
    category,
    location,
    quantity,
    qualification,
    searchQueries: [...new Set(queries.filter(Boolean))].slice(0, 8),
    mustMatchTerms: [...new Set(mustMatchTerms)],
    excludeTerms,
  };
}
