export interface WeatherInfo {
  condition: string;
  windSpeedMs: number;
  temperatureCelsius: number;
}

export interface HazardInfo {
  fallDistanceM: number;
  nearAirport: boolean;
  notamNote: string;
}

export interface RiskInfo {
  weather: WeatherInfo;
  hazard: HazardInfo;
}

export function getWeatherStub(): WeatherInfo {
  return {
    condition: "晴れ",
    windSpeedMs: 3.2,
    temperatureCelsius: 22,
  };
}

export function getHazardStub(fallDistanceM: number): HazardInfo {
  return {
    fallDistanceM,
    nearAirport: false,
    notamNote: "制限なし (モック)",
  };
}

export function getRiskStub(fallDistanceM: number): RiskInfo {
  return {
    weather: getWeatherStub(),
    hazard: getHazardStub(fallDistanceM),
  };
}
