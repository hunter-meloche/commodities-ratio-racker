export interface TimeseriesPoint {
  date: string;
  ratio: number;
  mean: number;
  upper_band: number;
  lower_band: number;
  z_score: number;
  is_anomaly: boolean;
  if_anomaly: boolean;
}

export interface PairCurrent {
  ratio: number;
  z_score: number;
  mean: number;
  upper_band: number;
  lower_band: number;
  is_anomaly: boolean;
  if_anomaly: boolean;
  direction: "metals_undervalued" | "metals_overvalued" | null;
  signal: "revert_to_metals" | "revert_to_equities" | null;
}

export interface RatioPair {
  id: string;
  name: string;
  index_symbol: string;
  metal_symbol: string;
  date_range: { start: string; end: string };
  current: PairCurrent;
  timeseries: TimeseriesPoint[];
}

export interface Alert {
  pair_id: string;
  pair_name: string;
  z_score: number;
  direction: "metals_undervalued" | "metals_overvalued";
  signal: "revert_to_metals" | "revert_to_equities";
  message: string;
}

export interface RatioData {
  generated_at: string;
  pairs: RatioPair[];
  alerts: Alert[];
}
