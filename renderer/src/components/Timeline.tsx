import { ActionIcon, Alert, Group, Stack } from '@mantine/core';
import { IconPlayerPauseFilled, IconPlayerPlayFilled } from '@tabler/icons-react';
import type { Frame } from '../lib/types';
import { TimeRuler } from './TimeRuler';

interface TimelineProps {
  frames: Frame[];
  currentIndex: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onScrub: (index: number) => void;
  onScrubStart: () => void;
  error: string;
}

/** The footer: play/pause control, the time-axis ruler, and errors. */
export function Timeline({
  frames,
  currentIndex,
  isPlaying,
  onTogglePlay,
  onScrub,
  onScrubStart,
  error
}: TimelineProps) {
  return (
    <Stack h="100%" px="md" py="xs" gap={4} justify="center">
      <Group gap="md" wrap="nowrap" align="center">
        <ActionIcon
          variant="filled"
          color="teal"
          size="lg"
          radius="xl"
          onClick={onTogglePlay}
          aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          {isPlaying ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}
        </ActionIcon>
        <TimeRuler
          frames={frames}
          currentIndex={currentIndex}
          onScrub={onScrub}
          onScrubStart={onScrubStart}
        />
      </Group>
      {error && (
        <Alert color="red" variant="light" py={4}>
          {error}
        </Alert>
      )}
    </Stack>
  );
}
