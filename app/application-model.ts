import { z } from "zod";

export type Answer = "yes" | "no" | "";
export type Context = { clientName: string; opf: string; requestOked: boolean; connectPayroll: boolean; sdboStatus: string; sla2Minutes: number | null };
export const countries = [{ code: "BY", name: "Республика Беларусь" }, { code: "RU", name: "Российская Федерация" }, { code: "KZ", name: "Республика Казахстан" }, { code: "PL", name: "Республика Польша" }, { code: "LT", name: "Литовская Республика" }, { code: "LV", name: "Латвийская Республика" }, { code: "DE", name: "Федеративная Республика Германия" }, { code: "CN", name: "Китайская Народная Республика" }];
export const identityDocuments = [{ code: "03", name: "Паспорт гражданина РБ" }, { code: "06", name: "Вид на жительство в РБ" }, { code: "09", name: "Паспорт гражданина иностранного государства" }, { code: "15", name: "Идентификационная карта гражданина РБ" }, { code: "16", name: "Биометрический вид на жительство в РБ иностранного гражданина" }];
// Small local reference fixtures. Replace with UOS/SOPS reference services in production.
export const settlements = [
  { code: "5000000000", region: "г. Минск", district: "", council: "", type: "г.", name: "Минск" },
  { code: "1401000000", region: "Брестская область", district: "", council: "", type: "г.", name: "Брест" },
  { code: "2401000000", region: "Витебская область", district: "", council: "", type: "г.", name: "Витебск" },
  { code: "3401000000", region: "Гомельская область", district: "", council: "", type: "г.", name: "Гомель" },
  { code: "4401000000", region: "Гродненская область", district: "", council: "", type: "г.", name: "Гродно" },
  { code: "7401000000", region: "Могилевская область", district: "", council: "", type: "г.", name: "Могилев" },
];
export type Person = { surname: string; name: string; patronymic: string; birthDate: string; birthPlace: string; residence: string; citizenship: string; documentType: string; series: string; number: string; issueDate: string; issuer: string; personalNumber: string; share: string; related: Answer; authorized: boolean };
export const emptyPerson = (): Person => ({ surname: "", name: "", patronymic: "", birthDate: "", birthPlace: "", residence: "", citizenship: "", documentType: "", series: "", number: "", issueDate: "", issuer: "", personalNumber: "", share: "", related: "", authorized: false });
export type Address = { soato: string; region: string; district: string; council: string; settlementType: string; settlement: string; streetType: string; street: string; house: string; building: string; office: string; other: string };
export type Details = { address: Address; leader: Person; accountantType: string; accountant: Person; founders: Person[]; otherBeneficiaries: Answer; beneficiaries: Person[] };
export const emptyDetails = (): Details => ({ address: { soato: "", region: "", district: "", council: "", settlementType: "", settlement: "", streetType: "", street: "", house: "", building: "", office: "", other: "" }, leader: emptyPerson(), accountantType: "", accountant: emptyPerson(), founders: [emptyPerson()], otherBeneficiaries: "", beneficiaries: [emptyPerson()] });

const personSchema = z.object({ surname: z.string().max(25), name: z.string().max(15), patronymic: z.string().max(15), birthDate: z.string().max(8), birthPlace: z.string().max(45), residence: z.string().max(70), citizenship: z.string().max(2), documentType: z.string().max(2), series: z.string().max(10), number: z.string().max(15), issueDate: z.string().max(8), issuer: z.string().max(35), personalNumber: z.string().max(14), share: z.string().max(8), related: z.enum(["", "yes", "no"]), authorized: z.boolean() });
export const detailsSchema = z.object({ address: z.object({ soato: z.string().max(10), region: z.string().max(35), district: z.string().max(35), council: z.string().max(35), settlementType: z.string().max(3), settlement: z.string().max(35), streetType: z.string().max(20), street: z.string().max(35), house: z.string().max(6), building: z.string().max(3), office: z.string().max(7), other: z.string().max(35) }), leader: personSchema, accountantType: z.enum(["", "director", "outsourced", "accountant"]), accountant: personSchema, founders: z.array(personSchema).min(1).max(30), otherBeneficiaries: z.enum(["", "yes", "no"]), beneficiaries: z.array(personSchema).min(1).max(30) });
export function parseDate(value: string): Date | null {
  if (!/^\d{2}\.\d{2}\.\d{2}$/.test(value)) return null;
  const [day, month, yy] = value.split(".").map(Number);
  const year = yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy;
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}
export function validateDetails(details: Details, sole: Answer): Record<string, string> {
  const errors: Record<string, string> = {};
  const checkPerson = (person: Person, path: string, shares: boolean, minimumAge: boolean) => {
    const required: (keyof Person)[] = ["surname", "name", "birthDate", "birthPlace", "residence", "citizenship", "documentType", "series", "number", "issueDate", "issuer"];
    if (person.citizenship === "BY") required.push("personalNumber");
    if (shares) required.push("share");
    required.forEach(key => { if (!person[key]) errors[`${path}.${key}`] = "Заполните поле"; });
    (["surname", "name", "patronymic"] as const).forEach(key => { if (person[key] && !/^[А-Яа-яЁёІіЎў\s’'−-]+$/.test(person[key])) errors[`${path}.${key}`] = "Используйте буквы кириллицы"; });
    for (const key of ["birthDate", "issueDate"] as const) {
      if (!person[key]) continue;
      const date = parseDate(person[key]); const today = new Date(); today.setHours(0, 0, 0, 0);
      if (!date || (key === "birthDate" ? date >= today : date > today)) errors[`${path}.${key}`] = "Недопустимый формат даты";
      else if (key === "birthDate" && minimumAge) { const limit = new Date(today); limit.setFullYear(limit.getFullYear() - 15); if (date > limit) errors[`${path}.${key}`] = "Недопустимый формат даты"; }
    }
    if (person.citizenship && !countries.some(c => c.code === person.citizenship)) errors[`${path}.citizenship`] = "Недопустимый формат";
    if (person.documentType && !identityDocuments.some(d => d.code === person.documentType)) errors[`${path}.documentType`] = "Недопустимый формат";
    if (person.personalNumber && person.citizenship === "BY" && !/^\d{7}[A-Za-z]\d{3}[A-Za-z]{2}\d$/.test(person.personalNumber)) errors[`${path}.personalNumber`] = /[А-Яа-яЁёІіЎў]/.test(person.personalNumber) ? "Используйте буквы латинского алфавита" : "Недопустимый формат";
    if (shares && person.share && (!/^\d{1,3}(,\d{1,4})?$/.test(person.share) || Number(person.share.replace(",", ".")) > 100)) errors[`${path}.share`] = "Недопустимый формат";
  };
  const address = details.address;
  (["soato", "streetType", "street", "house"] as const).forEach(key => { if (!address[key]) errors[`details.address.${key}`] = "Заполните поле"; });
  if (address.soato && !settlements.some(s => s.code === address.soato && s.name === address.settlement && s.region === address.region && s.type === address.settlementType && s.district === address.district && s.council === address.council)) errors["details.address.soato"] = /^\d{10}$/.test(address.soato) ? "Введенный код не существует" : "Недопустимый формат";
  if (address.street && !/^[А-Яа-яЁёІіЎў\d\s.,’'()/−-]+$/.test(address.street)) errors["details.address.street"] = "Используйте буквы кириллицы";
  if (address.house && !/^\d{1,6}$/.test(address.house)) errors["details.address.house"] = "Недопустимый формат";
  checkPerson(details.leader, "details.leader", false, false);
  if (details.accountantType === "accountant") checkPerson(details.accountant, "details.accountant", false, true);
  if (sole === "no") details.founders.forEach((person, i) => checkPerson(person, `details.founders.${i}`, true, true));
  if (!details.otherBeneficiaries) errors["details.otherBeneficiaries"] = "Выберите один из вариантов";
  if (details.otherBeneficiaries === "yes") details.beneficiaries.forEach((person, i) => { if (Object.entries(person).some(([key, value]) => !["authorized", "related"].includes(key) && !!value)) checkPerson(person, `details.beneficiaries.${i}`, true, true); });
  return errors;
}
export function requiredDocuments(company: boolean, sole: Answer, charter: Answer) {
  if (!company) return [{ code: "FN_1.1_319", name: "Свидетельство о государственной регистрации индивидуального предпринимателя" }];
  return [
    charter === "yes" ? { code: "FN_1.10_40", name: "Выписка (копия выписки) из ЕГР" } : { code: "FN_1.1_324", name: "Устав и действующие изменения в него" },
    { code: "FN_2.2_307-1", name: "Решение (выписка из решения) о назначении на должность руководителя" },
    { code: "FN_2.2_307-2", name: "Приказ (выписка из приказа) о назначении на должность руководителя" },
    ...(sole !== "yes" ? [{ code: "FN_2.2_307-3", name: "Трудовой договор/контракт (выписка из трудового договора/контракта) с руководителем и действующие изменения в него" }] : []),
  ];
}
export function detailsLines(details: Details, sole: Answer): string[] {
  const personLines = (label: string, person: Person, share = false) => [label, `${person.surname} ${person.name} ${person.patronymic}`, `Дата рождения: ${person.birthDate}`, `Место рождения: ${person.birthPlace}`, `Место жительства и (или) место пребывания: ${person.residence}`, `Гражданство: ${countries.find(c => c.code === person.citizenship)?.name || ""}`, `${identityDocuments.find(d => d.code === person.documentType)?.name || ""}: ${person.series} ${person.number}`, `Дата выдачи: ${person.issueDate}. Кем выдан: ${person.issuer}`, ...(person.citizenship === "BY" ? [`Личный номер резидента: ${person.personalNumber}`] : []), ...(share ? [`Доля в уставном фонде: ${person.share}%`, `Связь с другими организациями: ${person.related === "yes" ? "Да" : "Нет"}`] : [])];
  const a = details.address;
  return ["Место нахождения", `Код СОАТО: ${a.soato}`, [a.region, a.district, a.council, a.settlementType, a.settlement, a.streetType, a.street, a.house, a.building, a.office, a.other].filter(Boolean).join(", "), ...personLines("Данные о руководителе", details.leader), `Лицо, ведущее бухгалтерский учет: ${{director: "директор", outsourced: "организация/ИП, оказывающие услуги по ведению бухгалтерского учета и составлению отчетности", accountant: "главный бухгалтер / бухгалтер"}[details.accountantType] || "Не указано"}`, ...(details.accountantType === "accountant" ? [...personLines("Данные главного бухгалтера / бухгалтера", details.accountant), `Право действовать от имени организации: ${details.accountant.authorized ? "Да" : "Нет"}`, `Связь с другими организациями: ${details.accountant.related === "yes" ? "Да" : "Нет"}`] : []), ...(sole === "no" ? details.founders.flatMap((p, i) => personLines(`Учредитель ${i + 1}`, p, true)) : []), `Есть ли кроме учредителей бенефициарные владельцы? ${details.otherBeneficiaries === "yes" ? "Да" : "Нет"}`, ...(details.otherBeneficiaries === "yes" ? details.beneficiaries.filter(p => p.surname || p.name).flatMap((p, i) => personLines(`Бенефициарный владелец ${i + 1}`, p, true)) : [])];
}
