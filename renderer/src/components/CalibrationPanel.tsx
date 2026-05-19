import { useMemo } from 'react';
import {
  Button,
  Group,
  NumberInput,
  Paper,
  ScrollArea,
  SimpleGrid,
  Slider,
  Stack,
  Text,
  Textarea
} from '@mantine/core';
import {
  buildCalibrationSnippet,
  nudgeCoordinates,
  rotateCoordinates,
  scaleCoordinates
} from '../lib/calibration';
import { areaLabel } from '../lib/domains';
import type { DomainId, MapView, QuadCoordinates } from '../lib/types';

const CORNER_LABELS = ['Top Left', 'Top Right', 'Bottom Right', 'Bottom Left'] as const;

interface CalibrationPanelProps {
  domain: DomainId;
  view: MapView;
  views: Record<DomainId, MapView>;
  opacity: number;
  onOpacityChange: (value: number) => void;
  onCoordinatesChange: (coordinates: QuadCoordinates) => void;
}

function toNumber(value: number | string): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

/** Developer overlay (`--calibrate`) for georeferencing the radar overlay. */
export function CalibrationPanel({
  domain,
  view,
  views,
  opacity,
  onOpacityChange,
  onCoordinatesChange
}: CalibrationPanelProps) {
  const snippet = useMemo(() => buildCalibrationSnippet(opacity, views), [opacity, views]);
  const coordinates = view.coordinates;

  const setCorner = (cornerIndex: number, axis: 0 | 1, value: number) => {
    onCoordinatesChange(
      coordinates.map((point, index) => {
        if (index !== cornerIndex) {
          return point;
        }
        return axis === 0 ? [value, point[1]] : [point[0], value];
      }) as QuadCoordinates
    );
  };

  return (
    <Paper
      withBorder
      radius="md"
      shadow="md"
      p="md"
      style={{ position: 'absolute', top: 12, right: 12, zIndex: 5, width: 340 }}
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700} size="sm">
            Georeference
          </Text>
          <Text size="xs" fw={700} c="dimmed">
            {areaLabel(domain)}
          </Text>
        </Group>

        {coordinates.map((point, cornerIndex) => (
          <Stack key={CORNER_LABELS[cornerIndex]} gap={4}>
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              {CORNER_LABELS[cornerIndex]}
            </Text>
            <Group grow gap="xs">
              <NumberInput
                size="xs"
                hideControls
                decimalScale={6}
                step={0.001}
                value={point[0]}
                aria-label={`${CORNER_LABELS[cornerIndex]} longitude`}
                onChange={(value) => setCorner(cornerIndex, 0, toNumber(value))}
              />
              <NumberInput
                size="xs"
                hideControls
                decimalScale={6}
                step={0.001}
                value={point[1]}
                aria-label={`${CORNER_LABELS[cornerIndex]} latitude`}
                onChange={(value) => setCorner(cornerIndex, 1, toNumber(value))}
              />
            </Group>
          </Stack>
        ))}

        <Stack gap={4}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            Opacity — {opacity.toFixed(2)}
          </Text>
          <Slider
            color="teal"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={onOpacityChange}
          />
        </Stack>

        <SimpleGrid cols={6} spacing={6}>
          <Button size="xs" variant="default" aria-label="Move north" onClick={() => onCoordinatesChange(nudgeCoordinates(coordinates, 0, 0.01))}>↑</Button>
          <Button size="xs" variant="default" aria-label="Move west" onClick={() => onCoordinatesChange(nudgeCoordinates(coordinates, -0.01, 0))}>←</Button>
          <Button size="xs" variant="default" aria-label="Move east" onClick={() => onCoordinatesChange(nudgeCoordinates(coordinates, 0.01, 0))}>→</Button>
          <Button size="xs" variant="default" aria-label="Move south" onClick={() => onCoordinatesChange(nudgeCoordinates(coordinates, 0, -0.01))}>↓</Button>
          <Button size="xs" variant="default" aria-label="Shrink" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 0.99, 0.99))}>−</Button>
          <Button size="xs" variant="default" aria-label="Grow" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 1.01, 1.01))}>+</Button>
        </SimpleGrid>

        <SimpleGrid cols={6} spacing={6}>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 1.01, 1))}>W+</Button>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 0.99, 1))}>W−</Button>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 1, 1.01))}>H+</Button>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(scaleCoordinates(coordinates, 1, 0.99))}>H−</Button>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(rotateCoordinates(coordinates, 0.5))}>R+</Button>
          <Button size="xs" variant="default" onClick={() => onCoordinatesChange(rotateCoordinates(coordinates, -0.5))}>R−</Button>
        </SimpleGrid>

        <ScrollArea.Autosize mah={200}>
          <Textarea
            readOnly
            autosize
            minRows={6}
            value={snippet}
            spellCheck={false}
            onFocus={(event) => event.currentTarget.select()}
            styles={{ input: { fontFamily: 'monospace', fontSize: '11px' } }}
          />
        </ScrollArea.Autosize>
      </Stack>
    </Paper>
  );
}
