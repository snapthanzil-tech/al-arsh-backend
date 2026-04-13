import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { getBackendHealth, getDashboardSummary, API_BASE_URL } from '../services/api';

interface DashboardData {
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

export default function DashboardScreen({ onLogout }: { onLogout?: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      await getBackendHealth();
      const result = await getDashboardSummary();
      setData(result);
    } catch (err: any) {
      setError(
        `ഡാറ്റ ലോഡ് ചെയ്യുന്നതിൽ പിഴവ് സംഭവിച്ചു. ബാക്കെൻഡ് ഈ URL-ൽ ഓണോ എന്ന് പരിശോധിക്കുക: ${API_BASE_URL}/api/health. ${err?.message || 'ദയവായി സർവർ സ്റ്റാർട്ട് ചെയ്തിട്ടുണ്ടോ എന്ന് പരിശോധിക്കുക.'}`
      );
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>ഡാറ്റ ലോഡ് ചെയ്യുന്നു...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
        refreshing={!!refreshing}
        onRefresh={onRefresh}
        enabled={true}
        tintColor="#2563eb"
      />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>ഡാഷ്ബോർഡ് സംമറി</Text>
        {onLogout ? (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* പ്രധാന കണക്കുകൾ */}
      <View style={styles.grid}>
        <StatCard title="ആകെ ജോലികൾ" value={String(data?.totalWorks || 0)} color="#3b82f6" />
        <StatCard title="ആകെ ഇൻവോയിസുകൾ" value={String(data?.totalInvoices || 0)} color="#10b981" />
        <StatCard title="ആകെ തുക (AED)" value={String(data?.totalAmount?.toLocaleString() || 0)} color="#f59e0b" />
        <StatCard title="ഡെലിവർ ചെയ്തത്" value={String(data?.totalDelivered || 0)} color="#8b5cf6" />
        <StatCard title="പെൻഡിംഗ്" value={String(data?.totalPending || 0)} color="#ef4444" />
        <StatCard title="അൺപെയ്ഡ്" value={String(data?.totalUnpaid || 0)} color="#ec4899" />
      </View>

      {/* വർഷം തിരിച്ചുള്ള കണക്കുകൾ */}
      {data?.yearWiseData && data.yearWiseData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>വർഷം തിരിച്ചുള്ള കണക്കുകൾ</Text>
          {data.yearWiseData.slice(0, 5).map((item: any, index: number) => (
            <View key={index} style={styles.row}>
              <Text style={styles.rowLabel}>{item.year}</Text>
              <Text style={styles.rowValue}>{item.count} ജോലികൾ</Text>
            </View>
          ))}
        </View>
      )}

      {/* എമിറേറ്റ്സ് തിരിച്ചുള്ള കണക്കുകൾ */}
      {data?.emirateWiseData && data.emirateWiseData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>എമിറേറ്റ്സ് തിരിച്ച്</Text>
          {data.emirateWiseData.slice(0, 7).map((item: any, index: number) => (
            <View key={index} style={styles.row}>
              <Text style={styles.rowLabel}>{item.emirate}</Text>
              <Text style={styles.rowValue}>{item.count}</Text>
            </View>
          ))}
        </View>
      )}
      
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

function StatCard({ title, value, color }: { title: string; value: string; color: string }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  errorText: { color: 'red', textAlign: 'center', padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerText: { fontSize: 24, fontWeight: 'bold', color: '#1f2937' },
  logoutButton: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#ef4444', borderRadius: 8 },
  logoutText: { color: '#fff', fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10 },
  card: { width: '48%', backgroundColor: '#fff', padding: 15, margin: '1%', borderRadius: 8, elevation: 2, borderLeftWidth: 4 },
  cardTitle: { fontSize: 14, color: '#6b7280', marginBottom: 5 },
  cardValue: { fontSize: 20, fontWeight: 'bold', color: '#1f2937' },
  section: { backgroundColor: '#fff', margin: 10, padding: 15, borderRadius: 8, elevation: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#374151' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowLabel: { color: '#4b5563' },
  rowValue: { fontWeight: '600', color: '#1f2937' },
});