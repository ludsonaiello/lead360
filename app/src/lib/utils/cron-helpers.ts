/**
 * Cron Expression Helper Functions
 * Convert cron expressions to human-readable formats
 */

/**
 * Convert cron expression to readable format
 * Examples:
 * - "0 6 * * *" → "Daily at 6:00 AM"
 * - "0 0 1 * *" → "Monthly on the 1st at 00:00"
 * - "0 9 * * 1" → "Every Monday at 9:00 AM"
 */
export function cronToReadable(cron: string): string {
  const parts = cron.trim().split(' ');

  if (parts.length !== 5) {
    return cron; // Invalid cron, return as-is
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Helper to format time
  const formatTime = (h: string, m: string) => {
    const hourNum = parseInt(h);
    const minuteNum = parseInt(m);
    const period = hourNum >= 12 ? 'PM' : 'AM';
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    const minuteStr = minuteNum.toString().padStart(2, '0');
    return `${hour12}:${minuteStr} ${period}`;
  };

  // Daily (every day)
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    if (minute.startsWith('*/')) {
      const interval = minute.substring(2);
      return `Every ${interval} minutes`;
    }
    if (hour.startsWith('*/')) {
      const interval = hour.substring(2);
      return `Every ${interval} hours`;
    }
    if (minute === '0' && hour !== '*') {
      return `Daily at ${formatTime(hour, '0')}`;
    }
    return `Daily at ${formatTime(hour, minute)}`;
  }

  // Weekly (specific day of week)
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[parseInt(dayOfWeek)] || dayOfWeek;
    return `Every ${dayName} at ${formatTime(hour, minute)}`;
  }

  // Monthly (specific day of month)
  if (dayOfMonth !== '*' && month === '*' && dayOfWeek === '*') {
    const daySuffix = (day: number) => {
      if (day > 3 && day < 21) return 'th';
      switch (day % 10) {
        case 1: return 'st';
        case 2: return 'nd';
        case 3: return 'rd';
        default: return 'th';
      }
    };
    const dayNum = parseInt(dayOfMonth);
    return `Monthly on the ${dayNum}${daySuffix(dayNum)} at ${formatTime(hour, minute)}`;
  }

  // Weekly on specific days (e.g., "1-5" for weekdays)
  if (dayOfMonth === '*' && month === '*' && dayOfWeek.includes('-')) {
    const [start, end] = dayOfWeek.split('-').map(Number);
    if (start === 1 && end === 5) {
      return `Weekdays at ${formatTime(hour, minute)}`;
    }
  }

  // Specific months
  if (month !== '*') {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const monthName = months[parseInt(month) - 1] || month;
    if (dayOfMonth !== '*') {
      return `${monthName} ${dayOfMonth} at ${formatTime(hour, minute)}`;
    }
  }

  // Fallback: return the cron expression
  return cron;
}

/**
 * Validate cron expression
 */
export function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(' ');

  if (parts.length !== 5) {
    return false;
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Validate minute (0-59)
  if (!isValidCronField(minute, 0, 59)) return false;

  // Validate hour (0-23)
  if (!isValidCronField(hour, 0, 23)) return false;

  // Validate day of month (1-31)
  if (!isValidCronField(dayOfMonth, 1, 31)) return false;

  // Validate month (1-12)
  if (!isValidCronField(month, 1, 12)) return false;

  // Validate day of week (0-7, 0 and 7 are Sunday)
  if (!isValidCronField(dayOfWeek, 0, 7)) return false;

  return true;
}

/**
 * Validate individual cron field
 */
function isValidCronField(field: string, min: number, max: number): boolean {
  // Wildcard
  if (field === '*') return true;

  // Step values (*/n)
  if (field.startsWith('*/')) {
    const step = parseInt(field.substring(2));
    return !isNaN(step) && step > 0 && step <= max;
  }

  // Range (n-m)
  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start < end;
  }

  // List (n,m,o)
  if (field.includes(',')) {
    const values = field.split(',').map(Number);
    return values.every((val) => !isNaN(val) && val >= min && val <= max);
  }

  // Single value
  const value = parseInt(field);
  return !isNaN(value) && value >= min && value <= max;
}

/**
 * Get common cron presets
 */
export function getCronPresets() {
  return [
    { label: 'Every minute', cron: '* * * * *' },
    { label: 'Every 5 minutes', cron: '*/5 * * * *' },
    { label: 'Every 15 minutes', cron: '*/15 * * * *' },
    { label: 'Every 30 minutes', cron: '*/30 * * * *' },
    { label: 'Every hour', cron: '0 * * * *' },
    { label: 'Every 2 hours', cron: '0 */2 * * *' },
    { label: 'Every 6 hours', cron: '0 */6 * * *' },
    { label: 'Every 12 hours', cron: '0 */12 * * *' },
    { label: 'Daily at midnight', cron: '0 0 * * *' },
    { label: 'Daily at 6:00 AM', cron: '0 6 * * *' },
    { label: 'Daily at 12:00 PM', cron: '0 12 * * *' },
    { label: 'Daily at 6:00 PM', cron: '0 18 * * *' },
    { label: 'Weekdays at 8:00 AM', cron: '0 8 * * 1-5' },
    { label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1' },
    { label: 'Every Sunday at midnight', cron: '0 0 * * 0' },
    { label: 'Monthly on 1st at midnight', cron: '0 0 1 * *' },
    { label: 'Monthly on 15th at noon', cron: '0 12 15 * *' },
  ];
}
