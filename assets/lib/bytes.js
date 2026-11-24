/**
 * HWP 5.0 원시 타입용 리틀 엔디언 바이트 라이터/리더.
 *
 * HWP 레코드는 1/7200인치(HWPUNIT) 단위의 고정폭 정수 필드로 이뤄진다.
 * 여기서는 레코드를 만들 때 필요한 최소한만 담는다.
 */

export class HwpFormatError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HwpFormatError';
  }
}

export class ByteWriter {
  constructor() {
    this._chunks = [];
    this._buf = new Uint8Array(1024);
    this._len = 0;
  }

  get length() {
    let total = this._len;
    for (const chunk of this._chunks) total += chunk.length;
    return total;
  }

  _ensure(bytes) {
    if (this._len + bytes <= this._buf.length) return;
    this._chunks.push(this._buf.subarray(0, this._len));
    this._buf = new Uint8Array(Math.max(1024, bytes * 2));
    this._len = 0;
  }

  uint8(value) {
    this._ensure(1);
    this._buf[this._len++] = value & 0xff;
    return this;
  }

  int8(value) {
    return this.uint8(value < 0 ? value + 0x100 : value);
  }

  uint16(value) {
    this._ensure(2);
    const v = value & 0xffff;
    this._buf[this._len++] = v & 0xff;
    this._buf[this._len++] = (v >>> 8) & 0xff;
    return this;
  }

  int16(value) {
    return this.uint16(value < 0 ? value + 0x10000 : value);
  }

  uint32(value) {
    this._ensure(4);
    const v = value >>> 0;
    this._buf[this._len++] = v & 0xff;
    this._buf[this._len++] = (v >>> 8) & 0xff;
    this._buf[this._len++] = (v >>> 16) & 0xff;
    this._buf[this._len++] = (v >>> 24) & 0xff;
    return this;
  }

  int32(value) {
    return this.uint32(value < 0 ? value + 0x100000000 : value);
  }

  hwpUnit(value) {
    return this.uint32(Math.round(value));
  }

  sHwpUnit(value) {
    return this.int32(Math.round(value));
  }

  hwpUnit16(value) {
    return this.int16(Math.round(value));
  }

  /** `0xRRGGBB`(또는 `0xAARRGGBB`)를 HWP의 COLORREF `0x00BBGGRR`로 쓴다. */
  color(value) {
    const v = value >>> 0;
    const r = (v >>> 16) & 0xff;
    const g = (v >>> 8) & 0xff;
    const b = v & 0xff;
    const a = (v >>> 24) & 0xff;
    // 알파가 0xFF인 "없음" 표기는 그대로 0xFFFFFFFF로 보존한다.
    if (a === 0xff && r === 0xff && g === 0xff && b === 0xff) return this.uint32(0xffffffff);
    return this.uint32(((b << 16) | (g << 8) | r) >>> 0);
  }

  /** UTF-16 코드 단위 개수(uint16) + 데이터. NUL 종결자 없음. */
  string(value) {
    const text = String(value ?? '');
    this.uint16(text.length);
    return this.wchars(text);
  }

  wchars(value) {
    for (let i = 0; i < value.length; i++) this.uint16(value.charCodeAt(i));
    return this;
  }

  bytes(value) {
    if (!value || value.length === 0) return this;
    this._ensure(value.length);
    this._buf.set(value, this._len);
    this._len += value.length;
    return this;
  }

  zeros(count) {
    this._ensure(count);
    this._len += count;
    return this;
  }

  /** double (little endian) — 개체 변환 행렬에 쓴다. */
  double(value) {
    this._ensure(8);
    new DataView(this._buf.buffer, this._buf.byteOffset + this._len, 8).setFloat64(0, value, true);
    this._len += 8;
    return this;
  }

  finish() {
    const total = this.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of this._chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    out.set(this._buf.subarray(0, this._len), offset);
    return out;
  }
}

export class ByteReader {
  constructor(bytes) {
    this._bytes = bytes;
    this._view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this._offset = 0;
  }

  get offset() {
    return this._offset;
  }

  get length() {
    return this._bytes.length;
  }

  get remaining() {
    return this._bytes.length - this._offset;
  }

  hasMore(bytes = 1) {
    return this.remaining >= bytes;
  }

  uint8() {
    return this._view.getUint8(this._offset++);
  }

  uint16() {
    const v = this._view.getUint16(this._offset, true);
    this._offset += 2;
    return v;
  }

  uint32() {
    const v = this._view.getUint32(this._offset, true);
    this._offset += 4;
    return v;
  }

  int32() {
    const v = this._view.getInt32(this._offset, true);
    this._offset += 4;
    return v;
  }

  skip(n) {
    this._offset += n;
  }

  /** UTF-16 문자열: uint16 길이 + 코드 단위. */
  string() {
    if (!this.hasMore(2)) return '';
    const count = this.uint16();
    if (!this.hasMore(count * 2)) return '';
    return this.wchars(count);
  }

  wchars(count) {
    let out = '';
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this._view.getUint16(this._offset + i * 2, true));
      if (codes.length === 4096) {
        out += String.fromCharCode.apply(null, codes);
        codes.length = 0;
      }
    }
    if (codes.length) out += String.fromCharCode.apply(null, codes);
    this._offset += count * 2;
    return out;
  }
}

/** 비트필드에서 `start..end` 비트를 읽는다. */
export const bits = (value, start, end) => (value >>> start) & ((1 << (end - start + 1)) - 1);

/** 비트 하나를 읽는다. */
export const bit = (value, index) => ((value >>> index) & 1) === 1;

/** `start..end` 비트에 값을 쓴다. */
export const setBits = (target, start, end, value) => {
  const width = end - start + 1;
  const mask = ((1 << width) - 1) << start;
  return ((target & ~mask) | ((value << start) & mask)) >>> 0;
};

/** 비트 하나를 켜거나 끈다. */
export const setBit = (target, index, value) =>
  value ? (target | (1 << index)) >>> 0 : (target & ~(1 << index)) >>> 0;

/** 바이트 배열을 이어 붙인다. */
export const concatBytes = (chunks) => {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
};
