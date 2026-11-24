/**
 * XML 유틸리티 — DOMParser 기반.
 *
 * HWPX(OWPML)는 네임스페이스가 붙은 XML이다. 접두사(`hp:`, `hh:`, `hc:`)는
 * 파일마다 달라질 수 있으므로 접두사가 아니라 로컬 이름으로 찾는다.
 */

export class XmlError extends Error {
  constructor(message) {
    super(message);
    this.name = 'XmlError';
  }
}

export function parseXml(bytes, label = 'XML') {
  const text = new TextDecoder('utf-8').decode(bytes);
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const error = doc.getElementsByTagName('parsererror')[0];
  if (error) throw new XmlError(`${label}을(를) 해석할 수 없습니다.`);
  return doc;
}

/** 로컬 이름이 `name`인 직계 자식 요소들. */
export function children(element, name) {
  const out = [];
  if (!element) return out;
  for (const node of element.children) {
    if (node.localName === name) out.push(node);
  }
  return out;
}

/** 로컬 이름이 `name`인 첫 직계 자식. */
export function child(element, name) {
  if (!element) return undefined;
  for (const node of element.children) {
    if (node.localName === name) return node;
  }
  return undefined;
}

/** 문서 순서로 처음 만나는 하위 요소. */
export function firstDeep(element, name) {
  if (!element) return undefined;
  const found = element.getElementsByTagNameNS('*', name);
  return found.length ? found[0] : undefined;
}

/** 속성값. 없으면 undefined. */
export function attr(element, name) {
  if (!element) return undefined;
  return element.hasAttribute(name) ? element.getAttribute(name) : undefined;
}

export function numAttr(element, name, fallback = 0) {
  const value = attr(element, name);
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function boolAttr(element, name, fallback = false) {
  const value = attr(element, name);
  if (value === undefined) return fallback;
  return value === '1' || value === 'true' || value === 'TRUE';
}

/** 요소의 텍스트 내용(자식 요소 제외). */
export function textOf(element) {
  if (!element) return '';
  let out = '';
  for (const node of element.childNodes) {
    if (node.nodeType === 3) out += node.nodeValue;
  }
  return out;
}

export function allTextOf(element) {
  return element ? element.textContent ?? '' : '';
}
