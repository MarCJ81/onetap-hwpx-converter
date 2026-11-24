/**
 * ZIP 읽기/쓰기 (HWPX 패키지용).
 *
 * 읽기: 중앙 디렉터리를 훑어 항목을 찾고, 저장 방식(0)과 raw DEFLATE(8)를
 * 모두 처리한다. 암호화된 항목(일반 플래그 bit0)은 열지 않고 알린다.
 * 쓰기: 여러 .hwp를 한 번에 내려받는 ZIP을 만든다. 압축 API가 있으면
 * deflate, 없으면 무압축으로 저장한다.
 */
import { inflateRaw, deflateRaw } from './deflate.js';

const utf8 = new TextDecoder('utf-8');

export class ZipError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZipError';
  }
}

function u16(view, offset) {
  return view.getUint16(offset, true);
}
function u32(view, offset) {
  return view.getUint32(offset, true);
}

/** 중앙 디렉터리를 읽어 항목 목록을 돌려준다. */
export function listZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const start = Math.max(0, bytes.length - 0xffff - 22);
  for (let i = bytes.length - 22; i >= start; i--) {
    if (u32(view, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError('ZIP 구조를 찾지 못했습니다. HWPX 파일이 맞는지 확인해 주세요.');

  const count = u16(view, eocd + 10);
  const cdSize = u32(view, eocd + 12);
  const cdOffset = u32(view, eocd + 16);
  if (cdOffset === 0xffffffff || count === 0xffff) {
    throw new ZipError('ZIP64 형식은 지원하지 않습니다.');
  }
  if (cdOffset + cdSize > bytes.length) throw new ZipError('ZIP 중앙 디렉터리가 손상되었습니다.');

  const entries = [];
  let cursor = cdOffset;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > bytes.length || u32(view, cursor) !== 0x02014b50) {
      throw new ZipError('ZIP 항목 헤더가 손상되었습니다.');
    }
    const flags = u16(view, cursor + 8);
    const method = u16(view, cursor + 10);
    const crc = u32(view, cursor + 16);
    const compressedSize = u32(view, cursor + 20);
    const size = u32(view, cursor + 24);
    const nameLength = u16(view, cursor + 28);
    const extraLength = u16(view, cursor + 30);
    const commentLength = u16(view, cursor + 32);
    const localOffset = u32(view, cursor + 42);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = utf8.decode(nameBytes);
    entries.push({
      name,
      flags,
      method,
      crc,
      compressedSize,
      size,
      localOffset,
      encrypted: (flags & 1) === 1,
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** 항목 하나의 압축 데이터를 풀어 돌려준다. */
export async function extractEntry(bytes, entry) {
  if (entry.encrypted) throw new ZipError('암호화된 항목은 읽을 수 없습니다.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (u32(view, entry.localOffset) !== 0x04034b50) {
    throw new ZipError('ZIP 로컬 헤더가 손상되었습니다.');
  }
  const nameLength = u16(view, entry.localOffset + 26);
  const extraLength = u16(view, entry.localOffset + 28);
  const dataStart = entry.localOffset + 30 + nameLength + extraLength;
  const data = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return data.slice();
  if (entry.method === 8) return inflateRaw(data);
  throw new ZipError(`지원하지 않는 ZIP 압축 방식입니다: ${entry.method}`);
}

/** ZIP 전체를 `Map<이름, Uint8Array>`로 읽는다. */
export async function readZip(bytes) {
  const entries = listZip(bytes);
  const files = new Map();
  const encrypted = [];
  for (const entry of entries) {
    if (entry.name.endsWith('/')) continue;
    if (entry.encrypted) {
      encrypted.push(entry.name);
      continue;
    }
    files.set(entry.name, await extractEntry(bytes, entry));
  }
  return { files, entries, encrypted };
}

/* ---------------------------------------------------------------- 쓰기 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const time =
    ((date.getHours() & 0x1f) << 11) | ((date.getMinutes() & 0x3f) << 5) | ((date.getSeconds() / 2) & 0x1f);
  const day =
    (((date.getFullYear() - 1980) & 0x7f) << 9) | (((date.getMonth() + 1) & 0xf) << 5) | (date.getDate() & 0x1f);
  return { time, date: day };
}

/**
 * ZIP 파일을 만든다.
 * @param {{name: string, data: Uint8Array}[]} files
 */
export async function writeZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const stamp = dosDateTime(new Date());
  const encoder = new TextEncoder();

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc = crc32(file.data);
    const deflated = await deflateRaw(file.data);
    const useDeflate = deflated && deflated.length < file.data.length;
    const payload = useDeflate ? deflated : file.data;
    const method = useDeflate ? 8 : 0;

    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true); // UTF-8 파일 이름
    view.setUint16(8, method, true);
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, payload.length, true);
    view.setUint32(22, file.data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);

    chunks.push(header, payload);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, stamp.time, true);
    cv.setUint16(14, stamp.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, file.data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    cd.set(nameBytes, 46);
    central.push(cd);

    offset += header.length + payload.length;
  }

  let centralSize = 0;
  for (const cd of central) centralSize += cd.length;

  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  let total = centralSize + end.length;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    out.set(chunk, cursor);
    cursor += chunk.length;
  }
  for (const cd of central) {
    out.set(cd, cursor);
    cursor += cd.length;
  }
  out.set(end, cursor);
  return out;
}
