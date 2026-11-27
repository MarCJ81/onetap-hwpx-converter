/**
 * HWPX(OWPML) 패키지 파서.
 *
 * ZIP 안의 `Contents/header.xml`(서식 자원)과 `Contents/section*.xml`(본문)을
 * 읽어 HWP 5.0 라이터가 바로 쓸 수 있는 중간 표현(IR)으로 바꾼다.
 *
 * 중간 표현은 두 층이다.
 *  - resources: 글꼴·글자 모양·문단 모양·스타일·테두리/배경 등 문서 전역 표
 *  - sections: 문단 → 런 → 인라인 항목(텍스트/탭/표/그림/각주…) 트리
 */
import { readZip } from './zip.js';
import { attr, boolAttr, child, children, firstDeep, numAttr, parseXml, textOf } from './xml.js';

export const LANG_KEYS = ['hangul', 'latin', 'hanja', 'japanese', 'other', 'symbol', 'user'];
const FONT_LANG_ORDER = ['HANGUL', 'LATIN', 'HANJA', 'JAPANESE', 'OTHER', 'SYMBOL', 'USER'];

const HORIZONTAL_ALIGN = ['JUSTIFY', 'LEFT', 'RIGHT', 'CENTER', 'DISTRIBUTE', 'DIVISION'];
const VERTICAL_ALIGN = ['BASELINE', 'TOP', 'CENTER', 'BOTTOM'];
const LINE_SPACING_TYPE = ['PERCENT', 'FIXED', 'BETWEEN_LINES', 'AT_LEAST'];
const HEADING_TYPE = ['NONE', 'OUTLINE', 'NUMBER', 'BULLET'];
const UNDERLINE_TYPE = ['NONE', 'BOTTOM', 'CENTER', 'TOP'];
const PAGE_DIRECTION = { portrait: 'WIDELY', landscape: 'NARROWLY' };

/** 테두리 선 종류 — HWP5 BorderFill의 선 종류 인덱스와 같은 순서다. */
const STROKE_STYLES = [
  'NONE',
  'SOLID',
  'DASH',
  'DOT',
  'DASH_DOT',
  'DASH_DOT_DOT',
  'LONG_DASH',
  'CIRCLE',
  'DOUBLE_SLIM',
  'SLIM_THICK',
  'THICK_SLIM',
  'SLIM_THICK_SLIM',
];

/** 테두리 굵기(mm) → HWP5 굵기 인덱스. */
const LINE_WIDTHS_MM = [0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 1.0, 1.5, 2.0, 3.0, 4.0, 5.0];

/** 밑줄/취소선 모양 — HWP5 글자 모양의 선 모양 인덱스(0=실선). */
const UNDERLINE_SHAPES = ['SOLID', 'DASH', 'DOT', 'DASH_DOT', 'DASH_DOT_DOT', 'LONG_DASH', 'CIRCLE', 'DOUBLE_SLIM'];

const NUMBER_FORMATS = [
  'DIGIT',
  'ROMAN_CAPITAL',
  'ROMAN_SMALL',
  'ALPHABET_CAPITAL',
  'ALPHABET_SMALL',
  'CIRCLED_DIGIT',
  'HANGUL_SYLLABLE',
  'HANGUL_JAMO',
  'HANGUL_PHONETIC',
  'IDEOGRAPH',
  'CIRCLED_HANGUL_JAMO',
  'CIRCLED_LATIN_CAPITAL',
  'CIRCLED_LATIN_SMALL',
];

const indexOfName = (table, name, fallback = 0) => {
  const index = table.indexOf(name);
  return index === -1 ? fallback : index;
};

function parseColor(value, fallback = 0) {
  if (!value || value === 'none' || value === 'NONE') return fallback;
  let hex = String(value).trim();
  if (hex[0] === '#') hex = hex.slice(1);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(hex)) return fallback;
  return parseInt(hex.slice(0, 6), 16) >>> 0;
}

function parseWidthIndex(value) {
  if (!value) return 0;
  const match = String(value).match(/([0-9.]+)/);
  if (!match) return 0;
  const mm = Number(match[1]);
  if (!Number.isFinite(mm)) return 0;
  let best = 0;
  let bestDiff = Infinity;
  for (let i = 0; i < LINE_WIDTHS_MM.length; i++) {
    const diff = Math.abs(LINE_WIDTHS_MM[i] - mm);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  }
  return best;
}

/* ------------------------------------------------------------ header.xml */

function parseBorderLine(element) {
  if (!element) return { type: 0, width: 0, color: 0 };
  return {
    type: indexOfName(STROKE_STYLES, attr(element, 'type') ?? 'NONE'),
    width: parseWidthIndex(attr(element, 'width')),
    color: parseColor(attr(element, 'color'), 0),
  };
}

function parseBorderFill(element) {
  const fill = { kind: 'none' };
  const brush = child(element, 'winBrush');
  const gradation = child(element, 'gradation');
  const imgBrush = child(element, 'imgBrush');

  if (brush) {
    fill.kind = 'color';
    fill.faceColor = parseColor(attr(brush, 'faceColor'), 0xffffff);
    fill.hatchColor = parseColor(attr(brush, 'hatchColor'), 0);
    fill.alpha = Math.round(numAttr(brush, 'alpha', 0) * 100);
  } else if (gradation) {
    fill.kind = 'gradient';
    fill.gradientType = Math.max(1, indexOfName(['', 'LINEAR', 'RADIAL', 'CONICAL', 'SQUARE'], attr(gradation, 'type') ?? 'LINEAR', 1));
    fill.angle = numAttr(gradation, 'angle');
    fill.centerX = numAttr(gradation, 'centerX');
    fill.centerY = numAttr(gradation, 'centerY');
    fill.step = numAttr(gradation, 'step');
    fill.colors = children(gradation, 'color').map((c) => parseColor(attr(c, 'value'), 0));
  } else if (imgBrush) {
    fill.kind = 'image';
  }

  return {
    threeD: boolAttr(element, 'threeD'),
    shadow: boolAttr(element, 'shadow'),
    breakCellSeparateLine: boolAttr(element, 'breakCellSeparateLine'),
    left: parseBorderLine(child(element, 'leftBorder')),
    right: parseBorderLine(child(element, 'rightBorder')),
    top: parseBorderLine(child(element, 'topBorder')),
    bottom: parseBorderLine(child(element, 'bottomBorder')),
    diagonal: parseBorderLine(child(element, 'diagonal')),
    fill,
  };
}

function parseCharShape(element) {
  const fontRef = child(element, 'fontRef');
  const ratio = child(element, 'ratio');
  const spacing = child(element, 'spacing');
  const relSz = child(element, 'relSz');
  const offset = child(element, 'offset');
  const underline = child(element, 'underline');
  const strikeout = child(element, 'strikeout');
  const outline = child(element, 'outline');
  const shadow = child(element, 'shadow');
  const shade = attr(element, 'shadeColor');

  const shape = {
    fontIds: LANG_KEYS.map((key) => numAttr(fontRef, key, 0)),
    ratios: LANG_KEYS.map((key) => numAttr(ratio, key, 100)),
    spacings: LANG_KEYS.map((key) => numAttr(spacing, key, 0)),
    relSizes: LANG_KEYS.map((key) => numAttr(relSz, key, 100)),
    offsets: LANG_KEYS.map((key) => numAttr(offset, key, 0)),
    height: numAttr(element, 'height', 1000),
    textColor: parseColor(attr(element, 'textColor'), 0),
    shadeColor: shade === 'none' || shade === undefined ? 0xffffffff : parseColor(shade, 0xffffffff),
    borderFillId: Math.max(0, numAttr(element, 'borderFillIDRef', 1) - 1),
    useFontSpace: boolAttr(element, 'useFontSpace'),
    useKerning: boolAttr(element, 'useKerning'),
    bold: Boolean(child(element, 'bold')),
    italic: Boolean(child(element, 'italic')),
    emboss: Boolean(child(element, 'emboss')),
    engrave: Boolean(child(element, 'engrave')),
    superscript: Boolean(child(element, 'supscript')),
    subscript: Boolean(child(element, 'subscript')),
  };

  const underlineType = indexOfName(UNDERLINE_TYPE, attr(underline, 'type') ?? 'NONE');
  if (underlineType !== 0) {
    shape.underline = {
      kind: underlineType,
      style: indexOfName(UNDERLINE_SHAPES, attr(underline, 'shape') ?? 'SOLID'),
      color: parseColor(attr(underline, 'color'), 0),
    };
  }

  const strikeShape = attr(strikeout, 'shape');
  if (strikeShape && strikeShape !== 'NONE') {
    shape.strikeout = {
      style: indexOfName(UNDERLINE_SHAPES, strikeShape),
      color: parseColor(attr(strikeout, 'color'), 0),
    };
  }

  const outlineType = indexOfName(STROKE_STYLES, attr(outline, 'type') ?? 'NONE');
  if (outlineType !== 0) shape.outline = outlineType;

  const shadowType = attr(shadow, 'type');
  if (shadowType && shadowType !== 'NONE') {
    shape.shadow = {
      kind: 1,
      color: parseColor(attr(shadow, 'color'), 0xb2b2b2),
      offsetX: numAttr(shadow, 'offsetX', 10),
      offsetY: numAttr(shadow, 'offsetY', 10),
    };
  }

  return shape;
}

function parseParaShape(element) {
  const align = child(element, 'align');
  const heading = child(element, 'heading');
  const breakSetting = child(element, 'breakSetting');
  const autoSpacing = child(element, 'autoSpacing');
  const border = child(element, 'border');
  // 최근 한글은 여백/줄 간격을 hp:switch 안에 넣는다.
  const margin = firstDeep(element, 'margin');
  const lineSpacing = firstDeep(element, 'lineSpacing');

  const shape = {
    align: indexOfName(HORIZONTAL_ALIGN, attr(align, 'horizontal') ?? 'JUSTIFY'),
    verticalAlign: indexOfName(VERTICAL_ALIGN, attr(align, 'vertical') ?? 'BASELINE'),
    marginLeft: numAttr(child(margin, 'left'), 'value'),
    marginRight: numAttr(child(margin, 'right'), 'value'),
    indent: numAttr(child(margin, 'intent'), 'value'),
    marginTop: numAttr(child(margin, 'prev'), 'value'),
    marginBottom: numAttr(child(margin, 'next'), 'value'),
    lineSpacing: {
      kind: indexOfName(LINE_SPACING_TYPE, attr(lineSpacing, 'type') ?? 'PERCENT'),
      value: numAttr(lineSpacing, 'value', 160),
    },
    tabDefId: numAttr(element, 'tabPrIDRef'),
    fontLineHeight: boolAttr(element, 'fontLineHeight'),
    snapToGrid: boolAttr(element, 'snapToGrid', true),
    widowOrphan: boolAttr(breakSetting, 'widowOrphan'),
    keepWithNext: boolAttr(breakSetting, 'keepWithNext'),
    keepLines: boolAttr(breakSetting, 'keepLines'),
    pageBreakBefore: boolAttr(breakSetting, 'pageBreakBefore'),
    lineBreakLatin: attr(breakSetting, 'breakLatinWord') === 'BREAK_WORD' ? 2 : 0,
    lineBreakHangul: attr(breakSetting, 'breakNonLatinWord') === 'BREAK_WORD' ? 1 : 0,
    autoSpaceLatin: boolAttr(autoSpacing, 'eAsianEng'),
    autoSpaceNumber: boolAttr(autoSpacing, 'eAsianNum'),
  };

  const headingType = indexOfName(HEADING_TYPE, attr(heading, 'type') ?? 'NONE');
  if (headingType !== 0) {
    shape.heading = {
      type: headingType,
      idRef: Math.max(0, numAttr(heading, 'idRef', 1) - 1),
      level: numAttr(heading, 'level'),
    };
  }

  if (border) {
    shape.border = {
      borderFillId: Math.max(0, numAttr(border, 'borderFillIDRef', 1) - 1),
      offsetLeft: numAttr(border, 'offsetLeft'),
      offsetRight: numAttr(border, 'offsetRight'),
      offsetTop: numAttr(border, 'offsetTop'),
      offsetBottom: numAttr(border, 'offsetBottom'),
      connect: boolAttr(border, 'connect'),
      ignoreMargin: boolAttr(border, 'ignoreMargin'),
    };
  }

  return shape;
}

function parseNumberingLevel(element) {
  return {
    format: textOf(element),
    numberFormat: indexOfName(NUMBER_FORMATS, attr(element, 'numFormat') ?? 'DIGIT'),
    align: indexOfName(HORIZONTAL_ALIGN, attr(element, 'align') ?? 'LEFT'),
    widthAdjust: numAttr(element, 'widthAdjust'),
    distance: numAttr(element, 'textOffset', 50),
    distanceIsRatio: attr(element, 'textOffsetType') === 'PERCENT',
    start: numAttr(element, 'start', 1),
  };
}

function parseResources(headerDoc) {
  const refList = firstDeep(headerDoc, 'refList') ?? headerDoc.documentElement;
  const fonts = [[], [], [], [], [], [], []];
  const fontFaces = child(refList, 'fontfaces');
  const groups = fontFaces ? children(fontFaces, 'fontface') : [];
  const byLang = new Map();
  for (const group of groups) {
    const langIndex = FONT_LANG_ORDER.indexOf(attr(group, 'lang') ?? 'HANGUL');
    const names = children(group, 'font').map((font) => attr(font, 'face') ?? '');
    if (langIndex >= 0) byLang.set(langIndex, names);
  }
  const firstNames = byLang.values().next().value ?? [];
  for (let i = 0; i < 7; i++) {
    fonts[i] = byLang.get(i) ?? firstNames.slice();
  }

  const charShapes = children(child(refList, 'charProperties'), 'charPr').map(parseCharShape);
  const paraShapes = children(child(refList, 'paraProperties'), 'paraPr').map(parseParaShape);
  const styles = children(child(refList, 'styles'), 'style').map((element) => ({
    name: attr(element, 'name') ?? '',
    englishName: attr(element, 'engName') ?? '',
    kind: attr(element, 'type') === 'CHAR' ? 1 : 0,
    paraShapeId: numAttr(element, 'paraPrIDRef'),
    charShapeId: numAttr(element, 'charPrIDRef'),
    nextStyleId: numAttr(element, 'nextStyleIDRef'),
    langId: numAttr(element, 'langID', 1042),
    lockForm: boolAttr(element, 'lockForm'),
  }));
  const borderFills = children(child(refList, 'borderFills'), 'borderFill').map(parseBorderFill);
  const tabDefs = children(child(refList, 'tabProperties'), 'tabPr').map((element) => ({
    autoTabLeft: boolAttr(element, 'autoTabLeft'),
    autoTabRight: boolAttr(element, 'autoTabRight'),
    stops: children(element, 'tabItem').map((item) => ({
      position: numAttr(item, 'pos'),
      kind: indexOfName(['LEFT', 'RIGHT', 'CENTER', 'DECIMAL'], attr(item, 'type') ?? 'LEFT'),
      fillStyle: indexOfName(STROKE_STYLES, attr(item, 'leader') ?? 'NONE'),
    })),
  }));
  const numberings = children(child(refList, 'numberings'), 'numbering').map((element) => ({
    start: numAttr(element, 'start', 1),
    levels: children(element, 'paraHead').map(parseNumberingLevel),
  }));
  const bullets = children(child(refList, 'bullets'), 'bullet').map((element) => ({
    char: attr(element, 'char') ?? '•',
    level: parseNumberingLevel(child(element, 'paraHead') ?? element),
    useImage: boolAttr(element, 'useImage'),
  }));

  return { fonts, charShapes, paraShapes, styles, borderFills, tabDefs, numberings, bullets };
}

/* --------------------------------------------------------- section*.xml */

function emptyPlacement(width = 0, height = 0) {
  return {
    treatAsChar: true,
    flowWithText: true,
    allowOverlap: false,
    vertRelTo: 3,
    horzRelTo: 2,
    vertAlign: 0,
    horzAlign: 0,
    textWrap: 0,
    textFlowSide: 0,
    offsetX: 0,
    offsetY: 0,
    width,
    height,
    zOrder: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
  };
}

function parsePlacement(element) {
  const size = child(element, 'sz');
  const pos = child(element, 'pos');
  const outMargin = child(element, 'outMargin');
  // HWP5의 세로 기준에는 PAPER/PAGE/PARAGRAPH 세 가지뿐이라 COLUMN은 문단으로 접는다.
  const vertAnchor = { PAPER: 0, PAGE: 1, COLUMN: 2, PARA: 2 };
  const horzAnchor = { PAPER: 0, PAGE: 1, COLUMN: 2, PARA: 3 };
  const alignHorz = ['LEFT', 'CENTER', 'RIGHT', 'INSIDE', 'OUTSIDE'];
  const alignVert = ['TOP', 'CENTER', 'BOTTOM', 'INSIDE', 'OUTSIDE'];
  const wraps = ['NONE', 'SQUARE', 'TIGHT', 'THROUGH', 'TOP_AND_BOTTOM'];
  const sides = ['BOTH_SIDES', 'LEFT_ONLY', 'RIGHT_ONLY', 'LARGEST_ONLY'];

  const placement = emptyPlacement(numAttr(size, 'width'), numAttr(size, 'height'));
  if (pos) {
    placement.treatAsChar = boolAttr(pos, 'treatAsChar', true);
    placement.flowWithText = boolAttr(pos, 'flowWithText', true);
    placement.allowOverlap = boolAttr(pos, 'allowOverlap');
    placement.vertRelTo = vertAnchor[attr(pos, 'vertRelTo') ?? 'PARA'] ?? 2;
    placement.horzRelTo = horzAnchor[attr(pos, 'horzRelTo') ?? 'COLUMN'] ?? 2;
    placement.vertAlign = Math.max(0, indexOfName(alignVert, attr(pos, 'vertAlign') ?? 'TOP'));
    placement.horzAlign = Math.max(0, indexOfName(alignHorz, attr(pos, 'horzAlign') ?? 'LEFT'));
    placement.offsetX = numAttr(pos, 'horzOffset');
    placement.offsetY = numAttr(pos, 'vertOffset');
    placement.textWrap = Math.max(0, indexOfName(wraps, attr(pos, 'textWrap') ?? 'NONE'));
    placement.textFlowSide = Math.max(0, indexOfName(sides, attr(pos, 'textFlowSide') ?? 'BOTH_SIDES'));
  }
  if (outMargin) {
    placement.marginLeft = numAttr(outMargin, 'left');
    placement.marginRight = numAttr(outMargin, 'right');
    placement.marginTop = numAttr(outMargin, 'top');
    placement.marginBottom = numAttr(outMargin, 'bottom');
  }
  return placement;
}

function parsePageDef(secPr) {
  const pagePr = child(secPr, 'pagePr');
  const margin = child(pagePr, 'margin');
  const grid = child(secPr, 'grid');
  const landscapeAttr = attr(pagePr, 'landscape');
  return {
    width: numAttr(pagePr, 'width', 59528),
    height: numAttr(pagePr, 'height', 84186),
    landscape: landscapeAttr === PAGE_DIRECTION.landscape,
    gutterKind: Math.max(0, indexOfName(['LEFT_ONLY', 'LEFT_RIGHT', 'TOP_BOTTOM'], attr(pagePr, 'gutterType') ?? 'LEFT_ONLY')),
    margins: {
      left: numAttr(margin, 'left', 8504),
      right: numAttr(margin, 'right', 8504),
      top: numAttr(margin, 'top', 5668),
      bottom: numAttr(margin, 'bottom', 4252),
      header: numAttr(margin, 'header', 4252),
      footer: numAttr(margin, 'footer', 4252),
      gutter: numAttr(margin, 'gutter', 0),
    },
    // HWPX는 기본 탭 간격을 tabStop(HWPUNIT)로 쓰고, tabStopVal은 옛 호환 값이다.
    defaultTabStop: numAttr(secPr, 'tabStop', numAttr(secPr, 'tabStopVal', 8000)),
    lineGrid: numAttr(grid, 'lineGrid'),
    charGrid: numAttr(grid, 'charGrid'),
  };
}

function createContext() {
  return {
    counts: {
      paragraphs: 0,
      tables: 0,
      cells: 0,
      images: 0,
      equations: 0,
      notes: 0,
      headers: 0,
      fields: 0,
      shapes: 0,
      charts: 0,
      memos: 0,
      hiddenComments: 0,
      bookmarks: 0,
    },
    notes: [],
    sampleText: '',
  };
}

const TEXT_INLINE = {
  tab: { type: 'tab' },
  lineBreak: { type: 'lineBreak' },
  nbSpace: { type: 'special', char: 'nbsp' },
  fwSpace: { type: 'special', char: 'fixedWidthSpace' },
  hyphen: { type: 'special', char: 'hyphen' },
  titleMark: { type: 'special', char: 'titleMark' },
};

function parseTextElement(element) {
  const items = [];
  for (const node of element.childNodes) {
    if (node.nodeType === 3) {
      if (node.nodeValue) items.push({ type: 'text', value: node.nodeValue });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const template = TEXT_INLINE[node.localName];
    if (!template) continue;
    if (template.type === 'tab') items.push({ type: 'tab', width: numAttr(node, 'width') || 0 });
    else items.push({ ...template });
  }
  return items;
}

function parseRun(ctx, run) {
  const items = [];
  for (const node of run.children) {
    switch (node.localName) {
      case 't':
        items.push(...parseTextElement(node));
        break;
      case 'tbl':
        items.push(parseTable(ctx, node));
        break;
      case 'pic':
        items.push(parsePicture(ctx, node));
        break;
      case 'equation':
        ctx.counts.equations++;
        items.push({
          type: 'equation',
          placement: parsePlacement(node),
          script: textOf(child(node, 'script')),
        });
        break;
      case 'footNote':
      case 'endNote':
        ctx.counts.notes++;
        items.push({
          type: node.localName === 'footNote' ? 'footnote' : 'endnote',
          paragraphs: parseParagraphList(ctx, child(node, 'subList')),
        });
        break;
      case 'header':
      case 'footer':
        ctx.counts.headers++;
        items.push({
          type: node.localName === 'header' ? 'header' : 'footer',
          applyTo: Math.max(0, indexOfName(['BOTH', 'EVEN', 'ODD'], attr(node, 'applyPageType') ?? 'BOTH')),
          paragraphs: parseParagraphList(ctx, child(node, 'subList')),
        });
        break;
      case 'ctrl':
        items.push(...parseCtrl(ctx, node));
        break;
      case 'secPr':
      case 'linesegarray':
      case 'lineseg':
        break;
      case 'chart':
        ctx.counts.charts++;
        items.push({ type: 'unsupported', kind: 'chart' });
        break;
      case 'ole':
      case 'container':
      case 'textart':
      case 'video':
      case 'compose':
      case 'dutmal':
      case 'rect':
      case 'ellipse':
      case 'line':
      case 'arc':
      case 'polygon':
      case 'curve':
      case 'connectLine':
      case 'pic2':
        ctx.counts.shapes++;
        items.push({ type: 'unsupported', kind: node.localName });
        break;
      default:
        break;
    }
  }
  return items;
}

function parseCtrl(ctx, ctrl) {
  const items = [];
  for (const node of ctrl.children) {
    switch (node.localName) {
      case 'fieldBegin':
        ctx.counts.fields++;
        items.push({ type: 'field', command: firstDeep(node, 'stringParam') ? textOf(firstDeep(node, 'stringParam')) : '' });
        break;
      case 'bookmark':
        ctx.counts.bookmarks++;
        items.push({ type: 'bookmark', name: attr(node, 'name') ?? '' });
        break;
      case 'footNote':
      case 'endNote':
        ctx.counts.notes++;
        items.push({
          type: node.localName === 'footNote' ? 'footnote' : 'endnote',
          paragraphs: parseParagraphList(ctx, child(node, 'subList')),
        });
        break;
      case 'header':
      case 'footer':
        ctx.counts.headers++;
        items.push({
          type: node.localName === 'header' ? 'header' : 'footer',
          applyTo: Math.max(0, indexOfName(['BOTH', 'EVEN', 'ODD'], attr(node, 'applyPageType') ?? 'BOTH')),
          paragraphs: parseParagraphList(ctx, child(node, 'subList')),
        });
        break;
      case 'autoNum':
        items.push({
          type: 'autoNumber',
          numberKind: Math.max(
            0,
            ['PAGE', 'FOOTNOTE', 'ENDNOTE', 'PICTURE', 'TABLE', 'EQUATION'].indexOf(attr(node, 'numType') ?? 'PAGE'),
          ),
          number: numAttr(node, 'num', 1),
          suffix: (() => {
            const format = child(node, 'autoNumFormat');
            const text = attr(format, 'suffixChar') ?? ')';
            return text.length ? text.charCodeAt(0) : 0x29;
          })(),
        });
        break;
      case 'hiddenComment':
        ctx.counts.hiddenComments++;
        items.push({ type: 'unsupported', kind: 'hiddenComment' });
        break;
      case 'memo':
        ctx.counts.memos++;
        items.push({ type: 'unsupported', kind: 'memo' });
        break;
      default:
        break;
    }
  }
  return items;
}

function parseTable(ctx, element) {
  ctx.counts.tables++;
  const inMargin = child(element, 'inMargin');
  const rows = children(element, 'tr');
  const height = numAttr(child(element, 'sz'), 'height');
  const width = numAttr(child(element, 'sz'), 'width');

  const tableRows = [];
  const preview = [];
  let maxCol = 0;

  for (const tr of rows) {
    const cells = [];
    const rowTexts = [];
    let rowHeight = 0;
    for (const tc of children(tr, 'tc')) {
      ctx.counts.cells++;
      const addr = child(tc, 'cellAddr');
      const span = child(tc, 'cellSpan');
      const size = child(tc, 'cellSz');
      const cellMargin = child(tc, 'cellMargin');
      const subList = child(tc, 'subList');
      const paragraphs = parseParagraphList(ctx, subList);
      const row = numAttr(addr, 'rowAddr');
      const col = numAttr(addr, 'colAddr');
      const colSpan = Math.max(1, numAttr(span, 'colSpan', 1));
      const rowSpan = Math.max(1, numAttr(span, 'rowSpan', 1));
      const cellHeight = numAttr(size, 'height');
      if (rowSpan === 1) rowHeight = Math.max(rowHeight, cellHeight);
      maxCol = Math.max(maxCol, col + colSpan);

      cells.push({
        col,
        row,
        colSpan,
        rowSpan,
        width: numAttr(size, 'width'),
        height: cellHeight,
        margins: {
          left: numAttr(cellMargin, 'left'),
          right: numAttr(cellMargin, 'right'),
          top: numAttr(cellMargin, 'top'),
          bottom: numAttr(cellMargin, 'bottom'),
        },
        borderFillId: Math.max(0, numAttr(tc, 'borderFillIDRef', 1) - 1),
        verticalAlign: indexOfName(['TOP', 'CENTER', 'BOTTOM'], attr(subList, 'vertAlign') ?? 'TOP'),
        paragraphs,
      });
      rowTexts.push(paragraphs.map(paragraphText).join(' ').trim());
    }
    tableRows.push({ height: rowHeight || Math.round(height / Math.max(1, rows.length)), cells });
    preview.push(rowTexts);
  }

  return {
    type: 'table',
    placement: (() => {
      const placement = parsePlacement(element);
      if (!placement.width) placement.width = width;
      if (!placement.height) placement.height = height;
      return placement;
    })(),
    rows: tableRows,
    columns: maxCol,
    cellMargins: {
      left: numAttr(inMargin, 'left'),
      right: numAttr(inMargin, 'right'),
      top: numAttr(inMargin, 'top'),
      bottom: numAttr(inMargin, 'bottom'),
    },
    cellSpacing: numAttr(element, 'cellSpacing'),
    borderFillId: Math.max(0, numAttr(element, 'borderFillIDRef', 1) - 1),
    pageBreak: Math.max(0, indexOfName(['NONE', 'CELL', 'TABLE'], attr(element, 'pageBreak') ?? 'CELL', 1)),
    repeatHeader: boolAttr(element, 'repeatHeader'),
    preview,
  };
}

function parsePicture(ctx, element) {
  ctx.counts.images++;
  const img = child(element, 'img');
  const size = child(element, 'sz');
  const dim = child(element, 'imgDim');
  return {
    type: 'picture',
    placement: parsePlacement(element),
    binId: attr(img, 'binaryItemIDRef') ?? '',
    width: numAttr(size, 'width'),
    height: numAttr(size, 'height'),
    originalWidth: numAttr(dim, 'dimwidth') || numAttr(size, 'width'),
    originalHeight: numAttr(dim, 'dimheight') || numAttr(size, 'height'),
  };
}

function parseParagraphList(ctx, container) {
  if (!container) return [];
  const paragraphs = children(container, 'p').map((p) => parseParagraph(ctx, p));
  return paragraphs.length ? paragraphs : [{ paraShapeId: 0, styleId: 0, runs: [{ charShapeId: 0, items: [] }] }];
}

function parseParagraph(ctx, element) {
  ctx.counts.paragraphs++;
  const paragraph = {
    paraShapeId: numAttr(element, 'paraPrIDRef'),
    styleId: numAttr(element, 'styleIDRef'),
    pageBreak: boolAttr(element, 'pageBreak'),
    columnBreak: boolAttr(element, 'columnBreak'),
    runs: [],
  };
  for (const run of children(element, 'run')) {
    paragraph.runs.push({ charShapeId: numAttr(run, 'charPrIDRef'), items: parseRun(ctx, run) });
  }
  if (paragraph.runs.length === 0) paragraph.runs.push({ charShapeId: 0, items: [] });
  return paragraph;
}

/** 문단의 평문 (미리보기·텍스트 추출용). */
export function paragraphText(paragraph) {
  let out = '';
  for (const run of paragraph.runs) {
    for (const item of run.items) {
      if (item.type === 'text') out += item.value;
      else if (item.type === 'tab') out += '\t';
      else if (item.type === 'lineBreak') out += '\n';
      else if (item.type === 'special') {
        if (item.char === 'nbsp' || item.char === 'fixedWidthSpace') out += ' ';
        else if (item.char === 'hyphen') out += '-';
      } else if (item.type === 'table') {
        out += item.preview.map((row) => row.join(' | ')).join('\n');
      }
    }
  }
  return out;
}

/* --------------------------------------------------------------- 패키지 */

function findSectionPaths(files) {
  const paths = [];
  for (const name of files.keys()) {
    const match = name.match(/^Contents\/section(\d+)\.xml$/);
    if (match) paths.push({ name, index: Number(match[1]) });
  }
  paths.sort((a, b) => a.index - b.index);
  if (paths.length) return paths.map((p) => p.name);

  // 컨테이너/스파인만 있는 비표준 패키지 대비.
  const fallback = [];
  for (const name of files.keys()) {
    if (/section\d+\.xml$/i.test(name)) fallback.push(name);
  }
  return fallback.sort();
}

function readBinData(files) {
  const items = [];
  const names = [...files.keys()].filter((name) => /^BinData\/[^/]+$/.test(name)).sort();
  for (const name of names) {
    const file = name.slice('BinData/'.length);
    const dot = file.lastIndexOf('.');
    const id = dot === -1 ? file : file.slice(0, dot);
    const ext = dot === -1 ? 'bin' : file.slice(dot + 1).toLowerCase();
    items.push({ id, ext, data: files.get(name), name: file });
  }
  return items;
}

/**
 * HWPX 바이트를 읽어 IR과 진단 정보를 돌려준다.
 * @param {Uint8Array} bytes
 */
export async function parseHwpx(bytes) {
  const zip = await readZip(bytes);
  const files = zip.files;

  const headerBytes = files.get('Contents/header.xml');
  if (!headerBytes || !files.has('Contents/section0.xml')) {
    if (zip.encrypted.length) {
      throw new Error('암호가 걸린 HWPX입니다. 한글에서 암호를 해제한 뒤 다시 시도해 주세요.');
    }
    throw new Error('HWPX 구조가 아닙니다. (Contents/header.xml, Contents/section0.xml 없음)');
  }

  const headerDoc = parseXml(headerBytes, 'Contents/header.xml');
  const resources = parseResources(headerDoc);
  const binData = readBinData(files);
  const ctx = createContext();
  const sections = [];
  const sectionPaths = findSectionPaths(files);

  for (const path of sectionPaths) {
    const sectionDoc = parseXml(files.get(path), path);
    const root = sectionDoc.documentElement;
    const secPr = firstDeep(root, 'secPr');
    const pageDef = secPr ? parsePageDef(secPr) : parsePageDef(null);
    const paragraphs = children(root, 'p').map((p) => parseParagraph(ctx, p));
    if (paragraphs.length === 0) {
      paragraphs.push({ paraShapeId: 0, styleId: 0, runs: [{ charShapeId: 0, items: [] }] });
    }
    sections.push({ pageDef, paragraphs });
  }

  if (sections.length === 0) {
    throw new Error('본문 구역(section)을 찾지 못했습니다.');
  }

  const settings = parseSettings(files.get('settings.xml'));
  return {
    meta: parseMeta(files.get('Contents/content.hpf')),
    resources,
    binData,
    sections,
    settings,
    diagnostics: {
      ...ctx.counts,
      sections: sections.length,
      fonts: resources.fonts[0].length,
      charShapes: resources.charShapes.length,
      paraShapes: resources.paraShapes.length,
      styles: resources.styles.length,
      borderFills: resources.borderFills.length,
      binData: binData.length,
      encrypted: zip.encrypted.length > 0,
      entryCount: files.size,
      missing: buildMissing(resources),
    },
  };
}

function buildMissing(resources) {
  const missing = [];
  if (resources.charShapes.length === 0) missing.push('글자 모양');
  if (resources.paraShapes.length === 0) missing.push('문단 모양');
  if (resources.borderFills.length === 0) missing.push('테두리/배경');
  if (resources.fonts[0].length === 0) missing.push('글꼴');
  return missing;
}

function parseMeta(bytes) {
  if (!bytes) return {};
  try {
    const doc = parseXml(bytes, 'content.hpf');
    const meta = {};
    for (const element of doc.getElementsByTagNameNS('*', 'meta')) {
      const name = attr(element, 'name');
      if (name) meta[name] = attr(element, 'content') ?? '';
    }
    const title = firstDeep(doc, 'title');
    if (title) meta.title = textOf(title);
    return meta;
  } catch {
    return {};
  }
}

function parseSettings(bytes) {
  const result = { caretList: 0, caretParagraph: 0, caretPosition: 0 };
  if (!bytes) return result;
  try {
    const doc = parseXml(bytes, 'settings.xml');
    const caret = firstDeep(doc, 'caretPosition');
    if (caret) {
      result.caretList = numAttr(caret, 'listIDRef');
      result.caretParagraph = numAttr(caret, 'paraIDRef');
      result.caretPosition = numAttr(caret, 'pos');
    }
  } catch {
    /* 설정 파일은 없어도 된다. */
  }
  return result;
}
