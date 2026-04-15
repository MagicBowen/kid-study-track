const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const database = require('../database');
const ocrEngine = require('../utils/ocr-engine');

// Multer configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png)$/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPEG/PNG 图片'));
    }
  }
});

// POST /api/upload/photo - Upload photo and run OCR
router.post('/photo', upload.single('photo'), async (req, res, next) => {
  try {
    const { weekStart } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '请选择要上传的图片' }
      });
    }

    if (!weekStart) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 weekStart 参数' }
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'weekStart 格式无效' }
      });
    }

    // Generate upload ID
    const uploadId = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Run OCR with timeout
    let ocrResult;
    const ocrTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('OCR_TIMEOUT')), 45000)
    );

    try {
      ocrResult = await Promise.race([
        ocrEngine.processSheet(file.path, weekStart),
        ocrTimeout
      ]);
    } catch (err) {
      if (err.message === 'OCR_TIMEOUT') {
        return res.status(504).json({
          success: false,
          error: { code: 'OCR_TIMEOUT', message: '处理超时，请稍后重试' }
        });
      }
      throw err;
    }

    // Check if table was detected
    if (ocrResult.results.length === 0 && ocrResult.lowConfidence) {
      await database.run(
        `INSERT INTO ocr_uploads (upload_id, week_start, photo_path, status, ocr_result)
         VALUES (?, ?, ?, 'rejected', ?)`,
        [uploadId, weekStart, file.path, JSON.stringify(ocrResult)]
      );

      return res.status(400).json({
        success: false,
        error: { code: 'TABLE_NOT_DETECTED', message: '无法识别表格，请重新拍照。建议正面平拍，确保光线充足。' }
      });
    }

    // Save upload record
    await database.run(
      `INSERT INTO ocr_uploads (upload_id, week_start, photo_path, status, ocr_result)
       VALUES (?, ?, ?, 'pending', ?)`,
      [uploadId, weekStart, file.path, JSON.stringify(ocrResult)]
    );

    res.json({
      success: true,
      data: {
        uploadId,
        weekStart,
        results: ocrResult.results,
        lowConfidence: ocrResult.lowConfidence
      }
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(err);
  }
});

// POST /api/upload/confirm - Confirm and save OCR results
router.post('/confirm', async (req, res, next) => {
  try {
    const { uploadId, weekStart, results } = req.body;

    if (!uploadId || !weekStart || !Array.isArray(results)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
      });
    }

    // Validate weekStart format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'weekStart 格式无效' }
      });
    }

    // Validate result items
    for (const item of results) {
      if (item.taskId && (!Number.isInteger(item.taskId) || item.taskId <= 0)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '无效的 taskId' }
        });
      }
      if (item.timeSpent != null && (typeof item.timeSpent !== 'number' || item.timeSpent < 0)) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: '无效的 timeSpent 值' }
        });
      }
    }

    // Check upload exists and is pending
    const uploadRecord = await database.get(
      'SELECT * FROM ocr_uploads WHERE upload_id = ?',
      [uploadId]
    );

    if (!uploadRecord) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '上传记录不存在' }
      });
    }

    if (uploadRecord.status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: { code: 'ALREADY_CONFIRMED', message: '该记录已处理' }
      });
    }

    // Process results in a transaction
    let updated = 0;
    const total = results.length;

    await database.run('BEGIN TRANSACTION');
    try {
      for (const item of results) {
        if (item.taskId) {
          const result = await database.run(
            `UPDATE tasks SET is_completed = ?, time_spent = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [item.checked ? 1 : 0, item.timeSpent || 0, item.notes || '', item.taskId]
          );
          if (result.changes > 0) updated++;
        } else {
          await database.run(
            `INSERT INTO tasks (title, subject, date, is_completed, time_spent, notes, type, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'study', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [item.title || '未知任务', item.subject || '未知', item.day || weekStart,
             item.checked ? 1 : 0, item.timeSpent || 0, item.notes || '']
          );
          updated++;
        }
      }

      // Mark upload as confirmed
      await database.run(
        `UPDATE ocr_uploads SET status = 'confirmed', confirmed_result = ?, confirmed_at = datetime('now')
         WHERE upload_id = ?`,
        [JSON.stringify(results), uploadId]
      );

      await database.run('COMMIT');
    } catch (err) {
      await database.run('ROLLBACK');
      throw err;
    }

    res.json({
      success: true,
      data: { updated, total }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
