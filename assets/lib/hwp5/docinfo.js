/**
 * `DocInfo` 스트림 — 문서 전역 서식 표.
 *
 * HWP는 서식을 글자에 직접 붙이지 않는다. 텍스트는 글자 모양 id를, 문단은
 * 문단 모양 id를 가리키고, 그 모양들이 이 표에 산다. HWPX의 `header.xml`에
 * 있던 정의를 같은 순서·같은 개수로 옮겨 적는다.
 */
import { ByteWriter, setBit, setBits } from '../bytes.js';
import { RecordWriter } from './record.js';

export const DocInfoTag = {
  DocumentProperties: 16,
  IdMappings: 17,
  BinData: 18,
  FaceName: 19,
  BorderFill: 20,
  CharShape: 21,
  TabDef: 22,
  Numbering: 23,
  Bullet: 24,
  ParaShape: 25,
  Style: 26,
};

const ID_MAPPING_SLOTS = [
  'binData',
  'fontHangul',
  'fontLatin',
  'fontHanja',
  'fontJapanese',
  'fontOther',
  'fontSymbol',
  'fontUser',
  'borderFill',
  'charShape',
  'tabDef',
  'numbering',
  'bullet',
  'paraShape',
  'style',
  'memoShape',
  'trackChange',
  'trackChangeAuthor',
];

/** HWPX에 정의가 하나도 없을 때 쓰는 최소 서식. */
export function normalizeResources(resources) {
  const out = { ...resources };
  out.fonts = (resources.fonts ?? []).map((list) => (list.length ? list.slice() : []));
  if (out.fonts.length !== 7) out.fonts = Array.from({ length: 7 }, () => []);
  const anyFont = out.fonts.find((list) => list.length > 0);
  for (let i = 0; i < 7; i++) {
    if (out.fonts[i].length === 0) out.fonts[i] = anyFont ? anyFont.slice() : ['함초롬바탕'];
  }

  out.charShapes = (resources.charShapes ?? []).slice();
  if (out.charShapes.length === 0) {
    out.charShapes.push({
      fontIds: [0, 0, 0, 0, 0, 0, 0],
      ratios: [100, 100, 100, 100, 100, 100, 100],
      spacings: [0, 0, 0, 0, 0, 0, 0],
      relSizes: [100, 100, 100, 100, 100, 100, 100],
      offsets: [0, 0, 0, 0, 0, 0, 0],
      height: 1000,
      textColor: 0,
      shadeColor: 0xffffffff,
      borderFillId: 0,
    });
  }

  out.paraShapes = (resources.paraShapes ?? []).slice();
  if (out.paraShapes.length === 0) {
    out.paraShapes.push({
      align: 0,
      verticalAlign: 0,
      marginLeft: 0,
      marginRight: 0,
      indent: 0,
      marginTop: 0,
      marginBottom: 0,
      lineSpacing: { kind: 0, value: 160 },
      tabDefId: 0,
      snapToGrid: true,
    });
  }

  out.borderFills = (resources.borderFills ?? []).slice();
  if (out.borderFills.length === 0) {
    out.borderFills.push({
      threeD: false,
      shadow: false,
      left: { type: 0, width: 0, color: 0 },
      right: { type: 0, width: 0, color: 0 },
      top: { type: 0, width: 0, color: 0 },
      bottom: { type: 0, width: 0, color: 0 },
      diagonal: { type: 0, width: 0, color: 0 },
      fill: { kind: 'none' },
    });
  }

  out.styles = (resources.styles ?? []).slice();
  if (out.styles.length === 0) {
    out.styles.push({
      name: '바탕글',
      englishName: 'Normal',
      kind: 0,
      paraShapeId: 0,
      charShapeId: 0,
      nextStyleId: 0,
      langId: 1042,
      lockForm: false,
    });
  }

  out.tabDefs = (resources.tabDefs ?? []).slice();
  out.numberings = (resources.numberings ?? []).slice();
  out.bullets = (resources.bullets ?? []).slice();
  return out;
}

/* ---------------------------------------------------------------- 쓰기 */

function writeDocumentProperties(sectionCount, settings) {
  return new ByteWriter()
    .uint16(sectionCount)
    .uint16(1)
    .uint16(1)
    .uint16(1)
    .uint16(1)
    .uint16(1)
    .uint16(1)
    .uint32(settings?.caretList ?? 0)
    .uint32(settings?.caretParagraph ?? 0)
    .uint32(settings?.caretPosition ?? 0);
}

function writeIdMappings(resources, binDataCount) {
  const counts = {
    binData: binDataCount,
    fontHangul: resources.fonts[0].length,
    fontLatin: resources.fonts[1].length,
    fontHanja: resources.fonts[2].length,
    fontJapanese: resources.fonts[3].length,
    fontOther: resources.fonts[4].length,
    fontSymbol: resources.fonts[5].length,
    fontUser: resources.fonts[6].length,
    borderFill: resources.borderFills.length,
    charShape: resources.charShapes.length,
    tabDef: resources.tabDefs.length,
    numbering: resources.numberings.length,
    bullet: resources.bullets.length,
    paraShape: resources.paraShapes.length,
    style: resources.styles.length,
    memoShape: 0,
    trackChange: 0,
    trackChangeAuthor: 0,
  };
  const writer = new ByteWriter();
  for (const slot of ID_MAPPING_SLOTS) writer.int32(counts[slot]);
  return writer;
}

function writeBinData(item, index) {
  const writer = new ByteWriter();
  // bit0-3: 종류(0=링크, 1=내장, 2=저장), bit4-5: 압축 방식(0=기본,1=압축,2=비압축)
  // 그림은 문서 안에 넣는 "내장"이고, 압축 방식은 문서 압축 플래그를 따른다.
  writer.uint16(1 | ((item.compressed === false ? 2 : 0) << 4));
  writer.uint16(index + 1);
  writer.string(item.ext ?? 'bin');
  return writer;
}

/** 한글 기본 글꼴의 영문 이름 — 글꼴 레코드의 "기본 글꼴 이름"에 들어간다. */
const LATIN_FONT_NAMES = {
  함초롬돋움: 'HCR Dotum',
  함초롬바탕: 'HCR Batang',
  함초롬돋움체: 'HCR Dotum',
  함초롬바탕체: 'HCR Batang',
  HY견고딕: 'HYGothic-Medium',
  휴먼명조: 'HmBatang',
  굴림: 'Gulim',
  굴림체: 'GulimChe',
  돋움: 'Dotum',
  돋움체: 'DotumChe',
  바탕: 'Batang',
  바탕체: 'BatangChe',
  맑은고딕: 'Malgun Gothic',
  새굴림: 'Saemul',
  한양한강체: 'HYHanGang',
};

function latinFontName(name) {
  const text = String(name ?? '');
  if (LATIN_FONT_NAMES[text]) return LATIN_FONT_NAMES[text];
  return /^[\x20-\x7e]*$/.test(text) ? text : '';
}

/** PANOSE-1 글꼴 유형 정보 — 한글이 쓰는 기본값. */
const DEFAULT_PANOSE = [0x02, 0x03, 0x05, 0x04, 0x00, 0x01, 0x01, 0x01, 0x01, 0x01];

function writeFaceName(name) {
  const writer = new ByteWriter();
  // bit0-1: 글꼴 파일 형식(TTF=1), bit5: 기본 글꼴, bit6: 글꼴 유형 정보 있음
  writer.uint8(0x61);
  writer.string(name);
  for (const value of DEFAULT_PANOSE) writer.uint8(value);
  writer.string(latinFontName(name));
  return writer;
}

function writeBorderFill(fill) {
  const writer = new ByteWriter();
  let properties = 0;
  properties = setBit(properties, 0, fill.threeD);
  properties = setBit(properties, 1, fill.shadow);
  properties = setBit(properties, 4, fill.breakCellSeparateLine);
  writer.uint16(properties);

  const lines = [fill.left, fill.right, fill.top, fill.bottom];
  // 테두리 하나는 (선 종류 1바이트, 굵기 1바이트, 색 4바이트) 6바이트다.
  // 네 변을 따로 묶어 쓰면 한글이 선을 전혀 다른 변으로 읽는다.
  for (const line of lines) {
    writer.uint8(line?.type ?? 0);
    writer.uint8(line?.width ?? 0);
    writer.color(line?.color ?? 0);
  }

  const diagonal = fill.diagonal ?? { type: 0, width: 0, color: 0 };
  writer.uint8(diagonal.type ?? 0);
  writer.uint8(diagonal.width ?? 0);
  writer.color(diagonal.color ?? 0);

  const value = fill.fill ?? { kind: 'none' };
  if (value.kind === 'color') {
    writer.uint32(1);
    writer.color(value.faceColor ?? 0xffffff);
    writer.color(value.hatchColor ?? 0);
    writer.int32(-1);
  } else if (value.kind === 'gradient') {
    const colors = value.colors ?? [];
    writer.uint32(4);
    writer.uint8(value.gradientType ?? 1);
    writer.int32(value.angle ?? 0);
    writer.int32(value.centerX ?? 0);
    writer.int32(value.centerY ?? 0);
    writer.int32(value.step ?? 0);
    writer.int32(colors.length);
    for (const color of colors) writer.color(color);
  } else {
    writer.uint32(0);
  }
  // 한글 5.0.2.5 이후가 남기는 꼬리 4바이트.
  writer.uint32(0);
  return writer;
}

function writeCharShape(shape) {
  const writer = new ByteWriter();
  for (let i = 0; i < 7; i++) writer.uint16(shape.fontIds?.[i] ?? 0);
  for (let i = 0; i < 7; i++) writer.uint8(shape.ratios?.[i] ?? 100);
  for (let i = 0; i < 7; i++) writer.int8(shape.spacings?.[i] ?? 0);
  for (let i = 0; i < 7; i++) writer.uint8(shape.relSizes?.[i] ?? 100);
  for (let i = 0; i < 7; i++) writer.int8(shape.offsets?.[i] ?? 0);

  writer.int32(shape.height ?? 1000);

  let properties = 0;
  properties = setBit(properties, 0, shape.italic);
  properties = setBit(properties, 1, shape.bold);
  properties = setBits(properties, 2, 3, shape.underline?.kind ?? 0);
  properties = setBits(properties, 4, 7, shape.underline?.style ?? 0);
  properties = setBits(properties, 8, 10, shape.outline ?? 0);
  properties = setBits(properties, 11, 12, shape.shadow?.kind ?? 0);
  properties = setBit(properties, 13, shape.emboss);
  properties = setBit(properties, 14, shape.engrave);
  properties = setBit(properties, 15, shape.superscript);
  properties = setBit(properties, 16, shape.subscript);
  // 취소선 종류는 비트 18-20, 선 모양은 비트 26-29다. 한글은 모양 필드로
  // 취소선 유무를 판단하므로 둘 다 채운다.
  properties = setBits(properties, 18, 20, shape.strikeout ? 1 : 0);
  properties = setBits(properties, 21, 24, shape.emphasis ?? 0);
  properties = setBit(properties, 25, shape.useFontSpace);
  properties = setBits(properties, 26, 29, shape.strikeout?.style ?? 0);
  properties = setBit(properties, 30, shape.useKerning);
  writer.uint32(properties);

  writer.int8(shape.shadow?.offsetX ?? 0);
  writer.int8(shape.shadow?.offsetY ?? 0);
  writer.color(shape.textColor ?? 0);
  writer.color(shape.underline?.color ?? 0);
  writer.color(shape.shadeColor ?? 0xffffffff);
  writer.color(shape.shadow?.color ?? 0);
  writer.uint16(shape.borderFillId ?? 0);
  writer.color(shape.strikeout?.color ?? 0);
  return writer;
}

function writeTabDef(def) {
  const writer = new ByteWriter();
  let properties = 0;
  properties = setBit(properties, 0, def.autoTabLeft);
  properties = setBit(properties, 1, def.autoTabRight);
  writer.uint32(properties);
  writer.int32(def.stops.length);
  for (const stop of def.stops) {
    writer.hwpUnit(stop.position ?? 0);
    writer.uint8(stop.kind ?? 0);
    writer.uint8(stop.fillStyle ?? 0);
    writer.uint16(0);
  }
  return writer;
}

function writeParagraphHead(writer, level) {
  let properties = 0;
  properties = setBits(properties, 0, 1, level.align ?? 0);
  properties = setBit(properties, 2, level.includeUpperLevels);
  properties = setBit(properties, 3, level.distanceIsRatio);
  properties = setBits(properties, 12, 15, level.numberFormat ?? 0);
  writer.uint32(properties);
  writer.int16(level.widthAdjust ?? 0);
  writer.int16(level.distance ?? 50);
  writer.uint32(level.charShapeId ?? 0xffffffff);
  writer.string(level.format ?? '');
}

function writeNumbering(numbering) {
  const writer = new ByteWriter();
  for (let i = 0; i < 7; i++) {
    const level = numbering.levels[i] ?? {
      format: `^${i + 1}.`,
      numberFormat: 0,
      align: 0,
      widthAdjust: 0,
      distance: 50,
      distanceIsRatio: true,
    };
    writeParagraphHead(writer, level);
  }
  writer.uint16(numbering.start ?? 1);
  // 한글 5.0.3.0 이후가 남기는 예약 필드 7개.
  for (let i = 0; i < 7; i++) writer.uint32(0);
  return writer;
}

function writeBullet(bullet) {
  const writer = new ByteWriter();
  let flags = 0;
  flags = setBits(flags, 0, 1, bullet.align ?? 0);
  flags = setBit(flags, 3, bullet.autoIndent);
  writer.uint32(flags);
  writer.hwpUnit16(bullet.width ?? 0);
  writer.uint16(bullet.space ?? 0);
  writer.int32(bullet.charShapeId ?? 0);
  const char = bullet.char && bullet.char.length ? bullet.char.charCodeAt(0) : 0x2022;
  writer.uint16(char);
  return writer;
}

function writeParaShape(shape) {
  const writer = new ByteWriter();

  let properties1 = 0;
  properties1 = setBits(properties1, 0, 1, shape.lineSpacing?.kind ?? 0);
  properties1 = setBits(properties1, 2, 4, shape.align ?? 0);
  properties1 = setBits(properties1, 5, 6, shape.lineBreakLatin ?? 0);
  properties1 = setBit(properties1, 7, shape.lineBreakHangul === 1);
  properties1 = setBit(properties1, 8, shape.snapToGrid);
  properties1 = setBit(properties1, 16, shape.widowOrphan);
  properties1 = setBit(properties1, 17, shape.keepWithNext);
  properties1 = setBit(properties1, 18, shape.keepLines);
  properties1 = setBit(properties1, 19, shape.pageBreakBefore);
  properties1 = setBits(properties1, 20, 21, shape.verticalAlign ?? 0);
  properties1 = setBit(properties1, 22, shape.fontLineHeight);
  properties1 = setBits(properties1, 23, 24, shape.heading?.type ?? 0);
  properties1 = setBits(properties1, 25, 27, shape.heading?.level ?? 0);
  properties1 = setBit(properties1, 28, shape.border?.connect);
  properties1 = setBit(properties1, 29, shape.border?.ignoreMargin);

  writer.uint32(properties1);
  writer.int32(shape.marginLeft ?? 0);
  writer.int32(shape.marginRight ?? 0);
  writer.int32(shape.indent ?? 0);
  writer.int32(shape.marginTop ?? 0);
  writer.int32(shape.marginBottom ?? 0);
  writer.int32(shape.lineSpacing?.value ?? 160);
  writer.uint16(shape.tabDefId ?? 0);
  writer.uint16(shape.heading?.idRef ?? 0);
  writer.uint16(shape.border?.borderFillId ?? 0);
  writer.int16(shape.border?.offsetLeft ?? 0);
  writer.int16(shape.border?.offsetRight ?? 0);
  writer.int16(shape.border?.offsetTop ?? 0);
  writer.int16(shape.border?.offsetBottom ?? 0);

  let properties2 = 0;
  properties2 = setBit(properties2, 4, shape.autoSpaceLatin);
  properties2 = setBit(properties2, 5, shape.autoSpaceNumber);
  writer.uint32(properties2);

  let properties3 = 0;
  properties3 = setBits(properties3, 0, 4, shape.lineSpacing?.kind ?? 0);
  writer.uint32(properties3);
  writer.uint32(shape.lineSpacing?.value ?? 160);
  return writer;
}

function writeStyle(style, paraShapeCount, charShapeCount) {
  const writer = new ByteWriter();
  const paraShapeId = Math.max(0, Math.min(style.paraShapeId ?? 0, Math.max(0, paraShapeCount - 1)));
  const charShapeId = Math.max(0, Math.min(style.charShapeId ?? 0, Math.max(0, charShapeCount - 1)));
  const nextStyleId = Math.max(0, Math.min(style.nextStyleId ?? 0, 255));
  writer.string(style.name ?? '');
  writer.string(style.englishName ?? '');
  let properties = 0;
  properties = setBits(properties, 0, 2, style.kind === 1 ? 1 : 0);
  properties = setBit(properties, 3, style.lockForm);
  writer.uint8(properties);
  writer.uint8(nextStyleId);
  writer.int16(style.langId ?? 1042);
  writer.uint16(paraShapeId);
  writer.uint16(charShapeId);
  writer.uint16(0);
  return writer;
}

/** 문서 전체의 `DocInfo` 스트림 바이트를 만든다. */
export function buildDocInfo(doc) {
  const resources = doc.resources;
  const writer = new RecordWriter();

  writer.write(DocInfoTag.DocumentProperties, writeDocumentProperties(doc.sections.length, doc.settings));
  writer.write(DocInfoTag.IdMappings, writeIdMappings(resources, doc.binData.length));

  doc.binData.forEach((item, index) => writer.write(DocInfoTag.BinData, writeBinData(item, index)));

  for (let lang = 0; lang < 7; lang++) {
    for (const name of resources.fonts[lang]) writer.write(DocInfoTag.FaceName, writeFaceName(name));
  }
  for (const fill of resources.borderFills) writer.write(DocInfoTag.BorderFill, writeBorderFill(fill));
  for (const shape of resources.charShapes) writer.write(DocInfoTag.CharShape, writeCharShape(shape));
  for (const def of resources.tabDefs) writer.write(DocInfoTag.TabDef, writeTabDef(def));
  for (const numbering of resources.numberings) writer.write(DocInfoTag.Numbering, writeNumbering(numbering));
  for (const bullet of resources.bullets) writer.write(DocInfoTag.Bullet, writeBullet(bullet));
  for (const shape of resources.paraShapes) writer.write(DocInfoTag.ParaShape, writeParaShape(shape));
  for (const style of resources.styles) {
    writer.write(DocInfoTag.Style, writeStyle(style, resources.paraShapes.length, resources.charShapes.length));
  }

  return writer.finish();
}
