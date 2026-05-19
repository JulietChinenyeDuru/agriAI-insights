/**
 * ResultsScreen
 * Displays the AI yield prediction and lets the user save it to local history.
 */
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@agriai/history';

export default function ResultsScreen({ route, navigation }) {
  const { prediction } = route.params;
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    try {
      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const list = raw ? JSON.parse(raw) : [];
      const exists = list.some((p) => p.prediction_id === prediction.prediction_id);
      if (!exists) {
        list.unshift(prediction);
        await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
      }
      setSaved(true);
      Alert.alert('Saved', 'Prediction saved to local history.');
    } catch (err) {
      Alert.alert('Save failed', err.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.headline}>
        <Text style={styles.headlineLabel}>Predicted Total Yield</Text>
        <Text style={styles.headlineValue}>
          {prediction.predicted_yield_tonnes} t
        </Text>
        <Text style={styles.headlineSub}>
          {prediction.predicted_yield_per_hectare} t/ha · confidence{' '}
          {(prediction.confidence * 100).toFixed(0)}%
        </Text>
      </View>

      <View style={styles.detailCard}>
        <Row label="Crop" value={prediction.crop} capitalize />
        <Row label="State" value={prediction.state} />
        <Row label="Region" value={prediction.region} />
        <Row label="Farm size" value={`${prediction.farm_size_hectares} ha`} />
        <Row label="Season" value={prediction.season} capitalize />
      </View>

      <View style={styles.recommendation}>
        <Text style={styles.recommendationLabel}>Recommendation</Text>
        <Text style={styles.recommendationText}>{prediction.recommendation}</Text>
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saved && styles.saveBtnSaved]}
        onPress={handleSave}
        disabled={saved}
      >
        <Text style={styles.saveBtnText}>
          {saved ? 'Saved to History ✓' : 'Save to History'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.linkBtnText}>View All Saved Predictions →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkBtn}
        onPress={() => navigation.popToTop()}
      >
        <Text style={styles.linkBtnText}>Back to Home</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Row({ label, value, capitalize }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, capitalize && { textTransform: 'capitalize' }]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, backgroundColor: '#F1F8E9' },
  headline: {
    backgroundColor: '#2E7D32',
    borderRadius: 14,
    padding: 22,
    alignItems: 'center',
    marginBottom: 18,
  },
  headlineLabel: { color: '#C8E6C9', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 },
  headlineValue: { color: '#FFFFFF', fontSize: 44, fontWeight: '800', marginTop: 4 },
  headlineSub: { color: '#C8E6C9', marginTop: 6, fontSize: 13 },
  detailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F8E9',
  },
  rowLabel: { color: '#558B2F', fontSize: 13 },
  rowValue: { color: '#1B5E20', fontSize: 14, fontWeight: '600' },
  recommendation: {
    backgroundColor: '#FFF8E1',
    borderLeftWidth: 4,
    borderLeftColor: '#FBC02D',
    padding: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  recommendationLabel: { fontSize: 12, fontWeight: '700', color: '#F57F17', marginBottom: 4 },
  recommendationText: { color: '#5D4037', fontSize: 14, lineHeight: 20 },
  saveBtn: {
    backgroundColor: '#1B5E20',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveBtnSaved: { backgroundColor: '#558B2F' },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  linkBtn: { paddingVertical: 12, alignItems: 'center' },
  linkBtnText: { color: '#2E7D32', fontWeight: '600' },
});
