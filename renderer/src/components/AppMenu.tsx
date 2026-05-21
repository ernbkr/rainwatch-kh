import { ActionIcon, Box, Loader, Menu, SegmentedControl, Text } from '@mantine/core';
import { IconCheck, IconDots, IconPower, IconRefresh } from '@tabler/icons-react';
import { BASEMAPS } from '../lib/basemaps';
import { AREAS } from '../lib/domains';
import {
  FORECAST_WINDOWS,
  type ForecastWindowHours
} from '../lib/forecast-grid';
import { formatClock } from '../lib/format';
import type { DomainId } from '../lib/types';

export interface AppMenuProps {
  domain: DomainId;
  onDomainChange: (domain: DomainId) => void;
  basemapId: string;
  onBasemapChange: (id: string) => void;
  is3D: boolean;
  onToggle3D: () => void;
  onRefresh: () => void;
  onQuit: () => void;
  /** Provincial-capitals layer visibility (checkmark toggle). */
  provincialCapitalsVisible: boolean;
  onToggleProvincialCapitals: () => void;
  /** Triggers a manual provincial-capitals refresh. */
  onRefreshProvincialCapitals: () => void;
  /** True while a refresh is in flight (swaps the icon for a spinner). */
  provincialCapitalsRefreshing: boolean;
  /** Non-empty after a failed refresh, cleared on the next success. */
  provincialCapitalsError: string;
  /** Time of the last successful provincial-capitals fetch, or null if none yet. */
  provincialCapitalsUpdatedAt: Date | null;
  /** Forecast-grid layer visibility (checkmark toggle). */
  forecastGridVisible: boolean;
  onToggleForecastGrid: () => void;
  /** Triggers a manual forecast-grid refresh. */
  onRefreshForecastGrid: () => void;
  /** True while a forecast-grid refresh is in flight. */
  forecastGridRefreshing: boolean;
  /** Non-empty after a failed forecast-grid refresh. */
  forecastGridError: string;
  /** Time of the last successful forecast-grid fetch, or null if none yet. */
  forecastGridUpdatedAt: Date | null;
  /** Active forecast window in hours; drives the segmented control + icons. */
  forecastGridWindow: ForecastWindowHours;
  onForecastGridWindowChange: (next: ForecastWindowHours) => void;
  /** Gates the idle-timer that auto-enters hover/spin mode. The on-map
   * HoverControl button still works regardless of this setting. */
  autoHoverEnabled: boolean;
  onToggleAutoHover: () => void;
}

/** Fixed-width check mark so menu item labels stay aligned. */
function CheckMark({ active }: { active: boolean }) {
  return active ? <IconCheck size={16} /> : <Box w={16} />;
}

/** The ⋯ overflow menu: refresh, area, basemap, 3D terrain, quit. */
export function AppMenu({
  domain,
  onDomainChange,
  basemapId,
  onBasemapChange,
  is3D,
  onToggle3D,
  onRefresh,
  onQuit,
  provincialCapitalsVisible,
  onToggleProvincialCapitals,
  onRefreshProvincialCapitals,
  provincialCapitalsRefreshing,
  provincialCapitalsError,
  provincialCapitalsUpdatedAt,
  forecastGridVisible,
  onToggleForecastGrid,
  onRefreshForecastGrid,
  forecastGridRefreshing,
  forecastGridError,
  forecastGridUpdatedAt,
  forecastGridWindow,
  onForecastGridWindowChange,
  autoHoverEnabled,
  onToggleAutoHover
}: AppMenuProps) {
  return (
    <Menu position="bottom-end" width={240} withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Open app menu">
          <IconDots size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconRefresh size={16} />} onClick={onRefresh}>
          Refresh
        </Menu.Item>
        <Menu.Item
          leftSection={
            provincialCapitalsRefreshing ? (
              <Loader size={14} color="gray" />
            ) : (
              <IconRefresh size={16} />
            )
          }
          onClick={onRefreshProvincialCapitals}
          disabled={provincialCapitalsRefreshing}
          // Keep the menu open so the spinner is visible and a follow-up
          // error toast lands in the same open menu without a re-click.
          closeMenuOnClick={false}
        >
          Refresh forecasts
        </Menu.Item>
        {provincialCapitalsUpdatedAt && !provincialCapitalsError && (
          <Box px="sm" pb={6} pt={0}>
            <Text size="xs" c="dimmed" lh={1.3}>
              Updated {formatClock(provincialCapitalsUpdatedAt)}
            </Text>
          </Box>
        )}
        {provincialCapitalsError && (
          <Box px="sm" pb={6} pt={0}>
            <Text size="xs" c="red" lh={1.3}>
              {provincialCapitalsError}
            </Text>
          </Box>
        )}

        <Menu.Divider />
        <Menu.Label>Area</Menu.Label>
        {AREAS.map((area) => (
          <Menu.Item
            key={area.domain}
            leftSection={<CheckMark active={domain === area.domain} />}
            onClick={() => onDomainChange(area.domain)}
          >
            {area.label}
          </Menu.Item>
        ))}

        <Menu.Divider />
        <Menu.Label>Basemap</Menu.Label>
        {BASEMAPS.map((basemap) => (
          <Menu.Item
            key={basemap.id}
            leftSection={<CheckMark active={basemapId === basemap.id} />}
            onClick={() => onBasemapChange(basemap.id)}
          >
            {basemap.label}
          </Menu.Item>
        ))}

        <Menu.Divider />
        <Menu.Item leftSection={<CheckMark active={is3D} />} onClick={onToggle3D}>
          3D Terrain
        </Menu.Item>
        <Menu.Item
          leftSection={<CheckMark active={forecastGridVisible} />}
          onClick={onToggleForecastGrid}
        >
          Weather forecast
        </Menu.Item>
        {forecastGridVisible && (
          // Window selector + refresh sit just under the visibility toggle so
          // they're only present when the layer can actually use them.
          // `closeMenuOnClick={false}` would have to be set per item, but
          // SegmentedControl + the inline Box live outside Menu.Item entirely.
          <Box px="sm" py={6}>
            <SegmentedControl
              fullWidth
              size="xs"
              value={String(forecastGridWindow)}
              onChange={(value) =>
                onForecastGridWindowChange(Number(value) as ForecastWindowHours)
              }
              data={FORECAST_WINDOWS.map((hours) => ({
                label: `${hours}h`,
                value: String(hours)
              }))}
            />
            <Box mt={6} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={onRefreshForecastGrid}
                disabled={forecastGridRefreshing}
                aria-label="Refresh forecast grid"
              >
                {forecastGridRefreshing ? (
                  <Loader size={12} color="gray" />
                ) : (
                  <IconRefresh size={14} />
                )}
              </ActionIcon>
              <Text size="xs" c="dimmed" lh={1.3}>
                {forecastGridError
                  ? forecastGridError
                  : forecastGridUpdatedAt
                    ? `Updated ${formatClock(forecastGridUpdatedAt)}`
                    : 'Loading…'}
              </Text>
            </Box>
          </Box>
        )}
        <Menu.Item
          leftSection={<CheckMark active={provincialCapitalsVisible} />}
          onClick={onToggleProvincialCapitals}
        >
          Provincial capital forecasts
        </Menu.Item>
        <Menu.Item
          leftSection={<CheckMark active={autoHoverEnabled} />}
          onClick={onToggleAutoHover}
        >
          Auto-rotate when idle
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconPower size={16} />} onClick={onQuit}>
          Quit
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
