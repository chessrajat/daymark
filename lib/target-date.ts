export function targetDateChange(previous: string | null, next: string | null) {
  return previous === next
    ? ""
    : `Target date changed from ${previous || "Not set"} to ${next || "Not set"}`;
}

export function isOverdue(target: string | null, status: string, today: string) {
  return !!target && target < today && !["Completed", "Dropped"].includes(status);
}
