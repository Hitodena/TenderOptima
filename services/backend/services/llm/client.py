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
    ) -> dict:
        response = await self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
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
