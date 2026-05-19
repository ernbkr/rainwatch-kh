import { useMemo } from 'react';
import { Box, Text } from '@mantine/core';
import { useMove } from '@mantine/hooks';
import { parseFrameTime } from '../lib/frame-time';
import type { Frame } from '../lib/types';

const PX_PER_HOUR = 56;
const MS_PER_HOUR = 3_600_000;
const SPAN_HOURS = 14;
const TRACK_HEIGHT = 58;
const BAND_TOP = 10;
const BAND_HEIGHT = 8;
const BAND_MID = BAND_TOP + BAND_HEIGHT / 2;

interface FramePoint {
  index: number;
  timeMs: number;
}

interface TimeRulerProps {
  frames: Frame[];
  currentIndex: number;
  onScrub: (index: number) => void;
  onScrubStart: () => void;
}

/** A `left` value that places an element `offsetPx` from the track centre. */
function leftFromOffset(offsetPx: number): string {
  const rounded = Math.round(offsetPx);
  return rounded >= 0 ? `calc(50% + ${rounded}px)` : `calc(50% - ${-rounded}px)`;
}

function hourParts(date: Date): { time: string; period: string } {
  const hours = date.getHours();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return { time: `${hour12}:00`, period: hours < 12 ? 'AM' : 'PM' };
}

/**
 * A time-axis ruler: hourly labels, the radar-covered period highlighted as a
 * band centred on screen, a dot per frame, and a draggable current-frame
 * circle. Dragging scrubs to the nearest frame (the caller pauses on grab).
 */
export function TimeRuler({ frames, currentIndex, onScrub, onScrubStart }: TimeRulerProps) {
  const points = useMemo<FramePoint[]>(
    () =>
      frames
        .map((frame, index) => {
          const time = parseFrameTime(frame.label);
          return time ? { index, timeMs: time.getTime() } : null;
        })
        .filter((point): point is FramePoint => point !== null),
    [frames]
  );

  const hasFrames = points.length > 0;
  const firstMs = hasFrames ? points[0].timeMs : Date.now();
  const lastMs = hasFrames ? points[points.length - 1].timeMs : firstMs;
  const centerMs = (firstMs + lastMs) / 2;

  const currentMs = useMemo(() => {
    const current = frames[currentIndex];
    const time = current ? parseFrameTime(current.label) : null;
    return time ? time.getTime() : centerMs;
  }, [frames, currentIndex, centerMs]);

  const offset = (ms: number) => ((ms - centerMs) / MS_PER_HOUR) * PX_PER_HOUR;

  const { ref, active } = useMove<HTMLDivElement>(
    ({ x }) => {
      if (points.length === 0) {
        return;
      }
      const targetMs = firstMs + x * (lastMs - firstMs);
      let bestIndex = points[0].index;
      let bestDiff = Number.POSITIVE_INFINITY;
      for (const point of points) {
        const diff = Math.abs(point.timeMs - targetMs);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIndex = point.index;
        }
      }
      onScrub(bestIndex);
    },
    { onScrubStart }
  );

  const hourTicks = useMemo(() => {
    const centerHour = new Date(centerMs);
    centerHour.setMinutes(0, 0, 0);
    return Array.from({ length: SPAN_HOURS * 2 + 1 }, (_, i) => {
      return new Date(centerHour.getTime() + (i - SPAN_HOURS) * MS_PER_HOUR);
    });
  }, [centerMs]);

  const currentHourMs = useMemo(() => {
    const date = new Date(currentMs);
    date.setMinutes(0, 0, 0);
    return date.getTime();
  }, [currentMs]);

  const bandLeft = offset(firstMs);
  const bandWidth = Math.max(offset(lastMs) - offset(firstMs), 0);

  return (
    <Box style={{ position: 'relative', flex: 1, height: TRACK_HEIGHT, overflow: 'hidden' }}>
      {hourTicks.map((tick) => {
        const isCurrent = tick.getTime() === currentHourMs;
        const { time, period } = hourParts(tick);
        return (
          <Box
            key={tick.getTime()}
            style={{
              position: 'absolute',
              left: leftFromOffset(offset(tick.getTime())),
              transform: 'translateX(-50%)',
              top: BAND_TOP + BAND_HEIGHT + 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            <Box
              style={{
                width: 1,
                height: 6,
                marginBottom: 2,
                background: isCurrent
                  ? 'var(--mantine-color-text)'
                  : 'var(--mantine-color-dark-3)'
              }}
            />
            <Text fz={11} lh={1.1} fw={isCurrent ? 700 : 500} c={isCurrent ? undefined : 'dimmed'}>
              {time}
            </Text>
            <Text fz={9} lh={1.1} fw={isCurrent ? 700 : 500} c={isCurrent ? undefined : 'dimmed'}>
              {period}
            </Text>
          </Box>
        );
      })}

      {hasFrames && (
        <>
          <Box
            style={{
              position: 'absolute',
              left: leftFromOffset(bandLeft),
              width: Math.round(bandWidth),
              top: BAND_TOP,
              height: BAND_HEIGHT,
              borderRadius: BAND_HEIGHT / 2,
              background: 'var(--mantine-color-teal-7)'
            }}
          />
          {points.map((point) => (
            <Box
              key={point.index}
              style={{
                position: 'absolute',
                left: leftFromOffset(offset(point.timeMs)),
                transform: 'translate(-50%, -50%)',
                top: BAND_MID,
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'var(--mantine-color-teal-1)'
              }}
            />
          ))}
          <Box
            style={{
              position: 'absolute',
              left: leftFromOffset(offset(currentMs)),
              transform: 'translate(-50%, -50%)',
              top: BAND_MID,
              width: 15,
              height: 15,
              borderRadius: '50%',
              background: 'var(--mantine-color-white)',
              border: '2px solid var(--mantine-color-teal-5)',
              boxShadow: '0 1px 5px rgba(0, 0, 0, 0.55)'
            }}
          />
          <Box
            ref={ref}
            style={{
              position: 'absolute',
              left: leftFromOffset(bandLeft),
              width: Math.max(Math.round(bandWidth), 24),
              top: 0,
              height: BAND_TOP + BAND_HEIGHT + 6,
              cursor: active ? 'grabbing' : 'grab'
            }}
          />
        </>
      )}
    </Box>
  );
}
