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

/** Extract category phrase after find/research verbs */
function extractCategory(goal: string): string {
  const g = goal.trim();

  // Strip leading verbs
  let rest = g
    .replace(/^(find|research|search for|look for|get|list|discover|identify)\s+/i, "")
    .trim();

  // Remove quantity at start
  rest = rest.replace(/^\d{1,3}\s+/, "").trim();

  // Cut at location preposition
  rest = rest.split(/\b(?:in|near|around|at|for|that|who|which|with)\b/i)[0].trim();

  // Clean leftover
  rest = rest.replace(/\s+/g, " ").replace(/[.,]+$/, "").trim();

  if (rest.length >= 2) return rest;

  // Fallback: full goal without numbers
  return g.replace(/\d+/g, "").trim() || "businesses";
}

function extractLocation(goal: string): string | null {
  const m = goal.match(LOCATION_HINTS);
  if (m?.[2]) {
    const loc = m[2].trim();
    // Avoid capturing "that may need..."
    if (/^(that|who|which|need|needs|may|the|a|an)\b/i.test(loc)) return null;
    return loc;
  }
  // Common city/state names without preposition
  const known =
    goal.match(
      /\b(Lucknow|Mumbai|Delhi|Bangalore|Bengaluru|Hyderabad|Chennai|Pune|Kolkata|California|Texas|New York|Germany|UK|United States|USA|India)\b/i
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

/** Build search queries ONLY from the user's category + location — no SaaS defaults */
export function parseMissionRequirements(goal: string): MissionRequirements {
  const rawGoal = goal.trim();
  const category = extractCategory(rawGoal);
  const location = extractLocation(rawGoal);
  const quantity = extractQuantity(rawGoal);
  const qualification = extractQualification(rawGoal);

  const queries: string[] = [];

  // Primary: exact category + location
  if (location) {
    queries.push(`${category} ${location}`);
    queries.push(`best ${category} in ${location}`);
    queries.push(`${category} ${location} list`);
    queries.push(`${category} near ${location}`);
  } else {
    queries.push(category);
    queries.push(`${category} companies`);
    queries.push(`list of ${category}`);
  }

  if (qualification) {
    queries.push(
      location
        ? `${category} ${location} ${qualification}`
        : `${category} ${qualification}`
    );
  }

  // Always include the raw goal as a query
  queries.unshift(rawGoal);

  const mustMatchTerms = category
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|with|that)$/.test(w));

  // Only exclude SaaS/software when user did NOT ask for it
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
    searchQueries: [...new Set(queries)].slice(0, 6),
    mustMatchTerms,
    excludeTerms,
  };
}
