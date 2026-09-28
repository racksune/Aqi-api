const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const airQualityFields = [
  "pm10",
  "pm2_5",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "dust",
  "aerosol_optical_depth",
  "european_aqi",
  "european_aqi_pm2_5",
  "european_aqi_pm10",
  "european_aqi_nitrogen_dioxide",
  "european_aqi_ozone",
  "european_aqi_sulphur_dioxide",
  "us_aqi",
  "us_aqi_pm2_5",
  "us_aqi_pm10",
  "us_aqi_nitrogen_dioxide",
  "us_aqi_ozone",
  "us_aqi_sulphur_dioxide",
].join(",");

const pollutantFields = [
  "pm10",
  "pm2_5",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "dust",
  "aerosol_optical_depth",
];

const europeanAqiFields = [
  "european_aqi",
  "european_aqi_pm2_5",
  "european_aqi_pm10",
  "european_aqi_nitrogen_dioxide",
  "european_aqi_ozone",
  "european_aqi_sulphur_dioxide",
];

const usAqiFields = [
  "us_aqi",
  "us_aqi_pm2_5",
  "us_aqi_pm10",
  "us_aqi_nitrogen_dioxide",
  "us_aqi_ozone",
  "us_aqi_sulphur_dioxide",
];

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function queryFromRequest(req) {
  if (req.query) return req.query;
  const url = new URL(req.url || "/", "https://vercel.local");
  return Object.fromEntries(url.searchParams.entries());
}

function numberQueryValue(value, fallback) {
  const parsed = Number(firstQueryValue(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function usAqiCategory(value) {
  if (value === null || value === undefined) return null;
  if (value <= 50) return "Good";
  if (value <= 100) return "Moderate";
  if (value <= 150) return "Unhealthy for sensitive groups";
  if (value <= 200) return "Unhealthy";
  if (value <= 300) return "Very unhealthy";
  return "Hazardous";
}

function europeanAqiCategory(value) {
  if (value === null || value === undefined) return null;
  if (value <= 20) return "Good";
  if (value <= 40) return "Fair";
  if (value <= 60) return "Moderate";
  if (value <= 80) return "Poor";
  if (value <= 100) return "Very poor";
  return "Extremely poor";
}

function pickFields(source, fields) {
  const result = {};
  for (const field of fields) {
    result[field] = source?.[field] ?? null;
  }
  return result;
}

function addCategories(row) {
  return {
    ...row,
    us_aqi_category: usAqiCategory(row.us_aqi),
    european_aqi_category: europeanAqiCategory(row.european_aqi),
  };
}

function zipHourly(hourly) {
  if (!hourly?.time) return [];

  return hourly.time.map((time, index) => {
    const row = { time };
    for (const field of airQualityFields.split(",")) {
      row[field] = hourly[field]?.[index] ?? null;
    }
    return addCategories(row);
  });
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=900, stale-while-revalidate=3600",
  );

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    sendJson(res, 405, {
      success: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Sirf GET request allowed hai.",
      },
    });
    return;
  }

  const query = queryFromRequest(req);
  const city = String(firstQueryValue(query.city) || "").trim();

  if (!city) {
    sendJson(res, 400, {
      success: false,
      error: {
        code: "CITY_REQUIRED",
        message: "City query required hai. Example: /api/aqi?city=Delhi",
      },
    });
    return;
  }

  if (city.length > 100) {
    sendJson(res, 400, {
      success: false,
      error: {
        code: "CITY_TOO_LONG",
        message: "City name 100 characters se chhota hona chahiye.",
      },
    });
    return;
  }

  const requestedDays = numberQueryValue(query.days, 5);
  const forecastDays = Math.min(7, Math.max(1, Math.round(requestedDays)));
  const language = String(firstQueryValue(query.language) || "en");

  try {
    const geocodingParams = new URLSearchParams({
      name: city,
      count: "1",
      language,
      format: "json",
    });

    const geocodingResponse = await fetch(
      `${GEOCODING_URL}?${geocodingParams}`,
      {
        headers: {
          "User-Agent": "keyless-aqi-api/1.0",
        },
      },
    );

    if (!geocodingResponse.ok) {
      throw new Error(`Geocoding request failed: ${geocodingResponse.status}`);
    }

    const geocodingData = await geocodingResponse.json();
    const location = geocodingData.results?.[0];

    if (!location) {
      sendJson(res, 404, {
        success: false,
        error: {
          code: "CITY_NOT_FOUND",
          message: `AQI data nahi mila: ${city}`,
        },
      });
      return;
    }

    const forecastParams = new URLSearchParams({
      latitude: Number(location.latitude).toFixed(4),
      longitude: Number(location.longitude).toFixed(4),
      timezone: "auto",
      forecast_days: String(forecastDays),
      domains: "cams_global",
      current: airQualityFields,
      hourly: airQualityFields,
    });

    const airQualityResponse = await fetch(
      `${AIR_QUALITY_URL}?${forecastParams}`,
      {
        headers: {
          "User-Agent": "keyless-aqi-api/1.0",
        },
      },
    );

    if (!airQualityResponse.ok) {
      throw new Error(`Air quality request failed: ${airQualityResponse.status}`);
    }

    const airQuality = await airQualityResponse.json();
    const current = addCategories({
      time: airQuality.current?.time ?? null,
      ...pickFields(airQuality.current, pollutantFields),
      ...pickFields(airQuality.current, europeanAqiFields),
      ...pickFields(airQuality.current, usAqiFields),
    });

    sendJson(res, 200, {
      success: true,
      source: "Open-Meteo Air Quality API",
      attribution: "Air quality data by Open-Meteo.com",
      request: {
        city,
        forecast_days: forecastDays,
        timezone: airQuality.timezone,
      },
      location: {
        name: location.name,
        country: location.country,
        country_code: location.country_code,
        region: location.admin1 || null,
        latitude: airQuality.latitude,
        longitude: airQuality.longitude,
        elevation: airQuality.elevation,
      },
      current: {
        units: airQuality.current_units,
        data: current,
      },
      hourly: {
        units: airQuality.hourly_units,
        data: zipHourly(airQuality.hourly),
      },
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("AQI API error:", error);
    sendJson(res, 502, {
      success: false,
      error: {
        code: "AQI_PROVIDER_ERROR",
        message: "AQI provider se data lene me problem hui.",
      },
    });
  }
};
