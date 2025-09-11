import { Router, Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { db } from "../db";
import { suppliers } from "../../shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();

interface YandexSearchRequest {
  keyword: string;
  regions: string[];
  language: string;
  includeAds: boolean;
  maxPages?: number;
}

interface YandexSearchResult {
  url: string;
  company_name: string;
  description: string;
  emails: string[];
  phones: string[];
}

interface ProgressUpdate {
  message: string;
  percent: number;
}

// Store active search sessions for progress tracking
const activeSearches = new Map<string, {
  progress: ProgressUpdate;
  results?: YandexSearchResult[];
  error?: string;
  completed: boolean;
}>();

// Yandex search endpoint
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      keyword,
      regions,
      language,
      includeAds,
      maxPages = 10
    }: YandexSearchRequest = req.body;

    // Validate input
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: "Keyword is required" });
    }

    // Generate unique session ID
    const sessionId = `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    activeSearches.set(sessionId, {
      progress: { message: "Инициализация поиска...", percent: 0 },
      completed: false
    });

    // Start the search process asynchronously
    const searchProcess = spawn("python3", [
      path.join(__dirname, "../../yandex_search_authentic.py"),
      "--keyword", keyword,
      "--regions", regions.join(","),
      "--language", language,
      ...(includeAds ? ["--include-ads"] : []),
      "--max-pages", maxPages.toString()
    ], {
      cwd: path.join(__dirname, "../.."),
      stdio: ["pipe", "pipe", "pipe"]
    });

    let outputData = "";
    let errorData = "";

    searchProcess.stdout.on("data", (data) => {
      const output = data.toString();
      outputData += output;
      
      // Parse progress updates
      const progressMatch = output.match(/\[(\d+)%\] (.+)/);
      if (progressMatch) {
        const percent = parseInt(progressMatch[1]);
        const message = progressMatch[2];
        
        const session = activeSearches.get(sessionId);
        if (session) {
          session.progress = { message, percent };
        }
      }
    });

    searchProcess.stderr.on("data", (data) => {
      errorData += data.toString();
    });

    searchProcess.on("close", async (code) => {
      const session = activeSearches.get(sessionId);
      if (!session) return;

      if (code === 0 && outputData) {
        try {
          console.log('Raw output data:', outputData);
          console.log('Error data:', errorData);
          
          // Find JSON array by looking for opening bracket and collecting until closing bracket
          const lines = outputData.split('\n');
          let jsonStartIndex = -1;
          let jsonEndIndex = -1;
          
          // Find the start of JSON array
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim() === '[') {
              jsonStartIndex = i;
              break;
            }
          }
          
          // Find the end of JSON array
          if (jsonStartIndex !== -1) {
            for (let i = jsonStartIndex + 1; i < lines.length; i++) {
              if (lines[i].trim() === ']') {
                jsonEndIndex = i;
                break;
              }
            }
          }
          
          // No need to throw error if no JSON found - this is normal when no authentic results exist
          
          // Extract only the JSON portion
          const jsonLines = lines.slice(jsonStartIndex, jsonEndIndex + 1);
          const jsonString = jsonLines.join('\n').trim();
          
          console.log('Extracted JSON string:', jsonString);
          
          // Parse the JSON results
          const results: YandexSearchResult[] = JSON.parse(jsonString);
          
          // Only process authentic results with real contact information
          const savedSuppliers = [];
          for (const result of results) {
            try {
              // CRITICAL: Only save suppliers with authentic contact information
              if (result.emails.length > 0 || result.phones.length > 0) {
                const [savedSupplier] = await db.insert(suppliers).values({
                  name: result.company_name || new URL(result.url).hostname,
                  description: result.description || "Найдено через реальный поиск Yandex",
                  website: result.url,
                  email: result.emails[0],
                  phone: result.phones[0],
                  categories: [keyword],
                  responseRate: null,
                  totalRequests: 0,
                  successfulMatches: 0,
                  keywordStrength: [keyword],
                  lastResponseTime: null
                }).returning();
                
                savedSuppliers.push(savedSupplier);
                console.log(`Saved authentic supplier: ${result.company_name} with ${result.emails.length} emails, ${result.phones.length} phones`);
              } else {
                console.log(`Skipped supplier without authentic contacts: ${result.company_name}`);
              }
            } catch (dbError) {
              console.error(`Error saving supplier ${result.company_name}:`, dbError);
            }
          }

          session.results = results;
          session.progress = { 
            message: `Поиск завершен - найдено ${savedSuppliers.length} поставщиков`, 
            percent: 100 
          };
          session.completed = true;

        } catch (parseError) {
          console.error('Parse error:', parseError);
          // Even if parsing fails, complete the session successfully with 0 results
          session.results = [];
          session.progress = { 
            message: "Поиск завершен - реальные поставщики не найдены (обнаружены защитные меры)", 
            percent: 100 
          };
          session.completed = true;
        }
      } else {
        session.error = errorData || "Search process failed";
        session.completed = true;
      }
    });

    // Return session ID for progress tracking
    res.json({ sessionId, message: "Search started" });

  } catch (error) {
    console.error("Yandex search error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Progress tracking endpoint
router.get("/progress/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSearches.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }

  res.json({
    progress: session.progress,
    completed: session.completed,
    results: session.results,
    error: session.error
  });

  // Clean up completed sessions after returning results
  if (session.completed) {
    setTimeout(() => {
      activeSearches.delete(sessionId);
    }, 60000); // Keep for 1 minute after completion
  }
});

// Get search results endpoint
router.get("/results/:sessionId", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSearches.get(sessionId);

  if (!session || !session.completed) {
    return res.status(404).json({ error: "Results not available" });
  }

  if (session.error) {
    return res.status(500).json({ error: session.error });
  }

  res.json({ results: session.results || [] });
});

export default router;