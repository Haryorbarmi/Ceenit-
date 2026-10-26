import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Input } from '@/components/Input';
import { OptionChip } from '@/components/Chips';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TxnRow } from '@/components/TxnRow';
import { useLinks } from '@/state/links';
import { spacing } from '@/theme/tokens';

const filters = ['All', 'Paid', 'Pending', 'Review'] as const;
type Filter = (typeof filters)[number];

export default function History() {
  const { txns } = useLinks();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

  const shown = txns.filter((t) => {
    const byStatus =
      filter === 'All' || (filter === 'Review' ? t.status === 'Needs attention' : t.status === filter);
    const q = query.trim().toLowerCase();
    return byStatus && (!q || t.item.toLowerCase().includes(q) || t.amount.includes(q));
  });

  return (
    <Screen>
      <Text variant="h1" style={{ paddingTop: spacing.xs }}>History</Text>
      <Input label="Search" value={query} onChangeText={setQuery} placeholder="Search by item or amount" autoCapitalize="none" />
      <View style={styles.chips}>
        {filters.map((f) => <OptionChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />)}
      </View>
      {(['Today', 'Earlier'] as const).map((g) => {
        const rows = shown.filter((t) => t.group === g);
        return rows.length ? (
          <View key={g}>
            <Text variant="label" tone="tertiary">{g}</Text>
            {rows.map((t) => <TxnRow key={t.id} txn={t} />)}
          </View>
        ) : null;
      })}
      {shown.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="search" size={28} tone="tertiary" />
          <Text tone="secondary">No payments match this search.</Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
});
