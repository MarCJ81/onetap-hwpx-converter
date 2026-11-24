/**
 * HWPX → HWP 변환기 화면.
 *
 * 모든 변환은 이 페이지 안에서 돈다. 파일은 fetch로도, XHR로도 나가지 않는다.
 */
import { convertHwpx } from './lib/convert.js';
import { extractHwpText } from './lib/hwp5/reader.js';
import { writeZip } from './lib/zip.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const els = {
  dropzone: $('#dropzone'),
  fileInput: $('#file-input'),
  pickBtn: $('#pick-btn'),
  sampleBtn: $('#sample-btn'),
  sampleNote: $('#sample-note'),
  queuePanel: $('#queue-panel'),
  queueCount: $('#queue-count'),
  fileList: $('#file-list'),
  convertBtn: $('#convert-btn'),
  clearBtn: $('#clear-btn'),
  queueFoot: $('#queue-foot'),
  zipBtn: $('#zip-btn'),
  zipNote: $('#zip-note'),
  resultPanel: $('#result-panel'),
  resultList: $('#result-list'),
  resetBtn: $('#reset-btn'),
  inspectPanel: $('#inspect-panel'),
  fileSwitch: $('#file-switch'),
  previewBody: $('#preview-body'),
  reportBody: $('#report-body'),
  toast: $('#toast'),
  hwpInput: $('#hwp-input'),
  hwpText: $('#hwp-text'),
  copyHwp: $('#copy-hwp'),
  saveHwp: $('#save-hwp'),
  viewerHint: $('#viewer-hint'),
};

const state = {
  files: [],
  selected: null,
  busy: false,
  hwpFileName: '',
  hwpText: '',
};

let toastTimer = 0;

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3200);
}

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function baseName(name) {
  return String(name ?? '').replace(/\.[^.]+$/, '');
}

function addFiles(fileList) {
  const incoming = [...fileList];
  if (!incoming.length) return;
  let skipped = 0;
  for (const file of incoming) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.hwpx')) {
      skipped += 1;
      continue;
    }
    if (state.files.some((entry) => entry.file.name === file.name && entry.file.size === file.size)) {
      continue;
    }
    state.files.push({
      id: `f${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      file,
      name: file.name,
      size: file.size,
      status: 'ready',
      progress: 0,
      result: null,
      error: null,
    });
  }
  if (skipped) toast('.hwpx 파일만 변환할 수 있습니다.');
  render();
}

function statusLabel(status) {
  switch (status) {
    case 'ready':
      return '대기';
    case 'working':
      return '변환 중';
    case 'done':
      return '완료';
    case 'error':
      return '오류';
    default:
      return '';
  }
}

function statusClass(status) {
  return `status status--${status}`;
}

function renderQueue() {
  const files = state.files;
  els.queuePanel.hidden = files.length === 0;
  els.queueCount.textContent = String(files.length);

  els.fileList.innerHTML = files
    .map((entry) => {
      const barClass =
        entry.status === 'done' ? 'is-done' : entry.status === 'error' ? 'is-error' : '';
      const actions =
        entry.status === 'done'
          ? `<button class="btn btn--sm" data-download="${entry.id}" type="button">내려받기</button>`
          : '';
      return `
        <li class="file-row" data-id="${entry.id}">
          <div>
            <div class="file-row__name" title="${escapeHtml(entry.name)}">${escapeHtml(entry.name)}</div>
            <div class="file-row__meta">
              <span>${formatSize(entry.size)}</span>
              ${entry.result ? `<span>→ ${formatSize(entry.result.size)}</span>` : ''}
              ${entry.error ? `<span>${escapeHtml(entry.error)}</span>` : ''}
            </div>
          </div>
          <div class="file-row__actions">
            <span class="${statusClass(entry.status)}">${statusLabel(entry.status)}</span>
            ${actions}
            <button class="btn btn--sm btn--ghost" data-remove="${entry.id}" type="button" aria-label="${escapeHtml(entry.name)} 목록에서 빼기">✕</button>
          </div>
          <div class="file-row__bar ${barClass}"><span style="width:${entry.status === 'working' ? Math.max(8, entry.progress) : entry.status === 'done' ? 100 : 0}%"></span></div>
        </li>`;
    })
    .join('');

  const done = files.filter((entry) => entry.status === 'done');
  els.queueFoot.hidden = done.length === 0;
  els.zipNote.textContent = done.length ? `${done.length}개를 ZIP 하나로 묶어 받습니다.` : '';
  els.convertBtn.disabled = state.busy || files.every((entry) => entry.status === 'done');
}

function renderResults() {
  const done = state.files.filter((entry) => entry.status === 'done');
  els.resultPanel.hidden = done.length === 0;
  els.resultList.innerHTML = done
    .map((entry) => {
      const report = entry.result.report;
      return `
        <li class="result-row">
          <div>
            <div class="result-row__title">${escapeHtml(entry.result.fileName)}</div>
            <div class="result-row__summary">
              ${formatSize(entry.result.size)} · 문단 ${report.paragraphs} · 표 ${report.tables} · 그림 ${report.images}
              ${report.notes ? ` · 각주 ${report.notes}` : ''}
            </div>
          </div>
          <button class="btn btn--sm btn--primary" data-download="${entry.id}" type="button">내려받기</button>
        </li>`;
    })
    .join('');
}

function renderInspect() {
  const done = state.files.filter((entry) => entry.status === 'done');
  els.inspectPanel.hidden = done.length === 0;
  if (!done.length) return;

  if (!done.some((entry) => entry.id === state.selected)) {
    state.selected = done[0].id;
  }

  els.fileSwitch.innerHTML = done
    .map(
      (entry) =>
        `<button class="chip ${entry.id === state.selected ? 'is-active' : ''}" role="tab"
           aria-selected="${entry.id === state.selected}" data-select="${entry.id}" type="button"
           title="${escapeHtml(entry.result.fileName)}">${escapeHtml(entry.result.fileName)}</button>`,
    )
    .join('');

  const current = done.find((entry) => entry.id === state.selected);
  if (!current) return;
  renderPreview(current);
  renderReport(current);
}

function renderPreview(entry) {
  const { preview, report } = entry.result;
  if (!preview.paragraphs.length && !preview.tables.length) {
    els.previewBody.innerHTML = '<p class="empty">본문이 비어 있는 문서입니다.</p>';
    return;
  }
  const parts = [];
  for (const line of preview.paragraphs.slice(0, 40)) {
    parts.push(`<p>${escapeHtml(line)}</p>`);
  }
  for (const table of preview.tables.slice(0, 2)) {
    const rows = table
      .map(
        (row) =>
          `<tr>${row.map((cell) => `<td>${escapeHtml(cell || ' ')}</td>`).join('')}</tr>`,
      )
      .join('');
    parts.push(`<table class="table-grid">${rows}</table>`);
  }
  if (report.paragraphs > 40) {
    parts.push(`<p class="empty">… 문단 ${report.paragraphs}개 중 앞부분만 보여 줍니다.</p>`);
  }
  els.previewBody.innerHTML = parts.join('');
}

function reportNotes(report) {
  const notes = [];
  if (report.charts) notes.push(`차트 ${report.charts}개는 옮기지 못했습니다. 자리만 남습니다.`);
  if (report.equations) notes.push(`수식 ${report.equations}개는 글자로 옮기지 못했습니다.`);
  if (report.shapes) notes.push(`도형·OLE·글맵시 ${report.shapes}개는 옮기지 못했습니다.`);
  if (report.memos) notes.push(`메모 ${report.memos}개는 옮기지 못했습니다.`);
  if (report.hiddenComments) notes.push(`숨은 설명 ${report.hiddenComments}개는 옮기지 못했습니다.`);
  if (report.fields) notes.push(`누름틀·필드 ${report.fields}개는 값만 일반 글자로 남았습니다.`);
  if (report.notes) notes.push(`각주·미주 ${report.notes}개를 옮겼습니다. 번호는 뷰어에 따라 0으로 보일 수 있습니다.`);
  if (report.encrypted) notes.push('암호화된 항목이 있어 일부 내용을 읽지 못했습니다.');
  if (report.missing?.length) notes.push(`원본에 ${report.missing.join(', ')} 정의가 없어 기본값으로 채웠습니다.`);
  return notes;
}

function renderReport(entry) {
  const report = entry.result.report;
  const stats = [
    ['문단', report.paragraphs],
    ['표', report.tables],
    ['셀', report.cells],
    ['그림', report.images],
    ['각주', report.notes],
    ['필드', report.fields],
    ['글자 모양', report.charShapes],
    ['문단 모양', report.paraShapes],
    ['스타일', report.styles],
    ['테두리', report.borderFills],
    ['구역', report.sections],
    ['원본 용량', formatSize(entry.size)],
    ['변환 용량', formatSize(entry.result.size)],
    ['걸린 시간', `${entry.result.elapsed}ms`],
  ];
  const notes = reportNotes(report);
  els.reportBody.innerHTML = `
    <dl class="stat-grid">
      ${stats
        .map(([label, value]) => `<div class="stat"><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
        .join('')}
    </dl>
    ${
      notes.length
        ? `<ul class="note-list">${notes.map((note) => `<li>${escapeHtml(note)}</li>`).join('')}</ul>`
        : '<p class="muted">옮기지 못한 요소가 없습니다.</p>'
    }`;
}

function render() {
  renderQueue();
  renderResults();
  renderInspect();
}

async function convertAll() {
  if (state.busy) return;
  const targets = state.files.filter((entry) => entry.status === 'ready' || entry.status === 'error');
  if (!targets.length) {
    toast('변환할 파일이 없습니다.');
    return;
  }
  state.busy = true;
  els.convertBtn.disabled = true;
  els.convertBtn.textContent = '변환 중…';

  for (const entry of targets) {
    entry.status = 'working';
    entry.progress = 10;
    entry.error = null;
    renderQueue();
    try {
      const result = await convertHwpx(await entry.file.arrayBuffer(), { fileName: entry.name });
      entry.result = result;
      entry.status = 'done';
      entry.progress = 100;
    } catch (error) {
      entry.status = 'error';
      entry.error = error?.message ?? String(error);
      entry.progress = 100;
    }
    renderQueue();
    renderResults();
    renderInspect();
    // 화면이 갱신될 틈을 준다.
    await new Promise((resolve) => setTimeout(resolve, 16));
  }

  state.busy = false;
  els.convertBtn.textContent = '변환하기';
  renderQueue();
  const failed = targets.filter((entry) => entry.status === 'error');
  toast(failed.length ? `${failed.length}개는 변환하지 못했습니다.` : '변환을 마쳤습니다.');
}

function download(entry) {
  if (!entry?.result) return;
  const blob = new Blob([entry.result.bytes], { type: 'application/x-hwp' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = entry.result.fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadZip() {
  const done = state.files.filter((entry) => entry.status === 'done');
  if (!done.length) return;
  els.zipBtn.disabled = true;
  els.zipBtn.textContent = '묶는 중…';
  try {
    const files = done.map((entry) => ({ name: entry.result.fileName, data: entry.result.bytes }));
    const zip = await writeZip(files);
    const blob = new Blob([zip], { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `hwpx-to-hwp-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (error) {
    toast('ZIP을 만들지 못했습니다.');
  } finally {
    els.zipBtn.disabled = false;
    els.zipBtn.textContent = '모두 ZIP으로 내려받기';
  }
}

async function loadSample() {
  if (state.busy) return;
  els.sampleBtn.disabled = true;
  els.sampleBtn.textContent = '샘플 불러오는 중…';
  try {
    const response = await fetch('sample/sample.hwpx');
    if (!response.ok) throw new Error('no sample');
    const blob = await response.blob();
    const file = new File([blob], '원탭-변환-샘플.hwpx', { type: 'application/octet-stream' });
    addFiles([file]);
    els.sampleNote.textContent = '샘플을 목록에 넣었습니다. 변환하기를 눌러 보세요.';
    $('.file-row', els.fileList)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch {
    toast('샘플을 불러오지 못했습니다.');
  } finally {
    els.sampleBtn.disabled = false;
    els.sampleBtn.textContent = '샘플 HWPX로 체험하기';
  }
}

function clearAll() {
  if (state.busy) return;
  state.files = [];
  state.selected = null;
  render();
}

/* ------------------------------------------------------------- 이벤트 */

els.dropzone.addEventListener('click', () => els.fileInput.click());
els.dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    els.fileInput.click();
  }
});
els.pickBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  els.fileInput.click();
});
els.fileInput.addEventListener('change', () => {
  addFiles(els.fileInput.files);
  els.fileInput.value = '';
});

for (const type of ['dragenter', 'dragover']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.add('is-dragging');
  });
}
for (const type of ['dragleave', 'drop']) {
  els.dropzone.addEventListener(type, (event) => {
    event.preventDefault();
    els.dropzone.classList.remove('is-dragging');
  });
}
els.dropzone.addEventListener('drop', (event) => {
  if (event.dataTransfer?.files) addFiles(event.dataTransfer.files);
});
window.addEventListener('dragover', (event) => event.preventDefault());
window.addEventListener('drop', (event) => event.preventDefault());

els.fileList.addEventListener('click', (event) => {
  const removeId = event.target.closest('[data-remove]')?.dataset.remove;
  if (removeId) {
    if (state.busy) return;
    state.files = state.files.filter((entry) => entry.id !== removeId);
    render();
    return;
  }
  const downloadId = event.target.closest('[data-download]')?.dataset.download;
  if (downloadId) {
    download(state.files.find((entry) => entry.id === downloadId));
  }
});

els.resultList.addEventListener('click', (event) => {
  const id = event.target.closest('[data-download]')?.dataset.download;
  if (id) download(state.files.find((entry) => entry.id === id));
});

els.fileSwitch.addEventListener('click', (event) => {
  const id = event.target.closest('[data-select]')?.dataset.select;
  if (!id) return;
  state.selected = id;
  renderInspect();
});

els.hwpInput.addEventListener('change', async () => {
  const file = els.hwpInput.files?.[0];
  if (!file) return;
  els.hwpText.textContent = '읽는 중…';
  els.copyHwp.disabled = true;
  els.saveHwp.disabled = true;
  try {
    const result = await extractHwpText(new Uint8Array(await file.arrayBuffer()));
    state.hwpFileName = file.name;
    state.hwpText = result.text;
    els.hwpText.textContent = result.text.trim() || '(글자가 없는 문서입니다.)';
    els.viewerHint.textContent = `${file.name} · 구역 ${result.sections}개 · 문단 ${result.paragraphs.length}개`;
    els.copyHwp.disabled = !result.text.trim();
    els.saveHwp.disabled = !result.text.trim();
  } catch (error) {
    state.hwpText = '';
    els.hwpText.textContent = `열지 못했습니다: ${error?.message ?? error}`;
    els.viewerHint.textContent = 'HWP 파일이 맞는지, 암호가 걸려 있지 않은지 확인해 주세요.';
  } finally {
    els.hwpInput.value = '';
  }
});

els.copyHwp.addEventListener('click', async () => {
  if (!state.hwpText) return;
  try {
    await navigator.clipboard.writeText(state.hwpText);
    toast('글자를 복사했습니다.');
  } catch {
    toast('이 브라우저에서는 복사가 막혀 있습니다.');
  }
});

els.saveHwp.addEventListener('click', () => {
  if (!state.hwpText) return;
  const name = (state.hwpFileName || 'document').replace(/\.hwp$/i, '') + '.txt';
  const blob = new Blob([state.hwpText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
});

els.convertBtn.addEventListener('click', convertAll);
els.clearBtn.addEventListener('click', clearAll);
els.zipBtn.addEventListener('click', downloadZip);
els.sampleBtn.addEventListener('click', loadSample);
els.resetBtn.addEventListener('click', clearAll);

$$('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach((other) => {
      other.classList.toggle('is-active', other === tab);
      other.setAttribute('aria-selected', String(other === tab));
    });
    $$('.tab-panel').forEach((panel) => {
      panel.classList.toggle('is-active', panel.id === `panel-${tab.dataset.tab}`);
    });
  });
});

if (!('DecompressionStream' in window) || !('DOMParser' in window)) {
  const note = document.createElement('p');
  note.className = 'alert alert--danger';
  note.textContent = '이 브라우저는 필요한 기능을 지원하지 않습니다. 최신 Chrome·Edge·Safari에서 열어 주세요.';
  els.dropzone.after(note);
}

render();
