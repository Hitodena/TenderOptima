"""Generate TenderOptima first-party cookies inventory PDF."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Table, TableStyle

pdfmetrics.registerFont(TTFont("Arial", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", r"C:\Windows\Fonts\arialbd.ttf"))

OUT = Path(
    r"d:\Coding\Work\andrei_d\TenderOptima"
    r"\services\frontend\public\legal\cookies-inventory.pdf"
)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
        title="Реестр файлов cookie TenderOptima",
        author="TenderOptima",
    )

    styles = getSampleStyleSheet()
    cell = ParagraphStyle(
        "CellRu",
        parent=styles["Normal"],
        fontName="Arial",
        fontSize=8,
        leading=11,
        alignment=TA_LEFT,
    )
    cell_bold = ParagraphStyle(
        "CellBoldRu",
        parent=styles["Normal"],
        fontName="Arial-Bold",
        fontSize=8,
        leading=11,
        alignment=TA_LEFT,
    )

    def p(text: str, style: ParagraphStyle = cell) -> Paragraph:
        return Paragraph(text.replace("\n", "<br/>"), style)

    rows = [
        [
            p("Название", cell_bold),
            p("Что делают", cell_bold),
            p("Тип", cell_bold),
            p("Срок хранения", cell_bold),
        ],
        [
            p("<b>sf_token</b>"),
            p(
                "Сохраняет признак входа пользователя в личный кабинет. "
                "Без этого файла после авторизации недоступны защищённые "
                "разделы сервиса и работа с запросами, перепиской и анализом."
            ),
            p("Технические (обязательные)"),
            p("30 суток"),
        ],
        [
            p("<b>to_cookie_consent</b>"),
            p(
                "Сохраняет выбор пользователя о разрешённых категориях "
                "файлов cookie. Без этого файла баннер согласия не сможет "
                "запомнить решение и корректно применять настройки."
            ),
            p("Технические (обязательные)"),
            p("180 суток"),
        ],
        [
            p("<b>i18n_redirected</b>"),
            p(
                "Служебный файл модуля локализации интерфейса. "
                "Запоминает, что язык браузера уже определялся, чтобы "
                "показывать сайт на русском языке и не выполнять повторные "
                "перенаправления. Без него возможны сбои при выборе языка "
                "интерфейса. Уточнено у IT: выставляется модулем локализации "
                "сайта (ранее значился как неизвестный)."
            ),
            p("Технические (обязательные)"),
            p("1 год (по умолчанию модуля локализации)"),
        ],
        [
            p("<b>to_business_card_hint_seen</b>"),
            p(
                "Запоминает, что пользователь уже видел или закрыл подсказку "
                "про визитку при первом поиске поставщиков. Нужен только "
                "для удобства: сайт работает и без него, повторный показ "
                "подсказки будет чаще."
            ),
            p("Технические (функциональные)"),
            p("365 суток"),
        ],
        [
            p("<b>to_utm</b>"),
            p(
                "Сохраняет метки рекламного или партнёрского перехода "
                "при первом визите, чтобы передать их при отправке заявки "
                "на консультацию. Записывается только после согласия на "
                "аналитические файлы cookie; при отказе удаляется."
            ),
            p("Аналитические"),
            p("30 суток, либо до отзыва от аналитических файлов cookie"),
        ],
    ]

    table = Table(
        rows,
        colWidths=[48 * mm, 128 * mm, 48 * mm, 48 * mm],
        repeatRows=1,
    )
    table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Arial"),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#f8fafc")),
                ("BACKGROUND", (0, 3), (-1, 3), colors.HexColor("#f8fafc")),
                ("BACKGROUND", (0, 5), (-1, 5), colors.HexColor("#f8fafc")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )

    doc.build([table])
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
