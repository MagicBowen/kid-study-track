// 初始化家长视图
function initParentView() {
  setupModalEvents();
}

function loadParentData() {
  loadStatsSummary();
  loadDailyTrend();
  loadSubjectList();
}

async function loadStatsSummary() {
  const container = document.getElementById('statsSummary');
  container.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const stats = await AppState.loadWeekStats(AppState.getWeekStart());

    container.innerHTML = `
      <div class="stat-card">
        <div class="stat-value">${stats.total_hours}h</div>
        <div class="stat-label">本周总用时</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.daily_average}h</div>
        <div class="stat-label">日均用时</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats.completion_rate}%</div>
        <div class="stat-label">完成率</div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = '<div class="loading">加载失败</div>';
  }
}

function loadDailyTrend() {
  const container = document.getElementById('dailyTrend');
  const stats = AppState.statsCache.weekStats;

  if (!stats || !stats.daily_trend) {
    container.innerHTML = '';
    return;
  }

  const maxHours = Math.max(...stats.daily_trend.map(d => d.hours));

  container.innerHTML = `
    <h3 style="font-size: 14px; color: #666; margin: 16px 0 8px;">每日用时</h3>
    <div style="display: flex; gap: 8px; height: 100px; padding: 12px; background: white; border-radius: 8px; align-items: flex-end;">
      ${stats.daily_trend.map(day => {
        const height = maxHours > 0 ? (day.hours / maxHours) * 80 : 0;
        return `
          <div style="flex: 1; text-align: center;">
            <div style="font-size: 10px; margin-bottom: 4px;">${day.hours}h</div>
            <div style="background: ${day.hours > 0 ? '#667eea' : '#ddd'}; height: ${height}px; border-radius: 4px 4px 0 0; min-height: 4px;"></div>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">${day.date.slice(5)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function loadSubjectList() {
  const container = document.getElementById('subjectList');
  const stats = AppState.statsCache.weekStats;

  if (!stats || !stats.by_subject) {
    container.innerHTML = '<div class="loading">加载中...</div>';
    return;
  }

  container.innerHTML = `
    <h3 style="font-size: 14px; color: #666; margin-bottom: 8px;">各科目详情（点击查看）</h3>
    ${stats.by_subject.map(subject => `
      <div class="subject-item" data-subject="${subject.subject}">
        <div>
          <div style="font-weight: bold;">${SubjectConfig.getIcon(subject.subject)} ${subject.subject}</div>
          <div style="font-size: 11px; color: #888;">
            ${subject.completed}/${subject.total} 完成 | ${subject.total_hours}h | ${subject.percentage}%
          </div>
        </div>
        <span style="font-size: 18px;">›</span>
      </div>
    `).join('')}
  `;

  // 绑定点击事件
  container.querySelectorAll('.subject-item').forEach(item => {
    item.addEventListener('click', () => showSubjectDetail(item.dataset.subject));
  });
}

async function showSubjectDetail(subject) {
  const modal = document.getElementById('subjectModal');
  const title = document.getElementById('modalTitle');
  const body = document.getElementById('modalBody');

  title.textContent = `${SubjectConfig.getIcon(subject)} ${subject} 详情`;
  body.innerHTML = '<div class="loading">加载中...</div>';
  modal.classList.add('active');

  try {
    // URL encode the subject parameter for Chinese characters
    const encodedSubject = encodeURIComponent(subject);
    const detail = await StatsAPI.getSubject(encodedSubject, AppState.getWeekStart());

    body.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 16px;">
        <div style="flex: 1; background: #fffbeb; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #e67e00;">${detail.completedCount}/${detail.taskCount}</div>
          <div style="font-size: 11px; color: #888;">任务完成</div>
        </div>
        <div style="flex: 1; background: #dbeafe; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1a6fb5;">${detail.totalHours}h</div>
          <div style="font-size: 11px; color: #888;">总用时</div>
        </div>
        <div style="flex: 1; background: #dcfce7; padding: 12px; border-radius: 6px; text-align: center;">
          <div style="font-size: 20px; font-weight: bold; color: #1e8449;">${detail.completionRate}%</div>
          <div style="font-size: 11px; color: #888;">完成率</div>
        </div>
      </div>

      <h4 style="font-size: 14px; margin-bottom: 8px;">每日完成详情</h4>
      ${detail.dailyDetails.map(day => `
        <div style="background: ${day.tasks.length > 0 ? 'white' : '#f9f9f9'}; border: 1px solid #ddd; border-radius: 6px; padding: 10px; margin-bottom: 8px;">
          <div style="font-size: 12px; font-weight: bold; margin-bottom: 4px;">${day.date}</div>
          ${day.tasks.map(task => `
            <div style="display: flex; justify-content: space-between; font-size: 11px; padding: 4px 0;">
              <span>${task.completed ? '✓' : '✗'} ${task.title}</span>
              <span style="color: #888;">${task.timeSpent ? TimeUtils.formatMinutes(task.timeSpent) : '-'}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    `;
  } catch (err) {
    body.innerHTML = '<div class="loading">加载失败</div>';
  }
}

function setupModalEvents() {
  // 关闭弹窗
  document.getElementById('closeModal').addEventListener('click', () => {
    document.getElementById('subjectModal').classList.remove('active');
  });

  // 点击背景关闭
  document.getElementById('subjectModal').addEventListener('click', (e) => {
    if (e.target.id === 'subjectModal') {
      document.getElementById('subjectModal').classList.remove('active');
    }
  });
}
