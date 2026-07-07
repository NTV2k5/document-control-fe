import { DEFAULT_TIMEZONE } from 'reactjs-platform/utilities/constants';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import updateLocale from 'dayjs/plugin/updateLocale';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isBetween);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(duration);
dayjs.extend(customParseFormat);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);

dayjs.tz.setDefault(DEFAULT_TIMEZONE);

const dayjsWithTZ = (...args: Parameters<typeof dayjs>) => {
  const [input, format] = args;

  if (format) {
    return dayjs.tz(input, format as string, DEFAULT_TIMEZONE);
  }
  return dayjs.tz(input, DEFAULT_TIMEZONE);
};

const dayjsUTC = (...args: Parameters<typeof dayjs>) => {
  const [input, format] = args;

  if (format) {
    return dayjs.utc(input, format as string);
  }
  return dayjs.utc(input);
};

export { dayjsWithTZ as dayjs, dayjsUTC };
