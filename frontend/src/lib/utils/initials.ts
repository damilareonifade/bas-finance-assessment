/** "Chidi Okafor" → "CO", "Chidi" → "C". */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : [words[0]];
  return letters.map((word) => word?.[0] ?? '').join('').toUpperCase() || '?';
}
