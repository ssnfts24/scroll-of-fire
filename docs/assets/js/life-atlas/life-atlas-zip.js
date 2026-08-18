/**
 * Codex Life Atlas — browser-side ZIP reader.
 * Reads the ZIP central directory with Blob slices so large archives are not
 * loaded into memory all at once. Only selected text/data entries are inflated.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.CodexLifeAtlasZip = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;
  const LOC_SIG = 0x04034b50;
  const MAX_TAIL_BYTES = 66 * 1024;
  const MAX_ENTRIES = 12000;
  const MAX_ENTRY_BYTES = 24 * 1024 * 1024;
  const MAX_TOTAL_TEXT_BYTES = 96 * 1024 * 1024;
  const TEXT_EXTENSIONS = new Set(["ics", "json", "js", "csv", "txt", "geojson"]);

  const u16 = (view, offset) => view.getUint16(offset, true);
  const u32 = (view, offset) => view.getUint32(offset, true);
  const decoder = new TextDecoder("utf-8", { fatal: false });

  function extension(name = "") {
    const clean = String(name).split(/[?#]/)[0].toLowerCase();
    const idx = clean.lastIndexOf(".");
    return idx >= 0 ? clean.slice(idx + 1) : "";
  }

  function isCandidateEntry(name = "") {
    if (!name || name.endsWith("/")) return false;
    const ext = extension(name);
    if (TEXT_EXTENSIONS.has(ext)) return true;
    const lower = name.toLowerCase();
    return /(^|\/)(location|timeline|posts?|tweets?|instagram|facebook|tiktok|calendar|events?|places?|media|messages?)(\/|\.|_|-)/.test(lower);
  }

  async function sliceBytes(blob, start, end) {
    return new Uint8Array(await blob.slice(start, end).arrayBuffer());
  }

  async function isZipBlob(blob) {
    if (!blob || blob.size < 4) return false;
    const bytes = await sliceBytes(blob, 0, 4);
    return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) && (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08);
  }

  async function listEntries(blob) {
    if (!await isZipBlob(blob)) throw new Error("File is not a ZIP archive.");
    const tailStart = Math.max(0, blob.size - MAX_TAIL_BYTES);
    const tail = await sliceBytes(blob, tailStart, blob.size);
    const tailView = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
    let eocd = -1;
    for (let i = tail.byteLength - 22; i >= 0; i -= 1) {
      if (u32(tailView, i) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("ZIP directory could not be located. ZIP64 archives are not supported yet.");

    const entryCount = u16(tailView, eocd + 10);
    const centralSize = u32(tailView, eocd + 12);
    const centralOffset = u32(tailView, eocd + 16);
    if (entryCount === 0xffff || centralOffset === 0xffffffff || centralSize === 0xffffffff) {
      throw new Error("ZIP64 archive detected. Extract it first or export a smaller archive.");
    }
    if (entryCount > MAX_ENTRIES) throw new Error(`Archive has ${entryCount} entries; mobile safety limit is ${MAX_ENTRIES}.`);
    if (centralOffset + centralSize > blob.size) throw new Error("ZIP directory is truncated.");

    const central = await sliceBytes(blob, centralOffset, centralOffset + centralSize);
    const view = new DataView(central.buffer, central.byteOffset, central.byteLength);
    const entries = [];
    let offset = 0;
    while (offset + 46 <= central.byteLength && entries.length < entryCount) {
      if (u32(view, offset) !== CEN_SIG) break;
      const flags = u16(view, offset + 8);
      const method = u16(view, offset + 10);
      const compressedSize = u32(view, offset + 20);
      const uncompressedSize = u32(view, offset + 24);
      const nameLen = u16(view, offset + 28);
      const extraLen = u16(view, offset + 30);
      const commentLen = u16(view, offset + 32);
      const localOffset = u32(view, offset + 42);
      const nameBytes = central.subarray(offset + 46, offset + 46 + nameLen);
      const name = decoder.decode(nameBytes);
      entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset, candidate: isCandidateEntry(name) });
      offset += 46 + nameLen + extraLen + commentLen;
    }
    return entries;
  }

  async function inflateRaw(bytes) {
    if (typeof DecompressionStream !== "function") throw new Error("This browser cannot inflate ZIP entries locally. Update Chrome or extract this ZIP first.");
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readEntryBytes(blob, entry) {
    if (!entry) throw new Error("ZIP entry is required.");
    if (entry.uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`Entry ${entry.name} exceeds the ${Math.round(MAX_ENTRY_BYTES / 1048576)} MB text safety limit.`);
    if (![0, 8].includes(entry.method)) throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}.`);
    const header = await sliceBytes(blob, entry.localOffset, entry.localOffset + 30);
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
    if (u32(view, 0) !== LOC_SIG) throw new Error(`Invalid ZIP local header for ${entry.name}.`);
    const nameLen = u16(view, 26);
    const extraLen = u16(view, 28);
    const start = entry.localOffset + 30 + nameLen + extraLen;
    const compressed = await sliceBytes(blob, start, start + entry.compressedSize);
    if (entry.method === 0) return compressed;
    return inflateRaw(compressed);
  }

  async function readEntryText(blob, entry) {
    return decoder.decode(await readEntryBytes(blob, entry));
  }

  async function extractCandidateTexts(blob, { maxTotalBytes = MAX_TOTAL_TEXT_BYTES } = {}) {
    const entries = await listEntries(blob);
    const candidates = entries.filter(e => e.candidate && !e.name.endsWith("/"));
    const files = [];
    let total = 0;
    let skippedLarge = 0;
    let skippedUnsupported = 0;
    for (const entry of candidates) {
      if (entry.uncompressedSize > MAX_ENTRY_BYTES || total + entry.uncompressedSize > maxTotalBytes) { skippedLarge += 1; continue; }
      if (![0, 8].includes(entry.method)) { skippedUnsupported += 1; continue; }
      const text = await readEntryText(blob, entry);
      total += entry.uncompressedSize || text.length;
      files.push({ name: entry.name, text, size: entry.uncompressedSize, archiveEntry: true });
    }
    return { entries, files, candidateEntries: candidates.length, skippedLarge, skippedUnsupported, totalTextBytes: total };
  }

  return Object.freeze({ VERSION, MAX_ENTRIES, MAX_ENTRY_BYTES, MAX_TOTAL_TEXT_BYTES, isZipBlob, listEntries, readEntryText, extractCandidateTexts, isCandidateEntry });
});
