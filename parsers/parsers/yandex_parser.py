import asyncio
import base64
import json
import math
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Dict, List, Optional

import aiohttp
import jwt
import yandexcloud
from yandex.cloud.iam.v1.iam_token_service_pb2 import CreateIamTokenRequest
from yandex.cloud.iam.v1.iam_token_service_pb2_grpc import IamTokenServiceStub

from utils.logger import CustomLogger

# ============ Configuration ============
API_URL_POST = "https://searchapi.api.cloud.yandex.net/v2/web/searchAsync"
API_URL_GET = "https://operation.api.cloud.yandex.net/operations/{}"
POLL_INTERVAL = 5  # Seconds between polling attempts
MAX_RETRIES = 10  # Number of retry attempts for HTTP requests
RETRY_DELAY = 10  # Seconds to wait between retries

# ============ Logger Setup ============
logger = CustomLogger(
    logger_name="YandexParser", file_path="YandexParser.log", debug=True, console=True
).get_logger()


# ============ IAM Helpers ============


def load_service_account(key_file: Path) -> Dict[str, str]:
    """
    Load service account credentials from a JSON key file.

    Returns:
        Dict[str, str]: A dictionary containing:
            - id: key identifier
            - service_account_id: service account ID
            - private_key: PEM-formatted private key
    """
    data = json.loads(key_file.read_text(encoding="utf-8"))
    return {
        "id": data["id"],
        "service_account_id": data["service_account_id"],
        "private_key": data["private_key"],
    }


def create_jwt(sa_key: Dict[str, str]) -> str:
    """
    Generate a PS256-signed JWT for Yandex IAM token exchange.

    Args:
        sa_key (Dict[str, str]): Service account credentials.

    Returns:
        str: Encoded JWT token.
    """
    now = int(time.time())
    payload = {
        "aud": "https://iam.api.cloud.yandex.net/iam/v1/tokens",
        "iss": sa_key["service_account_id"],
        "iat": now,
        "exp": now + 3600,
    }
    token = jwt.encode(
        payload=payload, key=sa_key["private_key"], algorithm="PS256", headers={"kid": sa_key["id"]}
    )
    logger.debug("JWT created successfully.")
    return token


def get_iam_token(sa_key: Dict[str, str]) -> str:
    """
    Exchange the JWT for an IAM token using Yandex Cloud SDK.

    Args:
        sa_key (Dict[str, str]): Service account credentials.

    Returns:
        str: IAM bearer token.
    """
    jwt_token = create_jwt(sa_key)
    sdk = yandexcloud.SDK(service_account_key=sa_key)
    client: IamTokenServiceStub = sdk.client(IamTokenServiceStub)
    response = client.Create(CreateIamTokenRequest(jwt=jwt_token))
    logger.info("IAM token obtained.")
    return response.iam_token


# ============ Yandex Search API ============


async def post_search(
    session: aiohttp.ClientSession,
    query: str,
    page: int,
    folder_id: str,
    groups_on_page: int,
    docs_in_group: int,
    token: str,
    region: int = 65,
) -> Optional[str]:
    """
    Start an asynchronous Yandex Web Search operation.

    Args:
        session (aiohttp.ClientSession): HTTP client session.
        query (str): Search query text.
        page (int): Page index for pagination.
        groups_on_page (int): Number of domain groups to fetch per page.
        docs_in_group (int): Number of documents per group.
        token (str): IAM bearer token.
        region (int, optional): Region code (default: 65 for RU).

    Returns:
        Optional[str]: Operation ID if request succeeds, else None.
    """
    body = {
        "query": {
            "searchType": "SEARCH_TYPE_RU",
            "queryText": query,
            "familyMode": "FAMILY_MODE_NONE",
            "page": str(page),
        },
        "sortSpec": {"sortMode": "SORT_MODE_BY_RELEVANCE", "sortOrder": "SORT_ORDER_DESC"},
        "groupSpec": {
            "groupMode": "GROUP_MODE_DEEP",
            "groupsOnPage": str(groups_on_page),
            "docsInGroup": str(docs_in_group),
        },
        "maxPassages": "5",
        "region": str(region),
        "l10N": "LOCALIZATION_RU",
        "folderId": folder_id,
        "responseFormat": "FORMAT_XML",
    }
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.debug(f"POST attempt {attempt} for page={page}")
            resp = await session.post(API_URL_POST, json=body, headers=headers)
            text = await resp.text()

            if resp.status == 200:
                data = await resp.json()
                op_id = data.get("id")
                logger.info(f"Search operation started: id={op_id}")
                return op_id

            logger.warning(f"POST returned status {resp.status}: {text}")
        except Exception as e:
            logger.error(f"POST exception: {e}")

        if attempt < MAX_RETRIES:
            await asyncio.sleep(RETRY_DELAY)

    logger.error("POST failed after maximum retries.")
    return None


async def poll_search(session: aiohttp.ClientSession, token: str, op_id: str) -> Optional[Dict]:
    """
    Poll a Yandex operation until it completes (`done == True`).

    Args:
        session (aiohttp.ClientSession): HTTP client session.
        token (str): IAM bearer token.
        op_id (str): Operation ID to poll.

    Returns:
        Optional[Dict]: Operation result JSON when done, or None on failure.
    """
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    url = API_URL_GET.format(op_id)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            await asyncio.sleep(POLL_INTERVAL)
            logger.debug(f"Polling attempt {attempt} for op_id={op_id}")
            resp = await session.get(url, headers=headers)
            text = await resp.text()

            if resp.status != 200:
                logger.warning(f"GET returned status {resp.status}: {text}")
            else:
                data = await resp.json()

                if "done" not in data:
                    logger.error("Missing 'done' field, retrying...")
                elif data["done"]:
                    logger.info(f"Operation {op_id} completed.")
                    return data
                else:
                    logger.debug(f"Not done yet (done={data['done']}), waiting...")
        except Exception as e:
            logger.error(f"Polling exception attempt {attempt}: {e}")

        if attempt < MAX_RETRIES:
            logger.debug(f"Retrying polling in {RETRY_DELAY}s...")
            await asyncio.sleep(RETRY_DELAY)

    logger.error("Polling failed after maximum retries.")
    return None


# ============ XML Processing ============


def decode_base64_xml(b64_str: str) -> str:
    """
    Decode a base64-encoded XML string to UTF-8 text.

    Args:
        b64_str (str): Base64-encoded XML payload.

    Returns:
        str: Decoded XML text.
    """
    xml_bytes = base64.b64decode(b64_str)
    xml_text = xml_bytes.decode("utf-8")
    logger.debug("Decoded XML from Base64.")
    return xml_text


def parse_yandex_xml(xml_str: str) -> List[Dict]:
    """
    Parse Yandex XML response and extract unique domains and snippets.

    Args:
        xml_str (str): Raw XML string.

    Returns:
        List[Dict]: List of dicts with keys:
            - domain (str)
            - description (Optional[str])
    """
    root = ET.fromstring(xml_str)
    seen = set()
    out: List[Dict] = []

    for group in root.findall(".//results/grouping/group"):
        categ = group.find("categ")
        if categ is None:
            continue

        domain = categ.get("name", "").lower().removeprefix("www.")
        if not domain or domain in seen:
            continue

        seen.add(domain)
        snippet = None
        doc = group.find("doc")
        if doc is not None:
            passage = doc.find("passages/passage")
            if passage is not None:
                snippet = "".join(passage.itertext())

        out.append({"domain": domain, "description": snippet})

    logger.info(f"Parsed {len(out)} unique domains.")
    return out


# ============ Main Flow ============


async def yandex_fetch_all(
    key_file: Path,
    folder_id: str,
    user_id: str,
    query: str,
    total_results: int,
    groups_on_page: int = 100,
    docs_in_group: int = 3,
    region: int = 225,
) -> List[Dict]:
    """
    Fetch up to `total_results` unique domains from Yandex Web Search.

    Args:
        user_id (str): Identifier of the requesting user.
        query (str): Search query.
        total_results (int): Maximum number of domains to retrieve.
        groups_on_page (int): Groups per page.
        docs_in_group (int): Docs per group.
        region (int): Yandex region code.

    Returns:
        List[Dict]: List of dicts with:
            - user_id (str)
            - query (str)
            - domain (str)
            - description (Optional[str])
    """
    sa_key = load_service_account(key_file)
    token = get_iam_token(sa_key)

    max_per_page = groups_on_page * docs_in_group
    pages_needed = math.ceil(total_results / max_per_page)
    seen = set()
    combined: List[Dict] = []

    async with aiohttp.ClientSession() as session:
        for page in range(pages_needed):
            op_id = await post_search(
                session, query, page, folder_id, groups_on_page, docs_in_group, token, region
            )
            if not op_id:
                break

            op_data = await poll_search(session, token, op_id)
            if not op_data:
                break

            xml_text = decode_base64_xml(op_data["response"]["rawData"])
            page_items = parse_yandex_xml(xml_text)

            for item in page_items:
                dom = item["domain"]
                if dom in seen:
                    continue
                seen.add(dom)

                combined.append(
                    {
                        "user_id": user_id,
                        "query": query,
                        "region": str(region),  # Convert region code to string
                        "domain": "https://" + dom,
                        "description": item["description"],
                        "engine": "yandex",
                    }
                )
                if len(combined) >= total_results:
                    break

            if len(combined) >= total_results:
                break

    return combined