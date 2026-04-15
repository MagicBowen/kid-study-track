/**
 * OCR Upload Module
 * Handles: camera trigger, image compression, upload, results display, confirmation
 */
const OCRUpload = {
  // State
  currentResults: null,
  currentUploadId: null,
  currentWeekStart: null,

  /**
   * Escape HTML special characters to prevent XSS
   */
  _esc(str) {
    const div = document.createElement('div');
    div.textContent = String(str || '');
    return div.innerHTML;
  },

  /**
   * Open the camera/file picker
   */
  triggerCamera() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Rear camera on mobile
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        this.handleFile(file);
      }
    };
    input.click();
  },

  /**
   * Handle selected file: validate, compress, upload
   */
  async handleFile(file) {
    // Validate file type
    if (!file.type.match(/jpeg|jpg|png/)) {
      showToast('请选择 JPEG 或 PNG 图片', 'error');
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showToast('图片太大，请重新拍照', 'error');
      return;
    }

    // Compress image
    showToast('正在压缩图片...', 'info');
    let compressed;
    try {
      compressed = await this.compressImage(file);
    } catch (err) {
      showToast('图片处理失败: ' + err.message, 'error');
      return;
    }

    // Show upload progress
    this.showUploadProgress();

    try {
      const weekStart = AppState.getWeekStart();
      const result = await UploadAPI.uploadPhoto(compressed, weekStart, (progress) => {
        this.updateUploadProgress(progress);
      });

      this.currentUploadId = result.uploadId;
      this.currentWeekStart = result.weekStart;
      this.currentResults = result.results;

      this.hideUploadProgress();
      this.showResultsTable(result);
    } catch (err) {
      this.hideUploadProgress();
      if (err.message.includes('无法识别表格')) {
        showToast('无法识别表格，请正面平拍，确保光线充足', 'error');
      } else if (err.message.includes('超时')) {
        showToast('处理超时，请稍后重试', 'error');
      } else {
        showToast('上传失败: ' + err.message, 'error');
      }
    }
  },

  /**
   * Compress image using Canvas API
   */
  compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('图片解码失败'));
        img.onload = () => {
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          }, 'image/jpeg', 0.7);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Show upload progress overlay
   */
  showUploadProgress() {
    this.hideUploadProgress();
    const overlay = document.createElement('div');
    overlay.className = 'ocr-overlay';
    overlay.id = 'ocrUploadOverlay';
    overlay.innerHTML = `
      <div class="ocr-progress-dialog">
        <h3>正在处理...</h3>
        <div class="ocr-progress-bar">
          <div class="ocr-progress-fill" id="ocrProgressFill" style="width: 0%"></div>
        </div>
        <p id="ocrProgressText">上传中 0%</p>
      </div>
    `;
    document.body.appendChild(overlay);
  },

  updateUploadProgress(pct) {
    const fill = document.getElementById('ocrProgressFill');
    const text = document.getElementById('ocrProgressText');
    if (fill) fill.style.width = pct + '%';
    if (text) text.textContent = pct < 100 ? `上传中 ${pct}%` : 'OCR 识别中...';
  },

  hideUploadProgress() {
    const overlay = document.getElementById('ocrUploadOverlay');
    if (overlay) overlay.remove();
  },

  /**
   * Dismiss any open OCR overlay
   */
  _dismissOverlays() {
    this.hideUploadProgress();
    const results = document.getElementById('ocrResultsOverlay');
    if (results) results.remove();
  },

  /**
   * Show editable results table
   */
  showResultsTable(result) {
    this._dismissOverlays();
    const esc = this._esc.bind(this);

    const overlay = document.createElement('div');
    overlay.className = 'ocr-overlay';
    overlay.id = 'ocrResultsOverlay';

    // Group results by subject+title for compact display
    const bySubject = {};
    for (const r of result.results) {
      const key = `${r.subject}|${r.title}|${r.taskId || 'new'}`;
      if (!bySubject[key]) {
        bySubject[key] = { ...r, days: {} };
      }
      bySubject[key].days[r.day] = r;
    }

    const weekDates = DateUtils.getWeekDates(result.weekStart);

    let rows = '';
    for (const [key, group] of Object.entries(bySubject)) {
      const color = SubjectConfig.getColor(group.subject);
      rows += `
        <tr>
          <td class="ocr-subject" style="background:${color};color:white">${esc(group.subject)}</td>
          <td class="ocr-title">${esc(group.title)}${!group.taskId ? ' <small class="ocr-new">新任务</small>' : ''}</td>
          ${weekDates.map(date => {
            const dayData = group.days[date];
            if (!dayData) return '<td class="ocr-cell ocr-empty">—</td>';
            const checkedConf = dayData.confidence?.checked || 0;
            const timeConf = dayData.confidence?.timeSpent || 0;
            const confClass = (c) => c >= 0.8 ? 'conf-high' : c >= 0.5 ? 'conf-mid' : 'conf-low';
            return `
              <td class="ocr-cell">
                <input type="checkbox" class="ocr-checkbox"
                  ${dayData.checked ? 'checked' : ''}
                  data-day="${esc(date)}" data-key="${esc(key)}">
                <div class="${confClass(checkedConf)}"></div>
                <input type="number" class="ocr-time" min="0" placeholder="分"
                  value="${esc(dayData.timeSpent || '')}"
                  data-day="${esc(date)}" data-key="${esc(key)}">
                <div class="${confClass(timeConf)}"></div>
              </td>
            `;
          }).join('')}
          <td class="ocr-cell">
            <input type="text" class="ocr-notes" placeholder="备注"
              value="${esc(group.notes || '')}"
              data-key="${esc(key)}">
          </td>
        </tr>
      `;
    }

    const lowConfWarning = result.lowConfidence
      ? '<div class="ocr-warning">识别置信度较低，请仔细核对每项数据。标红色项建议重点检查。</div>'
      : '';

    overlay.innerHTML = `
      <div class="ocr-results-dialog">
        <div class="ocr-results-header">
          <h3>识别结果 — 请核对后确认</h3>
          <button class="ocr-close-btn" id="ocrCloseBtn">&times;</button>
        </div>
        ${lowConfWarning}
        <div class="ocr-results-table-wrap">
          <table class="ocr-results-table">
            <thead>
              <tr>
                <th>科目</th>
                <th>任务</th>
                ${['一','二','三','四','五','六','日'].map(d => `<th>周${d}</th>`).join('')}
                <th>备注</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="ocr-results-actions">
          <button class="btn btn-secondary" id="ocrCancelBtn">取消</button>
          <button class="btn btn-primary" id="ocrConfirmBtn">确认提交</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Bind events
    const dismiss = () => overlay.remove();
    document.getElementById('ocrCloseBtn').addEventListener('click', dismiss);
    document.getElementById('ocrCancelBtn').addEventListener('click', dismiss);
    document.getElementById('ocrConfirmBtn').addEventListener('click', () => {
      this.confirmResults(overlay, result);
    });

    // Backdrop click to dismiss
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) dismiss();
    });

    // Escape key to dismiss
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        dismiss();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  },

  /**
   * Collect edited results and confirm
   */
  async confirmResults(overlay, originalResult) {
    const results = [];

    for (const r of originalResult.results) {
      const key = `${r.subject}|${r.title}|${r.taskId || 'new'}`;

      const checkbox = overlay.querySelector(`.ocr-checkbox[data-day="${r.day}"][data-key="${key}"]`);
      const timeInput = overlay.querySelector(`.ocr-time[data-day="${r.day}"][data-key="${key}"]`);
      const notesInput = overlay.querySelector(`.ocr-notes[data-key="${key}"]`);

      results.push({
        taskId: r.taskId,
        subject: r.subject,
        title: r.title,
        day: r.day,
        checked: checkbox ? checkbox.checked : r.checked,
        timeSpent: timeInput ? parseInt(timeInput.value) || 0 : r.timeSpent,
        notes: notesInput ? notesInput.value : r.notes
      });
    }

    try {
      const confirmResult = await UploadAPI.confirmResults(
        this.currentUploadId,
        this.currentWeekStart,
        results
      );
      overlay.remove();
      showToast(`已更新 ${confirmResult.updated} 项任务`, 'success');
      loadStudentData();
    } catch (err) {
      showToast('确认失败: ' + err.message, 'error');
    }
  }
};
