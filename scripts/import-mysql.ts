import mysql from "mysql2/promise";
import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "data", "exam.db");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Ensure question_categories table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS question_categories (
    question_id INTEGER NOT NULL,
    category_id TEXT NOT NULL,
    PRIMARY KEY (question_id, category_id)
  );
  CREATE INDEX IF NOT EXISTS idx_qc_category ON question_categories(category_id);
`);

// Map: subject_category_id (顺序练习) → local category_id
const CATEGORY_MAP: Record<number, string> = {
  225: "car-s1",    // 小车科目一 - 1761题
  231: "car-s4",    // 小车科目四 - 1595题
  226: "truck-s1",  // 货车科目一 - 2087题
  232: "truck-s4",  // 货车科目四 - 2016题
  227: "bus-s1",    // 客车科目一 - 1748题
  233: "bus-s4",    // 客车科目四 - 2011题
  228: "moto-s1",   // 摩托车科目一 - 547题
  234: "moto-s4",   // 摩托车科目四 - 391题
};

const ANSWER_MAP = ["A", "B", "C", "D", "E", "F", "G", "H"];

function md5(text: string): string {
  return crypto.createHash("md5").update(text).digest("hex");
}

function parseAnswer(raw: unknown): string {
  try {
    const arr = Array.isArray(raw) ? raw : JSON.parse(String(raw));
    return (arr as string[]).map((v) => ANSWER_MAP[(parseInt(v) || 1) - 1]).join("");
  } catch {
    return "A";
  }
}

const insertQ = db.prepare(`
  INSERT OR IGNORE INTO questions
  (id, type, question_text, question_content, option1, option2, option3, option4,
   correct_answer, explanation, tip_text, tip_display, cover_image, gif_image,
   keywords, category_id, source_id, content_hash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertQC = db.prepare(`INSERT OR IGNORE INTO question_categories (question_id, category_id) VALUES (?, ?)`);

const findByHash = db.prepare("SELECT id FROM questions WHERE content_hash = ?");
const findBySource = db.prepare("SELECT id FROM questions WHERE source_id = ? AND source_id > 0");

async function main() {
  const conn = await mysql.createConnection({
    host: "8.129.22.198",
    port: 3307,
    user: "v3_test",
    password: "U4T33nVENfr4hjLh",
    database: "v3_test",
  });

  // Clear existing data and reimport fresh
  console.log("Clearing existing data...");
  db.pragma("foreign_keys = OFF");
  db.exec("DELETE FROM question_categories");
  db.exec("DELETE FROM questions");
  db.pragma("foreign_keys = ON");

  let nextId = 1;
  let totalInserted = 0;
  const hashToId = new Map<string, number>();

  for (const [subjectCategoryId, categoryId] of Object.entries(CATEGORY_MAP)) {
    const scId = Number(subjectCategoryId);
    console.log(`\nImporting ${categoryId} (subject_category_id=${scId})...`);

    const [rows] = await conn.query<mysql.RowDataPacket[]>(`
      SELECT sb.id, sb.question_type, sb.question, sb.answer_options, sb.answer_correct,
             sb.explain_voice_text, sb.skill_text, sb.skill_voice_text, sb.keywords, sb.img_url, sb.content_hash,
             se.sort
      FROM subject_bases sb
      INNER JOIN subject_exams se ON se.subject_base_id = sb.id
      WHERE se.subject_category_id = ? AND se.deleted_at IS NULL AND se.status = 1 AND sb.deleted_at IS NULL
      ORDER BY se.sort
    `, [scId]);

    console.log(`  Found ${rows.length} questions from MySQL`);
    let inserted = 0;
    let linked = 0;

    const tx = db.transaction(() => {
      for (const row of rows) {
        const questionText = String(row.question || "").trim();
        if (!questionText) continue;

        const opts: string[] = Array.isArray(row.answer_options) ? row.answer_options : [];
        const type = row.question_type === 1 ? 1 : 2;
        const correctAnswer = parseAnswer(row.answer_correct);

        const hashInput = questionText.replace(/【|】/g, "").replace(/\s+/g, "") +
          opts.map((o: string) => o.replace(/【|】/g, "")).join("");
        const hash = md5(hashInput);

        // Check if this question already exists
        let existingId = hashToId.get(hash);
        if (!existingId) {
          const existing = findByHash.get(hash) as { id: number } | undefined;
          if (existing) existingId = existing.id;
        }

        if (existingId) {
          // Question exists, just link to this category
          insertQC.run(existingId, categoryId);
          linked++;
        } else {
          // New question
          const qId = nextId++;
          const questionContent = questionText +
            (opts.length > 0 ? opts.map((o, i) => `${ANSWER_MAP[i]}:${o}`).join(";") : "");

          insertQ.run(
            qId, type, questionText, questionContent,
            opts[0] || null, opts[1] || null, opts[2] || null, opts[3] || null,
            correctAnswer,
            String(row.explain_voice_text || ""),
            String(row.skill_voice_text || ""),
            String(row.skill_text || ""),
            row.img_url || null, null,
            String(row.keywords || "") || null,
            categoryId, row.id, hash
          );
          insertQC.run(qId, categoryId);
          hashToId.set(hash, qId);
          inserted++;
        }
      }
    });

    tx();
    console.log(`  New: ${inserted}, Linked existing: ${linked}`);
    totalInserted += inserted;
  }

  await conn.end();

  // Stats
  const total = (db.prepare("SELECT COUNT(*) as c FROM questions").get() as { c: number }).c;
  const qcTotal = (db.prepare("SELECT COUNT(*) as c FROM question_categories").get() as { c: number }).c;
  console.log(`\n=== Done ===`);
  console.log(`Unique questions: ${total}`);
  console.log(`Category links: ${qcTotal}`);

  // Per-category counts
  const catCounts = db.prepare(`
    SELECT c.name, COUNT(qc.question_id) as cnt
    FROM categories c
    LEFT JOIN question_categories qc ON qc.category_id = c.id
    GROUP BY c.id ORDER BY c.sort_order
  `).all() as { name: string; cnt: number }[];
  console.log("\nPer-category:");
  for (const r of catCounts) {
    console.log(`  ${r.name}: ${r.cnt}`);
  }
}

main().catch(console.error);
