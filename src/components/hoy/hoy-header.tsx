"use client";

import { eyebrowHoy } from "@/lib/date";

export function HoyHeader({ today, count }: { today: Date; count: number }) {
  const titulo =
    count === 0
      ? "Todo al día"
      : `${count} seguimiento${count === 1 ? "" : "s"}`;

  return (
    <header>
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-text-subtle">
        {eyebrowHoy(today)}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-text">{titulo}</h1>
    </header>
  );
}
