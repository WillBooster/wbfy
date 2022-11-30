import merge from 'deepmerge';

export function overwriteMerge(destinationArray: any[], sourceArray: any[]): any[] {
  return sourceArray;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function combineMerge(target: any[], source: any[], options: any): any[] {
  const destination = [...target];

  for (const [index, item] of source.entries()) {
    if (destination[index] === undefined) {
      destination[index] = options.cloneUnlessOtherwiseSpecified(item, options);
    } else if (options.isMergeableObject(item)) {
      destination[index] = merge(target[index], item, options);
    } else if (!target.includes(item)) {
      destination.push(item);
    }
  }
  return destination;
}
