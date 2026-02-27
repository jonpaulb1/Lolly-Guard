import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI, Type } from "@google/genai";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("lexguard.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    student_name TEXT,
    submission_text TEXT,
    overall_probability REAL,
    confidence_score REAL,
    verdict TEXT,
    analysis_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flagged_passages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT,
    text TEXT,
    reason TEXT,
    probability REAL,
    FOREIGN KEY(submission_id) REFERENCES submissions(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/submissions", (req, res) => {
    const rows = db.prepare("SELECT * FROM submissions ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.get("/api/submissions/:id", (req, res) => {
    const submission = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
    if (!submission) return res.status(404).json({ error: "Not found" });
    
    const passages = db.prepare("SELECT * FROM flagged_passages WHERE submission_id = ?").all(req.params.id);
    res.json({ ...submission, flagged_passages: passages });
  });

  app.post("/api/save-analysis", async (req, res) => {
    const { text, studentName, type, result } = req.body;
    
    try {
      const id = Math.random().toString(36).substring(7);
      db.prepare(`
        INSERT INTO submissions (id, student_name, submission_text, overall_probability, confidence_score, verdict, analysis_summary)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, 
        studentName || "Anonymous", 
        text, 
        result.overallProbability || result.plagiarismScore || result.potentialScore || 0, 
        result.confidenceScore || 100, 
        result.verdict || result.overallGrade || (type === 'plagiarism' ? (result.plagiarismScore > 20 ? "Potential Plagiarism" : "Clean") : "N/A"), 
        result.analysisSummary || result.studentFeedback || ""
      );

      if (result.flaggedPassages) {
        const insertPassage = db.prepare(`
          INSERT INTO flagged_passages (submission_id, text, reason, probability)
          VALUES (?, ?, ?, ?)
        `);
        for (const p of result.flaggedPassages) {
          insertPassage.run(id, p.text, p.reason, p.probability);
        }
      }

      res.json({ success: true, id });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to save analysis" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
