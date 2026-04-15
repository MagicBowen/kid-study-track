const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const database = require('../database');

// Subject color palette (must match export.js and utils.js SubjectConfig)
const SUBJECT_COLORS = {
  '数学': [230, 126, 0],    // #e67e00
  '物理': [26, 111, 181],   // #1a6fb5
  '化学': [176, 48, 32],    // #b03020
  '生物': [30, 132, 73],    // #1e8449
  '语文': [125, 60, 152],   // #7d3c98
  '英语': [26, 37, 47],     // #1a252f
  '运动': [192, 57, 43]     // #c0392b
};

// Cached Tesseract worker
let worker = null;
let workerInitializing = null;

/**
 * Initialize the Tesseract worker. Called once on server startup.
 * @returns {Promise<void>}
 */
async function initWorker() {
  if (worker) return;
  if (workerInitializing) return workerInitializing;

  workerInitializing = (async () => {
    try {
      console.log('Initializing OCR worker (downloading language data on first run)...');
      worker = await Tesseract.createWorker('chi_sim+eng', Tesseract.OEM.LSTM_ONLY, {
        logger: m => {
          if (m.status === 'loading language traineddata') {
            console.log(`  OCR: ${m.status} ${Math.round((m.progress || 0) * 100)}%`);
          }
        }
      });
      console.log('OCR worker ready');
    } finally {
      workerInitializing = null;
    }
  })();

  return workerInitializing;
}

/**
 * Terminate the Tesseract worker. Called on server shutdown.
 */
async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

/**
 * Recognize checkbox state by pixel density.
 * @param {Buffer} cellImage - Binarized PNG buffer of the checkbox region
 * @returns {Promise<{ checked: boolean, confidence: number }>}
 */
async function recognizeCheckbox(cellImage) {
  const { data, info } = await sharp(cellImage)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  if (totalPixels === 0) return { checked: false, confidence: 0 };

  // Sample only the first channel to avoid 3x inflation from RGB
  let blackPixels = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] < 128) blackPixels++;
  }

  const density = blackPixels / totalPixels;
  const checked = density > 0.25;
  const confidence = Math.max(0, 1 - Math.abs(density - 0.5) * 5);

  return { checked, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Recognize a number from an image region.
 * Uses worker.setParameters for digit-only mode (Tesseract.js v5+/v7 API).
 * @param {Buffer} cellImage - PNG buffer
 * @returns {Promise<{ value: number|null, confidence: number }>}
 */
async function recognizeNumber(cellImage) {
  try {
    // Set digit-only mode via setParameters
    await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
    const result = await worker.recognize(cellImage);
    // Reset whitelist for subsequent calls
    await worker.setParameters({ tessedit_char_whitelist: '' });

    const text = result.data.text.trim();
    const confidence = result.data.confidence / 100;

    if (!text) return { value: null, confidence: 0 };

    const num = parseInt(text, 10);
    if (isNaN(num) || num < 0 || num > 1440) {
      return { value: null, confidence: Math.round(confidence * 100) / 100 };
    }

    return { value: num, confidence: Math.round(confidence * 100) / 100 };
  } catch (err) {
    // Ensure whitelist is reset even on error
    try { await worker.setParameters({ tessedit_char_whitelist: '' }); } catch (_) {}
    return { value: null, confidence: 0 };
  }
}

/**
 * Recognize text (Chinese + English) from an image region.
 * @param {Buffer} cellImage - PNG buffer
 * @returns {Promise<{ text: string, confidence: number }>}
 */
async function recognizeText(cellImage) {
  try {
    // Ensure no whitelist restriction from a prior recognizeNumber call
    await worker.setParameters({ tessedit_char_whitelist: '' });
    const result = await worker.recognize(cellImage);
    const text = result.data.text.trim();
    const confidence = result.data.confidence / 100;
    return { text, confidence: Math.round(confidence * 100) / 100 };
  } catch (err) {
    return { text: '', confidence: 0 };
  }
}

/**
 * Match a subject cell's dominant color against the known palette.
 * @param {Buffer} cellImage - Color PNG buffer (NOT binarized)
 * @returns {Promise<{ subject: string|null, confidence: number }>}
 */
async function matchSubject(cellImage) {
  const { data, info } = await sharp(cellImage)
    .resize(10, 10, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Average color
  let rSum = 0, gSum = 0, bSum = 0;
  const pixelCount = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    rSum += data[i];
    gSum += data[i + 1];
    bSum += data[i + 2];
  }
  const avgR = rSum / pixelCount;
  const avgG = gSum / pixelCount;
  const avgB = bSum / pixelCount;

  // Find closest color in palette
  let bestSubject = null;
  let bestDist = Infinity;
  for (const [subject, [sr, sg, sb]] of Object.entries(SUBJECT_COLORS)) {
    const dist = Math.sqrt((avgR - sr) ** 2 + (avgG - sg) ** 2 + (avgB - sb) ** 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestSubject = subject;
    }
  }

  const confidence = Math.max(0, Math.round((1 - bestDist / 100) * 100) / 100);
  return { subject: bestSubject, confidence };
}

/**
 * Fuzzy-match OCR'd title text against database tasks for a subject+week.
 * @param {string} ocrText - OCR recognized text
 * @param {string} subject - Already-identified subject
 * @param {string} weekStart - Week start date YYYY-MM-DD
 * @returns {Promise<{ taskId: number|null, title: string, confidence: number }>}
 */
async function matchTitle(ocrText, subject, weekStart) {
  if (!ocrText || !subject || !weekStart) {
    return { taskId: null, title: ocrText || '', confidence: 0 };
  }

  // Get all tasks for this subject in this week
  const weekDates = [];
  const [sy, sm, sd] = weekStart.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sy, sm - 1, sd + i);
    weekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  const placeholders = weekDates.map(() => '?').join(',');
  const tasks = await database.all(
    `SELECT DISTINCT id, title FROM tasks WHERE subject = ? AND date IN (${placeholders})`,
    [subject, ...weekDates]
  );

  if (tasks.length === 0) {
    return { taskId: null, title: ocrText, confidence: 0 };
  }

  // Simple substring matching: check if OCR text contains task title or vice versa
  let bestMatch = null;
  let bestScore = 0;

  for (const task of tasks) {
    const ocr = ocrText.replace(/\s+/g, '');
    const db = task.title.replace(/\s+/g, '');

    let score = 0;
    if (ocr === db) {
      score = 1.0;
    } else if (ocr.includes(db) || db.includes(ocr)) {
      score = 0.8;
    } else {
      // Character overlap ratio
      let overlap = 0;
      for (const ch of db) {
        if (ocr.includes(ch)) overlap++;
      }
      score = overlap / Math.max(db.length, ocr.length);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = task;
    }
  }

  return {
    taskId: bestScore > 0.3 ? bestMatch.id : null,
    title: bestScore > 0.3 ? bestMatch.title : ocrText,
    confidence: Math.round(bestScore * 100) / 100
  };
}

/**
 * Process a full sheet image. The main pipeline.
 * @param {string} imagePath - Path to uploaded photo
 * @param {string} weekStart - Week start date YYYY-MM-DD
 * @returns {Promise<{results: Array, lowConfidence: boolean}>}
 */
async function processSheet(imagePath, weekStart) {
  const imageProcessor = require('./image-processor');

  // 1. Preprocess image once — shared across all cell extractions
  const { binarized, color } = await imageProcessor.preprocessImage(imagePath);

  // 2. Detect table bounds (uses raw grayscale from original file)
  const bounds = await imageProcessor.detectTableBounds(imagePath);
  if (!bounds) {
    return { results: [], lowConfidence: true };
  }

  // 3. Detect row count (uses preprocessed binarized buffer)
  const rowCount = await imageProcessor.detectRowCount(binarized, bounds);
  if (rowCount < 1) {
    return { results: [], lowConfidence: true };
  }

  // 4. Estimate header height (~10% of table height)
  const headerHeight = Math.round(bounds.size.h * 0.1);

  // 5. Process each row
  const results = [];
  const weekDates = [];
  const [sy, sm, sd] = weekStart.split('-').map(Number);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sy, sm - 1, sd + i);
    weekDates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
    const cells = imageProcessor.getRowCellRegions(bounds, rowIdx, rowCount, headerHeight);

    // 5a. Identify subject (color matching — uses color buffer)
    const subjectCell = cells.find(c => c.type === 'subject');
    if (!subjectCell) continue;

    const subjectColorBuf = await imageProcessor.cropCellColor(color, subjectCell);
    const { subject, confidence: subjectConf } = await matchSubject(subjectColorBuf);

    // 5b. Identify title (uses binarized buffer)
    const titleCell = cells.find(c => c.type === 'title');
    let titleData = { taskId: null, title: '', confidence: 0 };
    if (titleCell) {
      const titleBuf = await imageProcessor.cropCell(binarized, titleCell);
      const { text: titleText, confidence: titleOcrConf } = await recognizeText(titleBuf);
      titleData = await matchTitle(titleText, subject, weekStart);
      // Take the lower of OCR confidence and match confidence
      titleData.confidence = Math.min(titleData.confidence, titleOcrConf);
    }

    // 5c. Process each day column
    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const checkboxCell = cells.find(c => c.col === `day-${dayIdx}` && c.type === 'checkbox');
      const timeCell = cells.find(c => c.col === `day-${dayIdx}` && c.type === 'time');

      let checkedData = { checked: false, confidence: 0 };
      let timeData = { value: null, confidence: 0 };

      if (checkboxCell) {
        const checkboxBuf = await imageProcessor.cropCell(binarized, checkboxCell);
        checkedData = await recognizeCheckbox(checkboxBuf);
      }

      if (timeCell && checkedData.checked) {
        const timeBuf = await imageProcessor.cropCell(binarized, timeCell);
        timeData = await recognizeNumber(timeBuf);
      }

      // Get notes cell (shared across all days, use last column)
      // Notes are per-row, not per-day in the current template
      const notesCell = cells.find(c => c.type === 'notes');
      let notesData = { text: '', confidence: 0 };
      if (notesCell && dayIdx === 0) {
        // Only read notes once per row
        const notesBuf = await imageProcessor.cropCell(binarized, notesCell);
        notesData = await recognizeText(notesBuf);
      }

      results.push({
        taskId: titleData.taskId,
        subject: subject || '未知',
        title: titleData.title || '未知任务',
        day: weekDates[dayIdx],
        checked: checkedData.checked,
        timeSpent: timeData.value,
        notes: dayIdx === 0 ? notesData.text : '',
        confidence: {
          checked: checkedData.confidence,
          timeSpent: timeData.confidence,
          notes: notesData.confidence,
          subject: subjectConf,
          title: titleData.confidence
        }
      });
    }
  }

  // 6. Calculate overall confidence
  const allFieldConfidences = results.flatMap(r => [
    r.confidence.checked, r.confidence.timeSpent,
    r.confidence.notes, r.confidence.subject, r.confidence.title
  ]).filter(c => c > 0);

  const lowConfFields = allFieldConfidences.filter(c => c < 0.5).length;
  const lowConfidence = allFieldConfidences.length > 0 && (lowConfFields / allFieldConfidences.length > 0.5);

  return { results, lowConfidence };
}

module.exports = {
  initWorker,
  terminateWorker,
  recognizeCheckbox,
  recognizeNumber,
  recognizeText,
  matchSubject,
  matchTitle,
  processSheet
};
