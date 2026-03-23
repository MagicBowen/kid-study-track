const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/tasks?date=YYYY-MM-DD - 获取指定日期的任务
router.get('/', async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 date 参数' }
      });
    }

    const tasks = await database.all(
      `SELECT id, title, subject, type, is_completed,
              start_time, end_time, time_spent, notes
       FROM tasks WHERE date = ? ORDER BY id`,
      [date]
    );

    res.json({ success: true, data: { date, tasks } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - 创建新任务
router.post('/', async (req, res, next) => {
  try {
    const { title, subject, date, type } = req.body;

    if (!title || !subject || !date) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数 (title, subject, date)' }
      });
    }

    const result = await database.run(
      `INSERT INTO tasks (title, subject, date, type, is_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [title, subject, date, type || 'study']
    );

    const newTask = await database.get(
      'SELECT id, title, subject, type, is_completed, date FROM tasks WHERE id = ?',
      [result.id]
    );

    res.json({ success: true, data: newTask });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id - 更新任务
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_completed, start_time, end_time, notes } = req.body;

    // 计算用时
    let time_spent = 0;
    if (start_time && end_time) {
      const [startH, startM] = start_time.split(':').map(Number);
      const [endH, endM] = end_time.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (endMinutes < startMinutes) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_TIME_RANGE', message: '结束时间必须晚于开始时间' }
        });
      }

      time_spent = endMinutes - startMinutes;
    }

    // 更新任务
    await database.run(
      `UPDATE tasks SET is_completed = ?, start_time = ?, end_time = ?,
                      time_spent = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [is_completed ? 1 : 0, start_time, end_time, time_spent, notes, id]
    );

    res.json({
      success: true,
      data: { id: parseInt(id), is_completed, time_spent }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id - 删除任务
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if task exists
    const task = await database.get('SELECT id FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '任务不存在' }
      });
    }

    await database.run('DELETE FROM tasks WHERE id = ?', [id]);

    res.json({ success: true, data: { id: parseInt(id) } });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/complete - 标记任务完成
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;

    await database.run(
      'UPDATE tasks SET is_completed = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    res.json({ success: true, data: { id: parseInt(id), is_completed: true } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
