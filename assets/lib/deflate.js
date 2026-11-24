/**
 * 스트림 압축/해제.
 *
 * HWP의 압축 플래그가 켜져 있으면 레코드 스트림은 **raw DEFLATE**(RFC 1951)다.
 * zlib 헤더도 Adler-32 꼬리도 없다. 브라우저 기본 API를 쓰고, 지원하지 않는
 * 환경에서는 호출하는 쪽이 무압축(STORE / 압축 플래그 0)으로 물러난다.
 */

const hasCompression = typeof CompressionStream !== 'undefined';
const hasDecompression = typeof DecompressionStream !== 'undefined';

async function through(stream, bytes) {
  const writer = stream.writable.getWriter();
  const reader = stream.readable.getReader();
  const pump = (async () => {
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    let total = 0;
    for (const chunk of chunks) total += chunk.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      out.set(chunk, offset);
      offset += chunk.length;
    }
    return out;
  })();
  await writer.write(bytes);
  await writer.close();
  return pump;
}

/** raw DEFLATE 압축. */
export async function deflateRaw(bytes) {
  if (!hasCompression) return null;
  try {
    return await through(new CompressionStream('deflate-raw'), bytes);
  } catch {
    return null;
  }
}

/** raw DEFLATE 해제. 실패하면 예외를 던진다. */
export async function inflateRaw(bytes) {
  if (!hasDecompression) throw new Error('이 브라우저는 압축 해제를 지원하지 않습니다.');
  return through(new DecompressionStream('deflate-raw'), bytes);
}

export const supportsDeflate = hasCompression;
export const supportsInflate = hasDecompression;
