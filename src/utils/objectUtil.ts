export function sortKeys<T extends Record<string, unknown>>(obj: T): T {
  const keyAndValues = Object.entries(obj).sort(([key1], [key2]) => key1.localeCompare(key2));
  for (const [key, value] of keyAndValues) {
    delete obj[key];
    (obj as Record<string, unknown>)[key] = value;
  }
  return obj;
}
