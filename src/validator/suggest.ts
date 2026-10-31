function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}

/** Finds the obvious near match for a misspelt name, or nothing when no candidate is close. */
export function closestName(name: string, candidates: string[]): string | undefined {
  const lowered = name.toLowerCase();
  const allowedDistance = Math.min(2, Math.floor(name.length / 3));
  let best: string | undefined;
  let bestDistance = allowedDistance + 1;
  for (const candidate of candidates) {
    // Lengths alone can rule a candidate out, which keeps a megabyte-long name from freezing the page.
    if (Math.abs(candidate.length - name.length) > allowedDistance) continue;
    const distance = editDistance(lowered, candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}
