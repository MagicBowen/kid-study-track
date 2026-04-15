# Photo OCR Design Spec

## Summary

Implement photo-based data entry for printed tracking tables. Students print weekly tracking tables, fill them by hand (checkboxes, time, notes), then take a photo at week's end. The system uses OCR to extract the data and presents an editable table for confirmation before saving.

## Architecture

**Approach**: Hybrid — frontend image compression + server-side image preprocessing and OCR.

```
Mobile Browser          Express Server          SQLite DB
─────────────          ──────────────          ──────────
1. Take photo
2. Compress (Canvas)
3. Upload ───────────▶ 4. Receive (multer)
                       5. Preprocess (sharp)
                       6. OCR (tesseract.js)
                       7. Return results ◀─────
8. Show editable table
9. User corrects
10. Confirm ──────────▶ 11. Batch update ──────▶ 12. Save
```

### Why hybrid

- Mobile photos are 3-5MB; frontend compression reduces upload time.
- Server-side sharp can do high-quality preprocessing (perspective correction, binarization) that would be slow on mobile.
- Tesseract.js on Node.js is significantly faster than WASM in mobile browsers.
- Offline fallback: if no network, user enters data manually.

## Data Flow

### 1. Frontend: Photo capture and upload

- `<input type="file" accept="image/*" capture="environment">` opens rear camera on mobile.
- Canvas API compresses image: max 1200px width, JPEG quality 0.7, target ~300-500KB.
- `POST /api/upload/photo` with multipart form data: `{ photo, weekStart }`.

### 2. Server: Image preprocessing (sharp)

**Strategy**: Use fixed-position cell lookup based on known print layout rather than full grid detection. This avoids the need for OpenCV and works reliably for photos taken roughly straight-on.

Pipeline:

1. **Grayscale + binarize**: sharp converts to grayscale, then applies threshold for black/white image.
2. **Page boundary detection**: Scan from edges inward to find the table's bounding rectangle (first row of dark pixels from top/bottom/left/right). This gives us the table origin and dimensions.
3. **Fixed-position cell lookup**: The print template has a known layout — fixed number of columns (subject, title, 7 days, notes), each with known proportional widths. Given the detected table bounds, compute each cell's position as a fraction of total table width/height:
   - Subject column: 0%-8% of width
   - Title column: 8%-43%
   - Day columns: each ~8.14% (43% to 100% minus 10% for notes)
   - Notes column: last 10%
   - Within each day cell, checkbox is in the top ~55% of height, time-input in the bottom ~45%.
4. **Cell cropping**: sharp extracts each cell region. Minimum expected cell size: 15x15 pixels for checkboxes in a 1200px-wide compressed image. If detected cell size < 10px, flag as too small and skip recognition.

**Limitations of v1**:
- No perspective correction — requires users to photograph straight-on. UI will show a guide overlay suggesting flat, overhead shots.
- No rotation correction — assumes photo is roughly upright.
- These can be added in v2 with OpenCV if needed.

### 3. Server: OCR recognition

Three recognition strategies by cell type:

| Cell Type | Method | Details |
|-----------|--------|---------|
| Checkbox (勾选框) | Pixel density | Count black pixels in cell region. >25% = checked, <10% = unchecked, 10-25% = low confidence. More reliable than Tesseract for mark detection. |
| Time (时长) | Tesseract.js digits-only | `recognize(region, 'eng')` with character whitelist `0123456789`. Returns minutes as integer. |
| Notes (备注) | Tesseract.js chi_sim+eng | `recognize(region, 'chi_sim+eng')`. Lower accuracy expected; user can correct. |
| Subject (科目) | Color matching | Match the cell's dominant color against known subject color palette (数学=#e67e00, 物理=#1a6fb5, etc.) to identify the row. |
| Title (任务名称) | Tesseract.js chi_sim+eng | `recognize(region, 'chi_sim+eng')` for fuzzy matching against known task titles from the database. |

### 4. Row Identification (mapping photo cells to taskId)

The printed table does not contain taskId values. The system maps rows as follows:

1. **Subject identification**: Each row's subject cell has a colored background. Match the dominant hue against the known palette (`数学=#e67e00`, `物理=#1a6fb5`, `化学=#b03020`, `生物=#1e8449`, `语文=#7d3c98`, `英语=#1a252f`, `运动=#c0392b`). This is reliable because the colors are pre-printed.
2. **Title matching**: OCR the title cell text and fuzzy-match against the database task list for that subject + week. Use simple string similarity (e.g., Levenshtein distance or substring match).
3. **Day mapping**: Column position directly maps to date (column 3 = 周一, column 4 = 周二, etc.), computed from `weekStart`.

**Result**: Query `SELECT id FROM tasks WHERE subject=? AND title LIKE ? AND date=?` to get the taskId.

**Handling mismatches**:
- If a row cannot be matched to any task (task was added after printing), include it in results with `taskId: null` and `subject`/`title` from OCR. Frontend shows a "new task" indicator.
- If a database task has no matching row in the OCR results (task was deleted after printing), that task is simply not included in results — no action needed.

### 5. Confidence system

Each result carries per-field confidence scores:

- `>= 80%`: Green — trusted.
- `50-80%`: Yellow — suggest review.
- `< 50%`: Red — must manually confirm.

**Confidence calculation formulas**:

- **Checkbox**: Linear mapping from pixel density ratio `r`: confidence = `max(0, 1 - abs(r - 0.5) * 5)`. Fully empty (0%) or fully filled (100%) = high confidence. Borderline (10-25%) = low confidence.
- **Time/Notes**: Use Tesseract.js's built-in confidence score directly (0-100 scale, normalized to 0-1).
- **Subject**: Color match distance. If the closest color in the palette is within Euclidean distance < 30 (in RGB space), confidence = `1 - distance/100`. Otherwise, low confidence.

**Overall `lowConfidence` flag**: True if more than 50% of all fields have confidence < 50%, OR if table boundary detection failed (no grid found).

If overall confidence is low, prompt user to retake photo or switch to manual entry.

### 6. Frontend: Editable results table

- Reuses print table layout style but with editable inputs.
- Checkbox → `<input type="checkbox">`
- Time → `<input type="number" min="0">`
- Notes → `<input type="text">`
- Low-confidence cells highlighted by background color.
- `POST /api/upload/confirm` submits user-verified data.

## API Design

### POST /api/upload/photo

Upload photo for OCR processing.

**Request**: `multipart/form-data`
- `photo`: Image file (JPEG/PNG, max 10MB before compression)
- `weekStart`: `YYYY-MM-DD` format, the Monday of the target week

**Response**:
```json
{
  "success": true,
  "data": {
    "uploadId": "upload_20260415_abc123",
    "weekStart": "2026-04-13",
    "results": [
      {
        "taskId": 15,
        "subject": "数学",
        "title": "函数练习册 P23-25",
        "day": "2026-04-13",
        "checked": true,
        "timeSpent": 45,
        "notes": "",
        "confidence": {
          "checked": 0.95,
          "timeSpent": 0.72,
          "notes": 0.0
        }
      }
    ],
    "lowConfidence": false
  }
}
```

### POST /api/upload/confirm

Confirm and save OCR results after user review.

**Validation rules**:
- `uploadId` must exist in `ocr_uploads` table and have status `pending`.
- If status is not `pending` (already confirmed/rejected), return 409 Conflict.
- Each `taskId` must exist in the `tasks` table for the given `weekStart` date range.
- `taskId: null` items (new tasks discovered via OCR) are INSERTED as new tasks.
- Results with a valid `taskId` UPDATE the existing task record.

**SQL operations**:
- For each result with `taskId !== null`: `UPDATE tasks SET is_completed=?, time_spent=?, notes=? WHERE id=?`
- For each result with `taskId === null`: `INSERT INTO tasks (subject, title, date, is_completed, time_spent, notes, ...) VALUES (...)`
- After all updates: `UPDATE ocr_uploads SET status='confirmed', confirmed_result=?, confirmed_at=datetime('now') WHERE upload_id=?`

**Request**:
```json
{
  "uploadId": "upload_20260415_abc123",
  "weekStart": "2026-04-13",
  "results": [
    {
      "taskId": 15,
      "checked": true,
      "timeSpent": 45,
      "notes": "错题3道需复习"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "updated": 12,
    "total": 15
  }
}
```

## Database Changes

### New table: ocr_uploads

```sql
CREATE TABLE IF NOT EXISTS ocr_uploads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  upload_id TEXT UNIQUE NOT NULL,
  week_start TEXT NOT NULL,
  photo_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  ocr_result TEXT,
  confirmed_result TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  confirmed_at TEXT
);
```

Fields:
- `upload_id`: Unique identifier like `upload_20260415_abc123`.
- `week_start`: The Monday of the target week.
- `photo_path`: Path to saved photo in `uploads/`.
- `status`: `pending` | `confirmed` | `rejected`.
- `ocr_result`: JSON string of raw OCR output.
- `confirmed_result`: JSON string of user-confirmed data.
- `confirmed_at`: Timestamp when user confirmed.

## Frontend Changes

### New file: `src/public/js/ocr-upload.js`

Single module handling:
- Camera/file picker trigger
- Canvas-based image compression
- Upload with progress indicator
- Results display as editable table
- Confirmation submission

### Existing file modifications

- `src/public/index.html`: Add "拍照录入" button to student view, add upload dialog modal.
- `src/public/js/student.js`: Integrate ocr-upload module, add upload button handler.
- `src/public/css/`: Add OCR-related styles (upload dialog, editable results table, confidence colors).

### Mobile UX considerations

- Upload button: fixed at bottom of student view, large touch target.
- Results table: horizontal scroll on narrow screens.
- Confirm button: prominent, always visible.
- File input: `capture="environment"` for rear camera on mobile.

## Server Changes

### New file: `src/routes/upload.js`

Express router with two endpoints:
- `POST /photo`: Receive image, preprocess, OCR, return results.
- `POST /confirm`: Save user-confirmed results to tasks table.

**Multer configuration**:
```javascript
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },  // 10MB max (before frontend compression)
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png/.test(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 JPEG/PNG 图片'));
  }
});
```

### New file: `src/utils/image-processor.js`

Image preprocessing module (sharp-only, no OpenCV dependency):
- `preprocessImage(filePath)`: Grayscale + binarize. Returns processed sharp instance.
- `detectTableBounds(imageBuffer)`: Scan edges inward to find table bounding box. Returns `{ origin: {x, y}, size: {w, h} }` or null if no table found.
- `getCellRegions(tableBounds, rowCount)`: Compute cell coordinates from table bounds using fixed proportional layout. Returns array of `{ row, col, type, x, y, w, h }`.
- `cropCell(imageBuffer, region)`: Extract a single cell region. Returns Buffer.

### New file: `src/utils/ocr-engine.js`

OCR engine module:
- `initWorker()`: Initialize and cache a Tesseract.js worker on server startup. Worker is reused across requests to avoid cold-start penalty (first init downloads language data ~15MB). Configurable OCR timeout of 45 seconds (30s for warm worker, extra for cold start).
- `recognizeCheckbox(cellImage)`: Pixel density check, returns `{ checked, confidence }`.
- `recognizeNumber(cellImage)`: Tesseract digits-only, returns `{ value, confidence }`.
- `recognizeText(cellImage)`: Tesseract chi_sim+eng, returns `{ text, confidence }`.
- `matchSubject(cellImage)`: Color matching against known palette, returns `{ subject, confidence }`.
- `matchTitle(text, subject, weekStart)`: Fuzzy match against DB task list, returns `{ taskId, title, confidence }`.
- `processSheet(imagePath, weekStart)`: Full pipeline, returns structured results array.

### Existing file modifications

- `src/server.js`: Mount upload router at `/api/upload`.
- `src/database.js`: Add `ocr_uploads` table creation in schema initialization.

## Dependencies

```json
{
  "multer": "^1.4.5-lts.1",
  "sharp": "^0.33.x",
  "tesseract.js": "^5.x"
}
```

**Notes**:
- `tesseract.js` v5 uses WebAssembly on Node.js. First invocation downloads language data (~15MB for chi_sim+eng). The worker is initialized on server startup and cached.
- `sharp` is a native addon — requires build tools on the host system. Prebuilt binaries available for most platforms.
- Combined with existing `puppeteer` dependency, total `node_modules` will be large but acceptable for a home-server deployment.

## Error Handling

| Scenario | Response |
|----------|----------|
| Image too blurry / no table detected | 400: "无法识别表格，请重新拍照" |
| OCR overall confidence < 30% | 200 with `lowConfidence: true`, prompt for retake or manual entry |
| Network error during upload | Frontend shows retry button |
| File too large (>10MB before compression) | Frontend rejects before upload, shows compression message |
| Partial recognition success | Return successfully recognized items, leave unrecognized empty |
| Tesseract timeout (>45s) | 504: "处理超时，请稍后重试" |

## Degradation Path

1. **Best case**: Photo is clear, table grid detected, OCR results mostly accurate → user reviews minor corrections.
2. **Partial recognition**: Grid detected but OCR quality is mixed → user corrects highlighted low-confidence fields.
3. **Grid detection fails**: Cannot locate table structure → prompt user to retake photo with better angle/lighting.
4. **Complete failure**: No network or processing error → show manual entry table (same editable table but pre-filled with current task list, all fields empty).
