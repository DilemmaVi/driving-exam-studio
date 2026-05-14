const XLSX = require("xlsx");
const Database = require("better-sqlite3");
const path = require("path");

const EXCEL_PATH = path.join(__dirname, "..", "..", "docs", "小车科目一试题.xlsx");
const DB_PATH = path.join(__dirname, "..", "data", "exam.db");

const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY,
    type INTEGER NOT NULL,
    question_text TEXT,
    question_content TEXT,
    option1 TEXT,
    option2 TEXT,
    option3 TEXT,
    option4 TEXT,
    correct_answer TEXT,
    explanation TEXT,
    tip_text TEXT,
    tip_display TEXT,
    cover_image TEXT,
    gif_image TEXT,
    explanation_images TEXT,
    keywords TEXT
  );

  CREATE TABLE IF NOT EXISTS tts_cache (
    question_id INTEGER NOT NULL,
    segment TEXT NOT NULL,
    file_path TEXT NOT NULL,
    duration_sec REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_id, segment)
  );

  CREATE TABLE IF NOT EXISTS render_tasks (
    id TEXT PRIMARY KEY,
    question_ids TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    progress REAL DEFAULT 0,
    output_path TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );
`);

const insert = db.prepare(`
  INSERT OR REPLACE INTO questions
  (id, type, question_text, question_content, option1, option2, option3, option4,
   correct_answer, explanation, tip_text, tip_display, cover_image, gif_image,
   explanation_images, keywords)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  let count = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !r[5]) continue;

    const explanationImages = [r[16], r[17], r[18], r[19], r[20]].filter(Boolean);

    insert.run(
      r[5],             // id (题库ID)
      r[4],             // type (题目类型 1=判断 2=选择)
      r[6] || null,     // question_text
      r[31] || null,    // question_content
      r[7] || null,     // option1
      r[8] || null,     // option2
      r[9] || null,     // option3
      r[10] || null,    // option4
      r[15] || null,    // correct_answer JSON
      r[23] || null,    // explanation
      r[27] || null,    // tip_text
      r[28] || null,    // tip_display
      r[34] || null,    // cover_image
      r[26] || null,    // gif_image
      explanationImages.length > 0 ? JSON.stringify(explanationImages) : null,
      r[22] || null,    // keywords
    );
    count++;
  }
  return count;
});

const count = tx();
console.log(`Imported ${count} questions into ${DB_PATH}`);
db.close();
