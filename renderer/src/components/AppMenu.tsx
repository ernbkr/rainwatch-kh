import { ActionIcon, Box, Menu } from '@mantine/core';
import { IconCheck, IconDots, IconPower, IconRefresh } from '@tabler/icons-react';
import { BASEMAPS } from '../lib/basemaps';
import { AREAS } from '../lib/domains';
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
  onQuit
}: AppMenuProps) {
  return (
    <Menu position="bottom-end" width={200} withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="lg" aria-label="Open app menu">
          <IconDots size={20} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconRefresh size={16} />} onClick={onRefresh}>
          Refresh
        </Menu.Item>

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

        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconPower size={16} />} onClick={onQuit}>
          Quit
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
