/**
 * Formats a date string into a localized display format
 * @param dateString - ISO date string to format
 * @param locale - Locale string (defaults to 'ru-RU' for Russian format)
 * @returns Formatted date string
 */
export function formatDate(dateString: string, locale: string = 'ru-RU'): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return original string on error
  }
}

/**
 * Calculates the number of days between two dates
 * @param startDate - Start date string or Date object
 * @param endDate - End date string or Date object (defaults to today)
 * @returns Number of days between dates (negative if end is before start)
 */
export function getDaysBetween(startDate: string | Date, endDate: string | Date = new Date()): number {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);
  
  // Time difference in milliseconds
  const timeDiff = end.getTime() - start.getTime();
  
  // Convert to days
  return Math.ceil(timeDiff / (1000 * 3600 * 24));
}

/**
 * Returns a relative time string (e.g., "2 days ago", "in 3 months")
 * @param dateString - ISO date string
 * @param locale - Locale for formatting (defaults to 'ru-RU')
 * @returns Localized relative time string
 */
export function getRelativeTimeString(dateString: string, locale: string = 'ru-RU'): string {
  try {
    const date = new Date(dateString);
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    
    const now = new Date();
    const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
    
    // Different time units in seconds
    const minute = 60;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;
    
    // Determine the appropriate unit
    if (Math.abs(diffInSeconds) < minute) {
      return rtf.format(Math.round(diffInSeconds), 'second');
    } else if (Math.abs(diffInSeconds) < hour) {
      return rtf.format(Math.round(diffInSeconds / minute), 'minute');
    } else if (Math.abs(diffInSeconds) < day) {
      return rtf.format(Math.round(diffInSeconds / hour), 'hour');
    } else if (Math.abs(diffInSeconds) < week) {
      return rtf.format(Math.round(diffInSeconds / day), 'day');
    } else if (Math.abs(diffInSeconds) < month) {
      return rtf.format(Math.round(diffInSeconds / week), 'week');
    } else if (Math.abs(diffInSeconds) < year) {
      return rtf.format(Math.round(diffInSeconds / month), 'month');
    } else {
      return rtf.format(Math.round(diffInSeconds / year), 'year');
    }
  } catch (error) {
    console.error('Error calculating relative time:', error);
    return formatDate(dateString, locale); // Fall back to formatted date
  }
}