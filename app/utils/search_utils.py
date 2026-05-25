from urllib.parse import urlparse


def extract_domain(raw: str) -> str:
    parsed = urlparse(raw)
    host = parsed.netloc or parsed.path
    return host.removeprefix("www.")
