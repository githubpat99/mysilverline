// src/lib/forecast/buckets.ts
export type Bucket = "LIQ" | "ST" | "LT" | "REAL";
export type Availability = "instant" | "3m_3y" | "gt_3y" | "locked";

export function bucketFromAvailability(a: Availability): Bucket {
  switch (a) {
    case "instant":
      return "LIQ";
    case "3m_3y":
      return "ST";
    case "gt_3y":
      return "LT";
    case "locked":
      return "REAL";
  }
}

export function availabilityFromBucket(b: Bucket): Availability {
  switch (b) {
    case "LIQ":
      return "instant";
    case "ST":
      return "3m_3y";
    case "LT":
      return "gt_3y";
    case "REAL":
      return "locked";
  }
}

export function bucketLabel(b: Bucket): string {
  switch (b) {
    case "LIQ":
      return "Liquidität";
    case "ST":
      return "Kurzfristig";
    case "LT":
      return "Langfristig";
    case "REAL":
      return "Sachwerte";
    default:
      return b;
  }
}