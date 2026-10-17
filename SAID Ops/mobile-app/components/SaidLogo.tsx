import { Image, StyleSheet } from 'react-native';

type SaidLogoProps = {
  size: number;
};

export function SaidLogo({ size }: SaidLogoProps) {
  return (
    <Image
      accessibilityLabel="SAID logo"
      resizeMode="contain"
      source={require('../assets/said_logo.png')}
      style={[styles.logo, { height: size, width: size }]}
    />
  );
}

const styles = StyleSheet.create({
  logo: { flexShrink: 0 },
});
