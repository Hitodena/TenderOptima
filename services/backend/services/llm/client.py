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
        messages = [{"role": "system", "content": system}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user})

        response = await self._client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        resp = response.choices[0].message.content
        if not resp:
            raise ValueError("No response from LLM")
        try:
            return json.loads(resp)
        except json.JSONDecodeError as exc:
            raise ValueError("Invalid response from LLM") from exc


llm_client = LLMClient()
