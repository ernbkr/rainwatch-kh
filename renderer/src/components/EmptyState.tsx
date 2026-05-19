import { Center, Loader, Stack, Text } from '@mantine/core';

interface EmptyStateProps {
  message: string;
  loading: boolean;
}

/** Overlay shown while the radar animation has no frame to display. */
export function EmptyState({ message, loading }: EmptyStateProps) {
  return (
    <Center
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        background: 'rgba(13, 15, 16, 0.82)'
      }}
    >
      <Stack align="center" gap="sm">
        {loading && <Loader color="teal" />}
        <Text c="dimmed" ta="center">
          {message}
        </Text>
      </Stack>
    </Center>
  );
}
