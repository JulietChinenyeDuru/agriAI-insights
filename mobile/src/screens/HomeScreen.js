/**
 * HomeScreen
 * Landing page showing current season and entry points to the main flows.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import ApiService from '../services/ApiService';

export default function HomeScreen({ navigation }) {
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    ApiService.getCurrentSeason()
      .then((data) => {
        if (mounted) setSeason(data);
      })
      .catch((err) => {
        if (mounted) setError(err.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>AgriAI</Text>
        <Text style={styles.heroSubtitle}>
          AI-powered yield predictions for Nigerian farmers
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Current Farming Season</Text>
        {loading && <ActivityIndicator color="#2E7D32" />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {season && (
          <>
            <Text style={styles.cardTitle}>{season.label}</Text>
            <Text style={styles.cardBody}>Months: {season.months}</Text>
            <Text style={styles.cardBody}>
              Primary crops: {season.primary_crops.join(', ')}
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Prediction')}
      >
        <Text style={styles.primaryButtonText}>Start New Prediction</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => navigation.navigate('History')}
      >
        <Text style={styles.secondaryButtonText}>View Saved Predictions</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Built for Nigerian smallholder farmers</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#F1F8E9', flexGrow: 1 },
  hero: { paddingVertical: 24, alignItems: 'center' },
  heroTitle: { fontSize: 40, fontWeight: '800', color: '#1B5E20' },
  heroSubtitle: { fontSize: 14, color: '#33691E', marginTop: 6, textAlign: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardLabel: { fontSize: 12, color: '#558B2F', textTransform: 'uppercase', marginBottom: 6 },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#1B5E20', marginBottom: 8 },
  cardBody: { fontSize: 14, color: '#37474F', marginTop: 2 },
  primaryButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2E7D32',
  },
  secondaryButtonText: { color: '#2E7D32', fontWeight: '700', fontSize: 16 },
  errorText: { color: '#C62828' },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { color: '#558B2F', fontSize: 12 },
});
