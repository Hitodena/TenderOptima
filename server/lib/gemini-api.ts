import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from 'mammoth';
import * as fs from 'fs';

async function extractTextFromDocx(filePath: string): Promise<string> {
  console.log(`📄 Извлечение текста из DOCX: ${filePath}`);
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer });
  
  if (!result.value || result.value.trim().length === 0) {
    throw new Error('Извлеченный текст пуст');
  }
  
  console.log(`✅ Извлечено ${result.value.length} символов`);
  return result.value;
}

export async function analyzeWithGeminiFiles(
  tzFilePath: string,
  kpFilePath: string
): Promise<string> {
  
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не найден в переменных окружения");
  }

  console.log("🤖 Инициализация Gemini AI...");
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  console.log("📤 Извлечение текста из документов...");
  const tzText = await extractTextFromDocx(tzFilePath);
  const kpText = await extractTextFromDocx(kpFilePath);

  console.log("📝 Формирование промпта...");
  const prompt = `
Ты — эксперт по анализу тендерной документации. Ниже два документа в текстовом формате.

=== ТЕХНИЧЕСКОЕ ЗАДАНИЕ (ТЗ) ===
${tzText}

=== КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ (КП) ===
${kpText}

=== ЗАДАЧА ===
Для каждого числового или текстового параметра/требования из ТЗ найди соответствующее значение в КП и определи, соответствует ли предложение требованиям.

Результат должен быть представлен в виде массива JSON объектов. Каждый объект представляет одно требование:
{
  "requirement_id": "номер пункта из ТЗ (например, '4.1.1')",
  "requirement_text": "полный текст требования из ТЗ",
  "supplier_value": "соответствующее значение или текст из КП. Если не найдено: 'не найдено'",
  "compliance_status": "статус ('compliant', 'non-compliant', 'partially-compliant', 'not-found')",
  "reasoning": "краткое объяснение на русском языке"
}

КРИТИЧЕСКИ ВАЖНО: Проанализируй АБСОЛЮТНО ВСЕ пункты из ВСЕХ разделов ТЗ. НЕ ПРОПУСКАЙ НИ ОДНОГО.

Твой ответ должен содержать ТОЛЬКО JSON массив, без каких-либо вступлений или заключений.
`;

  console.log("🚀 Отправка запроса к Gemini API...");
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const analysisResult = response.text();
    
    console.log("✅ Ответ успешно получен от Gemini");
    return analysisResult;
    
  } catch (error) {
    console.error("❌ Ошибка при вызове Gemini API:", error);
    throw error;
  }
}
