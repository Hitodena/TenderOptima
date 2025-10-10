/**
 * Очищает тему письма от служебных тегов [REQ-...] и [TID:...]
 * @param subject - исходная тема письма
 * @returns очищенная тема письма
 */
export function cleanEmailSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  
  // Удаляем теги [REQ-...] и [TID:...] включая пробелы и знак "-" перед ними
  let cleaned = subject
    .replace(/\s*-\s*\[REQ-[^\]]+\]\s*/g, ' ') // Удаляем - [REQ-...]
    .replace(/\s*-\s*\[TID:[^\]]+\]\s*/g, ' ') // Удаляем - [TID:...]
    .replace(/\s*\[REQ-[^\]]+\]\s*/g, ' ') // Удаляем [REQ-...] без дефиса
    .replace(/\s*\[TID:[^\]]+\]\s*/g, ' ') // Удаляем [TID:...] без дефиса
    .replace(/\s*-\s*$/, '') // Удаляем дефис в конце строки
    .replace(/\s+/g, ' ') // Заменяем множественные пробелы на один
    .trim(); // Убираем пробелы в начале и конце
  
  return cleaned;
}

/**
 * Проверяет, содержит ли тема письма служебные теги
 * @param subject - тема письма
 * @returns true, если содержит служебные теги
 */
export function hasServiceTags(subject: string | null | undefined): boolean {
  if (!subject) return false;
  return /\[REQ-[^\]]+\]|\[TID:[^\]]+\]/.test(subject);
}
