from __future__ import annotations

from robot_790d import smart_home


def clear_smart_home_env(monkeypatch) -> None:
    for name in [
        smart_home.DEVICES_ENV,
        smart_home.HA_URL_ENV,
        smart_home.HA_TOKEN_ENV,
        smart_home.HA_TIMEOUT_ENV,
    ]:
        monkeypatch.delenv(name, raising=False)
    for name in list(smart_home.os.environ):
        if name.startswith(smart_home.DEVICE_ENV_PREFIX):
            monkeypatch.delenv(name, raising=False)


def test_configured_devices_accept_combined_and_individual_env(monkeypatch) -> None:
    clear_smart_home_env(monkeypatch)
    monkeypatch.setenv(
        smart_home.DEVICES_ENV,
        "living_room_light=light.living_room;extra_light=switch.extra_light|Extra light",
    )
    monkeypatch.setenv(
        f"{smart_home.DEVICE_ENV_PREFIX}FAN",
        "fan.desk_fan|Desk fan",
    )

    devices = smart_home.configured_devices()

    assert sorted(devices) == ["extra_light", "fan", "living_room_light"]
    assert devices["living_room_light"].entity_id == "light.living_room"
    assert devices["extra_light"].label == "Extra light"
    assert devices["fan"].public_payload() == {
        "name": "fan",
        "entity_id": "fan.desk_fan",
        "domain": "fan",
        "label": "Desk fan",
    }


def test_list_devices_does_not_require_home_assistant_token(monkeypatch) -> None:
    clear_smart_home_env(monkeypatch)
    monkeypatch.setenv(f"{smart_home.DEVICE_ENV_PREFIX}LIVING_ROOM_LIGHT", "light.living_room")

    result = smart_home.control_smart_home_device(action="list")

    assert result["status"] == "ok"
    assert result["action"] == "list"
    assert result["devices"] == [
        {
            "name": "living_room_light",
            "entity_id": "light.living_room",
            "domain": "light",
            "label": "living room light",
        }
    ]


def test_unknown_device_reports_known_devices(monkeypatch) -> None:
    clear_smart_home_env(monkeypatch)
    monkeypatch.setenv(f"{smart_home.DEVICE_ENV_PREFIX}EXTRA_LIGHT", "light.extra")

    result = smart_home.control_smart_home_device("living room light", "turn_on")

    assert result["status"] == "error"
    assert result["known_devices"] == ["extra_light"]


def test_disallowed_domain_is_rejected_before_http(monkeypatch) -> None:
    clear_smart_home_env(monkeypatch)
    monkeypatch.setenv(f"{smart_home.DEVICE_ENV_PREFIX}FRONT_DOOR", "lock.front_door")

    result = smart_home.control_smart_home_device("front door", "turn_on")

    assert result["status"] == "error"
    assert "not allowed" in str(result["error"])


def test_turn_on_posts_home_assistant_service(monkeypatch) -> None:
    clear_smart_home_env(monkeypatch)
    monkeypatch.setenv(smart_home.HA_URL_ENV, "http://homeassistant.local:8123/")
    monkeypatch.setenv(smart_home.HA_TOKEN_ENV, "token")
    monkeypatch.setenv(f"{smart_home.DEVICE_ENV_PREFIX}LIVING_ROOM_LIGHT", "light.living_room")

    class FakeResponse:
        def __init__(self, payload: object, status_code: int = 200) -> None:
            self._payload = payload
            self.status_code = status_code
            self.content = b"{}"
            self.text = "{}"

        def json(self) -> object:
            return self._payload

    class FakeClient:
        def __init__(self) -> None:
            self.posts: list[tuple[str, dict[str, str], dict[str, str]]] = []
            self.gets: list[tuple[str, dict[str, str]]] = []

        def post(self, url: str, *, headers: dict[str, str], json: dict[str, str]) -> FakeResponse:
            self.posts.append((url, headers, json))
            return FakeResponse([])

        def get(self, url: str, *, headers: dict[str, str]) -> FakeResponse:
            self.gets.append((url, headers))
            return FakeResponse(
                {
                    "entity_id": "light.living_room",
                    "state": "on",
                    "attributes": {"friendly_name": "Living room light"},
                    "last_changed": "2026-08-29T12:00:00+00:00",
                }
            )

    client = FakeClient()

    result = smart_home.control_smart_home_device("Living Room Light", "on", client=client)

    assert result["status"] == "ok"
    assert result["action"] == "turn_on"
    assert client.posts == [
        (
            "http://homeassistant.local:8123/api/services/light/turn_on",
            {"Authorization": "Bearer token", "Content-Type": "application/json"},
            {"entity_id": "light.living_room"},
        )
    ]
    assert result["state"] == {
        "entity_id": "light.living_room",
        "state": "on",
        "friendly_name": "Living room light",
        "last_changed": "2026-08-29T12:00:00+00:00",
    }
