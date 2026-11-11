import type { Context } from "./application-model";

export const profiles = ["default", "ooo", "existing-dbo", "no-oked", "no-payroll", "reference-error"] as const;
export type Profile = typeof profiles[number];
export function applicationContext(kind: "ip" | "company", profile: Profile = "default", sla2Minutes: number | null = null): Context {
  return { clientName: kind === "ip" ? "ИП Иванов С. П." : profile === "ooo" ? "ООО «БелВЭБ Инжиниринг»" : "ОДО «БелВЭБ Инжиниринг»", opf: kind === "company" ? profile === "ooo" ? "ООО" : "ОДО" : "", requestOked: profile !== "no-oked", connectPayroll: profile !== "no-payroll", sdboStatus: profile === "existing-dbo" ? "A00" : "", sla2Minutes };
}
export function configuredSlaMinutes(value: string | undefined): number | null { const minutes = Number(value); return Number.isFinite(minutes) && minutes > 0 ? minutes : null; }
export function slaExpired(startedAt: number | null, minutes: number | null, now = Date.now()): boolean { return startedAt !== null && minutes !== null && now >= startedAt + minutes * 60_000; }
