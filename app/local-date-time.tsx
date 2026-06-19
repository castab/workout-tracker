"use client";

type LocalDateTimeProps = {
  isoString: string;
  fallback: string;
  weekday?: "short";
  className?: string;
};

export function LocalDateTime({ isoString, fallback, weekday, className }: LocalDateTimeProps) {
  const formattedDate = typeof window === "undefined"
    ? fallback
    : new Intl.DateTimeFormat("en", {
        weekday,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(isoString));

  return (
    <time dateTime={isoString} className={className} suppressHydrationWarning>
      {formattedDate}
    </time>
  );
}
