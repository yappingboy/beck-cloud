/**
 * Wraps OpenSCAD code in a generated module, then projects that module from
 * above. Library imports stay global because OpenSCAD does not allow use/include
 * directives inside module bodies.
 * @param code The OpenSCAD source code to project for DXF export
 * @returns OpenSCAD code wrapped in a top-down projection
 */
export function createDXFProjectionCode(code: string): string {
  const { imports, body } = extractTopLevelLibraryImports(code);
  const importBlock = imports.join('\n');
  const sourceModule = `module __cadam_dxf_source__() {\n${body.trim()}\n}`;
  const projection = 'projection(cut = false) __cadam_dxf_source__();';

  return [importBlock, sourceModule, projection].filter(Boolean).join('\n\n');
}

/**
 * Rewrites OpenSCAD's DXF output into an AutoCAD R12 (AC1009) conformant file.
 *
 * OpenSCAD emits a minimal DXF: `$ACADVER` is declared as AC1006 (R10), the
 * HEADER omits extent variables, and the TABLES section lacks the LTYPE and
 * STYLE tables that AutoCAD's parser requires. The resulting file opens in
 * lenient importers (LibreCAD, QCAD, Onshape, Inkscape, Fusion) but AutoCAD
 * itself rejects it. This function discards the OpenSCAD header/tables, keeps
 * the entity geometry (converting LWPOLYLINE into plain LINE entities for
 * R12), and rebuilds the surrounding sections to the R12 spec.
 * @param dxf Raw DXF text emitted by OpenSCAD
 * @returns AutoCAD-compatible R12 DXF text
 */
export function normalizeOpenSCADDxf(dxf: string): string {
  const pairs = toDxfPairs(dxf);
  const entityPairs = extractEntityPairs(pairs);
  const extents = computeExtents(entityPairs);

  return buildR12Dxf(entityPairs, extents);
}

type DxfPair = {
  code: string;
  value: string;
};

type Extents = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

/**
 * Parses DXF text into code/value pairs.
 * @param dxf DXF text to parse
 * @returns DXF group-code pairs
 */
function toDxfPairs(dxf: string): DxfPair[] {
  const lines = dxf.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const pairs: DxfPair[] = [];

  for (let index = 0; index < lines.length - 1; index += 2) {
    pairs.push({
      code: lines[index].trim(),
      value: lines[index + 1].trim(),
    });
  }

  return pairs;
}

/**
 * Serializes DXF code/value pairs back to DXF text.
 * @param pairs DXF group-code pairs to serialize
 * @returns DXF text with a trailing newline
 */
function fromDxfPairs(pairs: DxfPair[]): string {
  return `${pairs.map(({ code, value }) => `${code}\n${value}`).join('\n')}\n`;
}

/**
 * Extracts the entity body from an OpenSCAD DXF, converting LWPOLYLINE
 * entities to plain LINE pairs along the way. The surrounding HEADER,
 * TABLES, and EOF markers are dropped because we regenerate them.
 * @param pairs Full DXF pair list from OpenSCAD
 * @returns Entity pairs only (no SECTION/ENDSEC wrappers)
 */
function extractEntityPairs(pairs: DxfPair[]): DxfPair[] {
  const startIndex = findEntitiesSectionStart(pairs);
  if (startIndex < 0) return [];

  const output: DxfPair[] = [];
  for (let index = startIndex; index < pairs.length; index += 1) {
    const pair = pairs[index];

    if (pair.code === '0' && pair.value === 'ENDSEC') break;
    if (pair.code === '0' && pair.value === 'EOF') break;

    if (pair.code === '0' && pair.value === 'LWPOLYLINE') {
      const converted = convertLightweightPolylineToLines(pairs, index);
      output.push(...converted.pairs);
      index = converted.nextIndex - 1;
      continue;
    }

    output.push(formatEntityCoordPair(pair));
  }
  return output;
}

/**
 * Locates the start of the ENTITIES section body inside a parsed DXF.
 * @param pairs Full DXF pair list
 * @returns Index of the pair immediately after the `2 ENTITIES` marker,
 *   or -1 if no ENTITIES section is present.
 */
function findEntitiesSectionStart(pairs: DxfPair[]): number {
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (
      pairs[index].code === '0' &&
      pairs[index].value === 'SECTION' &&
      pairs[index + 1].code === '2' &&
      pairs[index + 1].value === 'ENTITIES'
    ) {
      return index + 2;
    }
  }
  return -1;
}

/**
 * Converts one LWPOLYLINE entity into a set of LINE entities.
 * @param pairs Full DXF pair list
 * @param startIndex Index of the LWPOLYLINE entity marker
 * @returns Converted pairs and the index where the next entity starts
 */
function convertLightweightPolylineToLines(
  pairs: DxfPair[],
  startIndex: number,
): { pairs: DxfPair[]; nextIndex: number } {
  let layer = '0';
  let closed = false;
  let pendingX: string | null = null;
  const vertices: Array<{ x: string; y: string }> = [];
  let nextIndex = pairs.length;

  for (let index = startIndex + 1; index < pairs.length; index += 1) {
    const pair = pairs[index];

    if (pair.code === '0') {
      nextIndex = index;
      break;
    }

    if (pair.code === '8') layer = pair.value;
    if (pair.code === '70') closed = (Number(pair.value) & 1) === 1;
    if (pair.code === '10') pendingX = pair.value;
    if (pair.code === '20' && pendingX !== null) {
      vertices.push({ x: pendingX, y: pair.value });
      pendingX = null;
    }
  }

  const converted: DxfPair[] = [];
  const segmentCount = closed ? vertices.length : vertices.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];

    converted.push(
      { code: '0', value: 'LINE' },
      { code: '8', value: layer },
      { code: '10', value: formatCoordText(start.x) },
      { code: '20', value: formatCoordText(start.y) },
      { code: '30', value: '0.0' },
      { code: '11', value: formatCoordText(end.x) },
      { code: '21', value: formatCoordText(end.y) },
      { code: '31', value: '0.0' },
    );
  }

  return { pairs: converted, nextIndex };
}

/**
 * Normalizes entity coordinate values to plain decimal DXF fields while
 * preserving non-coordinate and malformed values as emitted.
 * @param pair DXF group-code pair
 * @returns Pair with finite numeric coordinate values formatted plainly
 */
function formatEntityCoordPair(pair: DxfPair): DxfPair {
  const codeNum = Number(pair.code);

  if (!Number.isFinite(codeNum) || !isCoordinateCode(codeNum)) {
    return pair;
  }

  return { code: pair.code, value: formatCoordText(pair.value) };
}

/**
 * Formats finite numeric coordinate text and preserves anything else verbatim.
 * @param value Raw DXF coordinate value
 * @returns Plain decimal coordinate, or the original value if not numeric
 */
function formatCoordText(value: string): string {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? formatCoord(numericValue) : value;
}

/**
 * Checks whether a DXF group code carries an entity coordinate value.
 * @param codeNum Numeric DXF group code
 * @returns True when the group code is an X/Y/Z coordinate code
 */
function isCoordinateCode(codeNum: number): boolean {
  return (
    (codeNum >= 10 && codeNum <= 19) ||
    (codeNum >= 20 && codeNum <= 29) ||
    (codeNum >= 30 && codeNum <= 39)
  );
}

/**
 * Computes the 2D bounding box of all entity coordinates so the HEADER's
 * `$EXTMIN`/`$EXTMAX` reflect the actual geometry. AutoCAD trusts these
 * values when framing the initial viewport.
 * @param entityPairs Entity pairs (no SECTION/ENDSEC wrappers)
 * @returns Bounding box; collapses to the origin when no coordinates exist
 */
function computeExtents(entityPairs: DxfPair[]): Extents {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const { code, value } of entityPairs) {
    const codeNum = Number(code);
    if (!Number.isFinite(codeNum)) continue;

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) continue;

    // DXF group codes 10-19 carry primary X coords; 20-29 carry Y coords.
    if (codeNum >= 10 && codeNum <= 19) {
      if (numericValue < minX) minX = numericValue;
      if (numericValue > maxX) maxX = numericValue;
    } else if (codeNum >= 20 && codeNum <= 29) {
      if (numericValue < minY) minY = numericValue;
      if (numericValue > maxY) maxY = numericValue;
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Formats a number for DXF coordinate output. Avoids scientific notation,
 * which AutoCAD does not accept in coordinate fields.
 * @param value Numeric value to format
 * @returns Plain decimal string with 6 fractional digits
 */
function formatCoord(value: number): string {
  if (!Number.isFinite(value)) return '0.000000';
  return value.toFixed(6);
}

/**
 * Builds a complete AutoCAD R12 (AC1009) DXF from extracted entities.
 * Emits the required sections — HEADER, TABLES, BLOCKS, ENTITIES, plus the
 * `EOF` marker — with the LAYER/LTYPE/STYLE tables AutoCAD demands.
 * @param entityPairs Entity pairs to embed in the ENTITIES section
 * @param extents Bounding box used for the HEADER extent variables
 * @returns Full DXF text with a trailing newline
 */
function buildR12Dxf(entityPairs: DxfPair[], extents: Extents): string {
  const header: DxfPair[] = [
    { code: '0', value: 'SECTION' },
    { code: '2', value: 'HEADER' },
    { code: '9', value: '$ACADVER' },
    { code: '1', value: 'AC1009' },
    { code: '9', value: '$INSBASE' },
    { code: '10', value: '0.0' },
    { code: '20', value: '0.0' },
    { code: '30', value: '0.0' },
    { code: '9', value: '$EXTMIN' },
    { code: '10', value: formatCoord(extents.minX) },
    { code: '20', value: formatCoord(extents.minY) },
    { code: '30', value: '0.0' },
    { code: '9', value: '$EXTMAX' },
    { code: '10', value: formatCoord(extents.maxX) },
    { code: '20', value: formatCoord(extents.maxY) },
    { code: '30', value: '0.0' },
    { code: '9', value: '$LIMMIN' },
    { code: '10', value: '0.0' },
    { code: '20', value: '0.0' },
    { code: '9', value: '$LIMMAX' },
    { code: '10', value: '420.0' },
    { code: '20', value: '297.0' },
    { code: '0', value: 'ENDSEC' },
  ];

  const tables: DxfPair[] = [
    { code: '0', value: 'SECTION' },
    { code: '2', value: 'TABLES' },
    { code: '0', value: 'TABLE' },
    { code: '2', value: 'LTYPE' },
    { code: '70', value: '1' },
    { code: '0', value: 'LTYPE' },
    { code: '2', value: 'CONTINUOUS' },
    { code: '70', value: '0' },
    { code: '3', value: 'Solid line' },
    { code: '72', value: '65' },
    { code: '73', value: '0' },
    { code: '40', value: '0.0' },
    { code: '0', value: 'ENDTAB' },
    { code: '0', value: 'TABLE' },
    { code: '2', value: 'LAYER' },
    { code: '70', value: '1' },
    { code: '0', value: 'LAYER' },
    { code: '2', value: '0' },
    { code: '70', value: '0' },
    { code: '62', value: '7' },
    { code: '6', value: 'CONTINUOUS' },
    { code: '0', value: 'ENDTAB' },
    { code: '0', value: 'TABLE' },
    { code: '2', value: 'STYLE' },
    { code: '70', value: '1' },
    { code: '0', value: 'STYLE' },
    { code: '2', value: 'STANDARD' },
    { code: '70', value: '0' },
    { code: '40', value: '0.0' },
    { code: '41', value: '1.0' },
    { code: '50', value: '0.0' },
    { code: '71', value: '0' },
    { code: '42', value: '2.5' },
    { code: '3', value: 'txt' },
    { code: '4', value: '' },
    { code: '0', value: 'ENDTAB' },
    { code: '0', value: 'ENDSEC' },
  ];

  const blocks: DxfPair[] = [
    { code: '0', value: 'SECTION' },
    { code: '2', value: 'BLOCKS' },
    { code: '0', value: 'ENDSEC' },
  ];

  const entities: DxfPair[] = [
    { code: '0', value: 'SECTION' },
    { code: '2', value: 'ENTITIES' },
    ...entityPairs,
    { code: '0', value: 'ENDSEC' },
  ];

  const eof: DxfPair[] = [{ code: '0', value: 'EOF' }];

  return fromDxfPairs([...header, ...tables, ...blocks, ...entities, ...eof]);
}

/**
 * Separates top-level OpenSCAD library directives from projectable body code.
 * Uses a line-aligned comment-stripped scan so import detection ignores `use<>`
 * tokens that appear inside line or block comments while preserving the original
 * source verbatim in the returned body.
 * @param source OpenSCAD source code
 * @returns Global imports and the remaining source body
 */
function extractTopLevelLibraryImports(source: string): {
  imports: string[];
  body: string;
} {
  const normalizedSource = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sourceLines = normalizedSource.split('\n');
  const scanLines = normalizedSource
    .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
    .replace(/\/\/[^\n]*/g, '')
    .split('\n');

  const importRegex = /^[ \t]*(?:use|include)\s*<[^>]+>\s*;?\s*$/;
  const imports: string[] = [];
  const body: string[] = [];

  for (let index = 0; index < sourceLines.length; index += 1) {
    if (importRegex.test(scanLines[index])) {
      imports.push(sourceLines[index].trim());
    } else {
      body.push(sourceLines[index]);
    }
  }

  return { imports, body: body.join('\n') };
}
