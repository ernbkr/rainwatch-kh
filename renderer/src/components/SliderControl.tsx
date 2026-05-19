import { Group, Paper, Slider, Text } from '@mantine/core';

interface SliderControlProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  formatLabel: (value: number) => string;
}

/** A floating labelled slider — the shared design for the on-map map controls. */
export function SliderControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
  formatLabel
}: SliderControlProps) {
  return (
    <Paper withBorder radius="md" shadow="md" p="xs" w={240}>
      <Group gap="sm" wrap="nowrap">
        <Text size="xs" fw={700} tt="uppercase" c="dimmed" w={54}>
          {label}
        </Text>
        <Slider
          style={{ flex: 1 }}
          color="teal"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={onChange}
          label={formatLabel}
        />
      </Group>
    </Paper>
  );
}
