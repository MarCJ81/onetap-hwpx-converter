# Third-party notices — HWPX → HWP 변환기

이 앱은 외부 런타임 라이브러리를 포함하지 않습니다. ZIP·DEFLATE는 브라우저 기본 API를,
XML은 `DOMParser`를 씁니다. 아래는 포맷을 이해하고 자체 구현하는 데 참고한 오픈소스와
규격 문서입니다. 코드를 복사해 넣지는 않았지만, 구조와 필드 배치를 대조했으므로 출처를
밝힙니다.

## 참고한 오픈소스

| 프로젝트 | 라이선스 | 참고한 부분 |
|---|---|---|
| [juyeongnoh/js-hwp](https://github.com/juyeongnoh/js-hwp) | MIT | HWP 5.0 레코드 구조, CFB 라이터 구조, HWPX↔모델 매핑 |
| [ssabro/hwpxjs](https://github.com/ssabro/hwpxjs) | MIT | HWP 5.0 파싱 구조(MIT, rhwp 포팅), HWPX 패키지 규칙 |
| [ohah/hwpjs](https://github.com/ohah/hwpjs) | MIT | 공개 HWP/HWPX 처리 방식 조사 |
| [pyhwp](https://github.com/mete0r/pyhwp) | AGPL-3.0 | (검증용) 레코드 필드 정의 대조, 생성 파일 판독 |

`pyhwp`는 검증 도구로만 사용했고 앱에는 포함되지 않습니다.

## 규격 문서

- 한글과컴퓨터, 『한글 문서 파일 형식 5.0』 공개 문서 — 레코드 태그·필드 배치
- 한글과컴퓨터, HWPX(OWPML, KS X 6101) 공개 규격 — 패키지 구성·XML 스키마
- Microsoft, [MS-CFB] Compound File Binary File Format — CFB 컨테이너
- RFC 1951 — DEFLATE 압축 스트림

## 라이선스 전문 (MIT)

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

한글(HWP)은 한글과컴퓨터의 상표입니다. 이 도구는 독립적으로 만든 것이며
한글과컴퓨터와 제휴 관계가 없습니다.
