---
name: weather
description: Get current weather info (city, country, temperature, feels-like, description, humidity, wind, visibility) plus a 3-day forecast using wttr.in, no API key needed. Use when user asks about weather, temperature, forecast, or "clima".
---

# Weather

Fetch weather data via `wttr.in` (free, no API key, works with curl + jq).

## Configuración

Ubicación por defecto se lee de `config.md` (front matter `city`/`country`).
Edita ese archivo para cambiar la ciudad por defecto.

## Usage

Run the script with an optional city name:

```bash
.claude/skills/weather/get_weather.sh "Santiago"
```

No argument = usa la ciudad/país de `config.md`:

```bash
.claude/skills/weather/get_weather.sh
```

## Output

Reporte en español con:
- Ciudad y país
- Descripción del clima
- Temperatura actual y sensación térmica
- Humedad
- Viento
- Visibilidad
- Pronóstico de los próximos 3 días (mín/máx + descripción)

## Notes

- Requiere internet, `curl` y `jq`. Sin setup, sin API key.
- Nombres de ciudad con espacios: usar comillas (ej. `"Buenos Aires"`).
