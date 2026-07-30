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
        title="Реестр cookie TenderOptima",
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
            p("Cookie", cell_bold),
            p("Что делают", cell_bold),
            p("Тип", cell_bold),
            p("Срок", cell_bold),
        ],
        [
            p("<b>sf_token</b>"),
            p(
                "Хранит JWT access token авторизованного пользователя. "
                "Нужен для доступа к API личного кабинета (Bearer token "
                "берётся из cookie). SameSite=Lax; Secure только в production."
            ),
            p("Технические / функциональные (necessary)"),
            p(
                "30 суток (maxAge = 2 592 000 с).<br/>"
                "Совпадает со сроком JWT (30 дней)."
            ),
        ],
        [
            p("<b>to_cookie_consent</b>"),
            p(
                "Сохраняет выбор пользователя по категориям cookie: "
                "necessary (всегда true), analytics, marketing, а также дату "
                "сохранения (savedAt). Используется баннером согласия и "
                "блокирует аналитические cookie до согласия."
            ),
            p("Технические / функциональные (necessary)"),
            p("180 суток (maxAge = 15 552 000 с)."),
        ],
        [
            p("<b>to_utm</b>"),
            p(
                "Сохраняет UTM-метки первого визита (utm_source, utm_medium, "
                "utm_campaign, utm_content), чтобы передать их при отправке "
                "формы консультации / лида. Пишется только при согласии на "
                "analytics; при отказе очищается."
            ),
            p("Аналитические (analytics)"),
            p(
                "30 суток (maxAge = 2 592 000 с).<br/>"
                "Либо до отзыва от analytics."
            ),
        ],
        [
            p("<b>to_business_card_hint_seen</b>"),
            p(
                "Флаг, что пользователь уже видел / закрыл подсказку про "
                "визитку при первом поиске поставщиков. Предотвращает "
                "повторный показ онбординга."
            ),
            p("Технические / функциональные (necessary)"),
            p("365 суток (maxAge = 31 536 000 с)."),
        ],
    ]

    table = Table(
        rows,
        colWidths=[45 * mm, 130 * mm, 50 * mm, 50 * mm],
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
