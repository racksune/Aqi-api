# Keyless AQI API

Vercel-ready serverless AQI API using Open-Meteo Air Quality. Isme weather data nahi hai; sirf air quality aur AQI data hai.

## Endpoint

```text
GET /api/aqi?city=Delhi
```

Optional query parameters:

```text
/api/aqi?city=Delhi&days=5
/api/aqi?city=Mumbai&days=7
/api/aqi?city=London&days=3&language=en
```

- `city`: required city name
- `days`: hourly AQI forecast, `1` se `7` tak; default `5`
- `language`: city search language; default `en`

## Response data

- US AQI and European AQI
- PM2.5 and PM10
- Carbon monoxide
- Nitrogen dioxide
- Sulphur dioxide
- Ozone
- Dust and aerosol optical depth
- Per-pollutant AQI breakdown
- AQI category
- 5-day hourly data by default

## Deploy on Vercel

1. `aqi-api` folder ko separate GitHub repository me upload karo.
2. Vercel me **Add New Project** se repository import karo.
3. Framework preset **Other** select karo.
4. Build command blank rakho.
5. Deploy karo.

Deploy ke baad:

```text
https://YOUR-DOMAIN.vercel.app/api/aqi?city=Delhi
```

## Notes

- App-level rate limit nahi lagaya gaya.
- CDN caching ke liye `s-maxage=900` aur `stale-while-revalidate=3600` set hai.
- Open-Meteo ke free usage limits aur license follow karo.
- Public app me attribution rakho: `Air quality data by Open-Meteo.com`.