import json

from openai import AsyncOpenAI

from backend.core.config import get_config

config = get_config()


class LLMClient:
    def __init__(self) -> None:
        self._client = AsyncOpenAI(
            api_key=config.openai_api_key,
            base_url=config.openai_base_url,
        )

    async def complete(
        self,
        system: str,
        user: str,
        model: str = config.openai_model,
        history: list[dict[str, str]] | None = None,
    ) -> dict:
        """Run a single JSON-mode completion.

        ``history`` optionally carries prior turns (``{"role": "user"|
        "assistant", "content": ...}``) inserted between the system
        prompt and the final user message, enabling multi-turn chat
        features (e.g. the TZ creation wizard) without changing the
        single-shot contract for existing callers.
        """
        result, _ = await self.complete_with_usage(
            system, user, model=model, history=history
        )
        return result

    async def complete_with_usage(
        self,
        system: str,
        user: str,
        model: str = config.openai_model,
        history: list[dict[str, str]] | None = None,
        max_tokens: int | None = None,
        extra_body: dict | None = None,
    ) -> tuple[dict, dict]:
        """Like :meth:`complete`, plus the token usage the API reports.

        ``max_tokens`` raises the provider's default answer length (long JSON
        answers are otherwise cut off and fail to parse); ``extra_body``
        passes provider-specific options (e.g. switching reasoning off).
        """
        messages = [{"role": "system", "content": system}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user})

        extra: dict = {}
        if max_tokens is not None:
            extra["max_tokens"] = max_tokens
        if extra_body:
            extra["extra_body"] = extra_body
        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.0,
            response_format={"type": "json_object"},
            **extra,
        )
        resp = response.choices[0].message.content
        if not resp:
            raise ValueError("No response from LLM")
        try:
            parsed = json.loads(resp)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid response from LLM") from exc
        usage = response.usage.model_dump() if response.usage else {}
        return parsed, usage


llm_client = LLMClient()
