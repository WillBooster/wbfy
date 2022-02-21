export function sortKeys(obj: any): void {
  const keyAndValues = Object.entries(obj).sort(([key1], [key2]) => key1.localeCompare(key2));
  for (const [key, value] of keyAndValues) {
    delete obj[key];
    obj[key] = value;
  }
}
