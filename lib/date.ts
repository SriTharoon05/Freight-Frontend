import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const IST = 'Asia/Kolkata';

export function formatIST(date: string | Date, fmt: string = 'dd MMM yyyy, HH:mm'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const zoned = toZonedTime(d, IST);
  return format(zoned, fmt);
}

export function formatISTDate(date: string | Date): string {
  return formatIST(date, 'dd MMM yyyy');
}

export function formatISTTime(date: string | Date): string {
  return formatIST(date, 'HH:mm');
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}
