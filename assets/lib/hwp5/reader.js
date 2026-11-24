/**
 * HWP 5.0 읽기 — 텍스트 추출용 최소 판독기.
 *
 * 변환 결과를 확인하거나, 이미 있는 .hwp에서 글자만 뽑고 싶을 때 쓴다.
 * CFB 컨테이너 → 압축 해제 → 레코드 → PARA_TEXT 순서로 읽는다.
 */
import { inflateRaw } from '../deflate.js';
import { HwpFormatError } from '../bytes.js';

const ENDOFCHAIN = 0xfffffffe;

/** CFB 컨테이너에서 스트림을 꺼낸다. */
export function readCfb(bytes) {
  if (bytes.length < 512) throw new HwpFormatError('HWP 파일이 너무 작습니다.');
  const signature = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!signature.every((value, index) => bytes[index] === value)) {
    throw new HwpFormatError('HWP(CFB) 파일이 아닙니다.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorSize = 1 << view.getUint16(30, true);
  const miniSectorSize = 1 << view.getUint16(32, true);
  const numFat = view.getUint32(44, true);
  const dirStart = view.getUint32(48, true);
  const miniCutoff = view.getUint32(56, true);
  const miniFatStart = view.getUint32(60, true);

  const readSector = (id) => bytes.subarray((id + 1) * sectorSize, (id + 2) * sectorSize);

  const fatSectorIds = [];
  for (let i = 0; i < 109 && fatSectorIds.length < numFat; i++) {
    const id = view.getUint32(76 + i * 4, true);
    if (id !== 0xffffffff) fatSectorIds.push(id);
  }
  let difat = view.getUint32(68, true);
  while (difat !== ENDOFCHAIN && difat !== 0xffffffff && fatSectorIds.length < numFat) {
    const sector = readSector(difat);
    const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    for (let i = 0; i < sectorSize / 4 - 1 && fatSectorIds.length < numFat; i++) {
      const id = dv.getUint32(i * 4, true);
      if (id !== 0xffffffff) fatSectorIds.push(id);
    }
    difat = dv.getUint32(sectorSize - 4, true);
  }

  const fat = new Uint32Array(Math.max(1, fatSectorIds.length * (sectorSize / 4)));
  fatSectorIds.forEach((id, index) => {
    const sector = readSector(id);
    const dv = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    for (let i = 0; i < sectorSize / 4; i++) {
      fat[index * (sectorSize / 4) + i] = dv.getUint32(i * 4, true);
    }
  });

  const chain = (start, table) => {
    const out = [];
    let id = start;
    let guard = 0;
    while (id !== ENDOFCHAIN && id !== 0xffffffff && guard++ < 1e6) {
      out.push(id);
      id = table[id];
    }
    return out;
  };

  const readChain = (start, table) => {
    const ids = chain(start, table);
    const out = new Uint8Array(ids.length * sectorSize);
    ids.forEach((id, index) => out.set(readSector(id), index * sectorSize));
    return out;
  };

  const dirBytes = readChain(dirStart, fat);
  const entries = [];
  for (let offset = 0; offset + 128 <= dirBytes.length; offset += 128) {
    const dv = new DataView(dirBytes.buffer, dirBytes.byteOffset + offset, 128);
    const nameLength = dv.getUint16(64, true);
    if (nameLength < 2 || nameLength > 64) continue;
    let name = '';
    for (let i = 0; i < nameLength / 2 - 1; i++) name += String.fromCharCode(dv.getUint16(i * 2, true));
    entries.push({
      name,
      type: dv.getUint8(66),
      start: dv.getUint32(116, true),
      size: dv.getUint32(120, true),
    });
  }

  const root = entries.find((entry) => entry.type === 5);
  const miniStream = root ? readChain(root.start, fat).subarray(0, root.size) : new Uint8Array(0);
  const miniFatBytes = miniFatStart === ENDOFCHAIN ? new Uint8Array(0) : readChain(miniFatStart, fat);
  const miniFat = new Uint32Array(miniFatBytes.length / 4);
  for (let i = 0; i < miniFat.length; i++) {
    miniFat[i] = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset + i * 4, 4).getUint32(0, true);
  }

  const streams = new Map();
  for (const entry of entries) {
    if (entry.type !== 2) continue;
    let data;
    if (entry.size < miniCutoff) {
      const ids = chain(entry.start, miniFat);
      const buffer = new Uint8Array(ids.length * miniSectorSize);
      ids.forEach((id, index) => {
        buffer.set(miniStream.subarray(id * miniSectorSize, (id + 1) * miniSectorSize), index * miniSectorSize);
      });
      data = buffer.subarray(0, entry.size);
    } else {
      data = readChain(entry.start, fat).subarray(0, entry.size);
    }
    streams.set(entry.name, data.slice());
  }
  return { entries, streams };
}

function parseRecords(data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const records = [];
  let offset = 0;
  while (offset + 4 <= data.length) {
    const header = view.getUint32(offset, true);
    offset += 4;
    const tagId = header & 0x3ff;
    let size = (header >>> 20) & 0xfff;
    if (size === 0xfff) {
      size = view.getUint32(offset, true);
      offset += 4;
    }
    if (offset + size > data.length) break;
    records.push({ tagId, payload: data.subarray(offset, offset + size) });
    offset += size;
  }
  return records;
}

/** 제어 문자별 차지하는 코드 단위 수. */
const CONTROL_LENGTH = new Array(32).fill(1);
for (const code of [0x01, 0x02, 0x03, 0x0b, 0x0c, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x15, 0x16, 0x17]) {
  CONTROL_LENGTH[code] = 8;
}
for (const code of [0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x13, 0x14]) {
  CONTROL_LENGTH[code] = 8;
}

function decodeParaText(payload) {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const total = payload.length / 2;
  let out = '';
  let index = 0;
  while (index < total) {
    const code = view.getUint16(index * 2, true);
    if (code >= 32) {
      out += String.fromCharCode(code);
      index += 1;
      continue;
    }
    if (code === 0x0d) {
      index += 1;
      continue;
    }
    if (code === 0x0a) {
      out += '\n';
      index += 1;
      continue;
    }
    if (code === 0x18) {
      out += '-';
      index += 1;
      continue;
    }
    if (code === 0x1e || code === 0x1f) {
      out += ' ';
      index += 1;
      continue;
    }
    if (code === 0x09) {
      out += '\t';
      index += CONTROL_LENGTH[code];
      continue;
    }
    index += CONTROL_LENGTH[code] ?? 8;
  }
  return out;
}

/**
 * HWP 파일에서 문단 텍스트를 뽑는다.
 * @returns {{paragraphs: {text: string}[], text: string, sections: number, compressed: boolean}}
 */
export async function extractHwpText(bytes) {
  const cfb = readCfb(bytes);
  const header = cfb.streams.get('FileHeader');
  if (!header) throw new HwpFormatError('HWP 문서가 아닙니다. (FileHeader 없음)');
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const properties = headerView.getUint32(36, true);
  const compressed = (properties & 1) === 1;
  if (properties & 2) throw new HwpFormatError('암호가 걸린 HWP는 열 수 없습니다.');

  const sectionNames = [...cfb.streams.keys()]
    .filter((name) => /^Section\d+$/.test(name))
    .sort((a, b) => Number(a.slice(7)) - Number(b.slice(7)));

  const paragraphs = [];
  for (const name of sectionNames) {
    let data = cfb.streams.get(name);
    if (compressed) data = await inflateRaw(data);
    for (const record of parseRecords(data)) {
      if (record.tagId === 66) continue;
      if (record.tagId === 67) {
        const text = decodeParaText(record.payload);
        paragraphs.push({ text });
      }
    }
  }

  return {
    paragraphs,
    text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
    sections: sectionNames.length,
    compressed,
  };
}
