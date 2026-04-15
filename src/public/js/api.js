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

  // 创建新任务
  async create(data) {
    return apiRequest(`/tasks`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 更新任务
  async update(id, data) {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  // 删除任务
  async delete(id) {
    return apiRequest(`/tasks/${id}`, {
      method: 'DELETE'
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
  // 导出周跟踪表 PDF（使用打印对话框）
  async exportPDF(weekStart) {
    const url = `${API_BASE}/export/print?weekStart=${weekStart}`;
    window.open(url, '_blank');
  }
};

// OCR Upload API
const UploadAPI = {
  // Upload photo for OCR
  async uploadPhoto(file, weekStart, onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('weekStart', weekStart);

      const xhr = new XMLHttpRequest();

      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      xhr.addEventListener('load', () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result.success) {
            resolve(result.data);
          } else {
            reject(new Error(result.error?.message || 'OCR 处理失败'));
          }
        } catch (err) {
          reject(new Error('响应解析失败'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('网络错误')));
      xhr.addEventListener('timeout', () => reject(new Error('请求超时')));

      xhr.open('POST', '/api/upload/photo');
      xhr.timeout = 60000; // 60s for upload + OCR
      xhr.send(formData);
    });
  },

  // Confirm OCR results
  async confirmResults(uploadId, weekStart, results) {
    return apiRequest('/upload/confirm', {
      method: 'POST',
      body: JSON.stringify({ uploadId, weekStart, results })
    });
  }
};
