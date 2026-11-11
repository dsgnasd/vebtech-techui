import { z } from "zod";
import content from "../../source-content.json";
import { detailsSchema, requiredDocuments, validateDetails } from "../../application-model";
import { applicationContext, configuredSlaMinutes, profiles, slaExpired } from "../../application-context";

// Prototype receipt adapter. No bank connection, durable queue, file upload,
// personal-data logging or actual account-opening operation is performed.
const application = z.object({
  requestId: z.string().uuid(),
  profile: z.enum(profiles).default("default"),
  startedAt: z.number().int().positive(),
  details: detailsSchema.optional(),
  applicant: z.object({
    kind: z.enum(["ip", "company"]),
    unp: z.string().regex(/^\d{9}$/),
    phone: z.string().max(30).refine(value => /^375(25|29|33|44)\d{7}$/.test(value.replace(/\D/g, ""))),
  }),
  soleFounder: z.enum(["", "yes", "no"]),
  standardCharter: z.enum(["", "yes", "no"]),
  activityCode: z.string(),
  accounts: z.array(z.string().refine(value => value in content.currencies)).min(1).max(10).refine(values => values.includes("BYN") && new Set(values).size === values.length),
  packageId: z.string(),
  payroll: z.object({
    enabled: z.enum(["yes", "no"]),
    currencies: z.array(z.string().refine(value => content.payrollCurrencies.some(item => item.code === value))).max(4),
  }),
  officeId: z.string().refine(value => content.offices.some(item => item.id === value)),
  documents: z.array(z.object({
    documentCode: z.string(),
    name: z.string().min(1).max(255).regex(/\.(pdf|rtf|jpe?g|heic|heif)$/i),
    size: z.number().int().min(1).max(30 * 1024 * 1024),
    type: z.string().max(120),
  })).min(1).max(40),
  termsAccepted: z.literal(true),
  confirmationsAccepted: z.literal(true),
}).superRefine((value, context) => {
  const config = applicationContext(value.applicant.kind, value.profile);
  if (config.requestOked && !content.activities.some(item => item.code === value.activityCode)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["activityCode"], message: "Необходимо указать вид деятельности" });
  if (value.applicant.kind === "company") {
    if (!value.details) context.addIssue({ code: z.ZodIssueCode.custom, path: ["details"], message: "Заполните поле" });
    else for (const [path, message] of Object.entries(validateDetails(value.details, value.soleFounder))) context.addIssue({ code: z.ZodIssueCode.custom, path: path.split("."), message });
  }
  const required = requiredDocuments(value.applicant.kind === "company", value.soleFounder, config.opf === "ООО" ? value.standardCharter : "no");
  for (const doc of required) if (!value.documents.some(file => file.documentCode === doc.code)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: `Необходимо загрузить ${doc.name}` });
  if (value.documents.some(file => !required.some(doc => doc.code === file.documentCode))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["documents"], message: "Недопустимый комплект документов" });
  const category = value.applicant.kind === "company" ? "company" : "entrepreneur";
  if (!content.packages.some(item => item.id === value.packageId && item.category === category)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["packageId"], message: "Выберите пакет услуг" });
  if (category === "company" && (!value.soleFounder || (config.opf === "ООО" && !value.standardCharter))) context.addIssue({ code: z.ZodIssueCode.custom, path: ["soleFounder"], message: "Ответьте на этот вопрос" });
  if (config.connectPayroll && value.payroll.enabled === "yes" && !value.payroll.currencies.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ["payroll"], message: "Выберите валюту(-ы) зарплатного проекта." });
});

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 128_000) return Response.json({ error: "Не удалось отправить заявку" }, { status: 413 });
    const parsed = application.safeParse(JSON.parse(body));
    if (!parsed.success) return Response.json({ error: "Не удалось отправить заявку" }, { status: 400 });
    const minutes = configuredSlaMinutes(process.env.SLA2_MINUTES);
    if (parsed.data.startedAt > Date.now() + 5000) return Response.json({ error: "Недопустимое время начала" }, { status: 400 });
    if (slaExpired(parsed.data.startedAt, minutes)) return Response.json({ error: "Уважаемый клиент, Вы превысили время, отведённое на предоставление электронных документов", status: "SLA2 истек" }, { status: 408 });
    // Currency-to-account mapping required by UC 1.3 / AS1. No bank call is made.
    const accountTypes = parsed.data.accounts.map(currency => ({ currency, typeId: currency === "BYN" ? "0001" : "0008" }));
    return Response.json({
      accountTypes,
      mode: "prototype",
      status: "processing",
    }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Не удалось отправить заявку" }, { status: 400 });
  }
}
