// 日期处理工具（使用本地时区，避免UTC转换问题）
const DateUtils = {
  // 获取周的周一日期
  getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return this.format(new Date(d.setDate(diff)));
  },

  // 格式化为 YYYY-MM-DD（使用本地时区）
  format(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 获取一周的日期数组
  getWeekDates(weekStart) {
    const dates = [];
    const date = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
      dates.push(this.format(date));
      date.setDate(date.getDate() + 1);
    }
    return dates;
  },

  // 格式化日期显示
  formatDisplay(dateStr) {
    const date = new Date(dateStr);
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}/${date.getDate()} ${days[date.getDay()]}`;
  },

  // 获取当前周的周一
  getCurrentWeekStart() {
    return this.getWeekStart(new Date());
  }
};

// 时间处理工具
const TimeUtils = {
  // 计算用时（分钟）
  calculateTimeSpent(startTime, endTime) {
    if (!startTime || !endTime) return 0;

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    // 跨午夜处理
    if (endMinutes < startMinutes) {
      return endMinutes + 24 * 60 - startMinutes;
    }

    return endMinutes - startMinutes;
  },

  // 格式化分钟为 "X小时Y分钟"
  formatMinutes(minutes) {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  },

  // 验证时间格式
  validateTime(timeStr) {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(timeStr);
  }
};

// 科目配置
const SubjectConfig = {
  colors: {
    '数学': '#e67e00',
    '物理': '#1a6fb5',
    '化学': '#b03020',
    '生物': '#1e8449',
    '语文': '#7d3c98',
    '英语': '#1a252f',
    '运动': '#c0392b'
  },

  icons: {
    '数学': '📐',
    '物理': '⚛️',
    '化学': '🧪',
    '生物': '🧬',
    '语文': '📖',
    '英语': '📝',
    '运动': '🏃'
  },

  getColor(subject) {
    return this.colors[subject] || '#666';
  },

  getIcon(subject) {
    return this.icons[subject] || '📚';
  }
};

// Toast 提示
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999;
    animation: slideUp 0.3s ease-out;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
