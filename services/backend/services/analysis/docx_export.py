import io
from datetime import date

from docx import Document
from docx.shared import Pt
from docx.styles.style import ParagraphStyle

from backend.enums import TZAnalysisStatus
from backend.schemas.analysis import TZAnalysisItem


def build_clarification_docx(
    items: list[TZAnalysisItem],
    selected_indices: list[int],
    organization: str,
    deadline_date: str | None = None,
) -> bytes:
    """Build a DOCX letter requesting clarifications from the supplier."""
    doc = Document()
    normal = doc.styles["Normal"]
    if isinstance(normal, ParagraphStyle):
        normal.font.name = "Times New Roman"
        normal.font.size = Pt(12)

    title = doc.add_paragraph()
    title.add_run(
        "О несоответствии предложения техническим требованиям"
    ).bold = True

    doc.add_paragraph(
        "Проведён анализ вашего предложения по соответствию "
        "техническому заданию."
    )
    doc.add_paragraph("Выявлены следующие замечания и требуемые уточнения:")

    selected = [
        items[i]
        for i in selected_indices
        if 0 <= i < len(items)
        and items[i].status
        in (
            TZAnalysisStatus.PARTIAL,
            TZAnalysisStatus.MISSING,
            TZAnalysisStatus.NOT_FOUND,
        )
    ]

    mismatches = [
        it for it in selected if it.status == TZAnalysisStatus.MISSING
    ]
    clarifications = [
        it
        for it in selected
        if it.status in (TZAnalysisStatus.PARTIAL, TZAnalysisStatus.NOT_FOUND)
    ]

    if mismatches:
        doc.add_paragraph()
        p = doc.add_paragraph()
        p.add_run("Несоответствующие параметры:").bold = True
        for idx, item in enumerate(mismatches, start=1):
            doc.add_paragraph(f"{idx}. По пункту:")
            doc.add_paragraph(
                f'Требование: "{item.requirement}"'
                + (
                    f" ({item.requirement_ref})"
                    if item.requirement_ref
                    else ""
                )
            )
            if item.offer_value:
                doc.add_paragraph(
                    f'Предложено: "{item.offer_value}"'
                    + (f" ({item.offer_ref})" if item.offer_ref else "")
                )
            doc.add_paragraph(f"Причина отклонения: {item.explanation}")

    if clarifications:
        doc.add_paragraph()
        p = doc.add_paragraph()
        p.add_run("Требуют уточнения/дополнения:").bold = True
        start = len(mismatches) + 1
        for offset, item in enumerate(clarifications):
            n = start + offset
            doc.add_paragraph(f"{n}. Пункт:")
            doc.add_paragraph(
                f'Требуется: "{item.requirement}"'
                + (
                    f" ({item.requirement_ref})"
                    if item.requirement_ref
                    else ""
                )
            )
            if item.offer_value:
                doc.add_paragraph(
                    f'Предложено: "{item.offer_value}"'
                    + (f" ({item.offer_ref})" if item.offer_ref else "")
                )
            doc.add_paragraph(f"Необходимо: {item.explanation}")

    deadline = deadline_date or "7 дней"
    doc.add_paragraph()
    doc.add_paragraph(
        f"Просим предоставить дополненное/уточненное предложение "
        f"не позже {deadline}."
    )
    doc.add_paragraph()
    doc.add_paragraph("С уважением,")
    doc.add_paragraph()
    doc.add_paragraph(organization or "[Наименование организации]")
    doc.add_paragraph(date.today().strftime("%d %B %Y г."))

    buffer = io.BytesIO()
    doc.save(buffer)
    return buffer.getvalue()


def build_clarification_preview(
    items: list[TZAnalysisItem],
    selected_indices: list[int],
    organization: str,
    deadline_date: str | None = None,
) -> tuple[str, list[str], bool]:
    """Build plain-text preview paragraphs for the clarification letter."""
    selected = [
        items[i]
        for i in selected_indices
        if 0 <= i < len(items)
        and items[i].status
        in (
            TZAnalysisStatus.PARTIAL,
            TZAnalysisStatus.MISSING,
            TZAnalysisStatus.NOT_FOUND,
        )
    ]

    mismatches = [
        it for it in selected if it.status == TZAnalysisStatus.MISSING
    ]
    clarifications = [
        it
        for it in selected
        if it.status in (TZAnalysisStatus.PARTIAL, TZAnalysisStatus.NOT_FOUND)
    ]
    has_issues = bool(mismatches or clarifications)

    paragraphs: list[str] = [
        "О несоответствии предложения техническим требованиям",
        "",
        "Проведён анализ вашего предложения по соответствию "
        "техническому заданию.",
        "Выявлены следующие замечания и требуемые уточнения:",
    ]

    if mismatches:
        paragraphs.extend(["", "Несоответствующие параметры:"])
        for idx, item in enumerate(mismatches, start=1):
            paragraphs.append(f"{idx}. По пункту:")
            req = f'Требование: "{item.requirement}"'
            if item.requirement_ref:
                req += f" ({item.requirement_ref})"
            paragraphs.append(req)
            if item.offer_value:
                offer = f'Предложено: "{item.offer_value}"'
                if item.offer_ref:
                    offer += f" ({item.offer_ref})"
                paragraphs.append(offer)
            paragraphs.append(f"Причина отклонения: {item.explanation}")

    if clarifications:
        paragraphs.extend(["", "Требуют уточнения/дополнения:"])
        start = len(mismatches) + 1
        for offset, item in enumerate(clarifications):
            n = start + offset
            paragraphs.append(f"{n}. Пункт:")
            req = f'Требуется: "{item.requirement}"'
            if item.requirement_ref:
                req += f" ({item.requirement_ref})"
            paragraphs.append(req)
            if item.offer_value:
                offer = f'Предложено: "{item.offer_value}"'
                if item.offer_ref:
                    offer += f" ({item.offer_ref})"
                paragraphs.append(offer)
            paragraphs.append(f"Необходимо: {item.explanation}")

    deadline = deadline_date or "7 дней"
    paragraphs.extend(
        [
            "",
            f"Просим предоставить дополненное/уточненное предложение "
            f"не позже {deadline}.",
            "",
            "С уважением,",
            "",
            organization or "[Наименование организации]",
            date.today().strftime("%d %B %Y г."),
        ]
    )

    return (
        "О несоответствии предложения техническим требованиям",
        paragraphs,
        has_issues,
    )
