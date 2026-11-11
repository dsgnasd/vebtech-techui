import { applicationContext, configuredSlaMinutes, profiles, type Profile } from "../../application-context";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const profile = query.get("profile") || "default";
  if (!profiles.includes(profile as Profile)) return Response.json({ error: "Недопустимый профиль" }, { status: 400 });
  if (profile === "reference-error") return Response.json({ error: "Уважаемый клиент, Сервис временно недоступен. Попробуйте, пожалуйста, позже." }, { status: 503 });
  // Prototype context; replace fixtures with authenticated SOPS/MSI/LEGAT values.
  return Response.json(applicationContext(query.get("kind") === "company" ? "company" : "ip", profile as Profile, configuredSlaMinutes(process.env.SLA2_MINUTES)), { headers: { "Cache-Control": "no-store" } });
}
