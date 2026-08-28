from __future__ import annotations

import json
import logging
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen

logger = logging.getLogger(__name__)

DEFAULT_WEATHER_LOCATION = "Salem, Massachusetts"
GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"


def lookup_weather(location: str = DEFAULT_WEATHER_LOCATION, unit: str = "fahrenheit") -> dict[str, Any]:
    """Look up current weather and today's forecast for a place name."""
    query = (location or DEFAULT_WEATHER_LOCATION).strip() or DEFAULT_WEATHER_LOCATION
    units = _weather_units(unit)

    try:
        place = _geocode_location(query)
        forecast = _fetch_forecast(place, units)
    except (OSError, ValueError) as exc:
        logger.warning("weather lookup failed for %r: %s", query, exc)
        return {"status": "error", "tool": "get_weather", "error": str(exc), "location": query}

    current = forecast.get("current") if isinstance(forecast.get("current"), dict) else {}
    daily = forecast.get("daily") if isinstance(forecast.get("daily"), dict) else {}
    code = _number(current.get("weather_code"))

    return {
        "status": "ok",
        "tool": "get_weather",
        "source": "open-meteo",
        "query": query,
        "location": _format_place(place),
        "latitude": place["latitude"],
        "longitude": place["longitude"],
        "timezone": forecast.get("timezone") or place.get("timezone"),
        "current": {
            "time": current.get("time"),
            "condition": _weather_description(int(code)) if code is not None else "unknown",
            "weather_code": code,
            "temperature": _number(current.get("temperature_2m")),
            "temperature_unit": units["temperature_unit_label"],
            "feels_like": _number(current.get("apparent_temperature")),
            "humidity_percent": _number(current.get("relative_humidity_2m")),
            "precipitation": _number(current.get("precipitation")),
            "precipitation_unit": units["precipitation_unit_label"],
            "cloud_cover_percent": _number(current.get("cloud_cover")),
            "wind_speed": _number(current.get("wind_speed_10m")),
            "wind_gust": _number(current.get("wind_gusts_10m")),
            "wind_speed_unit": units["wind_speed_unit_label"],
        },
        "today": {
            "date": _first(daily.get("time")),
            "high": _number(_first(daily.get("temperature_2m_max"))),
            "low": _number(_first(daily.get("temperature_2m_min"))),
            "temperature_unit": units["temperature_unit_label"],
            "precipitation_probability_percent": _number(_first(daily.get("precipitation_probability_max"))),
        },
    }


def _geocode_location(query: str) -> dict[str, Any]:
    payload = _read_json_url(
        GEOCODE_URL,
        {"name": query, "count": 1, "language": "en", "format": "json"},
    )
    results = payload.get("results")
    if not isinstance(results, list) or not results:
        raise ValueError(f"No weather location found for '{query}'.")
    place = results[0]
    if not isinstance(place, dict) or place.get("latitude") is None or place.get("longitude") is None:
        raise ValueError(f"Weather location for '{query}' did not include coordinates.")
    return place


def _fetch_forecast(place: dict[str, Any], units: dict[str, str]) -> dict[str, Any]:
    return _read_json_url(
        FORECAST_URL,
        {
            "latitude": place["latitude"],
            "longitude": place["longitude"],
            "current": ",".join(
                [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "precipitation",
                    "weather_code",
                    "cloud_cover",
                    "wind_speed_10m",
                    "wind_gusts_10m",
                ]
            ),
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
            "forecast_days": 1,
            "timezone": "auto",
            "temperature_unit": units["temperature_unit"],
            "wind_speed_unit": units["wind_speed_unit"],
            "precipitation_unit": units["precipitation_unit"],
        },
    )


def _read_json_url(url: str, params: dict[str, object]) -> dict[str, Any]:
    request_url = f"{url}?{urlencode(params)}"
    request = Request(request_url, headers={"User-Agent": "Robot790/0.1"})
    with urlopen(request, timeout=8) as response:
        raw = response.read().decode("utf-8")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Weather service returned an unexpected response.")
    return payload


def _weather_units(unit: str) -> dict[str, str]:
    value = str(unit or "").strip().lower()
    if value in {"c", "celsius", "metric"}:
        return {
            "temperature_unit": "celsius",
            "temperature_unit_label": "C",
            "wind_speed_unit": "kmh",
            "wind_speed_unit_label": "km/h",
            "precipitation_unit": "mm",
            "precipitation_unit_label": "mm",
        }
    return {
        "temperature_unit": "fahrenheit",
        "temperature_unit_label": "F",
        "wind_speed_unit": "mph",
        "wind_speed_unit_label": "mph",
        "precipitation_unit": "inch",
        "precipitation_unit_label": "in",
    }


def _format_place(place: dict[str, Any]) -> str:
    parts = [
        str(place.get("name") or "").strip(),
        str(place.get("admin1") or "").strip(),
        str(place.get("country") or "").strip(),
    ]
    return ", ".join(part for part in parts if part)


def _first(value: object) -> object:
    if isinstance(value, list) and value:
        return value[0]
    return None


def _number(value: object) -> float | int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return round(value, 1)
    try:
        return round(float(value), 1)
    except (TypeError, ValueError):
        return None


def _weather_description(code: int) -> str:
    descriptions = {
        0: "clear sky",
        1: "mainly clear",
        2: "partly cloudy",
        3: "overcast",
        45: "fog",
        48: "depositing rime fog",
        51: "light drizzle",
        53: "drizzle",
        55: "heavy drizzle",
        56: "light freezing drizzle",
        57: "freezing drizzle",
        61: "light rain",
        63: "rain",
        65: "heavy rain",
        66: "light freezing rain",
        67: "freezing rain",
        71: "light snow",
        73: "snow",
        75: "heavy snow",
        77: "snow grains",
        80: "light rain showers",
        81: "rain showers",
        82: "heavy rain showers",
        85: "light snow showers",
        86: "snow showers",
        95: "thunderstorm",
        96: "thunderstorm with hail",
        99: "thunderstorm with heavy hail",
    }
    return descriptions.get(code, f"weather code {code}")
