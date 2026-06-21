import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

export function nowBeijing(): string {
  return new Date(Date.now() + 8 * 3600000).toISOString().replace("T", " ").slice(0, 19);
}

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "exam.db");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

let _db: Database.Database | null = (globalThis as any).__examDb || null;

export function getDbPath(): string {
  return DB_PATH;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
    (globalThis as any).__examDb = null;
  }
}

export function reopenDb(): Database.Database {
  closeDb();
  return getDb();
}

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    initTables(_db);
    (globalThis as any).__examDb = _db;
  }
  return _db;
}

function initTables(db: Database.Database) {
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
      series_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      progress REAL DEFAULT 0,
      phase TEXT DEFAULT '',
      phase_label TEXT DEFAULT '',
      rendered_frames INTEGER DEFAULT 0,
      total_frames INTEGER DEFAULT 0,
      output_path TEXT,
      file_size TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS video_series (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT DEFAULT '',
      intro_title TEXT DEFAULT '',
      intro_subtitle TEXT DEFAULT '',
      default_think_time REAL DEFAULT 3,
      default_voice_style TEXT DEFAULT '教学',
      default_transition TEXT DEFAULT 'fade',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS series_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      series_id TEXT NOT NULL,
      question_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      teacher_explanation TEXT DEFAULT '',
      show_official_explanation INTEGER DEFAULT 1,
      show_tip INTEGER DEFAULT 1,
      think_time REAL,
      voice_style TEXT,
      transition TEXT,
      FOREIGN KEY (series_id) REFERENCES video_series(id),
      FOREIGN KEY (question_id) REFERENCES questions(id),
      UNIQUE(series_id, question_id)
    );
  `);

  // migrate: add series_id to render_tasks if missing
  const rtCols = db.prepare("PRAGMA table_info(render_tasks)").all() as { name: string }[];
  if (!rtCols.some((c) => c.name === "series_id")) {
    db.exec("ALTER TABLE render_tasks ADD COLUMN series_id TEXT");
  }

  // migrate: add bridge columns to video_series if missing
  const vsCols = db.prepare("PRAGMA table_info(video_series)").all() as { name: string }[];
  const bridgeCols = ["bridge_think", "bridge_reveal", "bridge_explain", "bridge_tip"];
  for (const col of bridgeCols) {
    if (!vsCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE video_series ADD COLUMN ${col} TEXT`);
    }
  }

  // migrate: add video style columns to video_series
  const styleColsDef: [string, string][] = [
    ["theme", "TEXT DEFAULT 'light'"],
    ["font_scale", "REAL DEFAULT 1.0"],
    ["avatar_image", "TEXT DEFAULT ''"],
    ["avatar_position", "TEXT DEFAULT 'bottom-right'"],
    ["avatar_size", "INTEGER DEFAULT 260"],
    ["read_options", "INTEGER DEFAULT 999"],
    ["keyword_style", "TEXT DEFAULT 'circle'"],
    ["speech_rate", "REAL DEFAULT 1.0"],
    ["reveal_pause", "REAL DEFAULT 0.3"],
    ["panel_height", "REAL DEFAULT 48"],
  ];
  for (const [col, typedef] of styleColsDef) {
    if (!vsCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE video_series ADD COLUMN ${col} ${typedef}`);
    }
  }
  // Fix: read_options=1 was a wrong default, should be 999 (always read)
  db.exec("UPDATE video_series SET read_options = 999 WHERE read_options = 1");
  // migrate: add per-question override columns to series_questions
  const sqCols = db.prepare("PRAGMA table_info(series_questions)").all() as { name: string }[];
  const sqNewCols: [string, string][] = [
    ["read_options", "INTEGER"],
    ["speech_rate", "REAL"],
    ["reveal_pause", "REAL"],
    ["panel_adjust", "TEXT"],
    ["panel_adjust_value", "INTEGER"],
    ["option_gap", "REAL"],
    ["font_size_question", "INTEGER"],
    ["font_size_option", "INTEGER"],
    ["font_size_explanation", "INTEGER"],
    ["stem_keywords", "TEXT"],
    ["stem_keyword_phases", "TEXT"],
    ["reading_prefix_delay", "REAL"],
    ["reading_speed_ratio", "REAL"],
  ];
  for (const [col, typedef] of sqNewCols) {
    if (!sqCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE series_questions ADD COLUMN ${col} ${typedef}`);
    }
  }

  // categories table + seed data
  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      car_type TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0
    );
  `);
  const catCount = (db.prepare("SELECT COUNT(*) as c FROM categories").get() as { c: number }).c;
  if (catCount === 0) {
    const seeds = [
      ["car-s1", "小车科目一", "小车", "科目一", 1],
      ["car-s4", "小车科目四", "小车", "科目四", 2],
      ["truck-s1", "货车科目一", "货车", "科目一", 3],
      ["truck-s4", "货车科目四", "货车", "科目四", 4],
      ["bus-s1", "客车科目一", "客车", "科目一", 5],
      ["bus-s4", "客车科目四", "客车", "科目四", 6],
      ["moto-s1", "摩托车科目一", "摩托车", "科目一", 7],
      ["moto-s4", "摩托车科目四", "摩托车", "科目四", 8],
    ] as const;
    const ins = db.prepare("INSERT INTO categories (id, name, car_type, subject, sort_order) VALUES (?, ?, ?, ?, ?)");
    for (const s of seeds) ins.run(...s);
  }

  // question_categories junction table (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS question_categories (
      question_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      PRIMARY KEY (question_id, category_id)
    );
    CREATE INDEX IF NOT EXISTS idx_qc_category ON question_categories(category_id);
  `);

  // migrate: add category_id, source_id, content_hash to questions
  const qCols = db.prepare("PRAGMA table_info(questions)").all() as { name: string }[];
  const qNewCols: [string, string][] = [
    ["category_id", "TEXT DEFAULT ''"],
    ["source_id", "INTEGER"],
    ["content_hash", "TEXT"],
  ];
  for (const [col, typedef] of qNewCols) {
    if (!qCols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE questions ADD COLUMN ${col} ${typedef}`);
    }
  }

  // migrate: add answer read + bridge enabled + outro columns to video_series
  const vsColsRefresh = db.prepare("PRAGMA table_info(video_series)").all() as { name: string }[];
  const newVsCols: [string, string][] = [
    ["answer_read_option", "INTEGER DEFAULT 1"],
    ["answer_read_multi", "INTEGER DEFAULT 0"],
    ["bridge_think_enabled", "INTEGER DEFAULT 1"],
    ["bridge_reveal_enabled", "INTEGER DEFAULT 1"],
    ["bridge_explain_enabled", "INTEGER DEFAULT 1"],
    ["bridge_tip_enabled", "INTEGER DEFAULT 1"],
    ["outro_text", "TEXT DEFAULT ''"],
    ["outro_subtitle", "TEXT DEFAULT ''"],
  ];
  for (const [col, typedef] of newVsCols) {
    if (!vsColsRefresh.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE video_series ADD COLUMN ${col} ${typedef}`);
    }
  }
  for (const [col, typedef] of newVsCols) {
    const match = typedef.match(/DEFAULT\s+(.+)/i);
    if (match) {
      db.exec(`UPDATE video_series SET ${col} = ${match[1]} WHERE ${col} IS NULL`);
    }
  }

  // migrate: add style enhancement columns to video_series
  const vsColsV3 = db.prepare("PRAGMA table_info(video_series)").all() as { name: string }[];
  const styleEnhanceCols: [string, string][] = [
    ["show_transition", "INTEGER DEFAULT 0"],
    ["pause_start", "REAL DEFAULT 2.0"],
    ["pause_end", "REAL DEFAULT 2.0"],
    ["pause_before_tip", "REAL DEFAULT 2.0"],
    ["tts_speed", "TEXT DEFAULT 'medium'"],
    ["tts_voice", "TEXT DEFAULT '冰糖'"],
    ["keyword_flash_enabled", "INTEGER DEFAULT 1"],
    ["underline_progress_enabled", "INTEGER DEFAULT 0"],
    ["avatar_enabled", "INTEGER DEFAULT 1"],
    ["split_render", "INTEGER DEFAULT 0"],
    ["underline_question", "INTEGER DEFAULT 0"],
    ["underline_option", "INTEGER DEFAULT 0"],
    ["underline_explanation", "INTEGER DEFAULT 0"],
    ["underline_tip", "INTEGER DEFAULT 0"],
    ["underline_color", "TEXT DEFAULT '#6366F1'"],
    ["intro_enabled", "INTEGER DEFAULT 0"],
    ["outro_enabled", "INTEGER DEFAULT 0"],
    ["intro_duration", "REAL DEFAULT 4.0"],
    ["outro_duration", "REAL DEFAULT 4.0"],
    ["intro_logo", "TEXT DEFAULT ''"],
    ["panel_suffix", "TEXT DEFAULT '全安驾考'"],
  ];
  for (const [col, typedef] of styleEnhanceCols) {
    if (!vsColsV3.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE video_series ADD COLUMN ${col} ${typedef}`);
    }
  }
  // backfill NULLs with defaults for columns added via ALTER TABLE
  for (const [col, typedef] of styleEnhanceCols) {
    const match = typedef.match(/DEFAULT\s+(.+)/i);
    if (match) {
      db.exec(`UPDATE video_series SET ${col} = ${match[1]} WHERE ${col} IS NULL`);
    }
  }

  // migrate: rename old "dark" theme to "light" (dark theme removed)
  db.exec(`UPDATE video_series SET theme = 'light' WHERE theme = 'dark'`);

  // migrate: change underline defaults from 1 to 0 (previously backfilled as 1)
  db.exec(`UPDATE video_series SET underline_question = 0 WHERE underline_question = 1`);
  db.exec(`UPDATE video_series SET underline_explanation = 0 WHERE underline_explanation = 1`);
  db.exec(`UPDATE video_series SET underline_tip = 0 WHERE underline_tip = 1`);
  db.exec(`UPDATE video_series SET underline_progress_enabled = 0 WHERE underline_progress_enabled = 1`);

  // migrate: fix old JSON-format correct_answer (["1"] → "A")
  const oldFmt = (db.prepare("SELECT COUNT(*) as c FROM questions WHERE correct_answer LIKE '[%'").get() as { c: number }).c;
  if (oldFmt > 0) {
    const map = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const rows = db.prepare("SELECT id, correct_answer FROM questions WHERE correct_answer LIKE '[%'").all() as { id: number; correct_answer: string }[];
    const upd = db.prepare("UPDATE questions SET correct_answer = ? WHERE id = ?");
    for (const r of rows) {
      try {
        const arr = JSON.parse(r.correct_answer) as string[];
        upd.run(arr.map((v) => map[(parseInt(v) || 1) - 1]).join(""), r.id);
      } catch { /* skip */ }
    }
  }

  // migrate: add clause_durations to tts_cache
  const ttsCols = db.prepare("PRAGMA table_info(tts_cache)").all() as { name: string }[];
  if (!ttsCols.some((c) => c.name === "clause_durations")) {
    db.exec(`ALTER TABLE tts_cache ADD COLUMN clause_durations TEXT DEFAULT NULL`);
  }
  if (!ttsCols.some((c) => c.name === "text_hash")) {
    db.exec(`ALTER TABLE tts_cache ADD COLUMN text_hash TEXT DEFAULT NULL`);
  }

  // migrate: clean up v0.3.38 broken cache entries (hash was embedded in segment name)
  // and force all old entries to regenerate (text_hash was not stored before)
  // preserve question_id=0 entries (settings-generated tf option audio)
  const brokenCount = (db.prepare("SELECT COUNT(*) as c FROM tts_cache WHERE text_hash IS NULL AND question_id != 0").get() as { c: number }).c;
  if (brokenCount > 0) {
    const brokenRows = db.prepare("SELECT file_path FROM tts_cache WHERE text_hash IS NULL AND question_id != 0").all() as { file_path: string }[];
    const audioDir = process.env.AUDIO_DIR || path.join(process.cwd(), "public", "audio");
    for (const r of brokenRows) {
      try { fs.unlinkSync(path.join(audioDir, path.basename(r.file_path))); } catch {}
    }
    db.exec("DELETE FROM tts_cache WHERE text_hash IS NULL AND question_id != 0");
  }

  // TTS dictionary table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tts_dictionary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original TEXT NOT NULL UNIQUE,
      replacement TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      note TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
