import React from 'react';
import { Linking } from 'react-native';
import { Button, Info } from './ui';
import type { Json } from './types';

export function TripMap({ point }: { point?: Json; tileURL?: string }) {
  if (!point) return <Info>Waiting for the driver's first GPS fix.</Info>;
  return <Button secondary onPress={() => Linking.openURL(`https://www.google.com/maps?q=${point.latitude},${point.longitude}`)}>Open driver location in Google Maps</Button>;
}
