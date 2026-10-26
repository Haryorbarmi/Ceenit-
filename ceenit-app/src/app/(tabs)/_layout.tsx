import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Icon, IconName } from '@/components/Icon';
import { color, fonts, tone } from '@/theme/tokens';

const tabIcon = (name: IconName) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Icon name={name} size={24} tone={focused ? 'accent' : 'tertiary'} />;
  };

function NewButton() {
  return (
    <View style={styles.newButton}>
      <Icon name="plus" size={24} tone="inverse" />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: tone.accent.solid,
        tabBarInactiveTintColor: color.textTertiary,
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 12 },
        tabBarStyle: { backgroundColor: color.bgPage, borderTopColor: color.borderDefault },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: tabIcon('clock') }} />
      <Tabs.Screen name="new" options={{ title: 'New', tabBarIcon: () => <NewButton /> }} />
      <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: tabIcon('user') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  newButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: tone.accent.solid, alignItems: 'center', justifyContent: 'center' },
});
