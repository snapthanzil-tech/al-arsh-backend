import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export interface DashboardData {
  totalWorks: number;
  totalInvoices: number;
  totalAmount: number;
  totalDelivered: number;
  totalPending: number;
  totalUnpaid: number;
  yearWiseData: any[];
  clientWiseData: any[];
  projectWiseData: any[];
  emirateWiseData: any[];
}

export interface HealthResponse {
  message: string;
}

const getHostFromUri = (uri?: string) => {
  if (!uri) {
    return undefined;
  }

  const match = uri.match(/^(?:.*:\/\/)?([^:/]+)(?::\d+)?/);
  return match ? match[1] : undefined;
};

const getHostValue = () => {
  const manifest = Constants.manifest as any;
  const manifest2 = (Constants as any).manifest2 as any;
  const expoConfig = Constants.expoConfig as any;

  const candidates = [
    manifest?.debuggerHost,
    manifest?.hostUri,
    manifest2?.debuggerHost,
    manifest2?.hostUri,
    expoConfig?.hostUri,
    expoConfig?.extra?.hostUri,
    expoConfig?.extra?.apiHost,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const host = getHostFromUri(candidate);
      if (host) {
        return host;
      }
    }
  }

  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
};

export const API_BASE_URL = __DEV__ ? `http://${getHostValue()}:3000` : 'http://localhost:3000';

if (__DEV__) {
  console.log('API_BASE_URL:', API_BASE_URL);
}

export const getDashboardSummary = async (): Promise<DashboardData> => {
  const response = await axios.get<{ success: boolean; summary: DashboardData }>(
    `${API_BASE_URL}/api/dashboard-summary`
  );

  return response.data.summary;
};

export const getBackendHealth = async (): Promise<string> => {
  const response = await axios.get<HealthResponse>(`${API_BASE_URL}/api/health`);
  return response.data.message;
};
