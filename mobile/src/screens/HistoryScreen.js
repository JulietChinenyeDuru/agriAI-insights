/**
 * HistoryScreen
 * Lists predictions saved locally via AsyncStorage on the device.
 */
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@agriai/history';

export default function HistoryScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch (err) {
      Alert.alert('Load failed', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleClear = () => {
    Alert.alert('Clear history?', 'This will remove all saved predictions.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(HISTORY_KEY);
          setItems([]);
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2E7D32" size="large" />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyTitle}>No saved predictions yet</Text>
        <Text style={styles.emptySub}>
          Run a prediction and tap "Save to History" to keep it here.
        </Text>
        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate('Prediction')}
        >
          <Text style={styles.ctaText}>Start a Prediction</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.prediction_id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('Results', { prediction: item })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardCrop}>{item.crop}</Text>
              <Text style={styles.cardYield}>{item.predicted_yield_tonnes} t</Text>
            </View>
            <Text style={styles.cardMeta}>
              {item.state} · {item.farm_size_hectares} ha · {item.season} season
            </Text>
            <Text style={styles.cardDate}>
              {new Date(item.created_at).toLocaleString()}
            </Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
        <Text style={styles.clearBtnText}>Clear History</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F8E9' },
  centered: {
    flex: 1,
    backgroundColor: '#F1F8E9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1B5E20' },
  emptySub: { fontSize: 13, color: '#558B2F', textAlign: 'center', marginTop: 8 },
  cta: {
    marginTop: 20,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  ctaText: { color: '#FFFFFF', fontWeight: '700' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardCrop: { fontSize: 16, fontWeight: '700', color: '#1B5E20', textTransform: 'capitalize' },
  cardYield: { fontSize: 16, fontWeight: '700', color: '#2E7D32' },
  cardMeta: { fontSize: 13, color: '#37474F', marginTop: 6 },
  cardDate: { fontSize: 11, color: '#9E9E9E', marginTop: 6 },
  clearBtn: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#DCEDC8',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  clearBtnText: { color: '#C62828', fontWeight: '700' },
});
