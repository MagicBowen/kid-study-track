// API 基础 URL
const API_BASE = '/api';

// 通用请求函数
async function apiRequest(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || '请求失败');
    }

    return result.data;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

// 任务 API
const TaskAPI = {
  // 获取指定日期的任务
  async getByDate(date) {
    return apiRequest(`/tasks?date=${date}`);
  },

  // 更新任务
  async update(id, data) {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 标记完成
  async complete(id) {
    return apiRequest(`/tasks/${id}/complete`, {
      method: 'POST'
    });
  }
};

// 计划 API
const PlanAPI = {
  // 获取当前激活的计划
  async getActive() {
    return apiRequest('/plans/active');
  },

  // 从模板创建计划
  async createFromTemplate(weekStart, templateType) {
    return apiRequest('/plans/create-from-template', {
      method: 'POST',
      body: JSON.stringify({ week_start: weekStart, template_type: templateType })
    });
  },

  // 复制上周计划
  async copyLastWeek() {
    // 简化实现：使用模板创建
    const today = new Date();
    const lastWeekStart = DateUtils.getWeekStart(
      new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    );
    return this.createFromTemplate(lastWeekStart, 'weekday');
  }
};

// 统计 API
const StatsAPI = {
  // 获取周统计
  async getWeek(weekStart) {
    return apiRequest(`/stats/week?weekStart=${weekStart}`);
  },

  // 获取单科详情
  async getSubject(subject, weekStart) {
    return apiRequest(`/stats/subject?subject=${subject}&weekStart=${weekStart}`);
  }
};

// PDF 导出 API
const ExportAPI = {
  // 导出周跟踪表 PDF
  async exportPDF(weekStart) {
    const url = `${API_BASE}/export/pdf?weekStart=${weekStart}`;
    window.open(url, '_blank');
  }
};
