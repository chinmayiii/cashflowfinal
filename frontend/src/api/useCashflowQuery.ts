import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadStatementApi, uploadStatementImageApi, predictCashflowApi } from './client';
import { ScenarioParams } from './types';
import { useCashflowStore } from '../store/useCashflowStore';
import { useToastStore } from '../store/useToastStore';
import { formatCurrency } from '../utils/formatters';

export function useUploadStatementImage() {
  const queryClient = useQueryClient();
  const { isMockMode, setBaselineForecastResult, setTransactions, scenario } = useCashflowStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: async (file: File) => {
      return await uploadStatementImageApi(file, isMockMode, scenario);
    },
    onSuccess: (data) => {
      setBaselineForecastResult(data);
      if (data.ocrTransactions && data.ocrTransactions.length > 0) {
        setTransactions(data.ocrTransactions);
      }
      queryClient.invalidateQueries({ queryKey: ['cashflowForecast'] });
      addToast({
        type: 'success',
        title: 'Photo Analyzed via OCR',
        message: `Extracted ${data.totalExtracted || data.ocrTransactions.length} transactions. Forecasted cashflow: ${formatCurrency(data.next_day_cashflow)}`,
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'OCR Extraction Failed',
        message: error.message || 'Failed to extract text from photo. Please ensure clear lighting.',
      });
    },
  });
}

export function useUploadStatement() {
  const queryClient = useQueryClient();
  const { isMockMode, transactions, setBaselineForecastResult, scenario } = useCashflowStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: async (file: File) => {
      return await uploadStatementApi(file, isMockMode, transactions, scenario);
    },
    onSuccess: (data) => {
      setBaselineForecastResult(data);
      queryClient.invalidateQueries({ queryKey: ['cashflowForecast'] });
      addToast({
        type: 'success',
        title: 'Statement Uploaded & Analyzed',
        message: `Successfully processed file. Next-day cashflow forecast: ${formatCurrency(data.next_day_cashflow)}`,
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Upload Failed',
        message: error.message || 'Failed to process bank statement. Please verify CSV format.',
      });
    },
  });
}

export function usePredictCashflow() {
  const { isMockMode, transactions, setScenarioForecastResult, scenario } = useCashflowStore();
  const { addToast } = useToastStore();

  return useMutation({
    mutationFn: async (customScenario?: ScenarioParams) => {
      const activeScenario = customScenario || scenario;
      return await predictCashflowApi(activeScenario, isMockMode, transactions);
    },
    onSuccess: (data) => {
      setScenarioForecastResult(data);
      addToast({
        type: 'info',
        title: 'Stress Test Recalculated',
        message: `Recalculated predictions for uploaded statement. Risk status: ${data.risk} (Score: ${data.liquidity_score})`,
      });
    },
    onError: (error: Error) => {
      addToast({
        type: 'error',
        title: 'Prediction Error',
        message: error.message || 'Unable to re-run forecast model.',
      });
    },
  });
}
