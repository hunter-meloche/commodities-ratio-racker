// Raw data from data.json
export interface AssetPoint {
  date: string;
  price: number;
}

export type AssetType = "index" | "metal" | "energy" | "industrial";

export interface AssetInfo {
  symbol: string;
  name: string;
  type: AssetType;
  unit: string;
  timeseries: AssetPoint[];
}

export interface RawAlert {
  asset_a: string;
  asset_b: string;
  name: string;
  z_score: number;
  direction: "a_overvalued" | "b_overvalued";
  signal: "revert_down" | "revert_up";
  message: string;
}

export interface RatioData {
  generated_at: string;
  assets: Record<string, AssetInfo>;
  if_anomaly_dates: string[];
  alerts: RawAlert[];
}

// Derived pair computed in the frontend
export interface ComputedPoint {
  date: string;
  price_a: number;
  price_b: number;
  ratio: number;
  mean: number;
  upper_band: number;
  lower_band: number;
  z_score: number;
  is_anomaly: boolean;
  if_anomaly: boolean;
}

export interface DerivedPair {
  name: string;
  asset_a: AssetInfo;
  asset_b: AssetInfo;
  timeseries: ComputedPoint[];
  current: {
    ratio: number;
    z_score: number;
    mean: number;
    upper_band: number;
    lower_band: number;
    price_a: number;
    price_b: number;
    is_anomaly: boolean;
    if_anomaly: boolean;
    direction: "a_overvalued" | "b_overvalued" | null;
  };
}
