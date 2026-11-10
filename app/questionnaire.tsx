"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, ChevronDown, LoaderCircle, Plus, Search, Trash2, Upload, X } from "lucide-react";
import content from "./source-content.json";
import copy from "./source-copy.json";

export type Applicant = { kind: "ip" | "company"; unp: string; phone: string };
type Answer = "yes" | "no" | "";
type PickerItem = { id: string; title: string; subtitle?: string };
type Currency = keyof typeof content.currencies;

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

function documentRequirements(company: boolean, sole: Answer, charter: Answer) {
  if (!company) return ["Свидетельство о государственной регистрации индивидуального предпринимателя"];
  const appointment = "Решение (выписка из решения) о назначении на должность руководителя";
  const order = "Приказ (выписка из приказа) о назначении на должность руководителя";
  const contract = "Трудовой договор/контракт (выписка из трудового договора/контракта) с руководителем и действующие изменения в него";
  const statutes = "Устав и действующие изменения в него";
  if (!sole || !charter) return [statutes, appointment, order, contract];
  return [charter === "no" ? statutes : "Выписка (копия выписки) из ЕГР", appointment, order, ...(sole === "no" ? [contract] : [])];
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
  const [files, setFiles] = useState<File[]>([]);
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
  const [showPackageDetails, setShowPackageDetails] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const top = useRef<HTMLHeadingElement>(null);
  const activityItem = content.activities.find(item => item.code === activity);
  const office = content.offices.find(item => item.id === officeId);
  const packageItem = content.packages.find(item => item.id === selectedPackage);
  const clientName = company ? "ОДО «БелВЭБ Инжиниринг»" : "ИП Иванов С. П.";
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
    const supported = /\.(pdf|rtf|png|jpe?g|heic|heif)$/i;
    const all = Array.from(incoming);
    const invalid = all.filter(file => file.size > 30 * 1024 * 1024 || !supported.test(file.name));
    const valid = all.filter(file => file.size <= 30 * 1024 * 1024 && supported.test(file.name));
    setFiles(previous => [...previous, ...valid.filter(file => !previous.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]);
    setErrors(previous => ({ ...previous, files: invalid.length ? (invalid.some(file => file.size > 30 * 1024 * 1024) ? `Файлы превышают лимит 30 МБ: ${invalid.filter(file => file.size > 30 * 1024 * 1024).map(file => file.name).join(", ")}` : "Поддерживаются PDF, RTF, PNG, JPEG, HEIC, HEIF (до 30 МБ)") : "" }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sending.current || receipt) return;
    setSubmitError(null);
    const next: Record<string, string> = {};
    if (company && !sole) next.sole = "Ответьте на этот вопрос";
    if (company && !charter) next.charter = "Ответьте на этот вопрос";
    if (!activity) next.activity = "Выберите основной вид экономической деятельности (ОКЭД)";
    if (!selectedPackage) next.package = "Выберите пакет услуг";
    else if (!payroll[selectedPackage]?.enabled) next.package = "Ответьте на вопрос «Подключить зарплатный проект»";
    else if (payroll[selectedPackage]?.enabled === "yes" && !payroll[selectedPackage].currencies.length) next.package = "Выберите валюту для пакета";
    if (!officeId) next.office = "Выберите сервисный офис ОАО «Банк БелВЭБ»";
    if (!files.length) next.files = "Прикрепите документы для государственной регистрации";
    if (!terms) next.terms = "Предоставьте согласие";
    if (!confirmations) next.confirmations = "Подтвердите согласие";
    setErrors(next);
    if (Object.keys(next).length) { focusSection(sections[Object.keys(next)[0]].id); return; }
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
            applicant, soleFounder: sole, standardCharter: charter,
            activityCode: activity, accounts, packageId: selectedPackage,
            payroll: selectedPayroll, officeId,
            documents: files.map(file => ({ name: file.name, size: file.size, type: file.type })),
            termsAccepted: terms, confirmationsAccepted: confirmations,
          }),
        }),
        new Promise(resolve => window.setTimeout(resolve, 550)),
      ]);
      const result: unknown = await response.json();
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

  if (receipt) return <main id={active ? "main" : undefined} className="questionnaire submission-state" aria-live="polite">
    <section className="success-card">
      <div className="success-mark"><Check size={30} strokeWidth={2}/></div>
      <div className="processing-status"><span/>В обработке</div>
      <h1 ref={top} tabIndex={-1}>Заявление принято в обработку</h1>
      <p className="success-description">Заявление успешно зарегистрировано!</p>
      <button type="button" className="button secondary" onClick={restart || back}>Новое заявление</button>
    </section>
  </main>;

  return <main id={active ? "main" : undefined} className="questionnaire">
    <div className="questionnaire-heading"><button type="button" className="icon-button" disabled={submitting} onClick={back} aria-label="Открытие счета"><ArrowLeft size={22}/></button><h1 ref={top} tabIndex={-1}>Заявление на комплексное обслуживание</h1></div>
    <form ref={form} onSubmit={submit} noValidate aria-busy={submitting}>
      <fieldset className="submission-fields" disabled={submitting}>
      <section className="client-data questionnaire-panel"><div><span>Данные клиента</span><h2>{clientName}</h2><p><span>УНП {applicant.unp}</span><a href={`tel:${applicant.phone.replace(/[^\d+]/g, "")}`}>{applicant.phone}</a><span>Резидент РБ</span></p></div></section>
      {company && <section className="questionnaire-panel company-questions"><div id="section-sole" tabIndex={-1} data-invalid={!!errors.sole}><Question name="sole-founder" label="Руководитель юридического лица является единственным участником" value={sole} onChange={answer => { setSole(answer); clear("sole"); }} error={errors.sole}/></div><div id="section-charter" tabIndex={-1} data-invalid={!!errors.charter}><Question name="standard-charter" label="Юридическое лицо действует на основании типового устава" value={charter} onChange={answer => { setCharter(answer); clear("charter"); }} error={errors.charter}/></div></section>}
      <section id="section-activity" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.activity}><div className="field-heading"><h2>Основной вид деятельности</h2><span>Код ОКЭД</span></div><button type="button" className="select-trigger" aria-haspopup="dialog" aria-invalid={!!errors.activity} aria-describedby={errors.activity ? "activity-error" : undefined} onClick={() => setPicker("activity")}><span>{activityItem ? <><b className="code-tag">{activityItem.code}</b>{activityItem.name}</> : "Выберите вид деятельности"}</span><ChevronDown size={18}/></button><ErrorText id="activity-error">{errors.activity}</ErrorText></section>
      <section id="section-accounts" tabIndex={-1} className="questionnaire-panel"><h2>Прошу открыть текущий счет</h2><div className="account-grid">{accounts.map(currency => <div className="account" key={currency}><div><strong>{currency}</strong><span>{content.currencies[currency].name}</span></div>{currency !== "BYN" && <button type="button" className="icon-button" aria-label={`Удалить счет ${currency}`} onClick={() => setAccounts(previous => previous.filter(item => item !== currency))}><X size={18}/></button>}</div>)}{accounts.length <= content.additionalCurrencies.length && <button type="button" className="account add-account" data-edit-control onClick={() => setPicker("account")}><Plus size={20}/><span>+ Добавить валюту</span></button>}</div></section>
      <section id="section-packages" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.package && !selectedPackage}><div className="field-heading"><h2>Пакеты услуг</h2><button type="button" className="text-button package-description-toggle" aria-expanded={showPackageDetails} aria-controls="package-options" onClick={() => setShowPackageDetails(value => !value)}>{showPackageDetails ? "Скрыть описание" : "Показать описание"}<ChevronDown size={16}/></button></div>
        <div id="package-options" className={`package-grid ${showPackageDetails ? "comparing" : ""}`} role="radiogroup" aria-label="Пакеты услуг" aria-invalid={!!errors.package && !selectedPackage} aria-describedby={errors.package && !selectedPackage ? "package-error" : undefined}>{content.packages.filter(item => item.category === category).map(item => <article className={`package-card ${selectedPackage === item.id ? "selected" : ""}`} key={item.id}>
          <label className="package-choice"><input className="package-selector" type="radio" name="package" checked={selectedPackage === item.id} onChange={() => { setSelectedPackage(item.id); clear("package"); }}/><span>{item.title}</span></label>
          <p className="package-price"><strong>{item.price}</strong><span>/ месяц</span></p><p className="package-subtitle">{item.subtitle}</p>
          {showPackageDetails && <ul className="package-features">{item.items.map((feature, index) => <li className="package-feature" key={index}><span className={feature.status === "check" ? "feature-check" : "feature-cross"}>{feature.status === "check" ? <Check size={15}/> : <X size={15}/>}</span><span><strong>{feature.title}</strong><small>{feature.desc}</small></span></li>)}</ul>}
        </article>)}</div>{!selectedPackage && <ErrorText id="package-error">{errors.package}</ErrorText>}
      </section>
      {packageItem && <section id="section-payroll" tabIndex={-1} className="questionnaire-panel payroll-settings" data-invalid={!!errors.package}><div className="selected-package-name">{packageItem.title}</div><Question name={`payroll-${selectedPackage}`} label="Подключить зарплатный проект" value={selectedPayroll.enabled} onChange={answer => updatePayroll(selectedPackage, answer)} error={errors.package}/>
        {selectedPayroll.enabled === "yes" && <fieldset className="payroll-currencies"><legend>Выберите валюту</legend><div>{content.payrollCurrencies.map(currency => <label className={selectedPayroll.currencies.includes(currency.code) ? "currency selected" : "currency"} key={currency.code}><input type="checkbox" checked={selectedPayroll.currencies.includes(currency.code)} onChange={() => toggleCurrency(selectedPackage, currency.code)}/><strong>{currency.code}</strong><span>{currency.rate}</span></label>)}</div></fieldset>}
      </section>}
      <section id="section-office" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.office}><div className="field-heading"><h2>Сервисный офис для обслуживания</h2><button type="button" className="text-button" onClick={() => setPicker("office")}>Карта офисов</button></div><button type="button" className="select-trigger" aria-haspopup="dialog" onClick={() => setPicker("office")} aria-invalid={!!errors.office} aria-describedby={errors.office ? "office-error" : undefined}><span>{office ? <><strong>{office.name}</strong><small>{office.address}</small></> : "Выберите офис обслуживания Банка БелВЭБ"}</span><ChevronDown size={18}/></button>{office && <p className="office-hours">{office.workHours}</p>}<ErrorText id="office-error">{errors.office}</ErrorText></section>
      <section id="section-files" tabIndex={-1} className="questionnaire-panel" data-invalid={!!errors.files}><h2>Документы:</h2><ol className="required-documents">{documentRequirements(company, sole, charter).map(label => <li key={label}>{label}</li>)}</ol><input ref={fileInput} className="visually-hidden" type="file" multiple accept=".pdf,.rtf,.png,.jpeg,.jpg,.heic,.heif" onChange={event => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }}/>
        <div className={`dropzone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}><Upload size={28}/><div><button type="button" className="text-button" aria-describedby={errors.files ? "files-error" : undefined} onClick={() => fileInput.current?.click()}>{files.length ? "Прикрепить еще документ" : "Выберите файлы"}</button><span>или перетащите их сюда</span></div><p>Поддерживаются PDF, RTF, PNG, JPEG, HEIC, HEIF (до 30 МБ)</p></div>
        {files.length > 0 && <ul className="file-list">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span><strong>{file.name}</strong><small>{(file.size / 1024).toFixed(1)} КБ</small></span><button type="button" className="icon-button" title="Удалить документ" aria-label={`Удалить ${file.name}`} onClick={() => setFiles(previous => previous.filter((_, position) => position !== index))}><Trash2 size={18}/></button></li>)}</ul>}<ErrorText id="files-error">{errors.files}</ErrorText>
      </section>
      <section className="questionnaire-panel agreements"><div id="section-terms" tabIndex={-1} className="agreement" data-invalid={!!errors.terms}><input id="terms" type="checkbox" checked={terms} aria-invalid={!!errors.terms} aria-describedby={errors.terms ? "terms-error" : undefined} onChange={event => { setTerms(event.target.checked); clear("terms"); }}/><div><label htmlFor="terms">*{copy.at[0]}<a href="https://www.belveb.by" target="_blank" rel="noreferrer">www.belveb.by</a>):</label><ul>{(["contract", "docsList", "tariffs"] as const).map((type, index) => <li key={type}><button type="button" className="text-button agreement-link" onClick={() => setDocument(type)}>{copy.at[index + 1]}</button></li>)}</ul><ErrorText id="terms-error">{errors.terms}</ErrorText></div></div>
        <div id="section-confirmations" tabIndex={-1} className="agreement" data-invalid={!!errors.confirmations}><input id="confirmations" type="checkbox" checked={confirmations} aria-invalid={!!errors.confirmations} aria-describedby={errors.confirmations ? "confirmations-error" : undefined} onChange={event => { setConfirmations(event.target.checked); clear("confirmations"); }}/><div><label htmlFor="confirmations">*{copy.at[4]}</label><ul>{[copy.at[5], copy.at[6], copy.at[7], company ? copy.at[8] : copy.at[9]].map(text => <li key={text}>{text}</li>)}</ul><ErrorText id="confirmations-error">{errors.confirmations}</ErrorText></div></div>
      </section>
      </fieldset>
      {submitError && <div className="submission-error" role="alert">{submitError}</div>}
      <div className="form-footer questionnaire-actions"><button type="submit" className="button primary" disabled={submitting}>{submitting ? <><LoaderCircle className="submission-spinner" size={18}/>Отправка заявки...</> : "Отправить заявку"}</button></div>
    </form>
    {picker === "activity" && <Picker title="Основной вид деятельности" placeholder="Поиск по коду или названию деятельности..." items={content.activities.map(item => ({ id: item.code, title: `${item.code} · ${item.name}`, subtitle: item.category }))} selected={activity} choose={id => { setActivity(id); clear("activity"); }} close={() => setPicker(null)}/>}
    {picker === "account" && <Picker title="Добавить банковский счет" placeholder="Поиск по названию" items={content.additionalCurrencies.filter(code => !accounts.includes(code as Currency)).map(code => ({ id: code, title: code, subtitle: content.currencies[code as Currency].name }))} choose={id => setAccounts(previous => [...previous, id as Currency])} close={() => setPicker(null)}/>}
    {picker === "office" && <Picker title="Выберите офис" placeholder="Поиск по адресу или названию отделения..." items={content.offices.map(item => ({ id: item.id, title: item.name, subtitle: `${item.city} · ${item.address}` }))} selected={officeId} choose={id => { setOfficeId(id); clear("office"); }} close={() => setPicker(null)}><iframe className="office-map" title="Карта офисов" loading="lazy" src={office ? `https://www.openstreetmap.org/export/embed.html?bbox=${office.geo.lng - 0.045},${office.geo.lat - 0.025},${office.geo.lng + 0.045},${office.geo.lat + 0.025}&layer=mapnik&marker=${office.geo.lat},${office.geo.lng}` : "https://www.openstreetmap.org/export/embed.html?bbox=23.1,51.0,32.8,56.5&layer=mapnik"}/></Picker>}
    {document && <Modal title={content.documents[document].title} close={() => setDocument(null)}><div className="document-content"><h3>{content.documents[document].description}</h3>{content.documents[document].sections.map((text: string) => <p key={text}>{text}</p>)}</div><button className="button primary modal-confirm" type="button" onClick={() => setDocument(null)}>Понятно</button></Modal>}
  </main>;
}
