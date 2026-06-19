import JSZip from "jszip";

export async function buildZipArchive(files: Record<string, string | Buffer>): Promise<Buffer> {
  const zip = new JSZip();

  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }

  return zip.generateAsync({ type: "nodebuffer" });
}

export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",");
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}
