"""Unit, currency and VAT checks before prices of suppliers are ranked.

A price is ranked against other suppliers only when it is the same thing:
the same currency, the same VAT basis and the same unit (or a unit that is
converted exactly: мм→м, кг→т, «за 100 м», «бухта 100 м»). Anything that
cannot be brought to one basis is shown, but gets no percent and cannot be
«лучшая»; the supplier sees a note with the reason.

Deterministic only: no LLM, no exchange rates. Used by the supplier
comparison of module 1 (``api/responses``).
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field

# --------------------------------------------------------------------- units

# dimension → base label; factors below are "base units in one unit"
BASE_LABEL = {
    "length": "м",
    "area": "м²",
    "volume": "л",
    "mass": "кг",
    "count": "шт",
    "set": "компл.",
}

_NUM = r"\d{1,3}(?:[   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?"
_END = r"(?![a-zа-яё0-9²³])"

# (regex, dimension, factor, label). Longer / more specific first.
_UNIT_TABLE: list[tuple[str, str, float, str]] = [
    (r"тыс\.?\s*шт\.?", "count", 1000.0, "тыс. шт"),
    (
        r"(?:кв\.?\s*м|м2|м²|квадратн\w*\s+метр\w*|m2|sq\.?\s*m)",
        "area",
        1.0,
        "м²",
    ),
    (r"(?:см2|см²)", "area", 0.0001, "см²"),
    (r"(?:куб\.?\s*м|м3|м³|кубическ\w*\s+метр\w*|m3)", "volume", 1000.0, "м³"),
    (
        r"(?:пог\.?\s*м|п\.\s*м|м\.\s*п|погонн\w*\s+метр\w*)",
        "length",
        1.0,
        "м",
    ),
    (r"(?:мм|миллиметр\w*|mm)", "length", 0.001, "мм"),
    (r"(?:см|сантиметр\w*|cm)", "length", 0.01, "см"),
    (r"(?:км|километр\w*|km)", "length", 1000.0, "км"),
    (r"(?:м|метр\w*|m)", "length", 1.0, "м"),
    (r"(?:мл|миллилитр\w*|ml)", "volume", 0.001, "мл"),
    (r"(?:л|литр\w*|l)", "volume", 1.0, "л"),
    (r"(?:кг|килограмм\w*|kg)", "mass", 1.0, "кг"),
    (r"(?:гр?|грамм\w*|g)", "mass", 0.001, "г"),
    (r"(?:тн|т|тонн\w*|t)", "mass", 1000.0, "т"),
    (r"(?:шт|штук\w*|штуку|pcs|pc|piece\w*)", "count", 1.0, "шт"),
    (r"(?:компл\w*|к-т|комплект\w*|набор\w*|set)", "set", 1.0, "компл."),
    (r"(?:ед|единиц\w*|unit)", "generic", 1.0, "ед."),
]

# package words: the price is per package; its size must be written
_PACK_WORDS = (
    r"бухт\w*|рулон\w*|упаковк\w*|упак\.?|уп\.?|коробк\w*|кор\.?|мешк\w*|"
    r"мешок|пачк\w*|барабан\w*|катушк\w*|паллет\w*|палет\w*|поддон\w*|"
    r"бочк\w*|канистр\w*|ящик\w*|лист\w*|бобин\w*|флакон\w*|ведр\w*|ведро|"
    r"туб\w*|блок\w*|pack\w*|box\w*|roll\w*|coil\w*|drum\w*|pallet\w*"
)

_UNIT_ALT = "|".join(f"(?:{pattern})" for pattern, *_ in _UNIT_TABLE)
_UNIT_ONLY_RE = re.compile(
    rf"^\s*(?P<n>{_NUM})?\s*(?P<u>{_UNIT_ALT}){_END}\.?\s*$", re.I
)
_PER_RE = re.compile(
    rf"(?:\bза\b|/|\bper\b)\s*(?:1\s+)?(?P<n>{_NUM})?\s*"
    rf"(?P<u>(?:{_PACK_WORDS})|(?:{_UNIT_ALT})){_END}\.?",
    re.I,
)
_PACK_SIZE_RE = re.compile(
    rf"^(?P<pack>{_PACK_WORDS})\s*(?:\(|по\s+|[:\-–—]\s*)?\s*"
    rf"(?P<n>{_NUM})\s*(?P<u>{_UNIT_ALT}){_END}\.?\s*\)?",
    re.I,
)
_PACK_ONLY_RE = re.compile(rf"^(?P<pack>{_PACK_WORDS})(?![a-zа-яё])", re.I)


_PACK_NAMES: list[tuple[str, str]] = [
    ("бухт", "бухта"),
    ("рулон", "рулон"),
    ("упак", "упаковка"),
    ("уп", "упаковка"),
    ("коробк", "коробка"),
    ("кор", "коробка"),
    ("мешк", "мешок"),
    ("мешок", "мешок"),
    ("пачк", "пачка"),
    ("барабан", "барабан"),
    ("катушк", "катушка"),
    ("паллет", "поддон"),
    ("палет", "поддон"),
    ("поддон", "поддон"),
    ("бочк", "бочка"),
    ("канистр", "канистра"),
    ("ящик", "ящик"),
    ("лист", "лист"),
    ("бобин", "бобина"),
    ("флакон", "флакон"),
    ("ведр", "ведро"),
    ("туб", "туба"),
    ("блок", "блок"),
    ("pack", "упаковка"),
    ("box", "коробка"),
    ("roll", "рулон"),
    ("coil", "бухта"),
    ("drum", "барабан"),
    ("pallet", "поддон"),
]


def _pack_name(word: str) -> str:
    """Any case of a package word → its dictionary form («бухту» → «бухта»)."""
    text = word.lower().rstrip(".")
    for stem, name in _PACK_NAMES:
        if text.startswith(stem):
            return name
    return text


@dataclass(frozen=True)
class UnitSpec:
    """What one quoted price is for."""

    dimension: (
        str  # length | area | volume | mass | count | set | generic | pack
    )
    factor: float  # base units in the priced unit (за 100 м → 100)
    label: str  # as shown to the user: «м», «100 м», «бухта 100 м»
    pack_known: bool = True


def _num(token: str | None) -> float | None:
    if not token:
        return None
    cleaned = re.sub(r"[   ]", "", token).replace(",", ".")
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return value if value > 0 else None


def _fmt(value: float) -> str:
    if value == int(value):
        return f"{int(value):,}".replace(",", " ")
    text = f"{value:,.4f}".rstrip("0").rstrip(".")
    return text.replace(",", " ").replace(".", ",")


def _unit_entry(token: str) -> tuple[str, float, str] | None:
    text = token.strip().lower().replace("ё", "е")
    for pattern, dimension, factor, label in _UNIT_TABLE:
        if re.fullmatch(rf"(?:{pattern})\.?", text, re.I):
            return dimension, factor, label
    return None


def _spec_from(n_token: str | None, unit_token: str) -> UnitSpec | None:
    entry = _unit_entry(unit_token)
    if entry is None:
        return None
    dimension, factor, label = entry
    count = _num(n_token) or 1.0
    shown = label if count == 1 else f"{_fmt(count)} {label}"
    return UnitSpec(dimension, factor * count, shown)


def _pack_spec(text: str) -> UnitSpec | None:
    """«бухта 100 м» → length ×100; «бухта» alone → size unknown."""
    sized = _PACK_SIZE_RE.match(text.strip())
    if sized:
        inner = _spec_from(sized.group("n"), sized.group("u"))
        pack = _pack_name(sized.group("pack"))
        if inner and inner.dimension not in {"generic"}:
            return UnitSpec(
                inner.dimension,
                inner.factor,
                f"{pack} {inner.label}",
            )
    only = _PACK_ONLY_RE.match(text.strip())
    if only:
        return UnitSpec(
            "pack", 1.0, _pack_name(only.group("pack")), pack_known=False
        )
    return None


def parse_unit(
    unit_field: str | None, offer_value: str | None
) -> UnitSpec | None:
    """Unit of a quoted price: the model's ``unit`` field, else «за …» in text.

    Packaging mentioned elsewhere in the text («поставка бухтами») is not a
    price unit; only «за бухту», «/рулон» or the ``unit`` field count.
    """
    if unit_field and unit_field.strip():
        text = unit_field.strip().lower().replace("ё", "е")
        text = re.sub(r"^(?:за|/|per)\s*", "", text)
        text = re.sub(r"^1\s+", "", text)
        pack = _pack_spec(text)
        if pack:
            return pack
        only = _UNIT_ONLY_RE.match(text)
        if only:
            return _spec_from(only.group("n"), only.group("u"))
    if not offer_value:
        return None
    text = offer_value.lower().replace("ё", "е")
    for match in _PER_RE.finditer(text):
        unit_token = match.group("u")
        if re.fullmatch(rf"(?:{_PACK_WORDS})", unit_token, re.I):
            tail = text[match.start("u") :]
            pack = _pack_spec(tail)
            if pack:
                return pack
            continue
        spec = _spec_from(match.group("n"), unit_token)
        if spec:
            return spec
    return None


# ------------------------------------------------------------------ currency

_BELARUS_MARKERS = (
    "беларус",
    "белорус",
    "минск",
    "брест",
    "витебск",
    "гомел",
    "гродн",
    "могилев",
    "могилёв",
    "бобруйск",
    "барановичи",
    "борисов",
    "пинск",
    "мозыр",
    "солигорск",
    "новополоцк",
    "молодечно",
    "полоцк",
    "жлобин",
    "светлогорск",
    "речица",
    "жодино",
    "слуцк",
)
_RUSSIA_MARKERS = (
    "росси",
    "москв",
    "санкт-петербург",
    "петербург",
    "новосибирск",
    "екатеринбург",
    "казань",
    "нижний новгород",
    "краснодар",
    "самар",
    "ростов",
    "челябинск",
    "воронеж",
)
_BELARUS_WORDS_RE = re.compile(
    r"(?<![а-яёa-z])(?:рб|лида|орша)(?![а-яёa-z])", re.I
)
_RUSSIA_WORDS_RE = re.compile(
    r"(?<![а-яёa-z])(?:рф|спб|уфа|омск|пермь)(?![а-яёa-z])", re.I
)

_CURRENCY_PATTERNS: list[tuple[str, str]] = [
    (r"\bbyn\b|\bbyr\b|бел\.?\s*руб\w*|белорусск\w*\s+руб\w*|\bbr\b", "BYN"),
    (r"\brub\b|\brur\b|₽|рос\.?\s*руб\w*|российск\w*\s+руб\w*", "RUB"),
    (r"\busd\b|\$|долл\w*|доллар\w*", "USD"),
    (r"\beur\b|€|евро\b", "EUR"),
    (r"\bcny\b|\brmb\b|юан\w*|¥", "CNY"),
    (r"\bkzt\b|тенге|₸", "KZT"),
    (r"\bpln\b|злот\w*", "PLN"),
    (r"\bgbp\b|£|фунт\w*", "GBP"),
]
_RUB_WORD_RE = re.compile(r"руб\w*|(?<![а-яa-z])р\.(?![а-яa-z])", re.I)
_KOP_RE = re.compile(r"коп\w*", re.I)


def local_ruble(region: str | None) -> str | None:
    """«руб.» means BYN for a Belarusian delivery and RUB for a Russian one."""
    text = (region or "").lower().replace("ё", "е")
    if any(m in text for m in _BELARUS_MARKERS) or _BELARUS_WORDS_RE.search(
        text
    ):
        return "BYN"
    if any(m in text for m in _RUSSIA_MARKERS) or _RUSSIA_WORDS_RE.search(
        text
    ):
        return "RUB"
    return None


@dataclass(frozen=True)
class Money:
    code: str  # BYN, RUB, USD … or «руб» when the country is unknown
    factor: float = 1.0  # копейки → 0.01


def _explicit_code(text: str) -> str | None:
    for pattern, code in _CURRENCY_PATTERNS:
        if re.search(pattern, text, re.I):
            return code
    return None


def parse_currency(
    currency_field: str | None,
    offer_value: str | None,
    region: str | None,
) -> Money | None:
    """Currency of a quoted price.

    The supplier's text decides first. A plain «руб.» is the ruble of the
    delivery country: the model tends to write «₽»/RUB for a Belarusian
    «руб.», so its RUB is not trusted over the region. An explicit BYN, USD,
    EUR … from the model is kept.
    """
    text = (offer_value or "").lower().replace("ё", "е")
    field_text = (currency_field or "").lower().replace("ё", "е").strip()
    local = local_ruble(region)

    code = _explicit_code(text)
    if code:
        return Money(code)

    field_code = _explicit_code(field_text) if field_text else None
    rub_in_text = bool(_RUB_WORD_RE.search(text))
    kop_only = bool(
        _KOP_RE.search(text) or _KOP_RE.search(field_text)
    ) and not (rub_in_text or _RUB_WORD_RE.search(field_text))
    rubleish = (
        rub_in_text
        or kop_only
        or field_code == "RUB"
        or bool(_RUB_WORD_RE.search(field_text))
    )
    factor = 0.01 if kop_only else 1.0

    if field_code and field_code != "RUB":
        return Money(field_code, factor)
    if rubleish:
        return Money(local or field_code or "руб", factor)
    return None


_WITH_VAT_RE = re.compile(
    r"(?:\bс\s+(?:уч[её]том\s+)?ндс|включая\s+ндс|вкл\.?\s*ндс|"
    r"в\s+т\.?\s*ч\.?\s*ндс|в\s+том\s+числе\s+ндс)",
    re.I,
)
_WITHOUT_VAT_RE = re.compile(
    r"(?:без\s+(?:уч[её]та\s+)?ндс|ндс\s+не\s+облага\w*|не\s+облага\w*\s+ндс|"
    r"без\s+налога)",
    re.I,
)


def says_with_vat(offer_value: str | None) -> bool:
    """The supplier quoted the price including VAT (and not «без НДС»)."""
    text = (offer_value or "").lower()
    return bool(_WITH_VAT_RE.search(text)) and not _WITHOUT_VAT_RE.search(text)


# ---------------------------------------------------------- request quantity

_QTY_MARKER_RE = re.compile(
    rf"(?:количеств\w*|кол-?во|кол\.|объ[её]м\w*|тираж\w*|парти\w*)"
    rf"\s*(?:[:\-–—]|-\s*|составляет|не\s+менее)?\s*"
    rf"(?P<n>{_NUM})\s*(?P<u>{_UNIT_ALT}){_END}",
    re.I,
)
_QTY_TAIL_RE = re.compile(
    rf"[—–]\s*(?P<n>{_NUM})\s*(?P<u>{_UNIT_ALT}){_END}\.?\s*$",
    re.I,
)


@dataclass(frozen=True)
class Quantity:
    amount: float  # in base units of the dimension
    dimension: str
    label: str  # as written: «12 000 м»
    unit_factor: float = 1.0  # the request's unit in base units (т → 1000)
    unit_label: str = ""  # «т»


def parse_request_quantity(text: str | None) -> Quantity | None:
    """Ordered quantity from the request text, only when it is unambiguous.

    Accepted: «Количество: 600 шт», «в объёме 12 000 м», a trailing
    «— 12 000 м» in the title. Numbers inside product names («ПВХ 50 мм»,
    «3×2,5») are never taken. Two different quantities → None.
    """
    if not text or not text.strip():
        return None
    found: list[Quantity] = []
    candidates = list(_QTY_MARKER_RE.finditer(text))
    for line in text.splitlines():
        tail = _QTY_TAIL_RE.search(line)
        if tail:
            candidates.append(tail)
    for match in candidates:
        amount = _num(match.group("n"))
        entry = _unit_entry(match.group("u"))
        if amount is None or entry is None:
            continue
        dimension, factor, label = entry
        if dimension == "generic":
            continue
        found.append(
            Quantity(
                amount * factor,
                dimension,
                f"{_fmt(amount)} {label}",
                factor,
                label,
            )
        )
    distinct = {(q.dimension, round(q.amount, 6)) for q in found}
    if len(distinct) != 1:
        return None
    return found[0]


# -------------------------------------------------------------- comparison


@dataclass
class PriceCell:
    """One supplier's answer to one price requirement."""

    numeric: float | None
    offer_value: str | None = None
    currency: str | None = None
    unit: str | None = None
    total_without_vat: float | None = None  # same supplier, for the check
    total_currency: str | None = None
    total_offer_value: str | None = None
    # the supplier offers another product (brand, size): why, in words
    other_product: str | None = None


_CALCULATED_RE = re.compile(r"рассчитано", re.IGNORECASE)


@dataclass
class PriceVerdict:
    comparable: bool
    normalized: float | None = None  # per reference unit, reference currency
    note: str | None = None


@dataclass
class PriceRow:
    reference_unit: str | None
    reference_currency: str | None
    verdicts: dict[str, PriceVerdict] = field(default_factory=dict)


_TOLERANCE = 0.02


def _close(a: float, b: float) -> bool:
    scale = max(abs(a), abs(b), 1e-9)
    return abs(a - b) / scale <= _TOLERANCE


def _majority(values: list[str]) -> str | None:
    if not values:
        return None
    counts = Counter(values).most_common()
    top = counts[0][1]
    leaders = sorted(v for v, c in counts if c == top)
    return leaders[0] if len(leaders) == 1 else None


def compare_prices(
    cells: dict[str, PriceCell],
    *,
    unit_price: bool,
    without_vat: bool,
    region: str | None,
    request_quantity: Quantity | None = None,
) -> PriceRow:
    """Decide, per supplier, whether a price can be ranked and at what value.

    ``unit_price`` — the row is a price per unit (units are checked);
    otherwise it is a total (only currency and VAT are checked).
    """
    verdicts: dict[str, PriceVerdict] = {}
    priced = {
        k: c
        for k, c in cells.items()
        if c.numeric is not None and c.numeric > 0
    }
    for key in cells:
        if key not in priced:
            verdicts[key] = PriceVerdict(False)

    # currency: the one most suppliers quote in; a tie is not guessed
    money = {
        k: parse_currency(c.currency, c.offer_value, region)
        for k, c in priced.items()
    }
    ref_currency = _majority([m.code for m in money.values() if m])
    known_codes = {m.code for m in money.values() if m}
    if ref_currency is None and len(known_codes) == 1:
        ref_currency = next(iter(known_codes))

    # unit: the request's unit, else the one most suppliers use
    specs: dict[str, UnitSpec | None] = {}
    ref_dimension: str | None = None
    ref_factor = 1.0
    ref_label: str | None = None
    pack_ref: str | None = None  # everyone quotes «за лист»: compare as is
    if unit_price:
        specs = {
            k: parse_unit(c.unit, c.offer_value) for k, c in priced.items()
        }
        measurable = [
            s
            for s in specs.values()
            if s and s.dimension not in {"generic", "pack"}
        ]
        if request_quantity is not None:
            ref_dimension = request_quantity.dimension
        else:
            ref_dimension = _majority([s.dimension for s in measurable])
        if ref_dimension:
            same = [s for s in measurable if s.dimension == ref_dimension]
            plain = [
                s
                for s in same
                if not s.label[0].isdigit() and " " not in s.label
            ]
            common = Counter((s.factor, s.label) for s in plain).most_common()
            if common:
                ref_factor, ref_label = common[0][0]
            elif request_quantity is not None and request_quantity.unit_label:
                ref_factor = request_quantity.unit_factor
                ref_label = request_quantity.unit_label
            else:
                ref_factor, ref_label = 1.0, BASE_LABEL.get(ref_dimension)
        else:
            unknown_packs = [
                s.label for s in specs.values() if s and s.dimension == "pack"
            ]
            pack_ref = _majority(unknown_packs)
            ref_label = pack_ref

    for key, cell in priced.items():
        notes: list[str] = []
        value = float(cell.numeric)  # type: ignore[arg-type]

        if cell.other_product:
            verdicts[key] = PriceVerdict(
                False,
                note=(
                    "предложен другой товар — цена не сравнивается: "
                    f"{cell.other_product}"
                ),
            )
            continue

        cur = money.get(key)
        if cur is None:
            if ref_currency:
                notes.append("валюта не указана")
        elif ref_currency and cur.code != ref_currency:
            verdicts[key] = PriceVerdict(
                False, note=f"другая валюта ({cur.code}) — не сравнивается"
            )
            continue
        elif ref_currency is None and len(known_codes) > 1:
            verdicts[key] = PriceVerdict(
                False, note="у поставщиков разные валюты — не сравнивается"
            )
            continue
        if cur is not None and cur.factor != 1.0:
            value *= cur.factor
            notes.append(f"пересчитано из копеек: {_fmt(value)} {cur.code}")

        if without_vat and says_with_vat(cell.offer_value):
            verdicts[key] = PriceVerdict(
                False,
                note="цена указана с НДС — не сравнивается с ценами без НДС",
            )
            continue

        if unit_price:
            spec = specs.get(key)
            if (
                spec is not None
                and spec.dimension == "pack"
                and not spec.pack_known
                and spec.label != pack_ref
            ):
                verdicts[key] = PriceVerdict(
                    False,
                    note=f"цена за «{spec.label}», размер не указан — не сравнивается",
                )
                continue
            if (
                spec is not None
                and spec.dimension not in {"generic", "pack"}
                and ref_dimension
                and spec.dimension != ref_dimension
            ):
                verdicts[key] = PriceVerdict(
                    False,
                    note=(
                        f"цена за {spec.label}, а сравниваем за {ref_label} — "
                        "не сравнивается"
                    ),
                )
                continue
            if (
                spec is not None
                and spec.dimension == ref_dimension
                and not _close(spec.factor, ref_factor)
            ):
                converted = value * ref_factor / spec.factor
                notes.append(
                    f"пересчитано: {_fmt(value)} за {_quoted(spec.label)} → "
                    f"{_fmt(round(converted, 4))} за {ref_label}"
                )
                value = converted

        verdicts[key] = PriceVerdict(
            True, round(value, 6), "; ".join(notes) or None
        )

    if unit_price:
        _check_against_totals(
            verdicts,
            priced,
            money,
            ref_currency,
            ref_factor,
            ref_label,
            request_quantity,
            ref_dimension,
            region,
        )

    return PriceRow(
        reference_unit=ref_label if unit_price else None,
        reference_currency=ref_currency,
        verdicts=verdicts,
    )


def _check_against_totals(
    verdicts: dict[str, PriceVerdict],
    priced: dict[str, PriceCell],
    money: dict[str, Money | None],
    ref_currency: str | None,
    ref_factor: float,
    ref_label: str | None,
    request_quantity: Quantity | None,
    ref_dimension: str | None,
    region: str | None,
) -> None:
    """Price × quantity must give the supplier's own total.

    With the ordered quantity known, each supplier is checked against it.
    Without it, the quantities implied by total ÷ price must agree with the
    majority of suppliers; an outlier is usually a price per package.
    """
    implied: dict[str, float] = {}
    for key, verdict in verdicts.items():
        if not verdict.comparable or verdict.normalized is None:
            continue
        cell = priced[key]
        total = cell.total_without_vat
        if total is None or total <= 0:
            continue
        # a total the model computed from our own quantity proves nothing
        if _CALCULATED_RE.search(cell.total_offer_value or ""):
            continue
        total_money = parse_currency(
            cell.total_currency, cell.total_offer_value, region
        )
        price_money = money.get(key)
        if (
            total_money
            and price_money
            and total_money.code != price_money.code
        ):
            continue
        if total_money and total_money.factor != 1.0:
            total *= total_money.factor
        implied[key] = total / verdict.normalized

    if (
        request_quantity is not None
        and ref_dimension == request_quantity.dimension
        and ref_label
    ):
        ordered = request_quantity.amount / ref_factor
        for key, qty in implied.items():
            if _close(qty, ordered):
                continue
            verdict = verdicts[key]
            price = verdict.normalized or 0
            verdicts[key] = PriceVerdict(
                False,
                verdict.normalized,
                (
                    f"цена не сходится с суммой: {_fmt(round(price, 4))} × "
                    f"{request_quantity.label} = {_fmt(round(price * ordered, 2))}, "
                    f"а у поставщика {_fmt(round(price * qty, 2))}"
                    f"{_per_hint(ordered / qty, ref_label)} — уточните единицу цены"
                ),
            )
        return

    if len(implied) < 3:
        return
    groups: list[list[str]] = []
    for key, qty in sorted(implied.items(), key=lambda kv: kv[1]):
        if groups and _close(implied[groups[-1][0]], qty):
            groups[-1].append(key)
        else:
            groups.append([key])
    groups.sort(key=len, reverse=True)
    main = groups[0]
    if len(main) * 2 <= len(implied):
        return  # no clear majority: do not guess
    expected = implied[main[0]]
    for group in groups[1:]:
        for key in group:
            verdict = verdicts[key]
            verdicts[key] = PriceVerdict(
                False,
                verdict.normalized,
                (
                    f"по сумме поставщика выходит {_fmt(round(implied[key], 2))}"
                    f" {ref_label or 'ед.'} вместо ≈{_fmt(round(expected, 2))}, "
                    f"как у остальных{_per_hint(expected / implied[key], ref_label)}"
                    " — уточните единицу цены"
                ),
            )


def _quoted(label: str) -> str:
    return f"«{label}»" if " " in label else label


def _per_hint(ratio: float, ref_label: str | None) -> str:
    """«; похоже, цена за 100 м» when the gap is a round 10 / 100 / 1000."""
    if not ref_label:
        return ""
    for step in (10, 50, 100, 500, 1000):
        if _close(ratio, step):
            return f"; похоже, цена за {step} {ref_label}"
    return ""


def percent_vs_min(row: PriceRow) -> dict[str, float | None]:
    """0 = cheapest comparable price, +12.5 = 12.5 % above it."""
    values = [
        v.normalized
        for v in row.verdicts.values()
        if v.comparable and v.normalized
    ]
    minimum = min(values) if values else None
    out: dict[str, float | None] = {}
    for key, verdict in row.verdicts.items():
        if not verdict.comparable or verdict.normalized is None or not minimum:
            out[key] = None
        elif verdict.normalized == minimum:
            out[key] = 0.0
        else:
            out[key] = round((verdict.normalized - minimum) / minimum * 100, 1)
    return out


def position_quantities(description: str | None) -> dict[str, Quantity]:
    """Quantity of each «Позиция N:» block, keyed like its price row title."""
    from backend.utils.comparison_price import (
        _POSITION_BLOCK_RE,
        _POSITION_TITLE_MAX_WORDS,
    )

    if not description or not description.strip():
        return {}
    text = description.strip()
    matches = list(_POSITION_BLOCK_RE.finditer(text))
    if len(matches) < 2:
        return {}
    out: dict[str, Quantity] = {}
    for i, match in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        chunk = text[match.end() : end].strip()
        if not chunk:
            continue
        first_line = chunk.splitlines()[0].strip()
        title = " ".join(
            first_line.split()[:_POSITION_TITLE_MAX_WORDS]
        ).rstrip(" .,;:")
        quantity = parse_request_quantity(chunk)
        if title and quantity is not None:
            out[title] = quantity
    return out
