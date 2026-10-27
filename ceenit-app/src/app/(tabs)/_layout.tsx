import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { palette, tone } from '@/theme/tokens';

// The system tab bar: on iOS 26 it is Apple's floating "liquid glass" bar (the same one WhatsApp uses),
// and on older iPhones it is the standard frosted bar. It shrinks out of the way when you scroll down.
export default function TabsLayout() {
  return (
    <NativeTabs
      tintColor={tone.accent.solid}
      iconColor={{ default: palette.n400, selected: tone.accent.solid }}
      labelStyle={{ default: { color: palette.n400, fontWeight: '400' }, selected: { color: tone.accent.solid, fontWeight: '700' } }}
      minimizeBehavior="onScrollDown"
    >
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <NativeTabs.Trigger.Icon sf={{ default: 'clock', selected: 'clock.fill' }} md="history" />
        <NativeTabs.Trigger.Label>History</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="new">
        <NativeTabs.Trigger.Icon sf={{ default: 'plus.circle', selected: 'plus.circle.fill' }} md="add_circle" />
        <NativeTabs.Trigger.Label>New</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} md="person" />
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
