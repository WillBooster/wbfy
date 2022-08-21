export function sortKeys<T>(obj: any): T {
  const keyAndValues = Object.entries(obj).sort(([key1], [key2]) => key1.localeCompare(key2));
  for (const [key, value] of keyAndValues) {
    delete obj[key];
    obj[key] = value;
  }
  return obj;
}
