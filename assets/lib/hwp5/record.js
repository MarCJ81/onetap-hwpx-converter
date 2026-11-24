/**
 * HWP 레코드 스트림.
 *
 * 각 레코드는 4바이트 리틀 엔디언 헤더 뒤에 페이로드가 붙는다.
 *   bits 0..9   태그 id
 *   bits 10..19 중첩 레벨
 *   bits 20..31 페이로드 길이 (0xFFF면 다음 4바이트가 실제 길이)
 */
import { ByteWriter, HwpFormatError } from '../bytes.js';

const SIZE_ESCAPE = 0xfff;

export function serializeRecords(records) {
  const writer = new ByteWriter();
  for (const record of records) {
    if (record.tagId > 0x3ff) throw new HwpFormatError(`잘못된 태그 id: ${record.tagId}`);
    if (record.level > 0x3ff) throw new HwpFormatError(`잘못된 레벨: ${record.level}`);
    const size = record.payload.length;
    const long = size >= SIZE_ESCAPE;
    const header =
      ((record.tagId & 0x3ff) |
        ((record.level & 0x3ff) << 10) |
        (((long ? SIZE_ESCAPE : size) & 0xfff) << 20)) >>>
      0;
    writer.uint32(header);
    if (long) writer.uint32(size);
    writer.bytes(record.payload);
  }
  return writer.finish();
}

/**
 * 중첩 레벨을 스스로 관리하는 레코드 라이터.
 * `nested()`는 레코드를 쓰고 그 자식들을 한 단계 깊게 만든다.
 */
export class RecordWriter {
  constructor() {
    this._records = [];
    this._level = 0;
  }

  get level() {
    return this._level;
  }

  get records() {
    return this._records;
  }

  write(tagId, payload) {
    this._records.push({
      tagId,
      level: this._level,
      payload: payload instanceof ByteWriter ? payload.finish() : payload,
    });
    return this;
  }

  nested(tagId, payload, build) {
    this.write(tagId, payload);
    this._level++;
    try {
      build();
    } finally {
      this._level--;
    }
    return this;
  }

  descend(build) {
    this._level++;
    try {
      build();
    } finally {
      this._level--;
    }
    return this;
  }

  finish() {
    return serializeRecords(this._records);
  }
}
