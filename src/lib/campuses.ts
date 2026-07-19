// src/lib/campuses.ts
/**
 * Campus keys + labels for campus-aware retrieval. Corpus PDFs carry a
 * `metadata.campus` tag assigned by ingestion/ingest.py: either a specific
 * campus key, a region tag ("us", "canada", "london"), or "all" for
 * network-wide documents.
 */
export const AVAILABLE_CAMPUSES = {
  boston: "Boston",
  "silicon-valley": "Silicon Valley",
  seattle: "Seattle",
  toronto: "Toronto",
  vancouver: "Vancouver",
  london: "London",
} as const;

export type Campus = keyof typeof AVAILABLE_CAMPUSES;

export const CAMPUS_KEYS = Object.keys(AVAILABLE_CAMPUSES) as Campus[];

export function isCampus(value: string): value is Campus {
  return Object.prototype.hasOwnProperty.call(AVAILABLE_CAMPUSES, value);
}

/**
 * The `metadata.campus` tags relevant to a selected campus. US campuses share
 * the F-1/OGS corpus ("us"); Toronto and Vancouver share the Canadian
 * study-permit corpus ("canada"); London stands alone. "all" documents apply
 * everywhere.
 */
export function campusFilterValues(campus: Campus): string[] {
  switch (campus) {
    case "toronto":
    case "vancouver":
      return ["all", "canada", campus];
    case "london":
      return ["all", "london"];
    default:
      return ["all", "us", campus];
  }
}
