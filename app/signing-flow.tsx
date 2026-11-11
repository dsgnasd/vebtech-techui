"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Download, FileText, LoaderCircle, X } from "lucide-react";
import { createApplicationPdf } from "./application-pdf";

export type SigningStage = "documents" | "sms" | "checking" | "complete";
export const signingCopy = {
  documents: "Документы для подписания",
  documentsDescription: "Ознакомьтесь с документами перед подписанием",
  sms: "Подтверждение подписания заявления",
  smsDescription: "На ваш номер телефона выслано смс-сообщение с кодом подтверждения для подписания заявления на открытие счета",
  checking: "Документы успешно подписаны",
  checkingDescription: "Дождитесь, пожалуйста, подтверждения. Проверка может занять до 1 минуты. Не закрывайте страницу браузера",
  complete: "Уважаемый клиент",
  completeDescription: "Ожидайте смс с информацией о счетах и временным логином и паролем для входа в Интернет-банк в течение 10 минут. Используйте полученный логин и пароль для входа и активации своей учетной записи в Интернет-банке.",
};

type DocumentItem = { name: string; url: string; type: string };
type Props = { files: File[]; applicationLines: string[]; back: () => void };

export default function SigningFlow({ files, applicationLines, back }: Props) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentError, setDocumentError] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [stage, setStage] = useState<SigningStage>("documents");
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const verifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldId = useId();
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    setDocumentError(false);
    setDocuments([]);
    createApplicationPdf(applicationLines).then(blob => {
      if (!alive) return;
      const items = [{ name: "Заявление на комплексное обслуживание.pdf", blob }, ...files.map(file => ({ name: file.name, blob: file }))];
      setDocuments(items.map(item => { const url = URL.createObjectURL(item.blob); urls.push(url); return { name: item.name, url, type: item.blob.type }; }));
    }).catch(() => { if (alive) setDocumentError(true); });
    return () => { alive = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [files, applicationLines, generation]);
  useEffect(() => { heading.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }, [stage]);
  useEffect(() => () => { if (verifyTimer.current) clearTimeout(verifyTimer.current); }, []);
  useEffect(() => {
    if (stage !== "sms") return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [stage, resendAt]);
  useEffect(() => {
    if (stage !== "checking") return;
    const timer = setTimeout(() => setStage("complete"), 3500);
    return () => clearTimeout(timer);
  }, [stage]);
  function sendCode() { setCode(""); setError(""); setResendAt(Date.now() + 180_000); setRemaining(180); setStage("sms"); requestAnimationFrame(() => input.current?.focus()); }
  function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (code.length !== 6) { setError("Введите код из 6 цифр"); input.current?.focus(); return; }
    busy.current = true; setVerifying(true); setError("");
    // Demo verification only. No SMS gateway, digital signature or bank request.
    verifyTimer.current = setTimeout(() => {
      busy.current = false; setVerifying(false);
      if (code !== "123456") { setError("Неверный код. Проверьте код и попробуйте ещё раз"); input.current?.focus(); return; }
      setStage("checking");
    }, 650);
  }
  const time = `${String(Math.floor(remaining / 60)).padStart(2,"0")}:${String(remaining % 60).padStart(2,"0")}`;
  return <main id="main" className={`signing-flow signing-stage-${stage}`}>
    {(stage === "documents" || stage === "sms") && <button className="text-button signing-back" type="button" disabled={verifying} onClick={() => stage === "documents" ? back() : setStage("documents")}><ArrowLeft size={18}/>Назад</button>}
    <section className="signing-card" aria-busy={verifying || stage === "checking"}>
      {(stage === "checking" || stage === "complete") && <div className="signing-success-mark"><Check size={32}/></div>}
      <h1 tabIndex={-1} ref={heading}>{signingCopy[stage]}</h1>
      <p className="signing-description">{signingCopy[`${stage}Description`]}</p>
      {stage === "documents" && <>
        <div className="signing-documents" aria-label="Документы">
          <h2>Документы</h2>
          {!documents.length && !documentError && <div className="signing-document-loading" role="status"><LoaderCircle className="spinning" size={20}/>Подготовка документов...</div>}
          {documents.map((item,index) => <div className="signing-document" key={`${index}-${item.name}`}><FileText className="signing-file-icon" size={24}/><button className="document-open" type="button" onClick={() => setPreview(item)}>{item.name}</button><a className="icon-button" href={item.url} download={item.name} aria-label={`Скачать ${item.name}`}><Download size={20}/></a></div>)}
        </div>
        {documentError && <div role="alert" className="signing-document-error"><p className="error">Не удалось подготовить документы</p><button type="button" className="text-button" onClick={() => setGeneration(value => value + 1)}>Попробовать ещё раз</button></div>}
        <button className="button primary signing-action" type="button" disabled={!documents.length} onClick={sendCode}>Далее</button>
      </>}
      {stage === "sms" && <form className="signing-sms-form" noValidate onSubmit={confirm}>
        <div className="field"><label htmlFor={fieldId}>Введите код</label><input ref={input} id={fieldId} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Введите код" value={code} disabled={verifying} aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} onPaste={event => { event.preventDefault(); setCode(event.clipboardData.getData("text").replace(/\D/g, "").slice(0,6)); setError(""); }} onChange={event => { setCode(event.target.value.replace(/\D/g, "").slice(0,6)); setError(""); }}/>{error && <p role="alert" className="error" id={`${fieldId}-error`}>{error}</p>}</div>
        <button className="text-button signing-resend" type="button" disabled={remaining > 0 || verifying} onClick={sendCode}>{remaining > 0 ? `Отправить код повторно через ${time}` : "Отправить код повторно"}</button>
        <button className="button primary signing-action" type="submit" disabled={verifying}>{verifying ? <><LoaderCircle size={18} className="spinning"/>Подтверждение...</> : "Подтвердить"}</button>
      </form>}
      {stage === "checking" && <div className="signing-checking" role="status"><LoaderCircle size={28} className="spinning"/><span className="visually-hidden">Проверка документов</span></div>}
      {stage === "complete" && <a className="button primary signing-action signing-bank-link" href="https://dbo2.bveb.by/" target="_blank" rel="noopener noreferrer">Перейти в Интернет-банк<ArrowUpRight size={18}/></a>}
    </section>
    {preview && <dialog className="modal signing-preview" aria-label={preview.name} ref={element => { dialog.current = element; if (element && !element.open) element.showModal(); }} onCancel={() => setPreview(null)} onClose={() => setPreview(null)}>
      <div className="modal-title"><h2>{preview.name}</h2><button type="button" className="icon-button" aria-label="Закрыть" onClick={() => dialog.current?.close()}><X size={20}/></button></div>
      {preview.type === "application/pdf" || /\.pdf$/i.test(preview.name) ? <object data={preview.url} type="application/pdf" className="document-preview-content"><p>Просмотр PDF недоступен в этом браузере. <a href={preview.url} download={preview.name}>Скачать документ</a></p></object> : preview.type.startsWith("image/") && !/\.(heic|heif)$/i.test(preview.name) ? <img className="document-preview-image" src={preview.url} alt={preview.name}/> : <p className="document-preview-fallback">Просмотр этого формата недоступен в браузере. Скачайте документ, чтобы открыть его.</p>}
      <a className="button secondary signing-download" href={preview.url} download={preview.name}><Download size={18}/>Скачать документ</a>
    </dialog>}
  </main>;
}
