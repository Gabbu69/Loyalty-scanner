import type { ActivityKind, Member } from "@/lib/data/types";

export function formatDateTime(value: string, timezone = "Asia/Manila") {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatRelative(value: string) {
  const deltaSeconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const intervals: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, seconds] of intervals) {
    if (Math.abs(deltaSeconds) >= seconds) {
      return formatter.format(Math.round(deltaSeconds / seconds), unit);
    }
  }
  return "just now";
}

export function maskPhone(phone: string | null) {
  if (!phone) return "No phone added";
  if (phone.includes("•")) return phone;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : phone;
}

export function displayPhone(member: Pick<Member, "phone" | "maskedPhone">) {
  return member.maskedPhone || maskPhone(member.phone);
}

export function activityLabel(kind: ActivityKind) {
  return {
    earn: "Visit points",
    redeem: "Reward redeemed",
    adjustment: "Manual adjustment",
    reversal: "Reversal",
    blocked: "Duplicate blocked",
    reissue: "Card reissued",
  }[kind];
}
