/* ============================================================
   OneTap i18n · KO/EN runtime translation (v1)
   - ?lang=en|ko  >  localStorage 'onetap_lang'  >  navigator.language
   - DOM text and attributes are translated in place and restored on switch.
   - Elements added later by app.js are translated by a MutationObserver.
   - Missing keys are reported to console as "I18N_MISS: <korean>".
   ============================================================ */
(function (root, doc) {
  'use strict';

  var LANG_KEY = 'onetap_lang';
  var COMMON = /*__COMMON__*/ {"닫기":"Close","취소":"Cancel","저장":"Save","저장됨":"Saved","삭제":"Delete","복사":"Copy","복사됨":"Copied","다운로드":"Download","내려받기":"Download","공유":"Share","인쇄":"Print","초기화":"Reset","다시 시도":"Try again","불러오기":"Load","내보내기":"Export","적용":"Apply","추가":"Add","편집":"Edit","수정":"Edit","보기":"View","미리보기":"Preview","설정":"Settings","도움말":"Help","사용법":"Guide","예시":"Example","샘플":"Sample","무료":"Free","유료":"Paid","개인정보":"Privacy","개인정보 처리방침":"Privacy policy","개인정보 처리 안내":"Privacy notice","이용약관":"Terms","홈":"Home","뒤로":"Back","다음":"Next","이전":"Previous","확인":"OK","검색":"Search","필터":"Filter","전체":"All","없음":"None","준비 중":"Coming soon","준비 중입니다":"Coming soon","로딩 중":"Loading","불러오는 중":"Loading","처리 중":"Working","빈칸":"Blank","필수":"Required","선택":"Optional","이름":"Name","제목":"Title","날짜":"Date","시간":"Time","메모":"Note","상태":"Status","결과":"Result","요약":"Summary","상세":"Details","언어":"Language","한국어":"Korean","영어":"English","복사하기":"Copy","링크 복사":"Copy link","전체 복사":"Copy all","다크 모드로 전환":"Switch to dark mode","라이트 모드로 전환":"Switch to light mode","테마 전환":"Toggle theme","라이트/다크":"Light / dark","다크/라이트":"Dark / light","새 탭에서 보기":"Open in new tab","새 창":"New window","본문으로 건너뛰기":"Skip to content","본문으로 바로가기":"Skip to content","맨 위로":"Back to top","더 보기":"Show more","접기":"Collapse","펼치기":"Expand","자주 묻는 질문":"Frequently asked questions","이 브라우저에만 저장됩니다":"Saved only in this browser","이 브라우저에만 저장됩니다 · 서버 전송 0":"Saved only in this browser · zero uploads","서버 전송 없음":"No upload","서버 업로드 없음":"No server upload","100% 브라우저 처리":"100% in-browser","브라우저에서 처리":"Processed in your browser","파일은 서버로 전송되지 않습니다":"Files never leave your device","파일이 서버로 전송되지 않습니다":"Files never leave your device","붙여넣은 코드는 서버로 전송되지 않습니다":"Pasted code never leaves your device"};
  var APP = /*__DICT__*/ {"HWPX → HWP 변환기 — 브라우저에서 바로, 서버 업로드 없이":"HWPX → HWP Converter — right in your browser, no upload","HWPX(한글 2014 이후) 문서를 HWP 5.0 파일로 바꿉니다. 문단·글자 서식·표·그림을 살려 여러 개를 변환하고 ZIP으로 내려받으세요. 파일은 브라우저 안에서만 처리되며 서버로 전송되지 않습니다.":"Convert HWPX documents (Hangul 2014 and later) into HWP 5.0 files. Paragraphs, character formatting, tables and images are kept, several files convert at once, and you download them as a ZIP. Files are processed only inside your browser and never sent to a server.","원탭 문서 도구":"OneTap Document Tools","HWPX → HWP 변환기":"HWPX → HWP Converter","HWPX를 HWP 5.0으로. 서식·표·그림을 살려 한 번에 변환하고 ZIP으로 받으세요. 100% 브라우저 처리.":"HWPX to HWP 5.0. Convert in bulk with formatting, tables and images intact, then download a ZIP. 100% in-browser.","HWPX → HWP 변환기 화면.":"HWPX → HWP converter screen.","JavaScript 필요, 최신 Chrome·Safari·Edge":"Requires JavaScript; latest Chrome, Safari or Edge","HWPX(OWPML) 문서를 HWP 5.0 바이너리로 변환합니다. 서식·표·그림을 유지하고 여러 파일을 한 번에 처리하며, 모든 처리는 브라우저 안에서 이뤄집니다.":"Converts HWPX (OWPML) documents into HWP 5.0 binaries. Keeps formatting, tables and images, handles several files at once, and does everything inside the browser.","HWPX → HWP 5.0 변환":"HWPX → HWP 5.0 conversion","여러 파일 일괄 변환과 ZIP 다운로드":"Bulk conversion with ZIP download","문단·글자 모양·표·그림 보존":"Paragraphs, character formats, tables and images preserved","변환 전 문서 진단과 텍스트 미리보기":"Pre-conversion diagnostics and text preview","서버 업로드 없는 로컬 처리":"Local processing with no server upload","본문으로 건너뛰기":"Skip to content","HWPX to HWP 변환기 홈":"HWPX to HWP Converter home","HWPX 파일을":"Turn HWPX files into","로 바꿔 드립니다":" in seconds","한글 2014 이후가 쓰는 HWPX 문서를 예전 HWP 5.0 파일로 변환합니다. 글자 모양, 문단 정렬, 표, 그림까지 가능한 그대로 옮기고, 여러 개도 한 번에 처리합니다.":"Converts the HWPX documents written by Hangul 2014 and later into the older HWP 5.0 format. Character formats, paragraph alignment, tables and images carry over as faithfully as possible, and several files can go at once.","주요 특징":"Key features","여러 개 일괄 변환":"Bulk conversion","표·그림 보존":"Tables & images kept","설치 없이 무료":"Free, no install","HWPX 파일을 여기로 끌어다 놓으세요":"Drop your HWPX files here","탭해서 고르거나, 여러 개를 한꺼번에 놓아도 됩니다. .hwpx만 변환합니다.":"Tap to choose files or drop several at once. Only .hwpx files are converted.","파일 선택":"Choose files","샘플 HWPX로 체험하기":"Try a sample HWPX","표·서식·색상이 들어 있는 예제 문서로 바로 확인해 보세요.":"A ready-made document with tables, formatting and colour, so you can see it work.","변환 목록":"Conversion queue","변환하기":"Convert","비우기":"Clear","모두 ZIP으로 내려받기":"Download all as ZIP","변환 결과":"Results","새 파일 변환":"Convert new files","변환한 문서 엿보기":"Inspect the converted document","문서 선택":"Choose a document","미리보기 종류":"Preview type","본문 미리보기":"Text preview","문서 진단":"Document report","한계와 주의":"Limits & notes","이렇게 옮깁니다":"What carries over","문단·글자 모양(굵기, 기울임, 밑줄, 취소선, 색, 크기, 자간, 장평), 문단 정렬·들여쓰기·줄 간격을 옮깁니다.":"Paragraph and character formats (bold, italic, underline, strikethrough, colour, size, letter spacing, width), plus paragraph alignment, indents and line spacing.","표는 셀 병합(가로·세로), 셀 배경·테두리, 셀 안의 문단까지 옮깁니다.":"Tables keep merged cells (across rows and columns), cell fills, borders and the paragraphs inside each cell.","그림은 문서 안에 품어서 옮깁니다. 원본 그림은 압축해 넣고, 화면에는 글 위아래로 흐르는 개체로 배치합니다.":"Images are embedded in the document: the original is stored compressed and placed as an object that flows with the text.","각주·미주, 머리말·꼬리말의 글은 옮깁니다.":"Footnotes, endnotes, headers and footers carry over.","그대로 옮기지 못하는 것":"What does not carry over","은 내용을 옮기지 못합니다. 자리만 비고 문서는 정상적으로 열립니다.":" is not carried over. The space stays empty and the document still opens normally.","는 값만 일반 글자로 남습니다. 필드 기능은 사라집니다.":" keeps only its value as plain text. The field behaviour is lost.","는 뷰어에 따라 접두 기호가 한 번 더 붙어":" can pick up an extra prefix in some viewers, so it","처럼 보일 수 있습니다. 한글에서 열면 다시 계산됩니다.":" may look like this. Opening the file in Hangul recalculates it.","는 지원하지 않습니다. 한글에서 암호를 해제한 뒤 변환하세요.":" is not supported. Remove the password in Hangul, then convert.","쪽 나눔 위치와 줄 배치는 한글이 다시 계산합니다. 원본과 1픽셀 단위로 같지는 않습니다.":"Page breaks and line layout are recalculated by Hangul, so they will not match the original to the pixel.","파일은 어디로 갈까요?":"Where do my files go?","어디에도 가지 않습니다. 변환은 이 브라우저 탭 안에서 이뤄지고, 인터넷을 끊어도 동작합니다. 내려받은 .hwp 파일은 브라우저의 다운로드 폴더에만 남습니다.":"Nowhere. The conversion happens inside this browser tab and keeps working with the network off. The .hwp files you download stay only in your browser's download folder.","HWP 파일 글자만 보기":"Read the text of an HWP file","HWP 열기":"Open HWP","TXT로 저장":"Save as TXT","이미 가지고 있는 HWP 파일에서 글자만 뽑아 봅니다. 변환하지 않고 내용만 확인할 때 씁니다.":"Pulls just the text out of an HWP file you already have. Useful for checking the content without converting.","아직 연 파일이 없습니다.":"No file open yet.","HWPX와 HWP는 무엇이 다른가요?":"How are HWPX and HWP different?","HWPX는 한글 2014부터 쓰는 개방형 문서 형식(OWPML)으로, ZIP 안에 XML로 내용을 담습니다. HWP는 그 이전부터 쓰던 바이너리 형식(HWP 5.0)입니다. 관공서·은행·오래된 편집 도구는 아직 HWP만 받는 곳이 있어 변환이 필요합니다.":"HWPX is the open document format (OWPML) used since Hangul 2014 — a ZIP that holds the content as XML. HWP is the older binary format, HWP 5.0. Some government offices, banks and older editing tools still accept only HWP, so a conversion is needed.","표나 그림도 그대로 나오나요?":"Do tables and images come through intact?","표는 셀 병합과 테두리·배경까지, 그림은 파일 안에 품어서 옮깁니다. 다만 차트·수식·OLE·글맵시처럼 HWP 5.0에 대응 형식이 없는 개체는 옮기지 못하고 자리만 남습니다.":"Tables keep merged cells, borders and fills, and images are embedded in the file. Objects with no HWP 5.0 equivalent — charts, equations, OLE and WordArt — are not carried over and leave only their space.","여러 개를 한 번에 바꿀 수 있나요?":"Can I convert several files at once?","됩니다. 파일을 여러 개 놓고":"Yes. Drop several files, press ","를 누른 뒤":", then press ","를 누르면 한 번에 받습니다. 개별 파일은 목록에서 따로 내려받을 수도 있습니다.":" to get them all in one go. Individual files can also be downloaded from the list.","변환한 파일이 열리지 않아요.":"The converted file won't open.","암호가 걸린 문서이거나, HWPX가 아닌 파일을 확장자만 바꾼 경우입니다. 원본을 한글에서 열어 다른 이름으로 저장한 뒤 다시 시도해 보세요. 그래도 문제가 있으면 문서 진단 탭의 안내를 확인해 주세요.":"Either the document is password-protected, or the file is not HWPX and only its extension was changed. Open the original in Hangul, save it under a new name and try again. If it still fails, read the notes on the Document report tab.","HWPX → HWP 변환기 · 모든 처리는 브라우저에서 ·":"HWPX → HWP Converter · all processing in your browser · ","한글과컴퓨터의 공개 문서 형식 규격을 참고해 만든 독립 도구입니다. 한글과컴퓨터와 제휴 관계가 없습니다.":"An independent tool built on the public document format specification published by Hancom. Not affiliated with Hancom.","대기":"Queued","변환 중":"Converting","완료":"Done","오류":"Error",".hwpx 파일만 변환할 수 있습니다.":"Only .hwpx files can be converted.","본문이 비어 있는 문서입니다.":"This document has no body text.","암호화된 항목이 있어 일부 내용을 읽지 못했습니다.":"Parts of the file are encrypted, so some content could not be read.","문단":"Paragraphs","표":"Tables","셀":"Cells","그림":"Images","각주":"Notes","필드":"Fields","글자 모양":"Character formats","문단 모양":"Paragraph formats","스타일":"Styles","테두리":"Borders","구역":"Sections","원본 용량":"Original size","변환 용량":"Converted size","걸린 시간":"Time taken","옮기지 못한 요소가 없습니다.":"Nothing was left out.","변환할 파일이 없습니다.":"There are no files to convert.","변환 중…":"Converting…","변환을 마쳤습니다.":"Conversion finished.","묶는 중…":"Zipping…","ZIP을 만들지 못했습니다.":"Could not build the ZIP.","샘플 불러오는 중…":"Loading the sample…","원탭-변환-샘플.hwpx":"onetap-sample.hwpx","샘플을 목록에 넣었습니다. 변환하기를 눌러 보세요.":"Sample added to the queue. Press Convert to try it.","샘플을 불러오지 못했습니다.":"Could not load the sample.","읽는 중…":"Reading…","(글자가 없는 문서입니다.)":"(this document has no text.)","HWP 파일이 맞는지, 암호가 걸려 있지 않은지 확인해 주세요.":"Check that the file really is HWP and that it is not password-protected.","글자를 복사했습니다.":"Text copied.","이 브라우저에서는 복사가 막혀 있습니다.":"Copying is blocked in this browser.","이 브라우저는 필요한 기능을 지원하지 않습니다. 최신 Chrome·Edge·Safari에서 열어 주세요.":"This browser is missing a feature the converter needs. Please open the page in a recent Chrome, Edge or Safari.","차트, 수식, OLE 개체, 글맵시, 3D 도형":"Charts, equations, OLE objects, WordArt and 3D shapes","누름틀·필드":"Form fields","각주 번호":"Footnote numbers","암호가 걸린 HWPX":"Password-protected HWPX files","원탭-변환-샘플.hwp":"onetap-sample.hwp","원탭 HWPX → HWP 변환 샘플":"OneTap HWPX → HWP sample","이 문서는 변환기가 서식·표·그림을 어떻게 옮기는지 확인하는 예제입니다. 아래 내용을 그대로 HWP로 바꿔 보세요.":"This sample shows how the converter carries formatting, tables and images over. Convert it and open the result in Hangul to compare.","1. 글자 모양 굵게, 색상, 밑줄, 기울임":"1. Character formats: bold, colour, underline, italic","2. 표":"2. Table","3. 줄 바꿈과 정렬":"3. Line breaks and alignment","오른쪽 정렬 문단입니다.":"This paragraph is right-aligned.","들여쓰기 문단입니다.":"This paragraph is indented.","모든 처리는 브라우저 안에서 끝나고, 파일은 서버로 전송되지 않습니다.":"Everything runs inside the browser; files are never sent to a server.","항목":"Item","담당":"Owner","문서 변환":"Convert document","자동":"Automatic","서식 점검":"Format check","상태":"Status","1. 글자 모양  굵게, 색상, 밑줄, 기울임":"1. Character formats: bold, colour, underline, italic","상태 문서 변환":"Status Convert document","원탭-변환-샘플.hwpx 목록에서 빼기":"Remove onetap-sample.hwpx from the list"};
  var PATTERNS = /*__PATTERNS__*/ [[new RegExp("^(.+) 목록에서 빼기$", ""), "Remove $1 from the list"],[new RegExp("^1개를 ZIP 하나로 묶어 받습니다\\.$", ""), "1 file in a single ZIP."],[new RegExp("^(\\d+)개를 ZIP 하나로 묶어 받습니다\\.$", ""), "$1 files in a single ZIP."],[new RegExp("^([\\d.,]+\\s?[KMGT]?B) · 문단 (\\d+) · 표 (\\d+) · 그림 (\\d+)$", ""), "$1 · $2 paragraphs · $3 tables · $4 images"],[new RegExp("^([\\d.,]+\\s?[KMGT]?B) · 문단 (\\d+) · 표 (\\d+) · 그림 (\\d+) · 각주 (\\d+)$", ""), "$1 · $2 paragraphs · $3 tables · $4 images · $5 notes"],[new RegExp("^… 문단 (\\d+)개 중 앞부분만 보여 줍니다\\.$", ""), "… showing only the start of $1 paragraphs."],[new RegExp("^차트 (\\d+)개는 옮기지 못했습니다\\. 자리만 남습니다\\.$", ""), "$1 charts could not be carried over; only their space remains."],[new RegExp("^수식 (\\d+)개는 글자로 옮기지 못했습니다\\.$", ""), "$1 equations could not be carried over as text."],[new RegExp("^도형·OLE·글맵시 (\\d+)개는 옮기지 못했습니다\\.$", ""), "$1 shapes, OLE objects or WordArt items could not be carried over."],[new RegExp("^메모 (\\d+)개는 옮기지 못했습니다\\.$", ""), "$1 memos could not be carried over."],[new RegExp("^숨은 설명 (\\d+)개는 옮기지 못했습니다\\.$", ""), "$1 hidden comments could not be carried over."],[new RegExp("^누름틀·필드 (\\d+)개는 값만 일반 글자로 남았습니다\\.$", ""), "$1 fields kept only their values as plain text."],[new RegExp("^각주·미주 (\\d+)개를 옮겼습니다\\. 번호는 뷰어에 따라 0으로 보일 수 있습니다\\.$", ""), "Carried over $1 footnotes and endnotes. Numbers may show as 0 in some viewers."],[new RegExp("^원본에 (.+) 정의가 없어 기본값으로 채웠습니다\\.$", ""), "The original has no $1 definition, so defaults were used."],[new RegExp("^(\\d+)개는 변환하지 못했습니다\\.$", ""), "$1 files could not be converted."],[new RegExp("^([^ ]+) · 구역 (\\d+)개 · 문단 (\\d+)개$", ""), "$1 · $2 sections · $3 paragraphs"],[new RegExp("^열지 못했습니다: (.+)$", ""), "Could not open it: $1"],[new RegExp("^항목 \\| 담당 \\| 상태 문서 변환 \\| 자동 \\| 완료 서식 점검 \\| 자동 \\| 완료$", ""), "Item | Owner | Status  Convert document | Automatic | Done  Format check | Automatic | Done"],[new RegExp("^1개 파일$", ""), "1 file"]];

  var DICT = {};
  var k;
  for (k in COMMON) if (Object.prototype.hasOwnProperty.call(COMMON, k)) DICT[k] = COMMON[k];
  for (k in APP) if (Object.prototype.hasOwnProperty.call(APP, k)) DICT[k] = APP[k];

  var HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3]/;
  var SKIP_TAG = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, SVG: 1 };
  var ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  var state = { lang: 'ko' };
  var records = [];
  var missing = {};
  var missingList = [];
  var observer = null;

  /* ---------- language ---------- */
  function detect() {
    try {
      var q = new URLSearchParams(root.location.search).get('lang');
      if (q === 'ko' || q === 'en') return q;
    } catch (e) { /* very old browser */ }
    try {
      var saved = root.localStorage.getItem(LANG_KEY);
      if (saved === 'ko' || saved === 'en') return saved;
    } catch (e) { /* private mode */ }
    var nav = root.navigator.language || root.navigator.userLanguage || 'ko';
    return /^ko/i.test(nav) ? 'ko' : 'en';
  }

  /* ---------- lookup ---------- */
  function report(text) {
    if (missing[text]) return;
    missing[text] = 1;
    missingList.push(text);
    if (root.console && console.warn) console.warn('I18N_MISS: ' + text);
  }

  function tr(raw) {
    if (typeof raw !== 'string' || !HANGUL.test(raw)) return raw;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    var lead = m[1], core = m[2], tail = m[3];
    if (!core) return raw;
    var hit = DICT[core];
    if (hit == null && /\s{2,}|\n/.test(core)) hit = DICT[core.replace(/\s+/g, ' ').trim()];
    if (hit != null) return lead + hit + tail;

    /* money in Korean format: 81만 원 / 2,980,750원  ->  {0} template */
    var money = takeMoney(core);
    if (money.map.length) {
      var tpl = money.text;
      var th = DICT[tpl];
      if (th == null && /\s{2,}|\n/.test(tpl)) th = DICT[tpl.replace(/\s+/g, ' ').trim()];
      if (th == null && /^\{0\}$/.test(tpl.trim())) th = '{0}';
      if (th != null) return lead + putMoney(th, money.map) + tail;
      for (var mi = 0; mi < PATTERNS.length; mi++) {
        if (PATTERNS[mi][0].test(tpl)) {
          var mo = tpl.replace(PATTERNS[mi][0], PATTERNS[mi][1]);
          if (!HANGUL.test(mo)) return lead + putMoney(mo, money.map) + tail;
        }
      }
    }
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      if (p[0].test(core)) {
        var out = core.replace(p[0], p[1]);
        if (!HANGUL.test(out)) return lead + out + tail;
      }
    }
    var seg = trSegments(core);
    if (seg != null) return lead + seg + tail;
    report(core);
    return raw;
  }


  /* Korean money -> token template; values are formatted as ₩1,234,567 */
  function won(n) { return '₩' + n.toLocaleString('en-US'); }
  function takeMoney(core) {
    var map = [];
    var out = core.replace(/([\d,]+)\s*만(?:\s*([\d,]+))?\s*원/g, function (all, a, b) {
      var n = parseInt(a.replace(/,/g, ''), 10) * 10000 + (b ? parseInt(b.replace(/,/g, ''), 10) : 0);
      map.push(won(n));
      return '{' + (map.length - 1) + '}';
    });
    out = out.replace(/([+\-]?[\d,]+)\s*원/g, function (all, a) {
      map.push('₩' + a);
      return '{' + (map.length - 1) + '}';
    });
    return { text: out, map: map };
  }
  function putMoney(s, map) {
    return s.replace(/\{(\d+)\}/g, function (all, i) { return map[+i] != null ? map[+i] : all; });
  }

  /* A small unit: dictionary hit or pattern hit, no whitespace trimming. */
  function lookupSmall(unit) {
    var hit = DICT[unit];
    if (hit != null) return hit;
    for (var i = 0; i < PATTERNS.length; i++) {
      var p = PATTERNS[i];
      if (p[0].test(unit)) {
        var out = unit.replace(p[0], p[1]);
        if (!HANGUL.test(out)) return out;
      }
    }
    return null;
  }

  function trPipe(line) {
    var parts = line.split(/\s*\|\s*/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var t = lookupSmall(parts[i].trim());
      if (t == null) return null;
      out.push(t);
    }
    return out.join(' | ');
  }

  function trSegments(core) {
    if (core.indexOf('\n') > -1) {
      var lines = core.split('\n');
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var t = line.indexOf('|') > -1 ? trPipe(line) : lookupSmall(line.trim());
        if (t == null) return null;
        out.push(t);
      }
      return out.join('\n');
    }
    if (core.indexOf('|') > -1) return trPipe(core);
    return null;
  }

  /* ---------- DOM walking ---------- */
  function skipped(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (SKIP_TAG[el.tagName]) return true;
        if (el.getAttribute && (el.hasAttribute('data-i18n-skip') || el.getAttribute('contenteditable') === 'true')) return true;
        if (el.classList && el.classList.contains('onetap-lang')) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function trText(node) {
    var v = node.nodeValue;
    if (!v || !HANGUL.test(v)) return;
    var out = tr(v);
    if (out !== v) {
      records.push({ n: node, v: v });
      node.nodeValue = out;
    }
  }

  function trAttrs(el) {
    var i, at, v, out;
    for (i = 0; i < ATTRS.length; i++) {
      at = ATTRS[i];
      if (!el.hasAttribute(at)) continue;
      v = el.getAttribute(at);
      if (!v || !HANGUL.test(v)) continue;
      out = tr(v);
      if (out !== v) {
        records.push({ e: el, a: at, v: v });
        el.setAttribute(at, out);
      }
    }
    if (el.tagName === 'INPUT') {
      var ty = (el.type || '').toLowerCase();
      if (ty === 'button' || ty === 'submit' || ty === 'reset') {
        v = el.value;
        if (v && HANGUL.test(v)) {
          out = tr(v);
          if (out !== v) { records.push({ e: el, a: 'value', v: v }); el.value = out; }
        }
      }
    }
  }

  function walk(node) {
    if (node.nodeType === 3) { trText(node); return; }
    if (node.nodeType !== 1) return;
    if (node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE' && node.tagName !== 'SVG' &&
        !(node.classList && node.classList.contains('onetap-lang'))) trAttrs(node);
    if (skipped(node)) return;
    if (node.tagName === 'META') return;
    for (var c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function trMeta() {
    var list = doc.querySelectorAll('meta[name="description"], meta[property="og:title"], meta[property="og:description"], meta[name="twitter:title"], meta[name="twitter:description"]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], v = el.getAttribute('content');
      if (v && HANGUL.test(v)) {
        var out = tr(v);
        if (out !== v) { records.push({ e: el, a: 'content', v: v }); el.setAttribute('content', out); }
      }
    }
  }

  function trJsonLd() {
    var list = doc.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      try {
        var data = JSON.parse(el.textContent);
        var changed = fixJson(data);
        if (changed) el.textContent = JSON.stringify(data);
      } catch (e) { /* leave as is */ }
    }
  }

  function fixJson(o) {
    var changed = false, i;
    if (Array.isArray(o)) {
      for (i = 0; i < o.length; i++) if (fixJson(o[i])) changed = true;
      return changed;
    }
    if (!o || typeof o !== 'object') return false;
    for (var key in o) {
      if (!Object.prototype.hasOwnProperty.call(o, key)) continue;
      var v = o[key];
      if (typeof v === 'string' && HANGUL.test(v)) {
        var out = DICT[v.trim()];
        if (out != null) { o[key] = out; changed = true; }
      } else if (v && typeof v === 'object') {
        if (fixJson(v)) changed = true;
      }
    }
    return changed;
  }

  /* ---------- apply / restore ---------- */
  function applyEn() {
    var title = root.__onetapTitle || (root.__onetapTitle = doc.title);
    walk(doc.body);
    trMeta();
    trJsonLd();
    doc.documentElement.lang = 'en';
    var t = DICT[title] || DICT[title.trim()];
    doc.title = t || title;
  }

  function restoreKo() {
    for (var i = records.length - 1; i >= 0; i--) {
      var r = records[i];
      if (r.n) { if (r.n.nodeValue !== r.v) r.n.nodeValue = r.v; }
      else if (r.e) {
        if (r.a === 'value') { if (r.e.value !== r.v) r.e.value = r.v; }
        else if (r.e.getAttribute(r.a) !== r.v) r.e.setAttribute(r.a, r.v);
      }
    }
    var title = root.__onetapTitle;
    if (title) doc.title = title;
    doc.documentElement.lang = 'ko';
  }

  /* ---------- language switch UI ---------- */
  function buildSwitch() {
    var wrap = doc.createElement('div');
    wrap.className = 'onetap-lang';
    wrap.setAttribute('role', 'group');
    wrap.innerHTML = '<button type="button" data-onetap-lang="ko" aria-pressed="true">KO</button>' +
      '<button type="button" data-onetap-lang="en" aria-pressed="false">EN</button>';
    var box = doc.querySelector('.top-actions') || doc.querySelector('.topbar__inner') ||
      doc.querySelector('.topbar-inner') || doc.querySelector('.topbar-in') ||
      doc.querySelector('.topbar') || doc.querySelector('header');
    if (box) {
      if (box.classList.contains('top-actions')) box.insertBefore(wrap, box.firstChild);
      else {
        var act = box.querySelector('.top-actions');
        if (act) box.insertBefore(wrap, act); else box.appendChild(wrap);
      }
    } else {
      wrap.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;background:rgba(255,255,255,.9);color:#111';
      doc.body.appendChild(wrap);
    }
    wrap.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-onetap-lang]');
      if (!b) return;
      setLang(b.getAttribute('data-onetap-lang'));
    });
    return wrap;
  }

  var CSS = '.onetap-lang{display:inline-flex;flex:none;align-items:center;padding:2px;border:1px solid currentColor;border-radius:999px;opacity:.72;transition:opacity .15s;vertical-align:middle;align-self:center}' +
    '.onetap-lang:hover,.onetap-lang:focus-within{opacity:1}' +
    '.onetap-lang button{appearance:none;-webkit-appearance:none;border:0;background:transparent;color:inherit;font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.04em;line-height:1;padding:5px 6px;border-radius:999px;cursor:pointer;min-width:26px;text-align:center}' +
    '.onetap-lang button[aria-pressed="true"]{background:rgba(128,128,128,.3)}' +
    '@media (max-width:520px){.onetap-lang button{padding:4px 4px;font-size:10px;min-width:22px}.onetap-lang{margin-left:2px}}';

  function injectCss() {
    var s = doc.createElement('style');
    s.id = 'onetap-lang-css';
    s.textContent = CSS;
    (doc.head || doc.documentElement).appendChild(s);
  }

  function paintSwitch() {
    var bs = doc.querySelectorAll('[data-onetap-lang]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].setAttribute('aria-pressed', bs[i].getAttribute('data-onetap-lang') === state.lang ? 'true' : 'false');
    }
    var wrap = doc.querySelector('.onetap-lang');
    if (wrap) wrap.setAttribute('aria-label', state.lang === 'ko' ? '언어' : 'Language');
  }

  /* ---------- observe ---------- */
  function startObserver() {
    if (observer || !root.MutationObserver) return;
    observer = new MutationObserver(function (muts) {
      if (state.lang !== 'en') return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'characterData') { trText(m.target); continue; }
        if (m.type === 'attributes') { if (m.target.nodeType === 1 && !skipped(m.target)) trAttrs(m.target); continue; }
        for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title', 'alt'] });
  }

  function setLang(lang) {
    state.lang = lang === 'en' ? 'en' : 'ko';
    try { root.localStorage.setItem(LANG_KEY, state.lang); } catch (e) { /* private mode */ }
    if (state.lang === 'en') {
      applyEn();
      startObserver();
    } else {
      if (observer) { observer.disconnect(); observer = null; }
      restoreKo();
    }
    paintSwitch();
    try { doc.dispatchEvent(new CustomEvent('onetap:lang', { detail: { lang: state.lang } })); } catch (e) { /* old */ }
  }

  function boot() {
    injectCss();
    buildSwitch();
    state.lang = detect();
    if (state.lang === 'en') {
      applyEn();
      startObserver();
    } else {
      doc.documentElement.lang = 'ko';
    }
    paintSwitch();
    root.ONETAP_I18N = {
      lang: function () { return state.lang; },
      setLang: setLang,
      t: tr,
      missing: function () { return missingList.slice(); },
      dict: DICT
    };
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window, document);
