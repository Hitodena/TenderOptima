/**
 * Утилита для более качественного анализа и структурирования данных из ответа AI
 */

// Интерфейс для результатов парсинга
export interface ParsedAnalysisResult {
  suppliers: string[];
  data: Record<string, Record<string, string>>;
  formattedAnalysis: string;
  advantages: Record<string, string>;
  disadvantages: Record<string, string>;
  recommendations: {
    primary?: string;
    secondary?: string;
    text: string;
  };
  sections: Record<string, string>;
}

/**
 * Парсит текст AI-анализа и извлекает структурированные данные
 * @param aiAnalysis Текст анализа от AI
 * @returns Структурированные данные для отображения
 */
export function parseAnalysisContent(aiAnalysis: string | null): ParsedAnalysisResult {
  if (!aiAnalysis) {
    return { 
      suppliers: [], 
      data: {}, 
      formattedAnalysis: '',
      advantages: {},
      disadvantages: {},
      recommendations: { text: '' },
      sections: {}
    };
  }

  try {
    // Базовые структуры для данных
    const data: Record<string, Record<string, string>> = {};
    const suppliers: string[] = [];
    const advantages: Record<string, string> = {};
    const disadvantages: Record<string, string> = {};
    const sections: Record<string, string> = {};
    const recommendations: { primary?: string; secondary?: string; text: string } = { text: '' };

    // Очистка и нормализация текста
    const cleanText = aiAnalysis
      .replace(/<\/?[^>]+(>|$)/g, '') // Удаление HTML тегов
      .replace(/###\s+/g, '### ') // Нормализация заголовков секций
      .replace(/\n{3,}/g, '\n\n') // Нормализация переносов строк
      .trim();

    // Разделение текста на секции с помощью маркеров ###
    const sectionPattern = /### (.*?)\n([\s\S]*?)(?=### |$)/g;
    let match;
    const sectionMatches: RegExpExecArray[] = [];
    while ((match = sectionPattern.exec(cleanText)) !== null) {
      sectionMatches.push(match);
    }

    // Обработка секций
    sectionMatches.forEach(match => {
      const sectionName = match[1]?.trim();
      const sectionContent = match[2]?.trim();
      
      if (sectionName && sectionContent) {
        sections[sectionName] = sectionContent;
        
        // Обработка секции "Анализ предложений"
        if (sectionName.includes('Анализ предложени') || sectionName.includes('Сравнение')) {
          processAnalysisSection(sectionContent, data, suppliers);
        }
        
        // Обработка секции "Рекомендации"
        if (sectionName.includes('Рекомендации')) {
          recommendations.text = sectionContent;
          
          // Пытаемся найти первый и второй выбор
          const primaryMatch = sectionContent.match(/Приоритетный выбор[:\s-]+(.*?)(?=\n|$)/i);
          const secondaryMatch = sectionContent.match(/Второй выбор[:\s-]+(.*?)(?=\n|$)/i);
          
          if (primaryMatch && primaryMatch[1]) {
            recommendations.primary = primaryMatch[1].trim();
          }
          
          if (secondaryMatch && secondaryMatch[1]) {
            recommendations.secondary = secondaryMatch[1].trim();
          }
        }
        
        // Обработка секции "Дополнительно" для преимуществ и недостатков
        if (sectionName.includes('Дополнительно')) {
          // Извлечение преимуществ и недостатков по поставщикам
          extractAdvantagesDisadvantages(sectionContent, advantages, disadvantages, suppliers);
        }
      }
    });

    // Если поставщики не были найдены в анализе данных, ищем их по другим признакам
    if (suppliers.length === 0) {
      // Ищем поставщиков по шаблону "Поставщик Name: данные"
      const supplierPattern = /([\wА-Яа-я\s]+)(?:\s*\(.*?\))?(?::\s*[\d.,]+|:\s*[\wА-Яа-я]+)/g;
      let supplierMatch;
      const foundSuppliers: string[] = [];
      
      while ((supplierMatch = supplierPattern.exec(cleanText)) !== null) {
        if (supplierMatch[1] && supplierMatch[1].trim().length > 2) {
          foundSuppliers.push(supplierMatch[1].trim());
        }
      }
      
      // Фильтруем уникальные имена
      const uniqueSuppliers = foundSuppliers.filter((value, index, self) => 
        self.indexOf(value) === index
      );
      
      if (uniqueSuppliers.length > 0) {
        suppliers.push(...uniqueSuppliers);
      }
    }

    // Форматирование анализа для отображения
    let formattedAnalysis = aiAnalysis;
    
    // Преобразуем текст для лучшей читаемости
    formattedAnalysis = formattedAnalysis
      .replace(/### (.*?)(?=\n)/g, '<h3>$1</h3>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n([^<])/g, '<br>$1');
    
    // Возвращаем структурированные данные
    return {
      suppliers,
      data,
      formattedAnalysis,
      advantages,
      disadvantages,
      recommendations,
      sections
    };
  } catch (error) {
    console.error('Error parsing AI analysis:', error);
    return { 
      suppliers: [], 
      data: {}, 
      formattedAnalysis: aiAnalysis || '',
      advantages: {},
      disadvantages: {},
      recommendations: { text: '' },
      sections: {}
    };
  }
}

/**
 * Обрабатывает секцию анализа для извлечения структурированных данных
 */
function processAnalysisSection(
  sectionContent: string, 
  data: Record<string, Record<string, string>>,
  suppliers: string[]
): void {
  // Ищем параметры сравнения (цена, сроки поставки и т.д.)
  const paramLines = sectionContent.split('\n')
    .filter(line => line.includes(':') && !line.startsWith('-'));
  
  // Маппинг русских названий параметров к ключам
  const paramMapping: Record<string, string> = {
    'цен': 'cost',
    'стоимост': 'cost',
    'без ндс': 'costWithoutVAT',
    'с ндс': 'costWithVAT',
    'за единиц': 'unitCost',
    'срок': 'deliveryTime',
    'достав': 'delivery',
    'поставк': 'deliveryTerms',
    'оплат': 'paymentTerms',
    'гарант': 'warranty',
    'сервис': 'service',
    'резидент': 'resident',
    'действи': 'offerValidity'
  };
  
  // Проходим по строкам с параметрами
  paramLines.forEach(line => {
    // Находим тип параметра по ключевым словам
    let paramKey: string | null = null;
    
    for (const [keyword, key] of Object.entries(paramMapping)) {
      if (line.toLowerCase().includes(keyword)) {
        paramKey = key;
        break;
      }
    }
    
    if (!paramKey) return;
    
    // Ищем значения параметров для поставщиков
    const supplierValuePattern = /([\wА-Яа-я\s]+)(?:\s*\(.*?\))?:\s*([\wА-Яа-я\d\s.,№%()+-]*)/g;
    let svMatch;
    const supplierValues: RegExpExecArray[] = [];
    
    while ((svMatch = supplierValuePattern.exec(line)) !== null) {
      supplierValues.push(svMatch);
    }
    
    supplierValues.forEach(match => {
      const supplierName = match[1]?.trim();
      const value = match[2]?.trim();
      
      if (supplierName && value) {
        // Добавляем поставщика в список, если его там еще нет
        if (!suppliers.includes(supplierName)) {
          suppliers.push(supplierName);
        }
        
        // Создаем структуру для параметра, если ее еще нет
        if (!data[paramKey]) {
          data[paramKey] = {};
        }
        
        // Сохраняем значение параметра для поставщика
        data[paramKey][supplierName] = value;
      }
    });
  });
}

/**
 * Извлекает преимущества и недостатки поставщиков
 */
function extractAdvantagesDisadvantages(
  sectionContent: string,
  advantages: Record<string, string>,
  disadvantages: Record<string, string>,
  suppliers: string[]
): void {
  // Разбиваем по строкам и ищем упоминания поставщиков
  const lines = sectionContent.split('\n');
  
  for (const supplier of suppliers) {
    const supplierPattern = new RegExp(`${supplier}[^:\\n]*:?\\s*([^\\n]+)`, 'i');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Проверяем, содержит ли строка имя поставщика
      if (line.includes(supplier)) {
        // Проверяем, является ли это секцией преимуществ или недостатков
        if (
          line.toLowerCase().includes('преимущ') || 
          line.toLowerCase().includes('достоинств') ||
          line.toLowerCase().includes('плюс')
        ) {
          // Собираем все преимущества в следующих строках до следующего поставщика или раздела
          let advantageText = '';
          let j = i + 1;
          
          while (j < lines.length && 
                !suppliers.some(s => lines[j].includes(s)) && 
                !lines[j].includes('недостат') &&
                !lines[j].includes('минус')) {
            if (lines[j].trim()) {
              advantageText += lines[j].trim() + ' ';
            }
            j++;
          }
          
          if (advantageText) {
            advantages[supplier] = advantageText.trim();
          }
        } else if (
          line.toLowerCase().includes('недостат') || 
          line.toLowerCase().includes('минус')
        ) {
          // Собираем все недостатки в следующих строках до следующего поставщика или раздела
          let disadvantageText = '';
          let j = i + 1;
          
          while (j < lines.length && 
                !suppliers.some(s => lines[j].includes(s)) && 
                !lines[j].includes('преимущ') &&
                !lines[j].includes('плюс')) {
            if (lines[j].trim()) {
              disadvantageText += lines[j].trim() + ' ';
            }
            j++;
          }
          
          if (disadvantageText) {
            disadvantages[supplier] = disadvantageText.trim();
          }
        }
      }
    }
  }
}