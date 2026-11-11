"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, FileText, LoaderCircle, Plus, Search, Trash2, Upload, X } from "./solar-icons";
import content from "./source-content.json";
import copy from "./source-copy.json";
import SigningFlow from "./signing-flow";
import ApplicationDetails from "./application-details";
import { emptyDetails, emptyPerson, requiredDocuments, validateDetails, detailsLines, type Context } from "./application-model";
import { profiles, slaExpired, type Profile } from "./application-context";

export type Applicant = { kind: "ip" | "company"; unp: string; phone: string };
type Answer = "yes" | "no" | "";
type PickerItem = { id: string; title: string; subtitle?: string };
type Currency = keyof typeof content.currencies;
const officialDocuments = {
  contract: "https://www.belveb.by/documents/dogovor-o-kompleksnom-bankovskom-obsluzhivanii-korporativnykh-klientov-usloviya-publichnoy-oferty/",
  docsList: "https://www.belveb.by/documents/perechen-dokumentov-v-elektronnom-vide-peredavaemykh-s-ispolzovaniem-sistem-distantsionnogo-bankovskogo-obsluzhivaniya-korporativnykh-klientov/",
  tariffs: "https://www.belveb.by/documents/tarify-na-vypolnenie-operatsiy-i-okazanie-uslug-oao-bank-belveb/",
};

export function Modal({ title, children, close, wide = false }: { title: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.querySelector<HTMLInputElement>("input")?.focus(); }, []);
  return <dialog className={`modal ${wide ? "modal-wide" : ""}`} ref={element => { dialog.current = element; if (element && !element.open) element.showModal(); }} onCancel={close} onClose={close} aria-label={title}>
    <div className="modal-title"><h2>{title}</h2><button type="button" className="icon-button" onClick={() => dialog.current?.close()} aria-label="Закрыть"><X size={20}/></button></div>
    {children}
  </dialog>;
}

export function ErrorText({ children, id }: { children?: string; id?: string }) {
  return children ? <p className="error" id={id}>{children}</p> : null;
}

function Picker({ title, placeholder, items, selected, choose, close, children }: { title: string; placeholder: string; items: PickerItem[]; selected?: string; choose: (id: string) => void; close: () => void; children?: ReactNode }) {
  const [search, setSearch] = useState("");
  const results = items.filter(item => `${item.title} ${item.subtitle || ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <Modal title={title} close={close} wide={!!children}>
    <div className="search-field"><Search size={19}/><input autoFocus aria-label={placeholder} placeholder={placeholder} value={search} onChange={event => setSearch(event.target.value)}/>{search && <button className="icon-button" type="button" aria-label="Очистить поиск" onClick={() => setSearch("")}><X size={16}/></button>}</div>
    <div className={children ? "office-picker-grid" : ""}><div className="picker-items">{results.length ? results.map(item => <button key={item.id} type="button" className={`picker-item ${selected === item.id ? "selected" : ""}`} onClick={() => { choose(item.id); close(); }}><span><strong>{item.title}</strong>{item.subtitle && <small>{item.subtitle}</small>}</span>{selected === item.id && <Check size={18}/>}</button>) : <p className="empty-result">Ничего не найдено по запросу «{search}»</p>}</div>{children}</div>
  </Modal>;
}

function Question({ name, label, value, onChange, error }: { name: string; label: string; value: Answer; onChange: (answer: Answer) => void; error?: string }) {
  return <fieldset className="question" aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined}>
    <legend>{label}</legend><div className="inline-radios">{(["yes", "no"] as const).map(answer => <label key={answer}><input type="radio" name={name} checked={value === answer} onChange={() => onChange(answer)}/>{answer === "yes" ? "Да" : "Нет"}</label>)}</div><ErrorText id={`${name}-error`}>{error}</ErrorText>
  </fieldset>;
}

export default function Questionnaire({ applicant, back, restart, active = true }: { applicant: Applicant; back: () => void; restart?: () => void; active?: boolean }) {
  const company = applicant.kind === "company";
  const category = company ? "company" : "entrepreneur";
  const [sole, setSole] = useState<Answer>("");
  const [charter, setCharter] = useState<Answer>("");
  const [activity, setActivity] = useState("");
  const [accounts, setAccounts] = useState<Currency[]>(["BYN"]);
  const [selectedPackage, setSelectedPackage] = useState("");
  const [payroll, setPayroll] = useState<Record<string, { enabled: Answer; currencies: string[] }>>({});
  const [officeId, setOfficeId] = useState("");
  const [attachments, setAttachments] = useState<Record<string, File[]>>({});
  const [details, setDetails] = useState(emptyDetails);
  const [context, setContext] = useState<Context | null>(null);
  const [profile, setProfile] = useState<Profile>("default");
  const [contextError, setContextError] = useState(false);
  const [reloadContext, setReloadContext] = useState(0);
  const [slaAccepted, setSlaAccepted] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [expired, setExpired] = useState(false);
  const [slaRemaining, setSlaRemaining] = useState<number | null>(null);
  const [documentCode, setDocumentCode] = useState("");
  const currentDocumentCode = useRef("");
  const slaFinished = useRef(false);
  const effectiveCharter = company && context?.opf === "ООО" ? charter : "no";
  const required = requiredDocuments(company, sole, effectiveCharter);
  const files = useMemo(() => requiredDocuments(company, sole, effectiveCharter).flatMap(doc => attachments[doc.code] || []), [attachments, company, sole, effectiveCharter]);
  useEffect(() => {
    const controller = new AbortController(); let alive = true;
    const requested = new URLSearchParams(window.location.search).get("profile") || "default";
    const selected = profiles.includes(requested as Profile) ? requested as Profile : "default";
    setProfile(selected); setContextError(false);
    fetch(`/api/application-context?kind=${applicant.kind}&profile=${selected}`, { signal: controller.signal }).then(async response => { if (!response.ok) throw new Error(); const data = await response.json() as Context; if (alive) setContext(data); }).catch(() => { if (alive) setContextError(true); });
    return () => { alive = false; controller.abort(); };
  }, [applicant.kind, reloadContext]);
  useEffect(() => {
    if (!active || !slaAccepted || !startedAt || !context?.sla2Minutes) return;
    const tick = () => { if (slaFinished.current) return; const remaining = Math.max(0, Math.ceil((startedAt + context.sla2Minutes! * 60_000 - Date.now()) / 1000)); setSlaRemaining(remaining); if (!remaining) { setExpired(true); requestController.current?.abort(); } };
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [active, slaAccepted, startedAt, context?.sla2Minutes]);
  function updateDetails(next: ReturnType<typeof emptyDetails>) { setDetails(next); const current = validateDetails(next, sole); setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith("details.") || !!current[key]))); }
  function chooseFiles(code: string) { currentDocumentCode.current = code; setDocumentCode(code); fileInput.current?.click(); }
  const [terms, setTerms] = useState(false);
  const [confirmations, setConfirmations] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<"activity" | "account" | "office" | null>(null);
  const [document, setDocument] = useState<keyof typeof content.documents | null>(null);
  const [receipt, setReceipt] = useState<{ status: "processing" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const sending = useRef(false);
  const requestId = useRef<string | null>(null);
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => () => requestController.current?.abort(), []);
  const [expandedPackages, setExpandedPackages] = useState<string[]>([]);
  const showPackageDetails = expandedPackages.length > 0;
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const top = useRef<HTMLHeadingElement>(null);
  const activityItem = content.activities.find(item => item.code === activity);
  const office = content.offices.find(item => item.id === officeId);
  const packageItem = content.packages.find(item => item.id === selectedPackage);
  const clientName = context?.clientName || "";
  const clear = (key: string) => setErrors(previous => ({ ...previous, [key]: "" }));
  const selectedPayroll = payroll[selectedPackage] || { enabled: "" as Answer, currencies: [] };
  const sections: Record<string, { id: string; label: string }> = {
    sole: { id: "section-sole", label: "Руководитель юридического лица является единственным участником" },
    charter: { id: "section-charter", label: "Юридическое лицо действует на основании типового устава" },
    activity: { id: "section-activity", label: "Основной вид деятельности" },
    accounts: { id: "section-accounts", label: "Прошу открыть текущий счет" },
    package: { id: selectedPackage ? "section-payroll" : "section-packages", label: selectedPackage ? "Подключить зарплатный проект" : "Пакеты услуг" },
    office: { id: "section-office", label: "Сервисный офис для обслуживания" },
    files: { id: "section-files", label: "Документы:" },
    terms: { id: "section-terms", label: `${copy.at[0]}www.belveb.by):` },
    confirmations: { id: "section-confirmations", label: copy.at[4] },
  };
  function focusSection(id: string) {
    requestAnimationFrame(() => {
      const section = window.document.getElementById(id);
      section?.scrollIntoView({ block: "start", behavior: "smooth" });
      const control = section?.querySelector<HTMLElement>('.select-trigger,[data-edit-control]') || section?.querySelector<HTMLElement>('input:checked') || section?.querySelector<HTMLElement>('input:not([type="file"]),button');
      (control || section)?.focus({ preventScroll: true });
    });
  }
  function scrollTop() { requestAnimationFrame(() => { top.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); }); }
  function updatePayroll(id: string, value: Answer) {
    setSelectedPackage(id);
    setPayroll(previous => ({ ...previous, [id]: { enabled: value, currencies: value === "yes" ? previous[id]?.currencies || [] : [] } }));
    clear("package");
  }
  function toggleCurrency(id: string, currency: string) {
    setSelectedPackage(id);
    setPayroll(previous => { const current = previous[id] || { enabled: "yes" as Answer, currencies: [] }; return { ...previous, [id]: { ...current, currencies: current.currencies.includes(currency) ? current.currencies.filter(item => item !== currency) : [...current.currencies, currency] } }; });
    clear("package");
  }
  function addFiles(incoming: FileList | File[]) {
    const supported = /\.(pdf|rtf|jpe?g|heic|heif)$/i;
    const all = Array.from(incoming);
    const code = currentDocumentCode.current;
    if (!required.some(doc => doc.code === code)) return;
    const invalid = all.filter(file => file.size > 30 * 1024 * 1024 || !supported.test(file.name));
    const valid = all.filter(file => file.size <= 30 * 1024 * 1024 && supported.test(file.name));
    setAttachments(previous => ({ ...previous, [code]: [...(previous[code] || []), ...valid.filter(file => !(previous[code] || []).some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))] }));
    setErrors(previous => ({ ...previous, [`files.${code}`]: invalid.length ? "Недопустимый формат или размер файла" : "" }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || receipt || expired || !slaAccepted || !context) return;
    if (slaExpired(startedAt, context.sla2Minutes)) { setExpired(true); return; }
    setSubmitError(null);
    const next: Record<string, string> = {};
    if (company && !sole) next.sole = "Выберите один из вариантов";
    if (company && context.opf === "ООО" && !charter) next.charter = "Выберите один из вариантов";
    if (company) Object.assign(next, validateDetails(details, sole));
    if (context.requestOked && !activity) next.activity = "Необходимо указать вид деятельности";
    if (!selectedPackage) next.package = "Необходимо выбрать пакет услуг";
    else if (context.connectPayroll && payroll[selectedPackage]?.enabled === "yes" && !payroll[selectedPackage].currencies.length) next.package = "Выберите валюту(-ы) зарплатного проекта.";
    if (!officeId) next.office = "Необходимо выбрать сервисный офис";
    required.forEach(doc => { if (!attachments[doc.code]?.length) next[`files.${doc.code}`] = `Необходимо загрузить ${doc.name}`; });
    if (!terms) next.terms = "Требуется предоставить согласие";
    if (!confirmations) next.confirmations = "Требуется предоставить согласие";
    setErrors(next);
    if (Object.keys(next).length) { const key = Object.keys(next)[0];
      if (key.startsWith("details.") || key.startsWith("files.")) requestAnimationFrame(() => { const field = window.document.getElementById(key); field?.scrollIntoView({ block: "center", behavior: "smooth" }); field?.focus({ preventScroll: true }); });
      else focusSection(sections[key].id); return; }
    sending.current = true;
    setSubmitting(true);
    requestId.current ||= crypto.randomUUID();
    const controller = new AbortController();
    requestController.current = controller;
    try {
      const [response] = await Promise.all([
        fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            requestId: requestId.current,
            applicant, profile, startedAt, details: company ? details : undefined, soleFounder: sole, standardCharter: company && context.opf === "ООО" ? charter : "",
            activityCode: context.requestOked ? activity : "", accounts, packageId: selectedPackage,
            payroll: context.connectPayroll ? { ...selectedPayroll, enabled: selectedPayroll.enabled || "no" } : { enabled: "no", currencies: [] }, officeId,
            documents: required.flatMap(doc => (attachments[doc.code] || []).map(file => ({ documentCode: doc.code, name: file.name, size: file.size, type: file.type }))),
            termsAccepted: terms, confirmationsAccepted: confirmations,
          }),
        }),
        new Promise(resolve => window.setTimeout(resolve, 550)),
      ]);
      const result: unknown = await response.json();
      if (response.status === 408) { setExpired(true); return; }
      if (!response.ok || !result || typeof result !== "object" || !("status" in result) || result.status !== "processing") throw new Error("Не удалось отправить заявку");
      setReceipt({ status: "processing" });
      scrollTop();
    } catch (error) {
      if (!controller.signal.aborted) setSubmitError("Не удалось отправить заявку");
    } finally {
      sending.current = false;
      if (!controller.signal.aborted) setSubmitting(false);
    }
  }

  const applicationLines = useMemo(() => [
    "Заявление на комплексное обслуживание",
    clientName, `УНП ${applicant.unp}`, `Номер мобильного телефона: ${applicant.phone}`,
    ...(company ? [`Руководитель юридического лица является единственным участником: ${sole === "yes" ? "Да" : "Нет"}`, ...(context?.opf === "ООО" ? [`Юридическое лицо действует на основании типового устава: ${charter === "yes" ? "Да" : "Нет"}`] : [])] : []),
    ...(company ? detailsLines(details, sole) : []),
    ...(context?.requestOked ? [`Основной вид деятельности: ${activityItem?.code || ""} ${activityItem?.name || ""}`] : []),
    `Прошу открыть текущий счет: ${accounts.join(", ")}`,
    `Пакеты услуг: ${packageItem?.title || ""}`,
    ...(context?.connectPayroll ? [`Подключить зарплатный проект: ${selectedPayroll.enabled === "yes" ? "Да" : "Нет"}`] : []),
    ...(selectedPayroll.currencies.length ? [`Валюта: ${selectedPayroll.currencies.join(", ")}`] : []),
    `Сервисный офис для обслуживания: ${office?.address || officeId}`,
    ...files.map(file => file.name),
    `${copy.at[0]}www.belveb.by):`, ...copy.at.slice(1,8).filter((_, i) => i !== 1 || !["A00", "END"].includes(context?.sdboStatus || "")), company ? copy.at[8] : copy.at[9],
  ], [clientName, applicant.unp, applicant.phone, company, sole, charter, activityItem, accounts, packageItem, selectedPayroll, office, officeId, files, context, details]);

  if (contextError) return <main className="signing-flow"><section className="signing-card"><h1>Уважаемый клиент, Сервис временно недоступен. Попробуйте, пожалуйста, позже.</h1><button className="button primary signing-action" type="button" onClick={() => setReloadContext(value => value + 1)}>Попробовать ещё раз</button><button className="text-button signing-back" type="button" onClick={back}>Назад</button></section></main>;
  if (!context) return <main className="signing-flow" role="status"><LoaderCircle size={24} className="spinning"/><p>Загрузка данных...</p></main>;
  if (expired) return <main className="signing-flow"><section className="signing-card" role="alert"><h1>Уважаемый клиент, Вы превысили время, отведённое на предоставление электронных документов</h1><button type="button" className="button primary signing-action" onClick={restart || back}>Открытие счета</button></section></main>;
  if (!slaAccepted && active) return <main className="questionnaire"><Modal title="Предоставление электронных документов" close={back}><p className="section-description">Время, отведённое на предоставление электронных документов, ограничено.</p>{context.sla2Minutes && <p className="section-description">{context.sla2Minutes} мин.</p>}<button className="button primary modal-confirm" type="button" onClick={() => { setStartedAt(Date.now()); setSlaAccepted(true); }}>ОК</button></Modal></main>;
  if (receipt) return <SigningFlow onSubmitted={() => { if (slaExpired(startedAt, context.sla2Minutes)) { setExpired(true); return false; } slaFinished.current = true; setSlaRemaining(null); return true; }} files={files} applicationLines={applicationLines} back={() => { setReceipt(null); scrollTop(); }}/>;

  return <main id={active ? "main" : undefined} className="questionnaire">
    <div className="questionnaire-heading"><button type="button" className="icon-button" disabled={submitting} onClick={back} aria-label="Открытие счета"><ArrowLeft size={22}/></button><h1 ref={top} tabIndex={-1}>Заявление на комплексное обслуживание</h1></div>
    {slaRemaining !== null && <p className="sla-timer">Время на предоставление электронных документов: {String(Math.floor(slaRemaining / 60)).padStart(2,"0")}:{String(slaRemaining % 60).padStart(2,"0")}</p>}
    <form ref={form} onSubmit={submit} noValidate aria-busy={submitting}>
      <fieldset className="submission-fields" disabled={submitting}>
      <section className="client-data questionnaire-panel"><div><span>Данные клиента</span><h2>{clientName}</h2><p><span>УНП {applicant.unp}</span><a href={`tel:${applicant.phone.replace(/[^\d+]/g, "")}`}>{applicant.phone}</a><span>Резидент РБ</span></p></div></section>
      {company && <section className="questionnaire-panel company-questions"><div id="section-sole" tabIndex={-1} data-invalid={!!errors.sole}><Question name="sole-founder" label="Руководитель юридического лица является единственным участником" value={sole} onChange={answer => { setSole(answer); if (answer === "yes") updateDetails({ ...details, founders: [emptyPerson()] }); clear("sole"); }} error={errors.sole}/></div>{context.opf === "ООО" && <div id="section-charter" tabIndex={-1} data-invalid={!!errors.charter}><Question name="standard-charter" label="Юридическое лицо действует на основании типового устава" value={charter} onChange={answer => { setCharter(answer); clear("charter"); }} error={errors.charter}/></div>}</section>}
      {company && <ApplicationDetails value={details} change={updateDetails} sole={sole} errors={errors}/>}
      {context.requestOked && <section id="section-activity" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.activity}><div className="field-heading"><h2>Основной вид деятельности</h2><span>Код ОКЭД</span></div><button type="button" className="select-trigger" aria-haspopup="dialog" aria-invalid={!!errors.activity} aria-describedby={errors.activity ? "activity-error" : undefined} onClick={() => setPicker("activity")}><span>{activityItem ? <><b className="code-tag">{activityItem.code}</b>{activityItem.name}</> : "Выберите вид деятельности"}</span><ChevronDown size={18}/></button><ErrorText id="activity-error">{errors.activity}</ErrorText></section>}
      <section id="section-accounts" tabIndex={-1} className="questionnaire-panel"><h2>Прошу открыть текущий счет</h2><div className="account-grid">{accounts.map(currency => <div className="account" key={currency}><div><strong>{currency}</strong><span>{content.currencies[currency].name}</span></div>{currency !== "BYN" && <button type="button" className="icon-button" aria-label={`Удалить счет ${currency}`} onClick={() => setAccounts(previous => previous.filter(item => item !== currency))}><X size={18}/></button>}</div>)}{accounts.length < 10 && accounts.length <= content.additionalCurrencies.length && <button type="button" className="account add-account" data-edit-control onClick={() => setPicker("account")}><Plus size={20}/><span>+ Добавить валюту</span></button>}</div></section>
      <section id="section-packages" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.package && !selectedPackage}><div className="field-heading"><h2>Пакеты услуг</h2><button type="button" className="text-button package-description-toggle" aria-expanded={showPackageDetails} aria-controls="package-options" onClick={() => setExpandedPackages(showPackageDetails ? [] : content.packages.filter(item => item.category === category).map(item => item.id))}>{showPackageDetails ? "Скрыть описание" : "Показать описание"}<ChevronDown size={16}/></button></div>
        <div id="package-options" className={`package-grid ${showPackageDetails ? "comparing" : ""}`} role="radiogroup" aria-label="Пакеты услуг" aria-invalid={!!errors.package && !selectedPackage} aria-describedby={errors.package && !selectedPackage ? "package-error" : undefined}>{content.packages.filter(item => item.category === category).map(item => <article className={`package-card ${selectedPackage === item.id ? "selected" : ""}`} key={item.id}>
          <label className="package-choice"><input className="package-selector" type="radio" name="package" checked={selectedPackage === item.id} onChange={() => { setSelectedPackage(item.id); clear("package"); }}/><span>{item.title}</span></label>
          <p className="package-price"><strong>{item.price}</strong><span>/ месяц</span></p><p className="package-subtitle">{item.subtitle}</p>
          <button type="button" className="text-button package-expand" aria-expanded={expandedPackages.includes(item.id)} onClick={() => setExpandedPackages(previous => previous.includes(item.id) ? previous.filter(id => id !== item.id) : [...previous, item.id])}>{expandedPackages.includes(item.id) ? "Скрыть описание" : "Показать описание"}<ChevronDown size={16}/></button>
          {expandedPackages.includes(item.id) && <ul className="package-features">{item.items.map((feature, index) => <li className="package-feature" key={index}><span className={feature.status === "check" ? "feature-check" : "feature-cross"}>{feature.status === "check" ? <Check size={15}/> : <X size={15}/>}</span><span><strong>{feature.title}</strong><small>{feature.desc}</small></span></li>)}<li className="package-more"><a href={officialDocuments.tariffs} target="_blank" rel="noreferrer">Подробнее</a></li></ul>}
        </article>)}</div>{!selectedPackage && <ErrorText id="package-error">{errors.package}</ErrorText>}
      </section>
      {packageItem && context.connectPayroll && <section id="section-payroll" tabIndex={-1} className="questionnaire-panel payroll-settings" data-invalid={!!errors.package}><label className="check-label"><input type="checkbox" checked={selectedPayroll.enabled === "yes"} onChange={event => updatePayroll(selectedPackage, event.target.checked ? "yes" : "no")}/><span>Прошу подключить к зарплатному проекту</span></label>
        {selectedPayroll.enabled === "yes" && <fieldset className="payroll-currencies"><legend>Выберите одну или несколько валют зарплатного проекта</legend><div>{content.payrollCurrencies.map(currency => <label className={selectedPayroll.currencies.includes(currency.code) ? "currency selected" : "currency"} key={currency.code}><input type="checkbox" checked={selectedPayroll.currencies.includes(currency.code)} onChange={() => toggleCurrency(selectedPackage, currency.code)}/><strong>{currency.code}</strong><span>{currency.rate}</span></label>)}</div></fieldset>}<ErrorText>{errors.package}</ErrorText>
      </section>}
      <section id="section-office" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.office}><div className="field-heading"><h2>Сервисный офис для обслуживания</h2><a className="text-button" href="https://www.belveb.by/about/offices/" target="_blank" rel="noreferrer">Карта сервисных офисов</a></div><button type="button" className="select-trigger" aria-haspopup="dialog" onClick={() => setPicker("office")} aria-invalid={!!errors.office} aria-describedby={errors.office ? "office-error" : undefined}><span>{office ? <><strong>{office.name}</strong><small>{office.address}</small></> : "Выберите офис обслуживания Банка БелВЭБ"}</span><ChevronDown size={18}/></button>{office && <p className="office-hours">{office.workHours}</p>}<ErrorText id="office-error">{errors.office}</ErrorText></section>
      <section id="section-files" tabIndex={-1} className="questionnaire-panel documents-panel"><div className="documents-heading"><h2>Документы</h2><span className="documents-count">{required.filter(doc => attachments[doc.code]?.length).length} / {required.length}</span></div>
        <input ref={fileInput} className="visually-hidden" type="file" multiple accept=".pdf,.rtf,.jpeg,.jpg,.heic,.heif" tabIndex={-1} aria-hidden="true" aria-label={required.find(doc => doc.code === documentCode)?.name || "Документы"} onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }}/>
        <ol className="document-slots">{required.map(doc => { const attached = attachments[doc.code] || []; const error = errors[`files.${doc.code}`]; return <li key={doc.code} id={`files.${doc.code}`} tabIndex={-1} className={`document-slot ${dragging && documentCode === doc.code ? "document-slot-dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); setDocumentCode(doc.code); currentDocumentCode.current = doc.code; }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }} onDrop={event => { event.preventDefault(); setDragging(false); currentDocumentCode.current = doc.code; addFiles(event.dataTransfer.files); }}>
          <div className="document-slot-row"><span className={`document-kind-icon ${attached.length ? "document-kind-complete" : ""}`}>{attached.length ? <Check size={20}/> : <FileText size={20}/>}</span><h3 id={`document-title-${doc.code}`}>{doc.name}</h3><button type="button" className="button secondary document-upload" aria-describedby={`document-title-${doc.code}${error ? ` document-error-${doc.code}` : ""}`} onClick={() => chooseFiles(doc.code)}><Upload size={18}/>{attached.length ? "Прикрепить еще документ" : "Выберите файлы"}</button></div>
          {!!attached.length && <ul className="document-attachments">{attached.map((file, index) => <li key={`${file.name}-${index}`}><FileText size={18}/><span className="document-attachment-name">{file.name}<small>{(file.size / 1024).toFixed(1)} КБ</small></span><button type="button" className="icon-button" aria-label={`Удалить ${file.name}`} onClick={() => setAttachments(previous => ({ ...previous, [doc.code]: previous[doc.code].filter((_, i) => i !== index) }))}><Trash2 size={18}/></button></li>)}</ul>}
          {error && <p className="error document-slot-error" role="alert" id={`document-error-${doc.code}`}>{error}</p>}
        </li>; })}</ol><p className="document-format-hint">Поддерживаются PDF, RTF, JPEG, HEIC, HEIF (до 30 МБ)</p>
      </section>
      <section className="questionnaire-panel agreements"><div id="section-terms" tabIndex={-1} className="agreement" data-invalid={!!errors.terms}><input id="terms" type="checkbox" checked={terms} aria-invalid={!!errors.terms} aria-describedby={errors.terms ? "terms-error" : undefined} onChange={event => { setTerms(event.target.checked); clear("terms"); }}/><div><label htmlFor="terms">*{copy.at[0]}<a href="https://www.belveb.by" target="_blank" rel="noreferrer">www.belveb.by</a>):</label><ul>{(["contract", "docsList", "tariffs"] as const).map((type, index) => ({ type, index })).filter(({ type }) => type !== "docsList" || !["A00", "END"].includes(context.sdboStatus)).map(({ type, index }) => <li key={type}><a className="text-button agreement-link" target="_blank" rel="noreferrer" href={officialDocuments[type]}>{copy.at[index + 1]}</a></li>)}</ul><ErrorText id="terms-error">{errors.terms}</ErrorText></div></div>
        <div id="section-confirmations" tabIndex={-1} className="agreement" data-invalid={!!errors.confirmations}><input id="confirmations" type="checkbox" checked={confirmations} aria-invalid={!!errors.confirmations} aria-describedby={errors.confirmations ? "confirmations-error" : undefined} onChange={event => { setConfirmations(event.target.checked); clear("confirmations"); }}/><div><label htmlFor="confirmations">*{copy.at[4]}</label><ul>{[copy.at[5], copy.at[6], copy.at[7], company ? copy.at[8] : copy.at[9]].map(text => <li key={text}>{text}</li>)}</ul><ErrorText id="confirmations-error">{errors.confirmations}</ErrorText></div></div>
      </section>
      </fieldset>
      {submitError && <div className="submission-error" role="alert">{submitError}</div>}
      <div className="form-footer questionnaire-actions"><button type="submit" className="button primary" disabled={submitting}>{submitting ? <><LoaderCircle className="submission-spinner" size={18}/>Формируются документы</> : "Далее"}</button></div>
    </form>
    {picker === "activity" && <Picker title="Основной вид деятельности" placeholder="Поиск по коду или названию деятельности..." items={content.activities.map(item => ({ id: item.code, title: `${item.code} · ${item.name}`, subtitle: item.category }))} selected={activity} choose={id => { setActivity(id); clear("activity"); }} close={() => setPicker(null)}/>}
    {picker === "account" && <Picker title="Добавить банковский счет" placeholder="Поиск по названию" items={content.additionalCurrencies.filter(code => !accounts.includes(code as Currency)).map(code => ({ id: code, title: code, subtitle: content.currencies[code as Currency].name }))} choose={id => setAccounts(previous => previous.length < 10 && !previous.includes(id as Currency) ? [...previous, id as Currency] : previous)} close={() => setPicker(null)}/>}
    {picker === "office" && <Picker title="Выберите офис" placeholder="Поиск по адресу или названию отделения..." items={content.offices.map(item => ({ id: item.id, title: item.name, subtitle: `${item.city} · ${item.address}` }))} selected={officeId} choose={id => { setOfficeId(id); clear("office"); }} close={() => setPicker(null)}><iframe className="office-map" title="Карта офисов" loading="lazy" src={office ? `https://www.openstreetmap.org/export/embed.html?bbox=${office.geo.lng - 0.045},${office.geo.lat - 0.025},${office.geo.lng + 0.045},${office.geo.lat + 0.025}&layer=mapnik&marker=${office.geo.lat},${office.geo.lng}` : "https://www.openstreetmap.org/export/embed.html?bbox=23.1,51.0,32.8,56.5&layer=mapnik"}/></Picker>}
    {document && <Modal title={content.documents[document].title} close={() => setDocument(null)}><div className="document-content"><h3>{content.documents[document].description}</h3>{content.documents[document].sections.map((text: string) => <p key={text}>{text}</p>)}</div><button className="button primary modal-confirm" type="button" onClick={() => setDocument(null)}>Понятно</button></Modal>}
  </main>;
}
