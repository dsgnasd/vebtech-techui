"use client";
import { useRef, useState } from "react";
import { ArrowLeft, Check, RotateCcw, ChevronDown } from "lucide-react";
type Kind = "ip" | "company" | "";
type Errors = Partial<Record<"kind" | "unp" | "phone" | "consent" | "fatca" | "owners", string>>;
const companyDescription = "Являюсь руководителем юридического лица (ООО, ОДО, унитарного предприятия) – коммерческой организации – резидента Республики Беларусь, и действую на основании Устава/контракта. Юридическое лицо не является бюджетной организацией или профессиональным участником рынка ценных бумаг.";
export default function Home() {
  const [kind, setKind] = useState<Kind>("");
  const [unp, setUnp] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [fatca, setFatca] = useState(false);
  const [owners, setOwners] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [stage, setStage] = useState<"form" | "review" | "done">("form");
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const isCompany = kind === "company";
  const clearError = (key: keyof Errors) => setErrors(e => ({ ...e, [key]: undefined }));
  function reset() {
    setKind(""); setUnp(""); setPhone(""); setConsent(false); setFatca(false); setOwners(""); setErrors({}); setStage("form");
  }
  function changeKind(value: Kind) {setKind(value);setConsent(false);setFatca(false);setOwners("");setErrors({});}
  function changeStage(value: "form" | "review" | "done") {
    setStage(value);requestAnimationFrame(() => {heading.current?.focus();window.scrollTo({ top: 0, behavior: "smooth" });});
  }
  function submit(event: React.FormEvent) {
    event.preventDefault();const next: Errors = {};
    if (!kind) next.kind = "Выберите тип заявителя";
    if (kind && !/^\d{9}$/.test(unp)) next.unp = "Укажите УНП из 9 цифр";
    if (kind && !/^375(25|29|33|44)\d{7}$/.test(phone.replace(/\D/g, ""))) next.phone = "Введите номер: +375 (29) 123-45-67";
    if (isCompany && !consent) next.consent = "Для продолжения необходимо согласие";
    if (isCompany && !fatca) next.fatca = "Подтвердите информацию о налоговом резидентстве";
    if (isCompany && !owners) next.owners = "Выберите ответ";
    setErrors(next);
    if (Object.keys(next).length) {requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());return;}
    changeStage("review");
  }
  function formatPhone(value: string) {
    const d = value.replace(/\D/g, "").slice(0,12);
    if (!d) return "";if (!d.startsWith("375")) return "+" + d;
    return "+375" + (d.length > 3 ? " (" + d.slice(3,5) : "") + (d.length >= 5 ? ") " : "") + d.slice(5,8) + (d.length>8 ? "-"+d.slice(8,10) : "") + (d.length>10 ? "-"+d.slice(10,12) : "");
  }
  return <div className="app">
    <a href="#main" className="skip">К основной форме</a>
    <main id="main" className="layout">
      <img className="form-logo" src="/assets/figma-belweb.svg" alt="БЕЛВЭБ" width="214" height="154"/>
      <section className="form-card" aria-label="Открытие счёта">
        <div className="card-heading"><h1 ref={heading} tabIndex={-1}>{stage === "form" ? "Открытие счёта" : stage === "review" ? "Проверьте данные" : "Просмотр завершён"}</h1></div>
        {stage === "form" && <form ref={form} onSubmit={submit} noValidate>
          <fieldset className="applicants"><legend>Тип заявителя</legend><div className="choice-grid">
            <label className={`applicant ${kind === "ip" ? "selected" : ""}`}><input type="radio" name="kind" value="ip" checked={kind === "ip"} onChange={() => changeKind("ip")} aria-invalid={!!errors.kind} aria-describedby={errors.kind ? "kind-error" : undefined}/><img className="applicant-icon" src="/assets/figma-user.svg" alt="" width="24" height="24"/><strong>Индивидуальный предприниматель</strong></label>
            <label className={`applicant ${isCompany ? "selected" : ""}`}><input type="radio" name="kind" value="company" checked={isCompany} onChange={() => changeKind("company")} aria-invalid={!!errors.kind}/><img className="applicant-icon" src="/assets/figma-briefcase.svg" alt="" width="24" height="24"/><strong>Юридическое лицо</strong></label>
          </div>{errors.kind && <p className="error" id="kind-error" role="alert">{errors.kind}</p>}</fieldset>
          {kind && <div className="fields-area">
            {isCompany && <details className="eligibility"><summary>Кому подходит этот способ открытия <ChevronDown size={17}/></summary><p>{companyDescription}</p></details>}
            <div className="field"><label htmlFor="unp">УНП {isCompany ? "юридического лица" : "индивидуального предпринимателя"}</label><input id="unp" type="text" inputMode="numeric" autoComplete="off" maxLength={9} placeholder="9 цифр" value={unp} onChange={e => {setUnp(e.target.value.replace(/\D/g,""));clearError("unp");}} aria-invalid={!!errors.unp} aria-describedby={errors.unp ? "unp-hint" : undefined}/>{errors.unp && <p id="unp-hint" className="error">{errors.unp}</p>}</div>
            <div className="field"><label htmlFor="phone">Мобильный телефон {isCompany ? "руководителя" : "предпринимателя"}</label><input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+375 (29) 000-00-00" value={phone} onChange={e => {setPhone(e.target.value.replace(/[^+\d ()-]/g, "").slice(0,22));clearError("phone");}} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-hint" : undefined} onBlur={() => setPhone(formatPhone(phone))}/>{errors.phone && <p id="phone-hint" className="error">{errors.phone}</p>}</div>
            {isCompany && <>
              <div className="section-heading confirmation-heading"><h3>Подтверждения</h3></div>
              <div className="check-field"><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);clearError("consent");}} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-error" : undefined}/><span>Даю согласие на предоставление данных из МСИ <span className="muted">(Межбанковская система идентификации)</span></span></label>{errors.consent && <p className="error" id="consent-error">{errors.consent}</p>}</div>
              <div className="check-field"><label className="check-label"><input type="checkbox" checked={fatca} onChange={e=>{setFatca(e.target.checked);clearError("fatca");}} aria-invalid={!!errors.fatca} aria-describedby={errors.fatca ? "fatca-error" : undefined}/><span>Подтверждаю, что юридическое лицо и/или его существенные собственники не являются налоговыми резидентами США.</span></label>{errors.fatca && <p className="error" id="fatca-error">{errors.fatca}</p>}</div>
              <fieldset className="owners"><legend>В состав участников входят только физические лица?</legend><div className="inline-radios">{["Да","Нет"].map(v=><label key={v}><input type="radio" name="owners" checked={owners===v} onChange={()=>{setOwners(v);clearError("owners");}} aria-invalid={!!errors.owners} aria-describedby={errors.owners ? "owners-error" : undefined}/>{v}</label>)}</div>{errors.owners && <p className="error" id="owners-error">{errors.owners}</p>}</fieldset>
            </>}
          </div>}
          <div className="form-footer"><button className="button primary" type="submit">Продолжить</button></div>
        </form>}
        {stage === "review" && <div className="review"><div className="review-type"><img src={isCompany ? "/assets/figma-briefcase.svg" : "/assets/figma-user.svg"} alt="" width="24" height="24"/><strong>{isCompany ? "Юридическое лицо" : "Индивидуальный предприниматель"}</strong><span className="tag">Заполнено</span></div><dl><div><dt>УНП</dt><dd>{unp}</dd></div><div><dt>Мобильный телефон</dt><dd>{phone}</dd></div>{isCompany && <><div><dt>Согласие на предоставление данных из МСИ</dt><dd>Дано</dd></div><div><dt>Налоговое резидентство</dt><dd>Подтверждено</dd></div><div><dt>Участники — только физические лица</dt><dd>{owners}</dd></div></>}</dl><div className="form-footer"><button className="button secondary" onClick={()=>changeStage("form")}><ArrowLeft size={18}/> Изменить</button><button className="button primary" onClick={()=>changeStage("done")}>Завершить просмотр <Check size={18}/></button></div></div>}
        {stage === "done" && <div className="done"><button className="button primary" onClick={reset}><RotateCcw size={18}/> Вернуться к началу</button></div>}
      </section>
    </main>
  </div>;
}
