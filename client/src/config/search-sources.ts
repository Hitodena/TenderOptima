// Конфигурация поисковых систем на основе географии
// Этот файл содержит настройки для автоматического выбора поисковых систем
// в зависимости от выбранных регионов

export interface SearchSourceConfig {
  // Страны, для которых используется Яндекс
  yandexCountries: string[];
  // Страны, для которых используется Google
  googleCountries: string[];
  // По умолчанию включен поиск по реестру
  registryEnabledByDefault: boolean;
}

// Текущая конфигурация поисковых систем
export const searchSourceConfig: SearchSourceConfig = {
  // Страны, где Яндекс работает лучше всего
  yandexCountries: [
    'Россия',
    'Беларусь', 
    'Казахстан',
    'Турция'
  ],
  
  // Для всех остальных стран используем Google
  googleCountries: [
    // Все остальные страны из regionsData будут использовать Google
    // Этот массив можно расширить, если потребуется явно указать страны для Google
  ],
  
  // По умолчанию поиск по реестру выключен (так как он еще не готов)
  registryEnabledByDefault: false
};

/**
 * Определяет, какую поисковую систему использовать для указанной страны
 * @param countryName - название страны
 * @returns объект с настройками поисковых систем
 */
export function getSearchSourcesForCountry(countryName: string): {
  useYandex: boolean;
  useGoogle: boolean;
  useRegistry: boolean;
} {
  const isYandexCountry = searchSourceConfig.yandexCountries.includes(countryName);
  
  return {
    useYandex: isYandexCountry,
    useGoogle: !isYandexCountry,
    useRegistry: searchSourceConfig.registryEnabledByDefault
  };
}

/**
 * Определяет поисковые системы для списка выбранных регионов
 * @param selectedRegions - массив выбранных регионов
 * @returns объект с настройками поисковых систем
 */
export function getSearchSourcesForRegions(selectedRegions: Array<{name: string; googleCode: string; yandexId: number; type: 'country' | 'region' | 'city'}>): {
  useYandex: boolean;
  useGoogle: boolean;
  useRegistry: boolean;
} {
  if (selectedRegions.length === 0) {
    // Если регионы не выбраны, используем настройки по умолчанию
    return {
      useYandex: false,
      useGoogle: true,
      useRegistry: searchSourceConfig.registryEnabledByDefault
    };
  }

  // Определяем страны из выбранных регионов
  const countries = new Set<string>();
  
  selectedRegions.forEach(region => {
    if (region.type === 'country') {
      countries.add(region.name);
    } else if (region.type === 'region' || region.type === 'city') {
      // Для регионов и городов нужно найти родительскую страну
      // Это можно сделать через googleCode или найти в regionsData
      // Пока используем простой подход - определяем по googleCode
      const countryName = getCountryNameByGoogleCode(region.googleCode);
      if (countryName) {
        countries.add(countryName);
      }
    }
  });

  // Если есть хотя бы одна страна для Яндекса, используем Яндекс
  const hasYandexCountry = Array.from(countries).some(country => 
    searchSourceConfig.yandexCountries.includes(country)
  );

  return {
    useYandex: hasYandexCountry,
    useGoogle: !hasYandexCountry,
    useRegistry: searchSourceConfig.registryEnabledByDefault
  };
}

/**
 * Получает название страны по Google коду
 * @param googleCode - код страны в Google
 * @returns название страны или null
 */
function getCountryNameByGoogleCode(googleCode: string): string | null {
  // Маппинг кодов стран на названия
  const countryCodeMap: Record<string, string> = {
    'ru': 'Россия',
    'by': 'Беларусь',
    'kz': 'Казахстан',
    'tr': 'Турция',
    'us': 'США',
    'de': 'Германия',
    'fr': 'Франция',
    'gb': 'Великобритания',
    'it': 'Италия',
    'es': 'Испания',
    'pl': 'Польша',
    'cn': 'Китай',
    'jp': 'Япония',
    'kr': 'Южная Корея',
    'au': 'Австралия',
    'ca': 'Канада',
    'br': 'Бразилия',
    'in': 'Индия',
    // Добавьте другие страны по необходимости
  };

  return countryCodeMap[googleCode] || null;
}
