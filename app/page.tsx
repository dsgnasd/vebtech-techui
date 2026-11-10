"use client";

import { useRef, useState } from "react";
import { Info } from "lucide-react";
import Questionnaire, { ErrorText, Modal } from "./questionnaire";
import content from "./source-content.json";
import copy from "./source-copy.json";

type Kind = "ip" | "company" | "";
type Errors = Partial<Record<"kind" | "unp" | "phone" | "consent" | "fatca" | "owners", string>>;

export default function Home() {
  const [kind, setKind] = useState<Kind>("");
  const [unp, setUnp] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [fatca, setFatca] = useState(false);
  const [owners, setOwners] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [questionnaire, setQuestionnaire] = useState(false);
  const [dialog, setDialog] = useState<"fatca" | "service" | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const company = kind === "company";
  const messages = content.firstErrors;
  const clear = (key: keyof Errors) => setErrors(previous => ({ ...previous, [key]: undefined }));

  function changeKind(value: Kind) {
    if (value !== kind) { setUnp(""); setPhone(""); }
    setKind(value); setConsent(false); setFatca(false); setOwners(""); setErrors({});
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!kind) next.kind = messages.applicantRequired;
    if (kind && !/^\d{9}$/.test(unp)) next.unp = unp ? messages.unpLength : messages.fieldRequired;
    const digits = phone.replace(/\D/g, "");
    if (kind && !/^375\d{9}$/.test(digits)) next.phone = digits ? messages.phoneFormat : messages.fieldRequired;
    else if (kind && !/^375(25|29|33|44)/.test(digits)) next.phone = messages.phoneOperator;
    if (company && !consent) next.consent = messages.consentRequired;
    if (company && !fatca) next.fatca = messages.fatcaRequired;
    if (company && !owners) next.owners = messages.foundersRequired;
    setErrors(next);
    if (Object.keys(next).length) { requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()); return; }
    if (company && owners === "no") { setDialog("service"); return; }
    setQuestionnaire(true); window.scrollTo({ top: 0 });
  }
  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0,12);
    if (!digits) return "";
    if (!digits.startsWith("375")) return "+" + digits;
    return "+375" + (digits.length > 3 ? " (" + digits.slice(3,5) : "") + (digits.length >= 5 ? ") " : "") + digits.slice(5,8) + (digits.length>8 ? "-" + digits.slice(8,10) : "") + (digits.length>10 ? "-" + digits.slice(10,12) : "");
  }

  return <div className={questionnaire ? "app app-questionnaire" : "app"}>
    <a href="#main" className="skip">{questionnaire ? "Заявление на комплексное обслуживание" : "Открытие счета"}</a>
    {kind && <div hidden={!questionnaire}><Questionnaire key={kind} active={questionnaire} restart={() => { setQuestionnaire(false); setKind(""); setUnp(""); setPhone(""); setConsent(false); setFatca(false); setOwners(""); setErrors({}); window.scrollTo({ top: 0 }); }} applicant={{ kind, unp, phone }} back={() => { setQuestionnaire(false); window.scrollTo({ top: 0 }); }}/></div>}

    {!questionnaire && <main id="main" className="layout">
      <img className="form-logo" src="/assets/figma-belweb.svg" alt="БЕЛВЭБ" width="214" height="154"/>
      <section className="form-card" aria-label="Открытие счета">
        <div className="card-heading"><h1>Открытие счета</h1><p>Укажите ваши данные</p></div>
        <form ref={form} onSubmit={submit} noValidate>
          <fieldset className="applicants"><legend className="visually-hidden">Выберите тип заявителя</legend><div className="choice-grid">
            <label className={`applicant ${kind === "ip" ? "selected" : ""}`}><input type="radio" name="kind" value="ip" checked={kind === "ip"} onChange={() => changeKind("ip")} aria-invalid={!!errors.kind} aria-describedby={errors.kind ? "kind-error" : undefined}/><img className="applicant-icon" src="/assets/figma-user.svg" alt="" width="24" height="24"/><strong>{content.entrepreneurDescription}</strong></label>
            <label className={`applicant ${company ? "selected" : ""}`}><input type="radio" name="kind" value="company" checked={company} onChange={() => changeKind("company")} aria-invalid={!!errors.kind}/><img className="applicant-icon" src="/assets/figma-briefcase.svg" alt="" width="24" height="24"/><strong>{content.companyDescription}</strong></label>
          </div><ErrorText id="kind-error">{errors.kind}</ErrorText></fieldset>
          {kind && <div className="fields-area">
            <div className="field"><label htmlFor="unp">{company ? "УНП юридического лица" : "УНП индивидуального предпринимателя"}</label><input id="unp" type="text" inputMode="numeric" autoComplete="off" maxLength={9} placeholder="ХХХХХХХХХ" value={unp} onChange={event => { setUnp(event.target.value.replace(/\D/g, "")); clear("unp"); }} aria-invalid={!!errors.unp} aria-describedby={errors.unp ? "unp-error" : undefined}/><ErrorText id="unp-error">{errors.unp}</ErrorText></div>
            {company && <div className="check-field"><label className="check-label"><input type="checkbox" checked={consent} onChange={event => { setConsent(event.target.checked); clear("consent"); }} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-error" : undefined}/><span>Даю согласие на предоставление данных из МСИ (Межбанковская система идентификации)</span></label><ErrorText id="consent-error">{errors.consent}</ErrorText></div>}
            <div className="field"><label htmlFor="phone">{company ? "Номер мобильного телефона руководителя юридического лица" : "Номер мобильного телефона индивидуального предпринимателя"}</label><input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+375(ХХ)ХХХ-ХХ-ХХ" value={phone} onChange={event => { setPhone(event.target.value.replace(/[^+\d ()-]/g, "").slice(0,22)); clear("phone"); }} onBlur={() => setPhone(formatPhone(phone))} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined}/><ErrorText id="phone-error">{errors.phone}</ErrorText></div>
            {company && <>
              <div className="check-field"><label className="check-label"><input type="checkbox" checked={fatca} onChange={event => { setFatca(event.target.checked); clear("fatca"); }} aria-invalid={!!errors.fatca} aria-describedby={errors.fatca ? "fatca-error" : undefined}/><span>Подтверждаю, что юридическое лицо и/или его существенные собственники не являются налоговыми резидентами США.</span></label><button type="button" className="text-button fatca-help" aria-label="Информация о налоговом резидентстве США" onClick={() => setDialog("fatca")}><Info size={16}/></button><ErrorText id="fatca-error">{errors.fatca}</ErrorText></div>
              <fieldset className="owners"><legend>Состав учредителей юридического лица</legend><p>В состав участников юридического лица входят только физические лица</p><div className="inline-radios">{(["yes", "no"] as const).map(answer => <label key={answer}><input type="radio" name="owners" checked={owners === answer} onChange={() => { setOwners(answer); clear("owners"); }} aria-invalid={!!errors.owners} aria-describedby={errors.owners ? "owners-error" : undefined}/>{answer === "yes" ? "Да" : "Нет"}</label>)}</div><ErrorText id="owners-error">{errors.owners}</ErrorText></fieldset>
            </>}
          </div>}
          <div className="form-footer"><button className="button primary" type="submit">Открыть счет</button></div>
        </form>
      </section>
    </main>}
    {dialog === "fatca" && <Modal title={copy.P[0]} close={() => setDialog(null)}><div className="document-content">{copy.P.slice(2,-1).map((text, index) => <p key={index}>{text}</p>)}</div><button type="button" className="button primary modal-confirm" onClick={() => setDialog(null)}>Понятно</button></Modal>}
    {dialog === "service" && <Modal title={copy.F[0]} close={() => setDialog(null)}><div className="document-content"><p>{copy.F[2]}</p><p>МТС, А1, life:) <a href="tel:7209">7209</a></p><p>Городской: <a href="tel:+375172092949">+375 (17) 209-29-49</a></p></div><button type="button" className="button primary modal-confirm" onClick={() => setDialog(null)}>Понятно</button></Modal>}
  </div>;
}
