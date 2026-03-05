import { format } from "date-fns";

export function formatTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return format(date, "yyyy-MM-dd HH:mm:ss");
}
