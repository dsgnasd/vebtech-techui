import test from "node:test";
import assert from "node:assert/strict";
import { emptyDetails, emptyPerson, requiredDocuments, parseDate, validateDetails, detailsSchema } from "../app/application-model.ts";
import { applicationContext, configuredSlaMinutes, slaExpired } from "../app/application-context.ts";

const validPerson = () => ({ ...emptyPerson(), surname: "Иванов", name: "Иван", patronymic: "Иванович", birthDate: "01.01.90", birthPlace: "Минск", residence: "Минск, улица Ленина, 1", citizenship: "BY", documentType: "03", series: "МР", number: "1234567", issueDate: "01.01.20", issuer: "РОВД", personalNumber: "1234567A123BC4", share: "25,0000" });
const validDetails = () => { const details = emptyDetails(); details.leader = validPerson(); details.otherBeneficiaries = "no"; Object.assign(details.address, { soato: "5000000000", region: "г. Минск", settlementType: "г.", settlement: "Минск", streetType: "ул.", street: "Ленина", house: "1" }); return details; };

test("all five document sets follow client kind, Single and UstavTipical", () => {
  assert.deepEqual(requiredDocuments(false, "", "").map(d => d.code), ["FN_1.1_319"]);
  for (const sole of ["yes", "no"]) for (const charter of ["yes", "no"]) {
    const docs = requiredDocuments(true, sole, charter);
    assert.equal(docs.length, sole === "yes" ? 3 : 4);
    assert.equal(docs[0].code, charter === "yes" ? "FN_1.10_40" : "FN_1.1_324");
    assert.equal(docs.some(d => d.code === "FN_2.2_307-3"), sole === "no");
  }
});
test("a complete company questionnaire passes without optional accountant or beneficiaries", () => assert.deepEqual(validateDetails(validDetails(), "yes"), {}));
test("non-sole founder requires personal data and share", () => {
  const details = validDetails(); assert.equal(validateDetails(details, "no")["details.founders.0.surname"], "Заполните поле"); details.founders = [validPerson()]; assert.deepEqual(validateDetails(details, "no"), {});
});
test("accountant fields are required only for the accountant choice", () => {
  const details = validDetails(); details.accountantType = "director"; assert.deepEqual(validateDetails(details, "yes"), {}); details.accountantType = "accountant"; assert.ok(validateDetails(details, "yes")["details.accountant.birthDate"]); details.accountant = validPerson(); assert.deepEqual(validateDetails(details, "yes"), {});
});
test("beneficiary may be blank, but any filled identity field activates validation", () => {
  const details = validDetails(); details.otherBeneficiaries = "yes"; assert.deepEqual(validateDetails(details, "yes"), {}); details.beneficiaries[0].name = "Иван"; assert.ok(validateDetails(details, "yes")["details.beneficiaries.0.surname"]);
});
test("reference code and resolved settlement cannot contradict each other", () => {
  const details = validDetails(); details.address.settlement = "Брест"; assert.equal(validateDetails(details, "yes")["details.address.soato"], "Введенный код не существует");
});
test("dates validate real calendar days, future dates and minimum accountant age", () => {
  assert.equal(parseDate("31.02.20"), null); assert.ok(parseDate("29.02.20")); assert.equal(parseDate("29.02.21"), null);
  const details = validDetails(); details.accountantType = "accountant"; details.accountant = validPerson(); const year = new Date().getFullYear() % 100; details.accountant.birthDate = `01.01.${String(year - 10).padStart(2,"0")}`; assert.equal(validateDetails(details, "yes")["details.accountant.birthDate"], "Недопустимый формат даты");
});
test("identity number alphabet and share precision are enforced", () => {
  const details = validDetails(); details.founders = [validPerson()]; details.leader.personalNumber = "1234567А123ВС4"; details.founders[0].share = "100,0001"; const errors = validateDetails(details, "no"); assert.equal(errors["details.leader.personalNumber"], "Используйте буквы латинского алфавита"); assert.equal(errors["details.founders.0.share"], "Недопустимый формат");
});
test("founder and beneficiary limits are 30 each", () => { const details = validDetails(); details.founders = Array.from({length:31},validPerson); assert.equal(detailsSchema.safeParse(details).success,false); details.founders.pop(); assert.equal(detailsSchema.safeParse(details).success,true); });
test("context flags and SLA duration have no invented fallback", () => {
  assert.equal(applicationContext("company").opf,"ОДО"); assert.equal(applicationContext("company","ooo").opf,"ООО"); assert.equal(applicationContext("ip","no-oked").requestOked,false); assert.equal(applicationContext("company","no-payroll").connectPayroll,false); assert.equal(applicationContext("company","existing-dbo").sdboStatus,"A00"); assert.equal(configuredSlaMinutes(undefined),null); assert.equal(configuredSlaMinutes("-1"),null); assert.equal(configuredSlaMinutes("30"),30);
});

test("SLA expires at the exact boundary and is disabled until configured", () => {
  assert.equal(slaExpired(1000, 1, 60999), false);
  assert.equal(slaExpired(1000, 1, 61000), true);
  assert.equal(slaExpired(1000, 1, 80000), true);
  assert.equal(slaExpired(1000, null, 80000), false);
  assert.equal(slaExpired(null, 1, 80000), false);
});
