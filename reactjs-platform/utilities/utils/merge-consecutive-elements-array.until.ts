export function mergeCustomSizedElementsArray(array: any[], sizes: number[] = []) {
  const result: any[][] = [];
  let offset = 0;

  if (!Array.isArray(sizes) || sizes.length === 0) {
    result.push(array);
    return result;
  }

  for (const size of sizes) {
    if (typeof size !== 'number' || size <= 0) {
      continue;
    }

    if (offset < array.length) {
      result.push(array.slice(offset, offset + size));
      offset += size;
    } else {
      break;
    }
  }

  if (offset < array.length) {
    result.push(array.slice(offset));
  }

  return result;
}

/**
 * const array = [1, 2, 3, 4, 5, 6, 7, 8];
 * const sizes = [2, 2, 3];
 * const result = mergeCustomSizedElementsArray(array, sizes);
 * Output: [[1, 2], [3, 4], [5, 6, 7]]
 */
