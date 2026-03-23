const express = require('express');
const router = express.Router();
const database = require('../database');

// GET /api/stats/week?weekStart=YYYY-MM-DD - 周统计
router.get('/week', async (req, res, next) => {
  try {
    const { weekStart } = req.query;

    if (!weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少 weekStart 参数' }
      });
    }

    // 计算一周的日期范围
    const weekDates = getWeekDates(weekStart);

    // 获取所有任务
    const placeholders = weekDates.map(() => '?').join(',');
    const tasks = await database.all(
      `SELECT subject, is_completed, time_spent, date
       FROM tasks WHERE date IN (${placeholders})`,
      weekDates
    );

    // 计算统计数据
    const stats = calculateWeekStats(tasks, weekDates);

    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/subject?subject=数学&weekStart=YYYY-MM-DD - 单科详情
router.get('/subject', async (req, res, next) => {
  try {
    const { subject, weekStart } = req.query;

    if (!subject || !weekStart) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '缺少必要参数' }
      });
    }

    const weekDates = getWeekDates(weekStart);
    const placeholders = weekDates.map(() => '?').join(',');

    const tasks = await database.all(
      `SELECT * FROM tasks
       WHERE subject = ? AND date IN (${placeholders})
       ORDER BY date`,
      [subject, ...weekDates]
    );

    // 计算单科统计
    const totalHours = tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / 60;
    const completedCount = tasks.filter(t => t.is_completed).length;

    // 按日期分组
    const dailyDetails = weekDates.map(date => {
      const dayTasks = tasks.filter(t => t.date === date);
      return {
        date,
        tasks: dayTasks.map(t => ({
          title: t.title,
          completed: t.is_completed,
          timeSpent: t.time_spent,
          notes: t.notes
        }))
      };
    });

    res.json({
      success: true,
      data: {
        subject,
        totalHours: Math.round(totalHours * 10) / 10,
        taskCount: tasks.length,
        completedCount,
        completionRate: tasks.length > 0 ? Math.round(completedCount / tasks.length * 100) : 0,
        dailyDetails
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Generate array of 7 dates starting from weekStart
 * Uses local timezone to avoid UTC conversion issues
 * @param {string} weekStart - Start date in YYYY-MM-DD format
 * @returns {string[]} Array of 7 dates in YYYY-MM-DD format
 */
function getWeekDates(weekStart) {
  const dates = [];
  const date = new Date(weekStart);
  for (let i = 0; i < 7; i++) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

/**
 * Calculate weekly statistics from tasks
 * @param {Array} tasks - Array of task objects
 * @param {Array} weekDates - Array of 7 dates
 * @returns {Object} Weekly statistics
 */
function calculateWeekStats(tasks, weekDates) {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.is_completed).length;
  const totalMinutes = tasks.reduce((sum, t) => sum + (t.time_spent || 0), 0);

  // 按科目统计
  const bySubject = {};
  tasks.forEach(task => {
    if (!bySubject[task.subject]) {
      bySubject[task.subject] = { totalHours: 0, completed: 0, total: 0 };
    }
    bySubject[task.subject].totalHours += (task.time_spent || 0) / 60;
    bySubject[task.subject].total++;
    if (task.is_completed) bySubject[task.subject].completed++;
  });

  // 转换为数组并计算百分比
  const subjectStats = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    totalHours: Math.round(data.totalHours * 10) / 10,
    completed: data.completed,
    total: data.total,
    percentage: Math.round((data.totalHours / (totalMinutes / 60)) * 100)
  }));

  // 每日趋势
  const dailyTrend = weekDates.map(date => {
    const dayTasks = tasks.filter(t => t.date === date);
    const hours = dayTasks.reduce((sum, t) => sum + (t.time_spent || 0), 0) / 60;
    return {
      date,
      hours: Math.round(hours * 10) / 10,
      completed: dayTasks.filter(t => t.is_completed).length,
      total: dayTasks.length
    };
  });

  return {
    total_hours: Math.round(totalMinutes / 60 * 10) / 10,
    daily_average: Math.round((totalMinutes / 60 / 7) * 10) / 10,
    completion_rate: totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) : 0,
    total_tasks: totalTasks,
    completed_tasks: completedTasks,
    by_subject: subjectStats,
    daily_trend: dailyTrend
  };
}

module.exports = router;
