# HWPX → HWP 변환기

한글 2014 이후가 쓰는 **HWPX(OWPML)** 문서를 **HWP 5.0** 파일로 바꾸는 브라우저 도구입니다.
문단·글자 서식·표·그림을 살려 여러 개를 한 번에 변환하고 ZIP으로 내려받습니다.
파일은 어디에도 업로드되지 않고, 변환은 방문자의 브라우저 안에서만 이뤄집니다.

- 라이브: <https://marcj81.github.io/onetap-hwpx-converter/>
- 개인정보 처리 안내: <https://marcj81.github.io/onetap-hwpx-converter/privacy.html>

## 무엇을 하나

- `.hwpx` 드래그&드롭·파일 선택 → `.hwp` 변환, 개별 다운로드 또는 ZIP 일괄 다운로드
- 변환 전 **문서 진단**(문단·표·그림 수, 옮기지 못하는 요소 안내)
- 변환 텍스트·표 **미리보기**
- 만들어진 `.hwp`에서 **글자 추출**(HWP → 텍스트)
- 1클릭 **샘플 문서** 체험

## 구성

```
index.html            화면
privacy.html          개인정보 처리 안내
assets/styles.css     스타일 (라이트/다크, 모바일 우선)
assets/app.js         화면 로직 (목록·변환·다운로드·미리보기·진단)
assets/lib/zip.js     ZIP 읽기/쓰기 (HWPX 패키지, ZIP 다운로드)
assets/lib/deflate.js raw DEFLATE 압축/해제 (브라우저 CompressionStream)
assets/lib/xml.js     XML 도우미 (DOMParser, 네임스페이스 무시)
assets/lib/owpml.js   HWPX 파서 — header.xml·section*.xml → 중간 표현(IR)
assets/lib/convert.js 변환 파이프라인 (진단·미리보기 포함)
assets/lib/hwp5/…     HWP 5.0 쓰기·읽기 (레코드·CFB·DocInfo·BodyText)
sample/sample.hwpx    샘플 문서 (표·서식 포함)
```

빌드 도구가 필요 없습니다. 정적 서버로 저장소 루트를 열면 그대로 동작합니다
(`file://`에서는 ES 모듈 로딩이 막히므로 로컬 서버가 필요합니다).

```bash
python3 -m http.server 8080
# http://localhost:8080/
```

## 변환 방식

1. **읽기** — HWPX(ZIP)의 `Contents/header.xml`에서 글꼴·글자 모양·문단 모양·테두리/배경·
   스타일·번호/글머리표를 읽고, `Contents/section*.xml`에서 문단·런·표·그림·각주를 읽어
   중간 표현을 만듭니다.
2. **쓰기** — HWP 5.0의 `DocInfo`(문서 전역 서식 표)와 `BodyText/SectionN`(문단 스트림)을
   레코드 단위로 만들고 CFB 컨테이너에 담습니다. 스트림은 raw DEFLATE로 압축합니다.

HWPX와 HWP는 텍스트 → 글자 모양 id → 표처럼 서식을 참조하는 방식이 같아 정의를 같은 순서로
옮기면 서식이 거의 그대로 살아납니다. 다만 포맷 세부가 다른 지점이 여럿 있어 개별 처리했습니다.

- **테두리/배경 레코드 순서**: 네 변을 `[선종류 4][굵기 4][색 4]`로 묶으면 격자가 깨집니다.
  변마다 `(종류, 굵기, 색)` 6바이트를 연달아 씁니다.
- **밑줄/취소선 비트**: 취소선은 종류(비트 18–20)와 선 모양(비트 26–29)을 함께 씁니다.
- **그림 BinData 종류**: 내장 그림은 1(EMBEDDING)로 쓰고 스트림 이름 끝에 확장자를 붙입니다.
  2(STORAGE)는 종류·확장자 없는 저장소 참조라 한글이 그림을 찾지 못합니다.
- **셀 문단 레벨**: 표 셀 문단은 `LIST_HEADER`와 같은 레벨에 둡니다.
- **개체 공통 속성**: `z_order`는 2바이트이며 뒤에 예약 필드가 붙습니다.
- **세로 기준**: HWPX의 COLUMN은 HWP의 PAPER/PAGE/PARAGRAPH 중 문단으로 접습니다.
- **파일 버전**: `FileHeader` 버전은 `5.0.3.0`. 5.1.x로 적으면 한글 2010/2014가
  "상위 버전에서 작성한 문서입니다" 경고를 띄웁니다. 레코드 크기(PARA_SHAPE 54바이트 등)도
  5.0.3.0 기준에 맞춥니다.
- **구역 정의**: 첫 문단 글자 흐름에 `secd`·`cold` 제어 문자를 id까지 넣고,
  `CTRL_HEADER` 아래 `PAGE_DEF` 1개·`FOOTNOTE_SHAPE` 2개·`PAGE_BORDER_FILL` 3개를 차례로 둡니다.
  id가 빈 제어 문자나 빠진 자식 레코드는 한글이 "파일이 손상되었습니다"로 읽습니다.
- **스트림 압축**: zlib 헤더 없는 raw DEFLATE를 씁니다. 지원하지 않는 브라우저에서는
  무압축으로 저장합니다.

## 알려진 한계

- 차트·수식·OLE·글맵시·3D 도형은 HWP 5.0 대응 형식이 없어 옮기지 않습니다(자리만 남음).
- 암호가 걸린 HWPX는 지원하지 않습니다.
- 쪽 나눔·줄 배치는 한글이 다시 계산하므로 원본과 완전히 같지는 않습니다.
- 아주 큰 문서(수십 MB)는 브라우저 메모리 한계로 느려질 수 있습니다.

## 라이선스

참고한 오픈소스와 규격 문서는 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)에 적었습니다.
한글(HWP)은 한글과컴퓨터의 상표이며, 이 도구는 독립적으로 만든 것이고 한글과컴퓨터와
제휴 관계가 없습니다.
