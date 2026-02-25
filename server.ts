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

function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    console.error("GEMINI_API_KEY is not set or is a placeholder.");
    throw new Error("Gemini API Key is missing. Please ensure you have configured your API key in the Secrets panel.");
  }
  return new GoogleGenAI({ apiKey });
}

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

  app.post("/api/analyze", async (req, res) => {
    const { text, studentName, type = 'ai-detector' } = req.body;
    
    try {
      const ai = getAI();
      let systemInstruction = "";
      let responseSchema: any = {};

      if (type === 'ai-detector') {
        systemInstruction = "Forensic linguist mode. Analyze for AI generation. Return JSON with overallProbability, confidenceScore, analysisSummary, verdict, flaggedPassages (array of {text, reason, probability}), linguisticMarkers (array of {marker, finding, impact}).";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            overallProbability: { type: Type.NUMBER },
            confidenceScore: { type: Type.NUMBER },
            analysisSummary: { type: Type.STRING },
            verdict: { type: Type.STRING },
            flaggedPassages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  probability: { type: Type.NUMBER }
                }
              }
            },
            linguisticMarkers: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  marker: { type: Type.STRING },
                  finding: { type: Type.STRING },
                  impact: { type: Type.STRING }
                }
              }
            }
          }
        };
      } else if (type === 'plagiarism') {
        systemInstruction = "Plagiarism detection mode. Analyze the text for potential plagiarism or lack of proper attribution. Return JSON with plagiarismScore (0-100), sourcesFound (array of {source, matchPercentage, snippet}), analysisSummary.";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            plagiarismScore: { type: Type.NUMBER },
            analysisSummary: { type: Type.STRING },
            sourcesFound: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  source: { type: Type.STRING },
                  matchPercentage: { type: Type.NUMBER },
                  snippet: { type: Type.STRING }
                }
              }
            }
          }
        };
      } else if (type === 'grammar') {
        systemInstruction = "Grammar and style checker mode. Identify errors and suggest improvements. Return JSON with errorCount, suggestions (array of {original, suggestion, reason, type}), readabilityScore.";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            errorCount: { type: Type.NUMBER },
            readabilityScore: { type: Type.NUMBER },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  original: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  type: { type: Type.STRING }
                }
              }
            }
          }
        };
      } else if (type === 'paraphraser') {
        systemInstruction = "Paraphrasing tool. Rewrite the text while maintaining legal precision and meaning. Return JSON with paraphrasedText, changesMadeSummary.";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            paraphrasedText: { type: Type.STRING },
            changesMadeSummary: { type: Type.STRING }
          }
        };
      } else if (type === 'humanizer') {
        systemInstruction = "Text humanizer. Adjust the tone and flow to sound more natural and less robotic while keeping legal accuracy. Return JSON with humanizedText, toneAdjustments.";
        responseSchema = {
          type: Type.OBJECT,
          properties: {
            humanizedText: { type: Type.STRING },
            toneAdjustments: { type: Type.STRING }
          }
        };
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: `Task: ${type}. Text: ${text}`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema
        }
      });

      const result = JSON.parse(response.text || "{}");
      
      // Save to DB only for AI Detector and Plagiarism for now
      if (type === 'ai-detector' || type === 'plagiarism') {
        const id = Math.random().toString(36).substring(7);
        db.prepare(`
          INSERT INTO submissions (id, student_name, submission_text, overall_probability, confidence_score, verdict, analysis_summary)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, 
          studentName || "Anonymous", 
          text, 
          result.overallProbability || result.plagiarismScore || 0, 
          result.confidenceScore || 100, 
          result.verdict || (type === 'plagiarism' ? (result.plagiarismScore > 20 ? "Potential Plagiarism" : "Clean") : "N/A"), 
          result.analysisSummary || ""
        );
      }

      res.json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Operation failed" });
    }
  });

  app.post("/api/generate-image", async (req, res) => {
    const { prompt } = req.body;
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          imageConfig: { aspectRatio: "1:1" }
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return res.json({ imageUrl: `data:image/png;base64,${part.inlineData.data}` });
        }
      }
      res.status(500).json({ error: "No image generated" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Image generation failed" });
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
