/**
 * `BodyText/Section{N}` — 문단 스트림.
 *
 * 한 문단은 PARA_HEADER 하나와 그 자식들(PARA_TEXT, PARA_CHAR_SHAPE, 컨트롤)로
 * 이뤄진다. PARA_TEXT는 UTF-16 코드 단위 배열이고, 0-31 제어 문자는 컨트롤을
 * 나타낸다. 제어 문자마다 차지하는 길이가 다르다.
 *
 *   한 글자(0x0A 줄바꿈, 0x0D 문단 끝, 0x18 하이픈, 0x1E/0x1F 공백)
 *   8글자(0x02 구역 정의, 0x0B 표/그림, 0x10 머리말, 0x11 각주, 0x16 책갈피 …)
 *     — 가운데 6글자는 예약, 마지막 글자는 같은 코드의 반복
 *
 * 8글자 컨트롤은 뒤따르는 CTRL_HEADER 레코드를 차례대로 소비한다.
 */
import { ByteWriter, setBit, setBits } from '../bytes.js';
import { RecordWriter } from './record.js';

export const SectionTag = {
  ParaHeader: 66,
  ParaText: 67,
  ParaCharShape: 68,
  ParaLineSeg: 69,
  CtrlHeader: 71,
  ListHeader: 72,
  PageDef: 73,
  FootnoteShape: 74,
  PageBorderFill: 75,
  ShapeComponent: 76,
  Table: 77,
  ShapeComponentPicture: 85,
  CtrlData: 87,
  EqEdit: 88,
};

const CTRL = {
  Table: 'tbl ',
  DrawingObject: 'gso ',
  SectionDefinition: 'secd',
  ColumnDefinition: 'cold',
  Header: 'head',
  Footer: 'foot',
  Footnote: 'fn  ',
  Endnote: 'en  ',
  AutoNumber: 'atno',
  Equation: 'eqed',
};

const CHAR_TAB = 0x09;
const CHAR_LINE_BREAK = 0x0a;
const CHAR_PARA_BREAK = 0x0d;
const CHAR_HYPHEN = 0x18;
const CHAR_NBSP = 0x1e;
const CHAR_FIXED_SPACE = 0x1f;
const CHAR_TITLE_MARK = 0x08;
const CHAR_OBJECT = 0x0b;
const CHAR_SECTION = 0x02;
const CHAR_HEADER = 0x10;
const CHAR_FOOTNOTE = 0x11;

/** 네 글자 컨트롤 id를 DWORD로. */
function ctrlId(value) {
  const padded = String(value).padEnd(4, ' ');
  return (
    ((padded.charCodeAt(0) << 24) |
      (padded.charCodeAt(1) << 16) |
      (padded.charCodeAt(2) << 8) |
      padded.charCodeAt(3)) >>>
    0
  );
}

function clamped(id, length) {
  if (!length) return 0;
  const value = Number.isFinite(id) ? id : 0;
  return Math.max(0, Math.min(value, length - 1));
}

/* -------------------------------------------------------------- 문단 쓰기 */

function newParagraphState() {
  return { codes: [], charShapes: [], controls: [], mask: 0 };
}

function markControl(state, code) {
  state.mask |= 1 << code;
}

function pushExtended(state, code, payload = []) {
  markControl(state, code);
  state.codes.push(code);
  for (let i = 0; i < 6; i++) state.codes.push(payload[i] ?? 0);
  state.codes.push(code);
}

/** 컨트롤 id를 PARA_TEXT 안에 넣는 코드 단위로 바꾼다 (바이트 역순, 4글자). */
function ctrlIdCodes(id) {
  const padded = String(id).padEnd(4, ' ');
  return [
    padded.charCodeAt(3),
    padded.charCodeAt(2),
    padded.charCodeAt(1),
    padded.charCodeAt(0),
  ];
}

function pushInline(state, code, payload = []) {
  markControl(state, code);
  state.codes.push(code);
  for (let i = 0; i < 6; i++) state.codes.push(payload[i] ?? 0);
  state.codes.push(code);
}

function encodeParagraph(paragraph, options = {}) {
  const state = newParagraphState();

  if (options.section) {
    // 구역 정의(secd)와 단 정의(cold)는 본문 첫 문단의 글자 흐름 안에
    // 8글자 제어 문자로 자리를 잡고, 예약 6글자에 컨트롤 id를 담는다.
    // id가 비어 있으면 한글이 알 수 없는 컨트롤로 보고 "파일이 손상되었습니다"를 띄운다.
    pushExtended(state, CHAR_SECTION, ctrlIdCodes(CTRL.SectionDefinition));
    state.controls.push({ type: 'section', section: options.section });
    pushExtended(state, CHAR_SECTION, ctrlIdCodes(CTRL.ColumnDefinition));
    state.controls.push({ type: 'columns', section: options.section });
  }

  let lastShape = -1;
  for (const run of paragraph.runs) {
    if (run.charShapeId !== lastShape) {
      state.charShapes.push({ position: state.codes.length, charShapeId: run.charShapeId ?? 0 });
      lastShape = run.charShapeId ?? 0;
    }
    for (const item of run.items) {
      switch (item.type) {
        case 'autoNumber':
          pushExtended(state, 0x12, ctrlIdCodes(CTRL.AutoNumber));
          state.controls.push(item);
          break;
        case 'text':
          for (let i = 0; i < item.value.length; i++) {
            const code = item.value.charCodeAt(i);
            if (code === CHAR_TAB) {
              pushInline(state, CHAR_TAB, [0, 0]);
            } else if (code === 0x0a) {
              markControl(state, CHAR_LINE_BREAK);
              state.codes.push(CHAR_LINE_BREAK);
            } else if (code === 0x0d) {
              /* 문단 끝은 아래에서 한 번만 넣는다. */
            } else if (code < 0x20) {
              /* HWP가 모르는 제어 문자는 버린다. */
            } else {
              state.codes.push(code);
            }
          }
          break;
        case 'tab':
          pushInline(state, CHAR_TAB, [item.width & 0xffff, (item.width >>> 16) & 0xffff]);
          break;
        case 'lineBreak':
          markControl(state, CHAR_LINE_BREAK);
          state.codes.push(CHAR_LINE_BREAK);
          break;
        case 'special':
          if (item.char === 'hyphen') state.codes.push(CHAR_HYPHEN);
          else if (item.char === 'nbsp') state.codes.push(CHAR_NBSP);
          else if (item.char === 'fixedWidthSpace') state.codes.push(CHAR_FIXED_SPACE);
          else if (item.char === 'titleMark') pushInline(state, CHAR_TITLE_MARK);
          break;
        case 'table':
        case 'picture':
        case 'equation':
          pushExtended(state, CHAR_OBJECT);
          state.controls.push(item);
          break;
        case 'header':
        case 'footer':
          pushExtended(state, CHAR_HEADER);
          state.controls.push(item);
          break;
        case 'footnote':
        case 'endnote':
          pushExtended(state, CHAR_FOOTNOTE);
          state.controls.push(item);
          break;
        default:
          /* 필드·책갈피·미지원 개체는 본문 흐름만 남기고 컨트롤은 생략한다. */
          break;
      }
    }
  }

  state.codes.push(CHAR_PARA_BREAK);
  // 컨트롤이 하나라도 있으면 문단 제어 마스크의 "컨트롤 포함" 비트(11)를 켜다.
  // 한글은 이 비트가 없으면 뒤따르는 CTRL_HEADER를 읽지 않는다.
  if (state.controls.length > 0) state.mask |= 1 << 11;
  if (state.charShapes.length === 0) {
    state.charShapes.push({ position: 0, charShapeId: paragraph.runs[0]?.charShapeId ?? 0 });
  } else if (state.charShapes[0].position > 0) {
    // 한글은 문단 첫 글자 모양 항목을 항상 위치 0에 둔다. 문단 앞쪽 제어 문자도
    // 그 글자 모양을 쓴다.
    state.charShapes.unshift({ position: 0, charShapeId: state.charShapes[0].charShapeId });
  }
  // 같은 자리·같은 모양 항목이 겹치면 한글이 어느 것을 쓸지 모호해진다.
  const merged = [];
  for (const entry of state.charShapes) {
    const last = merged[merged.length - 1];
    if (last && last.position === entry.position) last.charShapeId = entry.charShapeId;
    else if (last && last.charShapeId === entry.charShapeId) continue;
    else merged.push({ ...entry });
  }
  state.charShapes = merged;
  return state;
}

function writeParagraph(writer, doc, paragraph, options = {}) {
  const state = encodeParagraph(paragraph, options);

  const header = new ByteWriter();
  const count = state.codes.length;
  header.uint32(options.last ? (count | 0x80000000) >>> 0 : count);
  header.uint32(state.mask);
  header.uint16(clamped(paragraph.paraShapeId, doc.resources.paraShapes.length));
  header.uint8(clamped(paragraph.styleId, doc.resources.styles.length) & 0xff);
  let split = 0;
  split = setBit(split, 0, options.firstOfSection);
  split = setBit(split, 1, options.firstOfSection);
  split = setBit(split, 2, paragraph.pageBreak);
  split = setBit(split, 3, paragraph.columnBreak);
  header.uint8(split);
  header.uint16(state.charShapes.length);
  header.uint16(0); // 범위 태그 수
  header.uint16(options.lineHeight ? 1 : 0); // 줄 배치 레코드 수
  header.uint32(0); // 개체 id
  header.uint16(0);

  writer.nested(SectionTag.ParaHeader, header, () => {
    // 빈 문단(문단 끝 한 글자뿐)은 한글도 PARA_TEXT를 쓰지 않는다.
    if (state.codes.length > 1 || state.controls.length > 0) {
      const text = new ByteWriter();
      for (const code of state.codes) text.uint16(code);
      writer.write(SectionTag.ParaText, text);
    }

    const shapes = new ByteWriter();
    for (const entry of state.charShapes) {
      shapes.uint32(entry.position);
      shapes.uint32(clamped(entry.charShapeId, doc.resources.charShapes.length));
    }
    writer.write(SectionTag.ParaCharShape, shapes);

    if (options.lineHeight) {
      writer.write(SectionTag.ParaLineSeg, buildLineSeg(doc, paragraph, options));
    }

    for (const control of state.controls) {
      writeControl(writer, doc, control);
    }
  });
}

/**
 * PARA_LINE_SEG — 한글의 줄 배치 캐시.
 *
 * 표 셀처럼 폭이 좁은 곳에서는 이 레코드가 없으면 뷰어가 줄 높이를 0으로
 * 잡아 행이 겹친다. 첫 줄 정보만 담아 최소 높이를 알려준다.
 */
function buildLineSeg(doc, paragraph, options) {
  let height = 1000;
  for (const run of paragraph.runs) {
    const shape = doc.resources.charShapes[clamped(run.charShapeId, doc.resources.charShapes.length)];
    if (shape?.height) height = Math.max(height, shape.height);
  }
  const baseline = Math.round(height * 0.85);
  const width = Math.max(0, options.availableWidth ?? 0);
  return new ByteWriter()
    .uint32(0) // textpos
    .uint32(0) // vertpos
    .uint32(height) // vertsize
    .uint32(height) // textheight
    .uint32(baseline)
    .uint32(600) // 줄 간격
    .uint32(0) // horzpos
    .uint32(width) // horzsize
    .uint32(0x80060000);
}

function writeParagraphList(writer, doc, paragraphs, listHeaderBuilder) {
  if (!paragraphs.length) paragraphs = [{ paraShapeId: 0, styleId: 0, runs: [{ charShapeId: 0, items: [] }] }];
  // 한글은 LIST_HEADER와 그 문단들을 같은 레벨에 둔다. 문단의 자식 레코드만
  // 한 단계 더 들어간다.
  writer.write(SectionTag.ListHeader, listHeaderBuilder(paragraphs.length));
  paragraphs.forEach((paragraph, index) => {
    writeParagraph(writer, doc, paragraph, { last: index === paragraphs.length - 1 });
  });
}

/* --------------------------------------------------------------- 컨트롤 */

function writeControl(writer, doc, control) {
  switch (control.type) {
    case 'section':
      writeSectionDefinition(writer, control.section);
      return;
    case 'columns':
      writeColumnsDefinition(writer);
      return;
    case 'table':
      writeTable(writer, doc, control);
      return;
    case 'picture':
      writePicture(writer, doc, control);
      return;
    case 'header':
    case 'footer': {
      const header = new ByteWriter()
        .uint32(ctrlId(control.type === 'header' ? CTRL.Header : CTRL.Footer))
        .uint32(control.applyTo ?? 0);
      writer.nested(SectionTag.CtrlHeader, header, () => {
        writeParagraphList(writer, doc, control.paragraphs, (count) => {
          const listHeader = new ByteWriter();
          listHeader.uint16(count);
          listHeader.uint16(0);
          listHeader.uint32(0);
          listHeader.hwpUnit(0);
          listHeader.hwpUnit(0);
          listHeader.uint8(0);
          listHeader.uint8(0);
          return listHeader;
        });
      });
      return;
    }
    case 'footnote':
    case 'endnote': {
      const header = new ByteWriter();
      const footnote = control.type === 'footnote';
      header.uint32(ctrlId(footnote ? CTRL.Footnote : CTRL.Endnote));
      header.uint32(1); // 번호
      header.uint16(footnote ? 0x003c : 0); // 사용자 기호
      header.uint16(footnote ? 0x003e : 0x0029); // 접미 기호
      header.uint32(footnote ? 2 : 0); // 속성
      header.uint32(0); // 개체 id
      writer.nested(SectionTag.CtrlHeader, header, () => {
        writeParagraphList(writer, doc, control.paragraphs, (count) => {
          const listHeader = new ByteWriter();
          listHeader.uint32(count);
          listHeader.uint32(0);
          listHeader.uint32(0);
          listHeader.uint32(0);
          return listHeader;
        });
      });
      return;
    }
    case 'autoNumber': {
      const header = new ByteWriter();
      header.uint32(ctrlId(CTRL.AutoNumber));
      header.uint32(0x21); // 속성
      header.uint32(control.number ?? 1);
      header.uint16(0x003c); // 구분 문자 '<'
      header.uint16(0x003e); // 구분 문자 '>'
      writer.write(SectionTag.CtrlHeader, header);
      return;
    }
    default:
      return;
  }
}

function writeSectionDefinition(writer, section) {
  const pageDef = section.pageDef;
  const header = new ByteWriter();
  header.uint32(ctrlId(CTRL.SectionDefinition));
  let flags = 0;
  header.uint32(flags); // 구역 표시/숨김 속성
  header.hwpUnit16(pageDef.columnSpacing ?? 1134); // 단 간격
  header.hwpUnit16(pageDef.lineGrid ?? 0); // 줄 격자
  header.hwpUnit16(pageDef.charGrid ?? 0); // 문자 격자
  header.hwpUnit(pageDef.defaultTabStop ?? 8000); // 기본 탭 간격
  header.uint16(1); // 문단 번호 모양 id
  header.uint16(pageDef.startingPageNumber ?? 0); // 시작 쪽 번호
  header.uint16(0); // 시작 그림 번호
  header.uint16(0); // 시작 표 번호
  header.uint16(0); // 시작 수식 번호
  header.uint32(0); // 예약
  header.uint32(0); // 예약
  header.uint16(0); // 꼬리 예약

  writer.nested(SectionTag.CtrlHeader, header, () => {
    const page = new ByteWriter();
    page.hwpUnit(pageDef.width);
    page.hwpUnit(pageDef.height);
    page.hwpUnit(pageDef.margins.left);
    page.hwpUnit(pageDef.margins.right);
    page.hwpUnit(pageDef.margins.top);
    page.hwpUnit(pageDef.margins.bottom);
    page.hwpUnit(pageDef.margins.header);
    page.hwpUnit(pageDef.margins.footer);
    page.hwpUnit(pageDef.margins.gutter);
    let properties = 0;
    properties = setBit(properties, 0, pageDef.landscape);
    properties = setBits(properties, 1, 2, pageDef.gutterKind ?? 0);
    page.uint32(properties);
    writer.write(SectionTag.PageDef, page);

    // 각주 모양 → 미주 모양 → 쪽 테두리/배경 3개(첫 쪽·홀수 쪽·짝수 쪽) 순서가
    // 한글의 구역 정의 고정 순서다. 하나라도 빠지면 구역 정의가 손상된 것으로 읽힌다.
    writer.write(SectionTag.FootnoteShape, noteShape({ spacing: 283, splitterLength: -1, splitterUnknown: -1, marginTop: 850, marginBottom: 567 }));
    writer.write(SectionTag.FootnoteShape, noteShape({ spacing: 0, splitterLength: 12280, splitterUnknown: 224, marginTop: 850, marginBottom: 567 }));
    for (let index = 0; index < 3; index++) {
      writer.write(SectionTag.PageBorderFill, pageBorderFill());
    }
  });
}

/** 구역 정의 아래의 단 정의(CTRL_HEADER `cold`) — 보통 한 단. */
function writeColumnsDefinition(writer) {
  const header = new ByteWriter();
  header.uint32(ctrlId(CTRL.ColumnDefinition));
  let flags = 0;
  flags = setBits(flags, 0, 1, 0); // 단 종류: 보통
  flags = setBits(flags, 2, 9, 1); // 단 개수
  flags = setBits(flags, 10, 11, 0); // 단 방향: 왼쪽→오른쪽
  flags = setBit(flags, 12, true); // 같은 폭
  header.uint16(flags);
  header.hwpUnit16(0); // 단 간격
  header.uint16(0); // 예약
  header.uint8(0); // 단 구분선 종류: 없음
  header.uint8(0); // 굵기
  header.color(0); // 색
  writer.write(SectionTag.CtrlHeader, header);
}

/** 쪽 테두리/배경 — 테두리 없음(용지 기준). */
function pageBorderFill() {
  const writer = new ByteWriter();
  writer.uint32(1); // 용지 기준
  writer.hwpUnit16(1417).hwpUnit16(1417).hwpUnit16(1417).hwpUnit16(1417);
  writer.uint16(1); // 테두리/배경 id (DocInfo 첫 항목)
  return writer;
}

function noteShape({ spacing, splitterLength, splitterUnknown = -1, marginTop, marginBottom }) {
  const writer = new ByteWriter();
  writer.uint32(0); // flags
  writer.uint16(0); // 사용자 기호
  writer.uint16(0); // 접두 기호
  writer.uint16(0x0029); // 접미 기호 ')'
  writer.uint16(1); // 시작 번호
  writer.hwpUnit16(splitterLength); // 구분선 길이
  writer.hwpUnit16(splitterUnknown); // 예약
  writer.hwpUnit16(marginTop); // 구분선 위 여백
  writer.hwpUnit16(marginBottom); // 구분선 아래 여백
  writer.hwpUnit16(spacing); // 각주 사이 간격
  writer.uint8(1); // 구분선 종류: 실선
  writer.uint8(1); // 굵기 0.12mm
  writer.color(0);
  return writer;
}

function writeTable(writer, doc, table) {
  const placement = table.placement ?? {};
  const rows = table.rows ?? [];
  const header = new ByteWriter();
  header.uint32(ctrlId(CTRL.Table));
  writePlacement(header, placement);

  writer.nested(SectionTag.CtrlHeader, header, () => {
    const columns =
      table.columns && table.columns > 0
        ? table.columns
        : Math.max(1, ...rows.map((row) => row.cells.reduce((sum, cell) => sum + cell.colSpan, 0)));

    const body = new ByteWriter();
    let properties = 0;
    properties = setBits(properties, 0, 1, table.pageBreak ?? 1);
    properties = setBit(properties, 2, table.repeatHeader);
    properties = setBit(properties, 26, true);
    body.uint32(properties);
    body.uint16(rows.length);
    body.uint16(columns);
    body.hwpUnit16(table.cellSpacing ?? 0);
    body.hwpUnit16(table.cellMargins?.left ?? 0);
    body.hwpUnit16(table.cellMargins?.right ?? 0);
    body.hwpUnit16(table.cellMargins?.top ?? 0);
    body.hwpUnit16(table.cellMargins?.bottom ?? 0);
    for (const row of rows) body.uint16(row.cells.length);
    const borderFillCount = doc.resources.borderFills.length;
    body.uint16(clamped(table.borderFillId ?? 0, borderFillCount) + 1);
    body.uint16(0);
    writer.write(SectionTag.Table, body);

    for (const row of rows) {
      for (const cell of row.cells) {
        writeCell(writer, doc, cell, row);
      }
    }
  });
}

function writeCell(writer, doc, cell, row) {
  const height = cell.rowSpan > 1 ? cell.height : row.height || cell.height;
  const paragraphs = cell.paragraphs.length
    ? cell.paragraphs
    : [{ paraShapeId: 0, styleId: 0, runs: [{ charShapeId: 0, items: [] }] }];
  const header = new ByteWriter();
  header.uint16(paragraphs.length);
  header.uint16(0);
  let flags = 0;
  flags = setBits(flags, 5, 6, cell.verticalAlign ?? 0);
  header.uint32(flags);
  header.uint16(cell.col ?? 0);
  header.uint16(cell.row ?? 0);
  header.uint16(Math.max(1, cell.colSpan ?? 1));
  header.uint16(Math.max(1, cell.rowSpan ?? 1));
  header.hwpUnit(cell.width ?? 0);
  header.hwpUnit(height ?? 0);
  header.hwpUnit16(cell.margins?.left ?? 0);
  header.hwpUnit16(cell.margins?.right ?? 0);
  header.hwpUnit16(cell.margins?.top ?? 0);
  header.hwpUnit16(cell.margins?.bottom ?? 0);
  header.uint16(clamped(cell.borderFillId ?? 0, doc.resources.borderFills.length) + 1);
  header.hwpUnit(cell.width ?? 0);
  header.uint32(0);
  header.uint32(0);
  header.uint8(0);
  writer.write(SectionTag.ListHeader, header);

  const availableWidth = Math.max(
    0,
    (cell.width ?? 0) - (cell.margins?.left ?? 0) - (cell.margins?.right ?? 0),
  );
  paragraphs.forEach((paragraph, index) => {
    writeParagraph(writer, doc, paragraph, {
      last: index === paragraphs.length - 1,
      lineHeight: true,
      availableWidth,
    });
  });
}

function writePlacement(writer, placement) {
  let properties = 0;
  properties = setBit(properties, 0, placement.treatAsChar);
  properties = setBit(properties, 2, placement.affectLineSpacing);
  properties = setBits(properties, 3, 4, placement.vertRelTo ?? 3);
  properties = setBits(properties, 5, 7, placement.vertAlign ?? 0);
  properties = setBits(properties, 8, 9, placement.horzRelTo ?? 2);
  properties = setBits(properties, 10, 12, placement.horzAlign ?? 0);
  properties = setBit(properties, 13, placement.flowWithText);
  properties = setBit(properties, 14, placement.allowOverlap);
  properties = setBits(properties, 15, 17, 4); // 개체 폭 기준: 절대값
  properties = setBits(properties, 18, 19, placement.treatAsChar ? 0 : 2); // 개체 높이 기준
  properties = setBits(properties, 21, 23, placement.flow ?? placement.textWrap ?? 0);
  properties = setBits(properties, 24, 25, placement.textFlowSide ?? 0);

  writer.uint32(properties);
  writer.int32(placement.offsetY ?? 0);
  writer.int32(placement.offsetX ?? 0);
  writer.uint32(placement.width ?? 0);
  writer.uint32(placement.height ?? 0);
  writer.int16(placement.zOrder ?? 0);
  writer.int16(0);
  writer.int16(placement.marginTop ?? 0);
  writer.int16(placement.marginBottom ?? 0);
  writer.int16(placement.marginLeft ?? 0);
  writer.int16(placement.marginRight ?? 0);
  writer.uint32(0); // instance id
  // 개체 공통 속성의 꼬리: 예약 필드와 빈 설명 문자열.
  writer.int16(0);
  writer.string('');
}

/** 2D 변환 행렬 (a c e / b d f / 0 0 1). */
function writeMatrix(writer, a, b, c, d, e, f) {
  writer.double(a).double(c).double(e).double(b).double(d).double(f);
}

/**
 * SHAPE_COMPONENT — 개체 요소 공통 레코드.
 *
 * 그림·도형은 CTRL_HEADER(gso) 아래에 이 레코드와 종류별 레코드를 갖는다.
 * 행렬 정보까지 정확히 써야 한글이 개체를 그린다.
 */
function writeShapeComponent(writer, chid, width, height, buildChildren) {
  const shape = new ByteWriter();
  shape.uint32(ctrlId(chid)); // chid0 — 개체 자신의 종류
  shape.uint32(ctrlId(chid)); // chid
  shape.int32(0); // x in group
  shape.int32(0); // y in group
  shape.uint16(0); // level in group
  shape.uint16(1); // local version
  shape.uint32(width);
  shape.uint32(height);
  shape.uint32(width);
  shape.uint32(height);
  shape.uint32(0); // flags
  shape.uint16(0); // angle
  shape.int32(0); // rotation center x
  shape.int32(0); // rotation center y
  shape.uint16(1); // scalerotations count
  writeMatrix(shape, 1, 0, 0, 1, 0, 0); // translation
  writeMatrix(shape, 1, 0, 0, 1, 0, 0); // scaler
  writeMatrix(shape, 1, 0, 0, 1, 0, 0); // rotator
  if (buildChildren) writer.nested(SectionTag.ShapeComponent, shape, buildChildren);
  else writer.write(SectionTag.ShapeComponent, shape);
}

function writePicture(writer, doc, picture) {
  const placement = picture.placement ?? {};
  const width = picture.width || placement.width || 0;
  const height = picture.height || placement.height || 0;
  const binIndex = doc.binData.findIndex((item) => item.id === picture.binId);
  const binDataId = binIndex >= 0 ? binIndex + 1 : 1;

  const header = new ByteWriter();
  header.uint32(ctrlId(CTRL.DrawingObject));
  writePlacement(header, {
    ...placement,
    width,
    height,
    // 뷰어·한글 모두에서 안정적으로 그려지도록 그림은 떠 있는 개체로 쓰고,
    // 본문과 겹치지 않게 위아래로 흐르게 한다.
    // 뷰어가 인라인 그림을 그리지 않는 경우가 있어, 글 위아래로 흐르는
    // 떠 있는 개체로 쓴다. 한글에서는 문단 위치에 붙어 같은 모양이 된다.
    treatAsChar: false,
    flowWithText: true,
    textWrap: 4,
    flow: 1,
  });

  writer.nested(SectionTag.CtrlHeader, header, () => {
    writeShapeComponent(writer, '$pic', width, height, () => {
    const body = new ByteWriter();
    // 테두리 선 정보 (없음)
    body.color(0);
    body.int32(0);
    body.uint32(0);
    // 그림 좌표 4점
    body.int32(0).int32(0);
    body.int32(width).int32(0);
    body.int32(width).int32(height);
    body.int32(0).int32(height);
    // 자르기 (원본 그림 크기 기준)
    const originalWidth = picture.originalWidth || width;
    const originalHeight = picture.originalHeight || height;
    body.int32(0).int32(0).int32(originalWidth).int32(originalHeight);
    // 안쪽 여백
    body.uint16(0).uint16(0).uint16(0).uint16(0);
    // 밝기, 대비, 효과, 그림 데이터 id
    body.uint8(0).uint8(0).uint8(0);
    body.uint16(binDataId);
    body.uint8(0); // 테두리 투명도
    body.uint32(0); // instance id
    body.uint32(0); // 그림 효과
    body.int32(originalWidth).int32(originalHeight).uint8(0);
    writer.write(SectionTag.ShapeComponentPicture, body);
    });
  });
}

/* ------------------------------------------------------------------ 구역 */

/** 구역 하나를 `BodyText/Section{N}` 스트림으로 직렬화한다. */
export function buildSection(doc, section) {
  const writer = new RecordWriter();
  const paragraphs = section.paragraphs ?? [];
  paragraphs.forEach((paragraph, index) => {
    writeParagraph(writer, doc, paragraph, {
      last: index === paragraphs.length - 1,
      firstOfSection: index === 0,
      section: index === 0 ? section : undefined,
    });
  });
  return writer.finish();
}
