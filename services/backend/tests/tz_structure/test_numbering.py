"""Automatic numbering must match what the reader sees in Word."""

from __future__ import annotations

import pytest

from backend.services.tz_structure.docx_reader import read_docx
from backend.services.tz_structure.model import LabelKind
from backend.tests.tz_structure.helpers import (
    ask_word,
    flat_paragraphs,
    visible_labels,
    word_oracle_enabled,
    word_visible,
)
from backend.tests.tz_structure.numbering_cases import CASES


@pytest.mark.parametrize("name", sorted(CASES))
def test_labels_as_in_document(name: str, tmp_path) -> None:
    builder, expected = CASES[name]()
    path = builder.save(tmp_path / f"{name}.docx")
    assert visible_labels(read_docx(path)) == expected


@pytest.fixture(scope="module")
def word_answers(tmp_path_factory):
    if not word_oracle_enabled():
        pytest.skip("set TZ_WORD_ORACLE=1 to compare with Microsoft Word")
    folder = tmp_path_factory.mktemp("oracle")
    paths = {
        name: CASES[name]()[0].save(folder / f"{name}.docx")
        for name in sorted(CASES)
    }
    answers = ask_word(list(paths.values()))
    return {name: (path, answers[str(path)]) for name, path in paths.items()}


@pytest.mark.parametrize("name", sorted(CASES))
def test_word_shows_the_same_numbers(name: str, word_answers) -> None:
    path, items = word_answers[name]
    ours = [
        (paragraph.label, " ".join(paragraph.text.split()))
        for paragraph in flat_paragraphs(read_docx(path))
        if paragraph.text or paragraph.label
    ]
    theirs = word_visible(items)
    assert [text for _, text in ours] == [text for _, text in theirs]
    for (label, text), (word_label, _) in zip(ours, theirs, strict=True):
        if label is not None and label.kind == LabelKind.BULLET:
            assert word_label and not word_label[0].isalnum(), text
        else:
            assert (label.raw if label else "") == word_label, text
