from robot_790d import weather


def test_lookup_weather_returns_compact_current_and_daily_payload(monkeypatch) -> None:
    def fake_read_json_url(url: str, params: dict[str, object]) -> dict[str, object]:
        if url == weather.GEOCODE_URL:
            return {
                "results": [
                    {
                        "name": "Salem",
                        "admin1": "Massachusetts",
                        "country": "United States",
                        "latitude": 42.5195,
                        "longitude": -70.8967,
                    }
                ]
            }
        assert url == weather.FORECAST_URL
        return {
            "timezone": "America/New_York",
            "current": {
                "time": "2026-08-28T12:00",
                "temperature_2m": 72.34,
                "relative_humidity_2m": 55,
                "apparent_temperature": 74.1,
                "precipitation": 0,
                "weather_code": 2,
                "cloud_cover": 40,
                "wind_speed_10m": 8.7,
                "wind_gusts_10m": 14.2,
            },
            "daily": {
                "time": ["2026-08-28"],
                "temperature_2m_max": [78.6],
                "temperature_2m_min": [62.5],
                "precipitation_probability_max": [20],
            },
        }

    monkeypatch.setattr(weather, "_read_json_url", fake_read_json_url)

    result = weather.lookup_weather("Salem, Massachusetts")

    assert result["status"] == "ok"
    assert result["tool"] == "get_weather"
    assert result["source"] == "open-meteo"
    assert result["location"] == "Salem, Massachusetts, United States"
    assert result["current"]["condition"] == "partly cloudy"
    assert result["current"]["temperature"] == 72.3
    assert result["current"]["temperature_unit"] == "F"
    assert result["today"]["high"] == 78.6


def test_lookup_weather_reports_unknown_location(monkeypatch) -> None:
    monkeypatch.setattr(weather, "_read_json_url", lambda _url, _params: {"results": []})

    result = weather.lookup_weather("Nowhere much")

    assert result["status"] == "error"
    assert result["tool"] == "get_weather"
    assert "No weather location found" in str(result["error"])
