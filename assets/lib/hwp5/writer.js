/**
 * HWP 5.0 파일 조립.
 *
 * 스트림 구성:
 *   FileHeader (256바이트, 압축 안 함)
 *   DocInfo
 *   BodyText/Section0 … SectionN
 *   BinData/BIN0001.png …   (그림이 있을 때)
 *
 * 압축 플래그가 켜지면 레코드 스트림만 raw DEFLATE로 압축한다.
 */
import { ByteWriter } from '../bytes.js';
import { deflateRaw } from '../deflate.js';
import { writeCfb } from './cfb.js';
import { buildDocInfo, normalizeResources } from './docinfo.js';
import { buildSection } from './bodytext.js';

/**
 * HWP 5.0.3.0 — 한글 2010까지도 경고 없이 여는 버전.
 *
 * 5.1.0.0으로 적으면 한글 2010/2014가 "상위 버전에서 작성한 문서입니다"
 * 경고를 띄운다. 만드는 구조는 모두 HWP 5.0.3.0 규격이므로 버전도 그에 맞춘다.
 */
const VERSION = 0x05000300;
const SIGNATURE = 'HWP Document File';

function buildFileHeader(compressed) {
  const writer = new ByteWriter();
  const signature = new TextEncoder().encode(SIGNATURE);
  writer.bytes(signature);
  writer.zeros(32 - signature.length);
  writer.uint32(VERSION);
  let properties = 0;
  if (compressed) properties |= 1;
  writer.uint32(properties);
  writer.uint32(0); // 라이선스
  writer.uint32(0); // 암호화 버전
  writer.uint8(0); // KOGL 국가 코드
  writer.zeros(256 - 49);
  return writer.finish();
}

function previewText(doc) {
  const lines = [];
  for (const section of doc.sections) {
    for (const paragraph of section.paragraphs) {
      let line = '';
      for (const run of paragraph.runs) {
        for (const item of run.items) {
          if (item.type === 'text') line += item.value;
          else if (item.type === 'tab') line += '\t';
          else if (item.type === 'lineBreak') line += '\n';
        }
      }
      lines.push(line);
      if (lines.length >= 200) break;
    }
    if (lines.length >= 200) break;
  }
  return lines.join('\r\n');
}

/**
 * IR 문서를 HWP 5.0 바이트로 만든다.
 * @param {object} doc parseHwpx() 결과
 */
export async function writeHwp(doc) {
  const resources = normalizeResources(doc.resources);
  const prepared = {
    ...doc,
    resources,
    binData: doc.binData ?? [],
    sections: doc.sections,
    settings: doc.settings ?? {},
  };

  const probe = await deflateRaw(new Uint8Array(32));
  const canCompress = Boolean(probe);

  // 그림 스트림은 압축 여부를 DocInfo에 먼저 적어야 하므로 여기서 정한다.
  const binDataStreams = [];
  for (const item of prepared.binData) {
    const raw = item.data;
    // 문서가 압축 문서이면 BinData 스트림도 raw DEFLATE로 압축해 넣는다.
    // (DocInfo의 BIN_DATA 레코드가 "기본" 압축 방식을 가리키므로 문서 압축
    //  플래그를 그대로 따른다.)
    const deflated = canCompress ? await deflateRaw(raw) : null;
    binDataStreams.push({
      path: `BinData/${item.id}.${item.ext}`,
      data: deflated ?? raw,
      compressed: Boolean(deflated),
    });
  }
  prepared.binData = prepared.binData.map((item, index) => ({
    ...item,
    compressed: binDataStreams[index].compressed,
  }));

  const docInfoRaw = buildDocInfo(prepared);
  const sections = prepared.sections.map((section) => buildSection(prepared, section));

  const streams = {};
  streams.FileHeader = buildFileHeader(canCompress);

  const pack = async (bytes) => {
    if (!canCompress) return bytes;
    const deflated = await deflateRaw(bytes);
    return deflated ?? bytes;
  };

  streams.DocInfo = await pack(docInfoRaw);
  for (let index = 0; index < sections.length; index++) {
    streams[`BodyText/Section${index}`] = await pack(sections[index]);
  }
  for (const item of binDataStreams) {
    streams[item.path] = item.data;
  }

  const text = previewText(prepared);
  if (text) {
    // PrvText는 한글 미리보기용 UTF-16LE 텍스트다 (압축하지 않는다).
    const bytes = new Uint8Array(text.length * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < text.length; i++) view.setUint16(i * 2, text.charCodeAt(i), true);
    streams.PrvText = bytes;
  }

  return writeCfb(streams);
}
