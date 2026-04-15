const sharp = require('sharp');

// Column layout proportions from the print template (export.js)
// Subject: 8%, Title: 35%, Days: 7 x ~6.71% each, Notes: 10%
const COLUMNS = [
  { name: 'subject', startPct: 0, endPct: 0.08 },
  { name: 'title', startPct: 0.08, endPct: 0.43 },
  { name: 'day-0', startPct: 0.43, endPct: 0.4971 },
  { name: 'day-1', startPct: 0.4971, endPct: 0.5643 },
  { name: 'day-2', startPct: 0.5643, endPct: 0.6314 },
  { name: 'day-3', startPct: 0.6314, endPct: 0.6986 },
  { name: 'day-4', startPct: 0.6986, endPct: 0.7657 },
  { name: 'day-5', startPct: 0.7657, endPct: 0.8329 },
  { name: 'day-6', startPct: 0.8329, endPct: 0.90 },
  { name: 'notes', startPct: 0.90, endPct: 1.0 }
];

// Within each day cell: checkbox top 55%, time bottom 45%
const CHECKBOX_HEIGHT_PCT = 0.55;

const MIN_CELL_SIZE = 10;

/**
 * Preprocess image: grayscale + binarize once, share buffers with all downstream functions.
 * @param {string} filePath - Path to the image file
 * @returns {Promise<{binarized: Buffer, color: Buffer, metadata: Object}>}
 */
async function preprocessImage(filePath) {
  const pipeline = sharp(filePath);
  const metadata = await pipeline.metadata();

  // Create binarized version (for checkbox/text OCR)
  const binarized = await sharp(filePath)
    .grayscale()
    .threshold(128)
    .png()
    .toBuffer();

  // Keep color version (for subject color matching)
  const color = await sharp(filePath)
    .png()
    .toBuffer();

  return { binarized, color, metadata };
}

/**
 * Detect table bounds by scanning from edges inward for dark pixel rows/columns.
 * @param {string} filePath - Path to the image file
 * @returns {Promise<{origin: {x: number, y: number}, size: {w: number, h: number}} | null>}
 */
async function detectTableBounds(filePath) {
  // First, get a grayscale version for analysis
  const { data, info } = await sharp(filePath)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const threshold = 128;

  // Scan from top
  let top = 0;
  outerTop:
  for (let y = 0; y < height * 0.3; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] < threshold) {
        top = y;
        break outerTop;
      }
    }
  }

  // Scan from bottom
  let bottom = height - 1;
  outerBottom:
  for (let y = height - 1; y > height * 0.7; y--) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] < threshold) {
        bottom = y;
        break outerBottom;
      }
    }
  }

  // Scan from left
  let left = 0;
  outerLeft:
  for (let x = 0; x < width * 0.3; x++) {
    for (let y = top; y <= bottom; y++) {
      if (data[y * width + x] < threshold) {
        left = x;
        break outerLeft;
      }
    }
  }

  // Scan from right
  let right = width - 1;
  outerRight:
  for (let x = width - 1; x > width * 0.7; x--) {
    for (let y = top; y <= bottom; y++) {
      if (data[y * width + x] < threshold) {
        right = x;
        break outerRight;
      }
    }
  }

  const tableWidth = right - left;
  const tableHeight = bottom - top;

  // Sanity check: table should be at least 30% of image
  if (tableWidth < width * 0.3 || tableHeight < height * 0.3) {
    return null;
  }

  return {
    origin: { x: left, y: top },
    size: { w: tableWidth, h: tableHeight }
  };
}

/**
 * Detect number of rows by counting horizontal lines in the table.
 * @param {Buffer} binarizedBuffer - Preprocessed binarized image buffer
 * @param {object} bounds - Table bounds from detectTableBounds
 * @returns {Promise<number>} Number of data rows (excluding header)
 */
async function detectRowCount(binarizedBuffer, bounds) {
  const { data, info } = await sharp(binarizedBuffer)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width } = info;
  const { origin, size } = bounds;

  // Scan horizontally across the middle of the table for horizontal lines
  // A line is a row where >40% of pixels are black
  const lineRows = [];
  const scanX1 = origin.x;
  const scanX2 = origin.x + size.w;

  for (let y = origin.y; y < origin.y + size.h; y++) {
    let blackCount = 0;
    for (let x = scanX1; x < scanX2; x++) {
      if (data[y * width + x] < 128) {
        blackCount++;
      }
    }
    const ratio = blackCount / (scanX2 - scanX1);
    if (ratio > 0.4) {
      lineRows.push(y);
    }
  }

  // Merge consecutive line rows into single lines
  const mergedLines = [];
  if (lineRows.length > 0) {
    let start = lineRows[0];
    let prev = lineRows[0];
    for (let i = 1; i < lineRows.length; i++) {
      if (lineRows[i] - prev > 3) {
        mergedLines.push(Math.round((start + prev) / 2));
        start = lineRows[i];
      }
      prev = lineRows[i];
    }
    mergedLines.push(Math.round((start + prev) / 2));
  }

  // Number of data rows = number of line gaps - 1 (minus header row)
  // We expect at least 2 lines (top + bottom of header) before data rows
  return Math.max(1, mergedLines.length - 2);
}

/**
 * Compute cell regions for a given row based on table bounds.
 * @param {object} bounds - Table bounds { origin, size }
 * @param {number} rowIndex - 0-based row index (0 = first data row)
 * @param {number} totalRows - Total number of data rows
 * @param {number} headerHeight - Estimated header height in pixels
 * @returns {Array<{col: string, type: string, x: number, y: number, w: number, h: number}>}
 */
function getRowCellRegions(bounds, rowIndex, totalRows, headerHeight) {
  const { origin, size } = bounds;
  const dataTop = origin.y + headerHeight;
  const dataHeight = size.h - headerHeight;
  const rowHeight = dataHeight / totalRows;

  const rowY = dataTop + rowIndex * rowHeight;
  const cells = [];

  for (const col of COLUMNS) {
    const cellX = Math.round(origin.x + col.startPct * size.w);
    const cellW = Math.round((col.endPct - col.startPct) * size.w);

    if (col.name.startsWith('day-')) {
      // Split day cell into checkbox (top) and time (bottom) regions
      const checkboxH = Math.round(rowHeight * CHECKBOX_HEIGHT_PCT);
      const timeH = Math.round(rowHeight * (1 - CHECKBOX_HEIGHT_PCT));

      if (checkboxH >= MIN_CELL_SIZE && timeH >= MIN_CELL_SIZE) {
        cells.push({
          col: col.name,
          type: 'checkbox',
          x: cellX,
          y: Math.round(rowY),
          w: cellW,
          h: checkboxH
        });
        cells.push({
          col: col.name,
          type: 'time',
          x: cellX,
          y: Math.round(rowY + checkboxH),
          w: cellW,
          h: timeH
        });
      }
    } else {
      const cellH = Math.round(rowHeight);
      if (cellW >= MIN_CELL_SIZE && cellH >= MIN_CELL_SIZE) {
        cells.push({
          col: col.name,
          type: col.name === 'subject' ? 'subject' : col.name === 'title' ? 'title' : 'notes',
          x: cellX,
          y: Math.round(rowY),
          w: cellW,
          h: cellH
        });
      }
    }
  }

  return cells;
}

/**
 * Crop a cell region from the preprocessed binarized image buffer.
 * @param {Buffer} binarizedBuffer - Preprocessed binarized image buffer
 * @param {object} region - { x, y, w, h }
 * @returns {Promise<Buffer>}
 */
async function cropCell(binarizedBuffer, region) {
  return sharp(binarizedBuffer)
    .extract({
      left: Math.max(0, region.x),
      top: Math.max(0, region.y),
      width: Math.max(1, region.w),
      height: Math.max(1, region.h)
    })
    .png()
    .toBuffer();
}

/**
 * Crop a cell region from the color image buffer (for subject color matching).
 * @param {Buffer} colorBuffer - Color image buffer
 * @param {object} region - { x, y, w, h }
 * @returns {Promise<Buffer>}
 */
async function cropCellColor(colorBuffer, region) {
  return sharp(colorBuffer)
    .extract({
      left: Math.max(0, region.x),
      top: Math.max(0, region.y),
      width: Math.max(1, region.w),
      height: Math.max(1, region.h)
    })
    .png()
    .toBuffer();
}

module.exports = {
  preprocessImage,
  detectTableBounds,
  detectRowCount,
  getRowCellRegions,
  cropCell,
  cropCellColor,
  COLUMNS,
  MIN_CELL_SIZE
};
