import { Group, Stack, Text } from '@mantine/core';
import { formatClock } from '../lib/format';
import { AppMenu, type AppMenuProps } from './AppMenu';

interface StatusBarProps extends AppMenuProps {
  latestLabel: string;
  currentLabel: string;
  lastChecked: Date | null;
  nextRefresh: Date | null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2} miw={0}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed">
        {label}
      </Text>
      <Text fw={600} truncate>
        {value}
      </Text>
    </Stack>
  );
}

/** The header: four radar status readouts and the app menu. */
export function StatusBar({
  latestLabel,
  currentLabel,
  lastChecked,
  nextRefresh,
  ...menu
}: StatusBarProps) {
  return (
    <Group h="100%" px="md" gap="xl" wrap="nowrap">
      <Stat label="Latest" value={latestLabel} />
      <Stat label="Current" value={currentLabel} />
      <Stat label="Last Checked" value={formatClock(lastChecked)} />
      <Stat label="Next Check" value={formatClock(nextRefresh)} />
      <Group ml="auto">
        <AppMenu {...menu} />
      </Group>
    </Group>
  );
}
