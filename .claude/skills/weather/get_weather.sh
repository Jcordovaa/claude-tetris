#!/bin/bash
# Fetch weather from wttr.in. Usage: get_weather.sh ["City Name"]
# Default location read from config.md (city/country front matter)

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SKILL_DIR/config.md"

DEFAULT_CITY=$(grep '^city:' "$CONFIG_FILE" | sed 's/^city: *//')
DEFAULT_COUNTRY=$(grep '^country:' "$CONFIG_FILE" | sed 's/^country: *//')

CITY="${1:-$DEFAULT_CITY,$DEFAULT_COUNTRY}"
ENCODED_CITY=$(printf '%s' "$CITY" | sed 's/ /+/g')

JSON=$(curl -s "wttr.in/${ENCODED_CITY}?format=j1&lang=es")

CITY_NAME=$(echo "$JSON" | jq -r '.nearest_area[0].areaName[0].value')
COUNTRY=$(echo "$JSON" | jq -r '.nearest_area[0].country[0].value')
TEMP=$(echo "$JSON" | jq -r '.current_condition[0].temp_C')
FEELS=$(echo "$JSON" | jq -r '.current_condition[0].FeelsLikeC')
DESC=$(echo "$JSON" | jq -r '.current_condition[0].lang_es[0].value // .current_condition[0].weatherDesc[0].value')
HUMIDITY=$(echo "$JSON" | jq -r '.current_condition[0].humidity')
WIND=$(echo "$JSON" | jq -r '.current_condition[0].windspeedKmph')
VISIBILITY=$(echo "$JSON" | jq -r '.current_condition[0].visibility')

echo "Clima actual en $CITY_NAME, $COUNTRY"
echo "  Descripción:     $DESC"
echo "  Temperatura:     ${TEMP}°C (sensación ${FEELS}°C)"
echo "  Humedad:         ${HUMIDITY}%"
echo "  Viento:          ${WIND} km/h"
echo "  Visibilidad:     ${VISIBILITY} km"
echo ""
echo "Pronóstico próximos 3 días:"
echo "$JSON" | jq -r '.weather[] | "  \(.date): min \(.mintempC)°C / max \(.maxtempC)°C - \(.hourly[4].lang_es[0].value // .hourly[4].weatherDesc[0].value)"'
