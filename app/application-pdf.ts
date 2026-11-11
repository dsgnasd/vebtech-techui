// A browser-local prototype document; never uploaded or signed by a bank.
export async function createApplicationPdf(lines: string[]) {
  const [{ PDFDocument, rgb }, { default: fontkit }, fontResponse] = await Promise.all([
    import("pdf-lib"), import("@pdf-lib/fontkit"), fetch("/assets/manrope.ttf"),
  ]);
  if (!fontResponse.ok) throw new Error("font");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await fontResponse.arrayBuffer(), { subset: true });
  pdf.setTitle("Заявление на комплексное обслуживание");
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  for (const [index, paragraph] of lines.entries()) {
    const size = index === 0 ? 18 : 11;
    const words = paragraph.split(/\s+/);
    let line = "";
    const draw = () => {
      if (y < 54) { page = pdf.addPage([595.28, 841.89]); y = 790; }
      page.drawText(line, { x: 44, y, size, font, color: rgb(44/255,45/255,46/255) });
      y -= size * 1.5;
    };
    for (const word of words) {
      if (line && font.widthOfTextAtSize(`${line} ${word}`,size) > 507) { draw(); line = word; }
      else line += `${line ? " " : ""}${word}`;
    }
    draw(); y -= 8;
  }
  return new Blob([await pdf.save() as Uint8Array<ArrayBuffer>], { type: "application/pdf" });
}
