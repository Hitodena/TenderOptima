# TenderOptima product promo

Скрипт сборки 30–40 с продуктового ролика из медиа лендинга.

## Выходы

| Файл | Формат | Назначение |
|------|--------|------------|
| `services/frontend/public/landing/promo/tenderoptima-promo-16x9.mp4` | 1920×1080 | Лендинг, YouTube, LinkedIn |
| `services/frontend/public/landing/promo/tenderoptima-promo-9x16.mp4` | 1080×1920 | Reels / Stories / Shorts |

## Пересборка

```powershell
python marketing/promo/build_promo_video.py --aspect both
# или только один формат:
python marketing/promo/build_promo_video.py --aspect 16x9
```

Зависимости: `pip install moviepy pillow imageio imageio-ffmpeg`

## Структура ролика

| Сек | Содержание | Источник |
|-----|------------|----------|
| 0–4 | Хаос закупок → логотип | титры + wordmark |
| 4–10 | Поиск поставщиков | `supplier_flow.gif` |
| 10–18 | Рассылка запросов | mock рассылки + `letter.png` |
| 18–26 | Входящие / переписка | `email_chat.png` |
| 26–34 | AI-анализ ТЗ/КП | upload → analyze → edit_refs → compare |
| 34–40 | Отчёт + CTA | `supplier_table` / `excel` + финал |

Титры на кадрах читаются без звука. Палитра: `#0F172A` / `#0369A1` / `#F8FAFC`.
