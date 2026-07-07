export const ENGLISH_LOCALE = {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: '1 sec',
    ss: '%d sec',
    m: '1 min',
    mm: '%d min',
    h: '1 hour',
    hh: '%d hours',
    d: '1 day',
    dd(number: number) {
      if (number < 7) {
        return `${number} days`;
      }
      const weeks = Math.round(number / 7);
      return `${weeks} weeks`;
    },
    M: '1 month',
    MM: '%d months',
    y: '1 year',
    yy: '%d years',
  },
};

export const VIETNAMESE_LOCALE = {
  relativeTime: {
    future: 'trong %s',
    past: '%s trước',
    s: '1 giây',
    ss: '%d giây',
    m: '1 phút',
    mm: '%d phút',
    h: '1 giờ',
    hh: '%d giờ',
    d: '1 ngày',
    dd(number: number) {
      if (number < 7) {
        return `${number} ngày`;
      }
      const weeks = Math.round(number / 7);
      return `${weeks} tuần`;
    },
    M: '1 tháng',
    MM: '%d tháng',
    y: '1 năm',
    yy: '%d năm',
  },
};

export const LONG_DAYS_TIME = `DD/MM/YYYY HH:mm:ss`;
export const LONG_DAYS_TIME_WIH_DASH = `DD/MM/YYYY - HH:mm:ss`;
export const LONG_DAYS_TIME_NO_SECOND = `DD/MM/YYYY HH:mm`;
export const SHORT_DAYS = `DD/MM/YYYY`;
export const SHORT_TIME = `HH:mm:ss`;
export const LONG_TIME = `HH:mm:ss.SSS`;
