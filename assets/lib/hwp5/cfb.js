/**
 * 복합 파일 바이너리(CFB / OLE2) 컨테이너 라이터.
 *
 * HWP 5.0 문서는 CFB 컨테이너이고, 그 안에 `FileHeader`, `DocInfo`,
 * `BodyText/Section0` 같은 스트림이 들어 있다. 스트림 경로(`'BodyText/Section0'`)를
 * 키로 받아 중간 저장소까지 자동으로 만든다.
 *
 * MS-CFB 규격을 따른 최소 구현: 섹터 512바이트(버전 3), 미니 스트림은 64바이트,
 * 디렉터리는 정렬된 이름 위에 균형 잡힌 레드-블랙 트리로 잇는다.
 */

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const FATSECT = 0xfffffffd;
const DIFSECT = 0xfffffffc;
const NOSTREAM = 0xffffffff;

const SIGNATURE = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const HEADER_SIZE = 512;
const DIRECTORY_ENTRY_SIZE = 128;
const HEADER_DIFAT_ENTRIES = 109;
const MINI_SECTOR_SIZE = 64;
const MINI_STREAM_CUTOFF = 4096;

const OBJECT_STORAGE = 1;
const OBJECT_STREAM = 2;
const OBJECT_ROOT = 5;
const COLOR_RED = 0;
const COLOR_BLACK = 1;

/** CFB 디렉터리 이름 비교: 길이 우선, 그다음 대문자 사전순. */
function compareNames(a, b) {
  if (a.length !== b.length) return a.length - b.length;
  const left = a.toUpperCase();
  const right = b.toUpperCase();
  return left < right ? -1 : left > right ? 1 : 0;
}

function makeNode(name, type) {
  return {
    name,
    type,
    content: new Uint8Array(0),
    children: [],
    id: -1,
    left: NOSTREAM,
    right: NOSTREAM,
    child: NOSTREAM,
    color: COLOR_BLACK,
    startSector: ENDOFCHAIN,
    size: 0,
  };
}

function buildTree(streams) {
  const root = makeNode('Root Entry', OBJECT_ROOT);
  const storages = new Map([['', root]]);

  const ensureStorage = (path) => {
    const existing = storages.get(path);
    if (existing) return existing;
    const slash = path.lastIndexOf('/');
    const parentPath = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    const parent = ensureStorage(parentPath);
    const node = makeNode(name, OBJECT_STORAGE);
    parent.children.push(node);
    storages.set(path, node);
    return node;
  };

  for (const path of Object.keys(streams)) {
    const slash = path.lastIndexOf('/');
    const parentPath = slash === -1 ? '' : path.slice(0, slash);
    const name = slash === -1 ? path : path.slice(slash + 1);
    if (!name) continue;
    const parent = ensureStorage(parentPath);
    const node = makeNode(name, OBJECT_STREAM);
    node.content = streams[path];
    parent.children.push(node);
  }
  return root;
}

function collect(node, out) {
  node.id = out.length;
  out.push(node);
  node.children.sort((a, b) => compareNames(a.name, b.name));
  for (const child of node.children) collect(child, out);
}

/** 정렬된 형제 목록 위에 균형 트리를 만들고 루트 id를 돌려준다. */
function linkTree(root) {
  const link = (node) => {
    if (node.children.length > 0) node.child = buildBalanced(node.children);
    for (const child of node.children) link(child);
  };
  link(root);
}

function buildBalanced(sorted) {
  let maxDepth = 0;
  const build = (lo, hi, depth) => {
    if (lo > hi) return NOSTREAM;
    const mid = (lo + hi) >> 1;
    const node = sorted[mid];
    maxDepth = Math.max(maxDepth, depth);
    node.left = build(lo, mid - 1, depth + 1);
    node.right = build(mid + 1, hi, depth + 1);
    node.depth = depth;
    return node.id;
  };
  const rootId = build(0, sorted.length - 1, 0);
  for (const node of sorted) {
    node.color = node.depth === maxDepth && maxDepth > 0 ? COLOR_RED : COLOR_BLACK;
  }
  return rootId;
}

function concat(chunks) {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * 스트림 표를 CFB 바이트로 직렬화한다.
 * @param {Record<string, Uint8Array>} streams 스트림 경로 → 내용
 */
export function writeCfb(streams) {
  const sectorSize = 512;
  const fatEntriesPerSector = sectorSize / 4;
  const difatEntriesPerSector = fatEntriesPerSector - 1;

  const root = buildTree(streams);
  const nodes = [];
  collect(root, nodes);
  linkTree(root);

  const sectors = [];
  const fat = [];

  const allocate = (data) => {
    if (data.length === 0) return ENDOFCHAIN;
    const count = Math.ceil(data.length / sectorSize);
    const start = sectors.length;
    for (let i = 0; i < count; i++) {
      const chunk = new Uint8Array(sectorSize);
      chunk.set(data.subarray(i * sectorSize, Math.min((i + 1) * sectorSize, data.length)));
      sectors.push(chunk);
      fat.push(start + i + 1);
    }
    fat[start + count - 1] = ENDOFCHAIN;
    return start;
  };

  const miniChunks = [];
  const miniFat = [];
  let miniSectorCount = 0;

  for (const node of nodes) {
    if (node.type !== OBJECT_STREAM) {
      node.startSector = 0;
      node.size = 0;
      continue;
    }
    node.size = node.content.length;
    if (node.content.length === 0) {
      node.startSector = ENDOFCHAIN;
    } else if (node.content.length < MINI_STREAM_CUTOFF) {
      const count = Math.ceil(node.content.length / MINI_SECTOR_SIZE);
      node.startSector = miniSectorCount;
      for (let i = 0; i < count; i++) {
        const chunk = new Uint8Array(MINI_SECTOR_SIZE);
        chunk.set(
          node.content.subarray(
            i * MINI_SECTOR_SIZE,
            Math.min((i + 1) * MINI_SECTOR_SIZE, node.content.length),
          ),
        );
        miniChunks.push(chunk);
        miniFat.push(miniSectorCount + i + 1);
      }
      miniSectorCount += count;
      miniFat[miniSectorCount - 1] = ENDOFCHAIN;
    } else {
      node.startSector = allocate(node.content);
    }
  }

  const miniStream = concat(miniChunks);
  const miniStreamStart = allocate(miniStream);

  let miniFatStart = ENDOFCHAIN;
  let miniFatSectorCount = 0;
  if (miniFat.length > 0) {
    const padded = Math.ceil(miniFat.length / fatEntriesPerSector) * fatEntriesPerSector;
    const bytes = new Uint8Array(padded * 4);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < padded; i++) {
      view.setUint32(i * 4, i < miniFat.length ? miniFat[i] : FREESECT, true);
    }
    miniFatStart = allocate(bytes);
    miniFatSectorCount = bytes.length / sectorSize;
  }

  root.startSector = miniStreamStart;
  root.size = miniStream.length;

  const dirEntriesPerSector = sectorSize / DIRECTORY_ENTRY_SIZE;
  const dirEntryCount = Math.ceil(nodes.length / dirEntriesPerSector) * dirEntriesPerSector;
  const dirBytes = new Uint8Array(dirEntryCount * DIRECTORY_ENTRY_SIZE);
  const dirView = new DataView(dirBytes.buffer);

  for (let i = 0; i < dirEntryCount; i++) {
    const base = i * DIRECTORY_ENTRY_SIZE;
    const node = nodes[i];
    if (!node) {
      dirView.setUint32(base + 68, NOSTREAM, true);
      dirView.setUint32(base + 72, NOSTREAM, true);
      dirView.setUint32(base + 76, NOSTREAM, true);
      continue;
    }
    const nameLength = Math.min(node.name.length, 31);
    for (let k = 0; k < nameLength; k++) {
      dirView.setUint16(base + k * 2, node.name.charCodeAt(k), true);
    }
    dirView.setUint16(base + 64, (nameLength + 1) * 2, true);
    dirView.setUint8(base + 66, node.type);
    dirView.setUint8(base + 67, node.color);
    dirView.setUint32(base + 68, node.left, true);
    dirView.setUint32(base + 72, node.right, true);
    dirView.setUint32(base + 76, node.child, true);
    dirView.setUint32(base + 116, node.startSector, true);
    dirView.setUint32(base + 120, node.size, true);
    dirView.setUint32(base + 124, 0, true);
  }

  const dirStart = allocate(dirBytes);
  const dirSectorCount = dirBytes.length / sectorSize;

  let numFatSectors = 0;
  let numDifatSectors = 0;
  for (let guard = 0; guard < 64; guard++) {
    const total = sectors.length + numFatSectors + numDifatSectors;
    const nf = Math.max(1, Math.ceil(total / fatEntriesPerSector));
    const nd =
      nf <= HEADER_DIFAT_ENTRIES
        ? 0
        : Math.ceil((nf - HEADER_DIFAT_ENTRIES) / difatEntriesPerSector);
    if (nf === numFatSectors && nd === numDifatSectors) break;
    numFatSectors = nf;
    numDifatSectors = nd;
  }

  const fatSectorIds = [];
  for (let i = 0; i < numFatSectors; i++) {
    fatSectorIds.push(sectors.length);
    sectors.push(new Uint8Array(sectorSize));
    fat.push(FATSECT);
  }
  const difatSectorIds = [];
  for (let i = 0; i < numDifatSectors; i++) {
    difatSectorIds.push(sectors.length);
    sectors.push(new Uint8Array(sectorSize));
    fat.push(DIFSECT);
  }

  const fatCapacity = numFatSectors * fatEntriesPerSector;
  for (let i = 0; i < numFatSectors; i++) {
    const sector = sectors[fatSectorIds[i]];
    const view = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    for (let j = 0; j < fatEntriesPerSector; j++) {
      const index = i * fatEntriesPerSector + j;
      view.setUint32(j * 4, index < fat.length ? fat[index] : FREESECT, true);
    }
  }
  if (fat.length > fatCapacity) throw new Error('CFB FAT 크기 계산 실패');

  const headerDifat = fatSectorIds.slice(0, HEADER_DIFAT_ENTRIES);
  let remaining = fatSectorIds.slice(HEADER_DIFAT_ENTRIES);
  for (let i = 0; i < numDifatSectors; i++) {
    const sector = sectors[difatSectorIds[i]];
    const view = new DataView(sector.buffer, sector.byteOffset, sector.byteLength);
    for (let j = 0; j < difatEntriesPerSector; j++) {
      view.setUint32(j * 4, remaining[j] ?? FREESECT, true);
    }
    const next = difatSectorIds[i + 1];
    view.setUint32(difatEntriesPerSector * 4, next ?? ENDOFCHAIN, true);
    remaining = remaining.slice(difatEntriesPerSector);
  }

  const out = new Uint8Array(sectorSize + sectors.length * sectorSize);
  const header = new DataView(out.buffer, 0, HEADER_SIZE);
  out.set(SIGNATURE, 0);
  header.setUint16(24, 0x003e, true);
  header.setUint16(26, 3, true);
  header.setUint16(28, 0xfffe, true);
  header.setUint16(30, 9, true);
  header.setUint16(32, 6, true);
  header.setUint32(40, 0, true);
  header.setUint32(44, numFatSectors, true);
  header.setUint32(48, dirStart, true);
  header.setUint32(52, 0, true);
  header.setUint32(56, MINI_STREAM_CUTOFF, true);
  header.setUint32(60, miniFatStart, true);
  header.setUint32(64, miniFatSectorCount, true);
  header.setUint32(68, difatSectorIds[0] ?? ENDOFCHAIN, true);
  header.setUint32(72, numDifatSectors, true);
  for (let i = 0; i < HEADER_DIFAT_ENTRIES; i++) {
    header.setUint32(76 + i * 4, headerDifat[i] ?? FREESECT, true);
  }
  void dirSectorCount;

  for (let i = 0; i < sectors.length; i++) {
    out.set(sectors[i], (i + 1) * sectorSize);
  }
  return out;
}

