"use client";
import { useRef, useState } from "react";
import { ArrowRight, ArrowLeft, Check, ShieldCheck, RotateCcw, LockKeyhole, UserRound, Building2, Info, CircleCheck, X, ChevronDown } from "lucide-react";
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
  const lockDialog = useRef<HTMLDialogElement>(null);
  const resetDialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const isCompany = kind === "company";
  const clearError = (key: keyof Errors) => setErrors(e => ({ ...e, [key]: undefined }));
  function reset() {
    setKind(""); setUnp(""); setPhone(""); setConsent(false); setFatca(false); setOwners(""); setErrors({}); setStage("form");
    resetDialog.current?.close();
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
    <header className="header"><div className="header-inner">
      <div className="brand"><img src="/assets/belweb.svg" alt="БЕЛВЭБ"/><span className="brand-divider"/><span className="brand-text">Банк для бизнеса</span></div>
      <div className="header-actions"><span className="prototype">Прототип</span><button className="icon-button" onClick={() => resetDialog.current?.showModal()} aria-label="Начать заново" title="Начать заново"><RotateCcw size={19}/></button><button className="lock-button" onClick={() => lockDialog.current?.showModal()}><LockKeyhole size={18}/><span>Заблокировать</span></button></div>
    </div></header>
    <main id="main" className="layout">
      <aside className="intro"><div className="eyebrow">РАСЧЁТНЫЙ СЧЁТ ДЛЯ БИЗНЕСА</div><h1>Открытие<br className="desktop-break"/> счёта</h1><p className="intro-copy">Начните с данных о вашем бизнесе.</p>
        <ol className="steps" aria-label="Этапы заполнения">
          <li className={stage === "form" ? "step current" : "step completed"} aria-current={stage === "form" ? "step" : undefined}><span className="step-number">{stage === "form" ? "1" : <Check size={17}/>}</span><div><strong>Данные заявителя</strong><span>Тип бизнеса и контакты</span></div></li>
          <li className={stage !== "form" ? "step current" : "step"} aria-current={stage !== "form" ? "step" : undefined}><span className="step-number">{stage === "done" ? <Check size={17}/> : "2"}</span><div><strong>Проверка данных</strong><span>Проверьте перед продолжением</span></div></li>
        </ol>
        <div className="privacy"><ShieldCheck size={22}/><div><strong>Ваши данные под контролем</strong><p>В этом прототипе данные остаются в текущей вкладке и не отправляются в банк.</p></div></div>
        <div className="powered">Технологии <img src="/assets/vebtech.svg" alt="Vebtech"/></div>
      </aside>
      <section className="form-card" aria-label="Открытие счёта">
        <div className="card-heading"><div className="step-caption">ШАГ {stage === "form" ? "1" : "2"} ИЗ 2</div><h2 ref={heading} tabIndex={-1}>{stage === "form" ? "Укажите ваши данные" : stage === "review" ? "Проверьте данные" : "Всё готово к следующему шагу"}</h2><p>{stage === "form" ? "Выберите тип заявителя, чтобы увидеть нужные поля." : stage === "review" ? "Убедитесь, что информация указана верно." : "Вы прошли демонстрационный сценарий открытия счёта."}</p></div>
        {stage === "form" && <form ref={form} onSubmit={submit} noValidate>
          <fieldset className="applicants"><legend>Кто открывает счёт?</legend><div className="choice-grid">
            <label className={`applicant ${kind === "ip" ? "selected" : ""}`}><input type="radio" name="kind" value="ip" checked={kind === "ip"} onChange={() => changeKind("ip")} aria-invalid={!!errors.kind} aria-describedby={errors.kind ? "kind-error" : undefined}/><UserRound className="choice-icon" size={25}/><strong>Индивидуальный<br/> предприниматель</strong><span>Открываю счёт для своего ИП</span></label>
            <label className={`applicant ${isCompany ? "selected" : ""}`}><input type="radio" name="kind" value="company" checked={isCompany} onChange={() => changeKind("company")} aria-invalid={!!errors.kind}/><Building2 className="choice-icon" size={25}/><strong>Юридическое<br/> лицо</strong><span>Я руководитель организации</span></label>
          </div>{errors.kind && <p className="error" id="kind-error" role="alert">{errors.kind}</p>}</fieldset>
          {kind && <div className="fields-area">
            {isCompany && <details className="eligibility"><summary>Кому подходит этот способ открытия <ChevronDown size={17}/></summary><p>{companyDescription}</p></details>}
            <div className="section-heading"><span className="section-marker">01</span><h3>Данные {isCompany ? "организации" : "предпринимателя"}</h3></div>
            <div className="field"><label htmlFor="unp">УНП {isCompany ? "юридического лица" : "индивидуального предпринимателя"}</label><input id="unp" type="text" inputMode="numeric" autoComplete="off" maxLength={9} placeholder="9 цифр" value={unp} onChange={e => {setUnp(e.target.value.replace(/\D/g,""));clearError("unp");}} aria-invalid={!!errors.unp} aria-describedby="unp-hint"/><p id="unp-hint" className={errors.unp ? "error" : "hint"}>{errors.unp || "Указан в свидетельстве о государственной регистрации"}</p></div>
            <div className="field"><label htmlFor="phone">Мобильный телефон {isCompany ? "руководителя" : "предпринимателя"}</label><input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+375 (29) 000-00-00" value={phone} onChange={e => {setPhone(e.target.value.replace(/[^+\d ()-]/g, "").slice(0,22));clearError("phone");}} aria-invalid={!!errors.phone} aria-describedby="phone-hint" onBlur={() => setPhone(formatPhone(phone))}/><p id="phone-hint" className={errors.phone ? "error" : "hint"}>{errors.phone || "Номер мобильного оператора Республики Беларусь"}</p></div>
            {isCompany && <>
              <div className="section-heading confirmation-heading"><span className="section-marker">02</span><h3>Подтверждения</h3></div>
              <div className="check-field"><label className="check-label"><input type="checkbox" checked={consent} onChange={e=>{setConsent(e.target.checked);clearError("consent");}} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? "consent-error" : undefined}/><span>Даю согласие на предоставление данных из МСИ <span className="muted">(Межбанковская система идентификации)</span></span></label>{errors.consent && <p className="error" id="consent-error">{errors.consent}</p>}</div>
              <div className="check-field"><label className="check-label"><input type="checkbox" checked={fatca} onChange={e=>{setFatca(e.target.checked);clearError("fatca");}} aria-invalid={!!errors.fatca} aria-describedby={errors.fatca ? "fatca-error" : undefined}/><span>Подтверждаю, что юридическое лицо и/или его существенные собственники не являются налоговыми резидентами США.</span></label>{errors.fatca && <p className="error" id="fatca-error">{errors.fatca}</p>}<p className="hint check-hint">Если вы не можете подтвердить это условие, открытие счёта требует консультации в банке.</p></div>
              <fieldset className="owners"><legend>В состав участников входят только физические лица?</legend><div className="inline-radios">{["Да","Нет"].map(v=><label key={v}><input type="radio" name="owners" checked={owners===v} onChange={()=>{setOwners(v);clearError("owners");}} aria-invalid={!!errors.owners} aria-describedby={errors.owners ? "owners-error" : undefined}/>{v}</label>)}</div>{errors.owners && <p className="error" id="owners-error">{errors.owners}</p>}</fieldset>
            </>}
          </div>}
          {!kind && <div className="empty-guidance"><Info size={19}/><span>Для ИП и юридических лиц нужны разные данные. Начните с выбора типа бизнеса.</span></div>}
          <div className="form-footer"><div className="footer-note"><LockKeyhole size={16}/><span>Без отправки данных</span></div><button className="button primary" type="submit">Продолжить <ArrowRight size={19}/></button></div>
        </form>}
        {stage === "review" && <div className="review"><div className="review-type">{isCompany ? <Building2 size={24}/> : <UserRound size={24}/>}<strong>{isCompany ? "Юридическое лицо" : "Индивидуальный предприниматель"}</strong><span className="tag">Заполнено</span></div><dl><div><dt>УНП</dt><dd>{unp}</dd></div><div><dt>Мобильный телефон</dt><dd>{phone}</dd></div>{isCompany && <><div><dt>Согласие на предоставление данных из МСИ</dt><dd>Дано</dd></div><div><dt>Налоговое резидентство</dt><dd>Подтверждено</dd></div><div><dt>Участники — только физические лица</dt><dd>{owners}</dd></div></>}</dl><div className="info-box"><Info size={20}/><p>Это прототип. Проверка УНП в реестре и отправка заявки в банк не выполняются.</p></div><div className="form-footer"><button className="button secondary" onClick={()=>changeStage("form")}><ArrowLeft size={18}/> Изменить</button><button className="button primary" onClick={()=>changeStage("done")}>Завершить просмотр <Check size={18}/></button></div></div>}
        {stage === "done" && <div className="done"><div className="success-icon"><CircleCheck size={44}/></div><h3>Прототип проверен</h3><p>Заявка не отправлена, счёт не открыт.<br/>Вы можете вернуться к форме и посмотреть другой сценарий.</p><button className="button primary" onClick={reset}><RotateCcw size={18}/> Вернуться к началу</button></div>}
      </section>
    </main>
    <footer className="page-footer"><span>БЕЛВЭБ · Банк для бизнеса</span><span>Дизайн на основе TechUI</span></footer>
    <dialog ref={resetDialog} className="dialog" aria-labelledby="reset-title"><div className="dialog-top"><RotateCcw size={25}/><button className="icon-button" aria-label="Закрыть" onClick={()=>resetDialog.current?.close()}><X size={20}/></button></div><h2 id="reset-title">Начать заново?</h2><p>Заполненные поля будут очищены.</p><div className="dialog-actions"><button className="button secondary" onClick={()=>resetDialog.current?.close()}>Продолжить заполнение</button><button className="button primary" onClick={reset}>Начать заново</button></div></dialog>
    <dialog ref={lockDialog} className="lock-screen" aria-labelledby="lock-title"><div className="lock-content"><img src="/assets/belweb.svg" alt="БЕЛВЭБ"/><div className="lock-symbol"><LockKeyhole size={28}/></div><h2 id="lock-title">Просмотр приостановлен</h2><p>Данные формы скрыты. В прототипе можно продолжить без ключа доступа.</p><button className="button primary" onClick={()=>lockDialog.current?.close()}>Вернуться к форме <ArrowRight size={18}/></button></div></dialog>
  </div>;
}
