/**
 * HWPX → HWP 변환 파이프라인.
 *
 * 전부 브라우저 안에서 끝난다. 파일은 어디에도 올라가지 않는다.
 */
import { parseHwpx, paragraphText } from './owpml.js';
import { writeHwp } from './hwp5/writer.js';


function normalizeFileName(name) {
  const base = String(name || 'document').replace(/\\/g, '/').split('/').pop();
  const withoutExtension = base.replace(/\.hwpx$/i, '').replace(/\.hwp$/i, '');
  return (withoutExtension || 'document').trim().slice(0, 80);
}

function buildPreview(doc) {
  const paragraphs = [];
  const tables = [];
  for (const section of doc.sections) {
    for (const paragraph of section.paragraphs) {
      const text = paragraphText(paragraph).trim();
      if (text) paragraphs.push(text);
      for (const run of paragraph.runs) {
        for (const item of run.items) {
          if (item.type === 'table' && tables.length < 4) tables.push(item.preview);
        }
      }
      if (paragraphs.length >= 60) break;
    }
    if (paragraphs.length >= 60) break;
  }
  return { paragraphs, tables };
}

function buildReport(doc) {
  const counts = doc.diagnostics;
  return {
    sections: counts.sections,
    paragraphs: counts.paragraphs,
    tables: counts.tables,
    cells: counts.cells,
    images: counts.images,
    notes: counts.notes,
    headers: counts.headers,
    fields: counts.fields,
    shapes: counts.shapes,
    charts: counts.charts,
    equations: counts.equations,
    memos: counts.memos,
    hiddenComments: counts.hiddenComments,
    bookmarks: counts.bookmarks,
    fonts: counts.fonts,
    charShapes: counts.charShapes,
    paraShapes: counts.paraShapes,
    styles: counts.styles,
    borderFills: counts.borderFills,
    binData: counts.binData,
    entryCount: counts.entryCount,
    encrypted: counts.encrypted,
    missing: counts.missing,
  };
}

/**
 * HWPX 한 개를 HWP로 바꾼다.
 * @param {ArrayBuffer|Uint8Array} input
 * @param {{fileName?: string}} options
 */
export async function convertHwpx(input, options = {}) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length === 0) throw new Error('빈 파일입니다.');
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error('HWPX(ZIP) 파일이 아닙니다. 확장자와 실제 형식을 확인해 주세요.');
  }

  const started = performance.now();
  const doc = await parseHwpx(bytes);
  const hwp = await writeHwp(doc);
  const elapsed = Math.round(performance.now() - started);

  const name = normalizeFileName(options.fileName ?? 'document');
  return {
    fileName: `${name}.hwp`,
    bytes: hwp,
    size: hwp.length,
    sourceSize: bytes.length,
    elapsed,
    report: buildReport(doc),
    preview: buildPreview(doc),
    meta: doc.meta ?? {},
  };
}

/** 여러 파일을 차례로 변환한다. 실패한 파일은 결과에 오류로 남는다. */
export async function convertAll(files, onProgress) {
  const results = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if (onProgress) onProgress(index, file);
    try {
      const result = await convertHwpx(await file.arrayBuffer(), { fileName: file.name });
      results.push({ ok: true, ...result, file });
    } catch (error) {
      results.push({ ok: false, file, message: error?.message ?? String(error) });
    }
  }
  return results;
}
