/**
 * API Data Contracts & TypeScript Interfaces
 */

export interface BackendPredictionResponse {
  predicted_cashflow: number;
  liquidity_score: number;
  risk: string; // e.g. "Stable", "Moderate Risk", "High Risk", "Critical"
  recommendations: string[];
}

export interface OCRUploadResponse extends BackendPredictionResponse {
  extracted_transactions: TransactionItem[];
  raw_text_snippet?: string;
  total_extracted?: number;
  inflow_total?: number;
  outflow_total?: number;
  confidence_note?: string;
}

export interface ForecastPoint {
  date: string;
  predicted_cashflow: number;
  lower_ci: number;
  upper_ci: number;
  actual_cashflow?: number;
  is_forecast: boolean;
  cash_in?: number;
  cash_out?: number;
  balance?: number;
}

export interface ModelMetrics {
  model_name: string;
  trained_date: string;
  rmse: number;
  mae: number;
  r2: number;
  horizon_days: number;
  sample_size: number;
}

export interface FeatureImportance {
  feature: string;
  importance: number; // 0 to 1
  impact: 'positive' | 'negative' | 'neutral';
  description: string;
}

export interface TransactionItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  type: 'inflow' | 'outflow';
  balance: number;
}

export interface ScenarioParams {
  inflow_multiplier: number; // e.g. 1.10 = +10%
  outflow_multiplier: number; // e.g. 0.95 = -5%
  horizon_days: number;
}

export interface LiquidityAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  suggested_action: string;
  timestamp: string;
}

export interface FullForecastResult {
  next_day_cashflow: number;
  liquidity_score: number;
  risk: 'Stable' | 'Moderate Risk' | 'High Risk' | 'Critical';
  recommendations: string[];
  points: ForecastPoint[];
  metrics: ModelMetrics;
  feature_importance: FeatureImportance[];
  historical_burn_rate_30d: number;
  runway_days: number;
  current_balance: number;
  generated_at: string;
}

export type UserRole = 'financial_analyst' | 'finance_manager' | 'cfo_executive';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  is_verified?: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user: UserProfile;
}

export interface ApiMessageResponse {
  message: string;
  detail?: string;
}
