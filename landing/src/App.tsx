import {
  Button,
  Container,
  Group,
  Image,
  List,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { IconBrandGithub, IconDownload } from '@tabler/icons-react';
import screenshot from '../../rainwatch-kh.png';

const REPO_URL = 'https://github.com/ernbkr/rainwatch-kh';
const RELEASES_URL = `${REPO_URL}/releases`;

export function App() {
  return (
    <Container size="md" py="xl">
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1}>Rainwatch KH</Title>
          <Text size="lg" c="dimmed">
            A minimal desktop viewer for Cambodia Meteo radar animations.
          </Text>
        </Stack>

        <Image src={screenshot} radius="md" alt="Rainwatch KH screenshot" />

        <Group>
          <Button
            component="a"
            href={RELEASES_URL}
            size="lg"
            leftSection={<IconDownload size={20} />}
          >
            Download
          </Button>
          <Button
            component="a"
            href={REPO_URL}
            size="lg"
            variant="default"
            leftSection={<IconBrandGithub size={20} />}
          >
            View on GitHub
          </Button>
        </Group>

        <Stack gap="xs">
          <Title order={2} size="h3">
            Features
          </Title>
          <List spacing="xs">
            <List.Item>
              Cambodia Meteo radar — PHN (80 km), 240 km, and Cambodia (450 km) domains
            </List.Item>
            <List.Item>
              Animated playback with timeline scrubber and adjustable speed
            </List.Item>
            <List.Item>
              Hourly weather forecasts and provincial capital conditions from Open-Meteo
            </List.Item>
            <List.Item>3D terrain with switchable basemap styles</List.Item>
            <List.Item>Auto-rotate when idle for ambient display</List.Item>
            <List.Item>Native installers for Linux, Windows, and macOS</List.Item>
          </List>
        </Stack>

        <Text size="sm" c="dimmed">
          MIT licence · Radar data © Cambodia Meteo
        </Text>
      </Stack>
    </Container>
  );
}
