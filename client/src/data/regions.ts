// Общие данные регионов для всего приложения
// Этот файл является единым источником истины для всех регионов

export type City = { name: string; yandexId: number };
export type Region = { name: string; yandexId: number; cities: City[] };
export type Country = { name: string; googleCode: string; yandexId: number; regions: Region[] };
export type SelectedRegion = { name: string; googleCode: string; yandexId: number; type: 'country' | 'region' | 'city' };

// Иерархическая и полная структура данных регионов
export const regionsData: Country[] = [
  { name: "Россия", googleCode: "ru", yandexId: 225, regions: [
      { name: "Центральный ФО", yandexId: 3, cities: [{ name: "Москва", yandexId: 213 }]},
      { name: "Северо-Западный ФО", yandexId: 17, cities: [{ name: "Санкт-Петербург", yandexId: 2 }]},
      { name: "Южный ФО", yandexId: 35, cities: [{ name: "Ростов-на-Дону", yandexId: 39 }]},
      { name: "Северо-Кавказский ФО", yandexId: 26, cities: []},
      { name: "Приволжский ФО", yandexId: 41, cities: [{ name: "Казань", yandexId: 43 }, { name: "Нижний Новгород", yandexId: 47 }, { name: "Самара", yandexId: 46 }]},
      { name: "Уральский ФО", yandexId: 56, cities: [{ name: "Екатеринбург", yandexId: 54 }, { name: "Челябинск", yandexId: 56 }]},
      { name: "Сибирский ФО", yandexId: 54, cities: [{ name: "Новосибирск", yandexId: 65 }, { name: "Омск", yandexId: 66 }]},
      { name: "Дальневосточный ФО", yandexId: 73, cities: []},
  ]},
  { name: "Австралия", googleCode: "au", yandexId: 129, regions: [] },
  { name: "Австрия", googleCode: "at", yandexId: 130, regions: [] },
  { name: "Армения", googleCode: "am", yandexId: 169, regions: [] },
  { name: "Беларусь", googleCode: "by", yandexId: 149, regions: [
      { name: "г. Минск", yandexId: 157, cities: [] },
      { name: "Брестская область", yandexId: 150, cities: [
          { name: "Брест", yandexId: 151 },
          { name: "Барановичи", yandexId: 152 },
          { name: "Пинск", yandexId: 153 }
        ]},
      { name: "Витебская область", yandexId: 154, cities: [
          { name: "Витебск", yandexId: 155 },
          { name: "Новополоцк", yandexId: 156 },
          { name: "Орша", yandexId: 157 },
          { name: "Полоцк", yandexId: 158 }
        ]},
      { name: "Гомельская область", yandexId: 159, cities: [
          { name: "Гомель", yandexId: 160 },
          { name: "Мозырь", yandexId: 161 },
          { name: "Жлобин", yandexId: 162 }
        ]},
      { name: "Гродненская область", yandexId: 163, cities: [
          { name: "Гродно", yandexId: 164 },
          { name: "Лида", yandexId: 165 }
        ]},
      { name: "Минская область", yandexId: 166, cities: [
          { name: "Борисов", yandexId: 167 },
          { name: "Солигорск", yandexId: 168 },
          { name: "Молодечно", yandexId: 169 }
        ]},
      { name: "Могилёвская область", yandexId: 170, cities: [
          { name: "Могилёв", yandexId: 171 },
          { name: "Бобруйск", yandexId: 172 }
        ]}
    ]},
  { name: "Бельгия", googleCode: "be", yandexId: 131, regions: [] },
  { name: "Болгария", googleCode: "bg", yandexId: 132, regions: [] },
  { name: "Бразилия", googleCode: "br", yandexId: 233, regions: [] },
  { name: "Великобритания", googleCode: "gb", yandexId: 12, regions: [] },
  { name: "Венгрия", googleCode: "hu", yandexId: 135, regions: [] },
  { name: "Германия", googleCode: "de", yandexId: 132, regions: [] },
  { name: "Греция", googleCode: "gr", yandexId: 133, regions: [] },
  { name: "Грузия", googleCode: "ge", yandexId: 169, regions: [] },
  { name: "Дания", googleCode: "dk", yandexId: 134, regions: [] },
  { name: "Египет", googleCode: "eg", yandexId: 86, regions: [] },
  { name: "Израиль", googleCode: "il", yandexId: 131, regions: [] },
  { name: "Индия", googleCode: "in", yandexId: 236, regions: [] },
  { name: "Испания", googleCode: "es", yandexId: 137, regions: [] },
  { name: "Италия", googleCode: "it", yandexId: 138, regions: [] },
  { name: "Казахстан", googleCode: "kz", yandexId: 159, regions: [] },
  { name: "Канада", googleCode: "ca", yandexId: 104, regions: [] },
  { name: "Кипр", googleCode: "cy", yandexId: 984, regions: [] },
  { name: "Киргизия", googleCode: "kg", yandexId: 164, regions: [] },
  { name: "Китай", googleCode: "cn", yandexId: 134, regions: [] },
  { name: "Латвия", googleCode: "lv", yandexId: 115, regions: [] },
  { name: "Литва", googleCode: "lt", yandexId: 114, regions: [] },
  { name: "Нидерланды", googleCode: "nl", yandexId: 140, regions: [] },
  { name: "Норвегия", googleCode: "no", yandexId: 141, regions: [] },
  { name: "ОАЭ", googleCode: "ae", yandexId: 971, regions: [] },
  { name: "Польша", googleCode: "pl", yandexId: 142, regions: [] },
  { name: "Португалия", googleCode: "pt", yandexId: 143, regions: [] },
  { name: "Румыния", googleCode: "ro", yandexId: 144, regions: [] },
  { name: "Сербия", googleCode: "rs", yandexId: 11232, regions: [] },
  { name: "Словакия", googleCode: "sk", yandexId: 145, regions: [] },
  { name: "Словения", googleCode: "si", yandexId: 146, regions: [] },
  { name: "США", googleCode: "us", yandexId: 84, regions: [] },
  { name: "Таиланд", googleCode: "th", yandexId: 118, regions: [] },
  { name: "Турция", googleCode: "tr", yandexId: 983, regions: [] },
  { name: "Узбекистан", googleCode: "uz", yandexId: 166, regions: [] },
  { name: "Финляндия", googleCode: "fi", yandexId: 147, regions: [] },
  { name: "Франция", googleCode: "fr", yandexId: 148, regions: [] },
  { name: "Хорватия", googleCode: "hr", yandexId: 150, regions: [] },
  { name: "Черногория", googleCode: "me", yandexId: 11233, regions: [] },
  { name: "Чехия", googleCode: "cz", yandexId: 153, regions: [] },
  { name: "Швейцария", googleCode: "ch", yandexId: 154, regions: [] },
  { name: "Швеция", googleCode: "se", yandexId: 155, regions: [] },
  { name: "Эстония", googleCode: "ee", yandexId: 116, regions: [] },
  { name: "Южная Корея", googleCode: "kr", yandexId: 10758, regions: [] },
  { name: "Япония", googleCode: "jp", yandexId: 133, regions: [] },
].sort((a, b) => a.name.localeCompare(b.name));

// Создаем плоский список всех регионов и подрегионов для обратной совместимости
export const allRegionsList = regionsData.flatMap(country => {
  const countryName = country.name;
  const regions = country.regions.flatMap(region => {
    const regionName = region.name;
    const cities = region.cities.map(city => city.name);
    return [regionName, ...cities];
  });
  return [countryName, ...regions];
});

// Функция для получения всех доступных регионов в простом формате (для совместимости)
export const getSimpleRegionsList = (): string[] => {
  return allRegionsList;
};

// Функция для поиска региона по имени
export const findRegionByName = (name: string): SelectedRegion | null => {
  for (const country of regionsData) {
    // Проверяем страну
    if (country.name === name) {
      return {
        name: country.name,
        googleCode: country.googleCode,
        yandexId: country.yandexId,
        type: 'country'
      };
    }
    
    // Проверяем регионы
    for (const region of country.regions) {
      if (region.name === name) {
        return {
          name: region.name,
          googleCode: country.googleCode,
          yandexId: region.yandexId,
          type: 'region'
        };
      }
      
      // Проверяем города
      for (const city of region.cities) {
        if (city.name === name) {
          return {
            name: city.name,
            googleCode: country.googleCode,
            yandexId: city.yandexId,
            type: 'city'
          };
        }
      }
    }
  }
  
  return null;
};
