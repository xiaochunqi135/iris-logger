import { useEffect, useState } from "react";
import {
  type Coordinates,
  getCurrentPosition,
} from "@tauri-apps/plugin-geolocation";
import { invoke } from "@tauri-apps/api/core";

interface Weather {
  weather: string;
}

function Weather({ hasLocationPermission = false }) {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [weather, setWeather] = useState<string>("晴");

  useEffect(() => {
    async function fetchWeather() {
      let pos = {
        "latitude": 27.682981,
        "longitude": 102.2003087,
        "accuracy": 100,
        "altitudeAccuracy": 100,
        "altitude": 1000,
        "speed": 0,
        "heading": 0,
      } as Coordinates;

      try {
        if (hasLocationPermission) {
          const position = await getCurrentPosition();
          pos = position.coords;
        }
      } catch (e) {
        console.error("getCurrentPosition failed", e);
      }

      const result = await invoke("update_weather", {
        gps_location: JSON.stringify(pos),
      }) as Weather;
      if (result) {
        setWeather(result.weather);
      }
      setIsLoading(false);
    }

    fetchWeather();
  }, [hasLocationPermission]);

  return (
    <div>
      <span className="font-bold">天气：</span>
      <span>{isLoading ? "加载中..." : weather}</span>
    </div>
  );
}

export default Weather;
