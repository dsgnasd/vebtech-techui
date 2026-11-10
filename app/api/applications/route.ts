import { z } from "zod";
import content from "../../source-content.json";

// Prototype receipt adapter. No bank connection, durable queue, file upload,
// personal-data logging or actual account-opening operation is performed.
const application = z.object({
  requestId: z.string().uuid(),
  applicant: z.object({
    kind: z.enum(["ip", "company"]),
    unp: z.string().regex(/^\d{9}$/),
    phone: z.string().max(30).refine(value => /^375(25|29|33|44)\d{7}$/.test(value.replace(/\D/g, ""))),
  }),
  soleFounder: z.enum(["", "yes", "no"]),
  standardCharter: z.enum(["", "yes", "no"]),
  activityCode: z.string().refine(value => content.activities.some(item => item.code === value)),
  accounts: z.array(z.string().refine(value => value in content.currencies)).min(1).max(11).refine(values => values.includes("BYN") && new Set(values).size === values.length),
  packageId: z.string(),
  payroll: z.object({
    enabled: z.enum(["yes", "no"]),
    currencies: z.array(z.string().refine(value => content.payrollCurrencies.some(item => item.code === value))).max(4),
  }),
  officeId: z.string().refine(value => content.offices.some(item => item.id === value)),
  documents: z.array(z.object({
    name: z.string().min(1).max(255).regex(/\.(pdf|rtf|png|jpe?g|heic|heif)$/i),
    size: z.number().int().min(1).max(30 * 1024 * 1024),
    type: z.string().max(120),
  })).min(1).max(40),
  termsAccepted: z.literal(true),
  confirmationsAccepted: z.literal(true),
}).superRefine((value, context) => {
  const category = value.applicant.kind === "company" ? "company" : "entrepreneur";
  if (!content.packages.some(item => item.id === value.packageId && item.category === category)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["packageId"], message: "Выберите пакет услуг" });
  if (category === "company" && (!value.soleFounder || !value.standardCharter)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["soleFounder"], message: "Ответьте на этот вопрос" });
  if (value.payroll.enabled === "yes" && !value.payroll.currencies.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["payroll"], message: "Выберите валюту для пакета" });
});

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 128_000) return Response.json({ error: "Не удалось отправить заявку" }, { status: 413 });
    const parsed = application.safeParse(JSON.parse(body));
    if (!parsed.success) return Response.json({ error: "Не удалось отправить заявку" }, { status: 400 });
    const receivedAt = new Date().toISOString();
    return Response.json({
      mode: "prototype",
      reference: `БВ-${receivedAt.slice(0, 4)}-${parsed.data.requestId.slice(0, 8).toUpperCase()}`,
      status: "processing",
      receivedAt,
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Не удалось отправить заявку" }, { status: 400 });
  }
}
