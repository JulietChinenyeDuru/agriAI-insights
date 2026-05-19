/**
 * PredictionScreen
 * Farm data input form that submits to the AgriAI /predict endpoint.
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ApiService from '../services/ApiService';

const SOIL_OPTIONS = ['poor', 'medium', 'good'];

export default function PredictionScreen({ navigation }) {
  const [states, setStates] = useState([]);
  const [crops, setCrops] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [state, setState] = useState('');
  const [crop, setCrop] = useState('');
  const [farmSize, setFarmSize] = useState('');
  const [rainfall, setRainfall] = useState('');
  const [fertilizer, setFertilizer] = useState('');
  const [soil, setSoil] = useState('medium');

  useEffect(() => {
    Promise.all([ApiService.getRegions(), ApiService.getCrops()])
      .then(([regionsData, cropsData]) => {
        setStates(regionsData.states || []);
        setCrops((cropsData.crops || []).map((c) => c.name));
      })
      .catch((err) => Alert.alert('Network error', err.message))
      .finally(() => setLoadingMeta(false));
  }, []);

  const handleSubmit = async () => {
    if (!state || !crop || !farmSize) {
      Alert.alert('Missing fields', 'Please select a state, crop, and farm size.');
      return;
    }
    const size = parseFloat(farmSize);
    if (Number.isNaN(size) || size <= 0) {
      Alert.alert('Invalid input', 'Farm size must be a positive number.');
      return;
    }

    const payload = {
      state,
      crop,
      farm_size_hectares: size,
      rainfall_mm: rainfall ? parseFloat(rainfall) : null,
      fertilizer_kg_per_ha: fertilizer ? parseFloat(fertilizer) : null,
      soil_quality: soil,
    };

    setSubmitting(true);
    try {
      const result = await ApiService.predictYield(payload);
      navigation.navigate('Results', { prediction: result });
    } catch (err) {
      Alert.alert('Prediction failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingMeta) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#2E7D32" size="large" />
        <Text style={styles.loadingText}>Loading reference data…</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>State *</Text>
      <ChipPicker options={states} value={state} onChange={setState} />

      <Text style={styles.label}>Crop *</Text>
      <ChipPicker options={crops} value={crop} onChange={setCrop} />

      <Text style={styles.label}>Farm size (hectares) *</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="e.g. 2.5"
        value={farmSize}
        onChangeText={setFarmSize}
      />

      <Text style={styles.label}>Expected rainfall (mm)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="optional"
        value={rainfall}
        onChangeText={setRainfall}
      />

      <Text style={styles.label}>Fertilizer (kg per hectare)</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        placeholder="optional"
        value={fertilizer}
        onChangeText={setFertilizer}
      />

      <Text style={styles.label}>Soil quality</Text>
      <ChipPicker options={SOIL_OPTIONS} value={soil} onChange={setSoil} />

      <TouchableOpacity
        style={[styles.submit, submitting && styles.submitDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitText}>Predict Yield</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

function ChipPicker({ options, value, onChange }) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 18, backgroundColor: '#F1F8E9' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F8E9' },
  loadingText: { marginTop: 12, color: '#33691E' },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#33691E',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#C5E1A5',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C5E1A5',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: { backgroundColor: '#2E7D32', borderColor: '#2E7D32' },
  chipText: { color: '#33691E', fontSize: 13, textTransform: 'capitalize' },
  chipTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  submit: {
    backgroundColor: '#2E7D32',
    marginTop: 24,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
