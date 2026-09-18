"""Native response ownership and request-sized context telemetry."""

from functools import wraps
from typing import Any, Literal

from pydantic import BaseModel


class RequestUsageEvent(BaseModel):
    type: Literal["robot790.request.usage"] = "robot790.request.usage"
    response_id: str
    conversation_id: str | None
    input_tokens: int
    output_tokens: int


def apply_native_response_lifecycle_patch() -> None:
    from speech_to_speech.api.openai_realtime.service import RealtimeService
    from speech_to_speech.utils.utils import is_out_of_band

    if getattr(RealtimeService, "_robot_790_native_response_lifecycle_patch", False):
        return

    def wrap(handler: Any) -> Any:
        @wraps(handler)
        def queued(self: Any, conn_id: str, event: Any) -> list[Any]:
            events = handler(self, conn_id, event)
            state = self._state(conn_id)
            if state.response_pending and not state.in_response:
                # Use the ordinary response ID and terminal events, not a UI timeout.
                _, _, created = self.audio.begin_audio_response(conn_id)
                events.extend(created)
            return events

        return queued

    RealtimeService._on_transcription_completed = wrap(RealtimeService._on_transcription_completed)
    RealtimeService._on_audio_input_completed = wrap(RealtimeService._on_audio_input_completed)
    original_usage = RealtimeService._on_token_usage

    @wraps(original_usage)
    def usage(self: Any, conn_id: str, event: Any) -> list[Any]:
        events = original_usage(self, conn_id, event)
        state = self._state(conn_id)
        if (not state.in_response or not state.current_response_id
                or (self.speculative_turns and not self.speculative_turns.is_latest(
                    event.turn_id, event.turn_revision))):
            return events
        # Preserve billable response totals; send the unaccumulated provider count separately.
        events.append(RequestUsageEvent(
            response_id=state.current_response_id,
            conversation_id=None if is_out_of_band(state.current_response_params) else state.conversation_id,
            input_tokens=event.input_tokens, output_tokens=event.output_tokens,
        ))
        return events

    RealtimeService._on_token_usage = usage
    RealtimeService._robot_790_native_response_lifecycle_patch = True
