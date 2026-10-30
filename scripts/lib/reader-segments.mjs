const repository = "ssnfts24/scroll-of-fire";
export const MAX_RENDERED_SEGMENT_LENGTH = 4000;
const MAX_SEGMENT_LINES = 80;

function sourceUrl(sourceCommit, line) {
  return `https://github.com/${repository}/blob/${sourceCommit}/Full_Scroll_Unsealed#L${line}`;
}

function splitLongLine(text) {
  const slices = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_RENDERED_SEGMENT_LENGTH, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(" ", end);
      if (space > start + MAX_RENDERED_SEGMENT_LENGTH * 0.7) end = space + 1;
      if (end > start && /[\uD800-\uDBFF]/.test(text[end - 1])) end -= 1;
    }
    if (end <= start) end = Math.min(start + MAX_RENDERED_SEGMENT_LENGTH, text.length);
    slices.push({ startOffset: start, endOffset: end, text: text.slice(start, end) });
    start = end;
  }
  return slices;
}

function buildSegmentsForSection(section, startLine, endLine, lines, paragraphByLine, sourceCommit) {
  const segments = [];
  let pending = [];
  let pendingChars = 0;

  function flush(kind = "text") {
    if (!pending.length) return;
    const lineStart = pending[0].line;
    const lineEnd = pending.at(-1).line;
    const text = pending.reduce((result, slice, index) => {
      if (!index) return slice.text;
      return `${result}${slice.line === pending[index - 1].line ? "" : "\n"}${slice.text}`;
    }, "");
    const paragraphIds = [...new Set(pending.map(slice => slice.paragraphId).filter(Boolean))];
    segments.push({
      id: `segment-line-${String(lineStart).padStart(6, "0")}-${String(segments.length + 1).padStart(3, "0")}`,
      lineStart,
      lineEnd,
      sectionId: section.id,
      paragraphIds,
      sourceUrl: sourceUrl(sourceCommit, lineStart),
      kind,
      genesisChapter: section.genesisChapter,
      lineSlices: pending.map(slice => [slice.line, slice.startOffset, slice.endOffset, slice.paragraphId]),
      text
    });
    pending = [];
    pendingChars = 0;
  }

  function addLine(lineNumber, kind) {
    const text = lines[lineNumber - 1];
    const paragraphId = paragraphByLine[lineNumber - 1] ?? null;
    const slices = text.length > MAX_RENDERED_SEGMENT_LENGTH
      ? splitLongLine(text).map(slice => ({ ...slice, line: lineNumber, paragraphId }))
      : [{ line: lineNumber, startOffset: 0, endOffset: text.length, paragraphId, text }];

    if (slices.length > 1) flush();
    for (const slice of slices) {
      const separatorLength = pending.length && pending.at(-1).line !== lineNumber ? 1 : 0;
      if (pending.length && (pending.length >= MAX_SEGMENT_LINES ||
          pendingChars + separatorLength + slice.text.length > MAX_RENDERED_SEGMENT_LENGTH)) {
        flush();
      }
      pending.push(slice);
      pendingChars += (pending.length > 1 && pending.at(-2).line !== lineNumber ? 1 : 0) + slice.text.length;
      if (slices.length > 1) flush();
    }
    if (kind === "heading") flush("heading");
  }

  if (section.type !== "opening-matter" && startLine <= endLine) {
    addLine(startLine, "heading");
  }
  const bodyStart = section.type === "opening-matter" ? startLine : startLine + 1;
  for (let line = bodyStart; line <= endLine; line += 1) addLine(line, "text");
  flush();
  return segments;
}

function isGenesisCollectionEnd(section, lineText, lastGenesisLine) {
  if (section.line <= lastGenesisLine || section.type !== "uppercase-heading") return false;
  const title = lineText.trim();
  return Boolean(title) &&
    !/^(?:📜|🌿|🌟|🔥)/u.test(title) &&
    !/\p{Script=Hebrew}/u.test(title);
}

export function buildReaderSegments({ lines, sections, paragraphs, sourceCommit }) {
  const paragraphByLine = new Array(lines.length);
  for (const paragraph of paragraphs) {
    for (let line = paragraph.lineStart; line <= paragraph.lineEnd; line += 1) {
      paragraphByLine[line - 1] = paragraph.id;
    }
  }

  const sortedSections = sections.map(section => ({ ...section })).sort((left, right) => left.line - right.line);
  const lastGenesisLine = Math.max(0, ...sortedSections
    .filter(section => section.type === "genesis-chapter")
    .map(section => section.line));
  let activeGenesisChapter = null;
  for (const section of sortedSections) {
    const headingText = lines[section.line - 1] ?? "";
    if (section.type === "genesis-chapter") {
      activeGenesisChapter = section.label;
    } else if (activeGenesisChapter === 50 &&
        isGenesisCollectionEnd(section, headingText, lastGenesisLine)) {
      activeGenesisChapter = null;
    }
    section.genesisChapter = activeGenesisChapter;
  }

  if (sortedSections.length && sortedSections[0].line > 1 &&
      lines.slice(0, sortedSections[0].line - 1).some(line => line.trim())) {
    const startLine = 1;
    sortedSections.unshift({
      id: "section-opening-matter",
      type: "opening-matter",
      label: null,
      title: "Opening matter",
      normalizedTitle: "opening matter",
      line: startLine,
      sourceUrl: sourceUrl(sourceCommit, startLine),
      genesisChapter: null
    });
  }

  const ranges = sortedSections.map((section, index) => ({
    ...section,
    lineStart: section.type === "opening-matter" ? 1 : section.line,
    lineEnd: (sortedSections[index + 1]?.line ?? lines.length + 1) - 1
  }));
  const segments = ranges.flatMap(section =>
    buildSegmentsForSection(section, section.lineStart, section.lineEnd, lines, paragraphByLine, sourceCommit));

  const sectionsWithContent = ranges.map(section => {
    const sectionSegments = segments.filter(segment => segment.sectionId === section.id);
    const bodyStart = section.type === "opening-matter" ? section.lineStart : section.lineStart + 1;
    let bodyLineCount = 0;
    for (let line = bodyStart; line <= section.lineEnd; line += 1) {
      if (lines[line - 1].trim()) bodyLineCount += 1;
    }
    return {
      ...section,
      segmentIds: sectionSegments.map(segment => segment.id),
      paragraphIds: [...new Set(sectionSegments.flatMap(segment => segment.paragraphIds))],
      bodyLineCount,
      contentBearing: bodyLineCount > 0
    };
  });
  const enrichedById = new Map(sectionsWithContent.map(section => [section.id, section]));
  const chapterBody = new Map();
  for (const section of sectionsWithContent) {
    if (section.genesisChapter !== null && section.contentBearing) {
      chapterBody.set(section.genesisChapter, true);
    }
  }

  for (const [index, section] of sectionsWithContent.entries()) {
    if (section.contentBearing ||
        (section.type === "genesis-chapter" && chapterBody.get(section.label))) {
      section.readerTargetId = section.id;
      continue;
    }
    const sameChapter = section.genesisChapter;
    const nextContent = sectionsWithContent.slice(index + 1)
      .find(candidate => candidate.contentBearing && candidate.genesisChapter === sameChapter);
    const previousContent = sectionsWithContent.slice(0, index).reverse()
      .find(candidate => candidate.contentBearing && candidate.genesisChapter === sameChapter);
    const fallback = sameChapter === null
      ? sectionsWithContent.slice(index + 1).find(candidate => candidate.contentBearing) ??
        sectionsWithContent.slice(0, index).reverse().find(candidate => candidate.contentBearing)
      : enrichedById.get(sortedSections.find(candidate =>
        candidate.type === "genesis-chapter" && candidate.label === sameChapter)?.id);
    section.readerTargetId = nextContent?.id ?? previousContent?.id ?? fallback?.id ?? section.id;
  }

  const genesisOccurrences = sectionsWithContent.filter(section => section.type === "genesis-chapter");
  const genesisChapters = Array.from({ length: 50 }, (_, index) => {
    const chapter = index + 1;
    const occurrences = genesisOccurrences.filter(section => section.label === chapter);
    const chapterSegments = segments.filter(segment => segment.genesisChapter === chapter);
    return {
      chapter,
      sectionIds: occurrences.map(section => section.id),
      segmentCount: chapterSegments.length,
      lineStart: chapterSegments[0]?.lineStart ?? null,
      lineEnd: chapterSegments.at(-1)?.lineEnd ?? null
    };
  });
  const nonblankLineCount = lines.filter(line => line.trim()).length;
  const trueEmptyStructuralHeadings = sectionsWithContent.filter(section =>
    !section.contentBearing &&
    !(section.type === "genesis-chapter" && chapterBody.get(section.label))).length;

  return {
    sections: sectionsWithContent,
    segments,
    genesisChapters,
    coverage: {
      sectionCount: sectionsWithContent.length,
      contentBearingSections: sectionsWithContent.filter(section => section.contentBearing).length,
      sectionsWithoutDirectBody: sectionsWithContent.filter(section => !section.contentBearing).length,
      trueEmptyStructuralHeadings,
      chapterContextSections: sectionsWithContent.filter(section =>
        section.type === "genesis-chapter" && !section.contentBearing && chapterBody.get(section.label)).length,
      segmentCount: segments.length,
      sourceLineCount: lines.length,
      sourceNonblankLineCount: nonblankLineCount,
      maximumRenderedSegmentLength: Math.max(0, ...segments.map(segment => segment.text.length)),
      maximumSegmentLineCount: Math.max(0, ...segments.map(segment => segment.lineSlices.length))
    }
  };
}
