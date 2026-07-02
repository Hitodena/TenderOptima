"""Convert monetary amounts to Russian words for BYN documents."""

from decimal import Decimal

_ONES_M = (
    "",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
)
_ONES_F = (
    "",
    "одна",
    "две",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
)
_TEENS = (
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
)
_TENS = (
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
)
_HUNDREDS = (
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
)


def _plural_form(number: int, forms: tuple[str, str, str]) -> str:
    n = abs(number) % 100
    if 11 <= n <= 19:
        return forms[2]
    n = n % 10
    if n == 1:
        return forms[0]
    if 2 <= n <= 4:
        return forms[1]
    return forms[2]


def _triplet_to_words(value: int, *, feminine: bool) -> str:
    if value == 0:
        return ""
    parts: list[str] = []
    hundreds = value // 100
    remainder = value % 100
    if hundreds:
        parts.append(_HUNDREDS[hundreds])
    if 10 <= remainder <= 19:
        parts.append(_TEENS[remainder - 10])
    else:
        tens = remainder // 10
        ones = remainder % 10
        if tens:
            parts.append(_TENS[tens])
        if ones:
            parts.append((_ONES_F if feminine else _ONES_M)[ones])
    return " ".join(parts)


def _integer_to_words(value: int) -> str:
    if value == 0:
        return "ноль"
    parts: list[str] = []
    millions = value // 1_000_000
    thousands = (value % 1_000_000) // 1000
    remainder = value % 1000

    if millions:
        parts.append(_triplet_to_words(millions, feminine=False))
        parts.append(
            _plural_form(
                millions,
                ("миллион", "миллиона", "миллионов"),
            )
        )
    if thousands:
        parts.append(_triplet_to_words(thousands, feminine=True))
        parts.append(
            _plural_form(
                thousands,
                ("тысяча", "тысячи", "тысяч"),
            )
        )
    if remainder:
        parts.append(_triplet_to_words(remainder, feminine=False))

    return " ".join(part for part in parts if part).strip()


def format_byn_amount_words(amount: Decimal) -> str:
    """Return amount in words for Belarusian rubles."""
    normalized = amount.quantize(Decimal("0.01"))
    rubles = int(normalized)
    kopecks = int((normalized - Decimal(rubles)) * 100)

    rubles_words = _integer_to_words(rubles)
    rubles_form = _plural_form(
        rubles,
        ("белорусский рубль", "белорусских рубля", "белорусских рублей"),
    )
    kopecks_form = _plural_form(
        kopecks,
        ("копейка", "копейки", "копеек"),
    )

    return f"{rubles_words} {rubles_form} {kopecks:02d} {kopecks_form}"


def format_byn_amount_line(amount: Decimal) -> str:
    """Numeric amount plus words in parentheses."""
    normalized = amount.quantize(Decimal("0.01"))
    numeric = f"{normalized:.2f}"
    words = format_byn_amount_words(normalized)
    return f"{numeric} белорусских рублей ({words})"
