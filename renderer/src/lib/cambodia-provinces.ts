/**
 * The 25 provincial capitals of Cambodia, with lat/lon for the city centre.
 *
 * `id` is the lower-cased province slug (used as the MapLibre feature id and
 * for stable React keys). `name` is the city as it appears on the map label.
 * `province` is the parent province name; for most provinces the capital
 * shares the province's name, but a few diverge (Sen Monorom in Mondulkiri,
 * Suong in Tboung Khmum, Samraong in Oddar Meanchey, Ta Khmau in Kandal,
 * Tbeng Meanchey in Preah Vihear, Serei Saophoan in Banteay Meanchey,
 * Khemarak Phoumin in Koh Kong, Banlung in Ratanakiri).
 *
 * Coordinates are city-centre points. They drive both the marker placement
 * and the Open-Meteo lat/lon request — the API snaps to its own grid cell
 * (~9 km) but returns the actual cell coords; we ignore those and keep these
 * for display.
 */
export interface ProvincialCapital {
  readonly id: string;
  readonly name: string;
  readonly province: string;
  readonly lat: number;
  readonly lon: number;
}

export const PROVINCIAL_CAPITALS: readonly ProvincialCapital[] = [
  { id: 'banteay-meanchey', name: 'Serei Saophoan', province: 'Banteay Meanchey', lat: 13.5859, lon: 102.9747 },
  { id: 'battambang',       name: 'Battambang',     province: 'Battambang',       lat: 13.0957, lon: 103.2028 },
  { id: 'kampong-cham',     name: 'Kampong Cham',   province: 'Kampong Cham',     lat: 12.0001, lon: 105.4533 },
  { id: 'kampong-chhnang',  name: 'Kampong Chhnang',province: 'Kampong Chhnang',  lat: 12.2503, lon: 104.6675 },
  { id: 'kampong-speu',     name: 'Chbar Mon',      province: 'Kampong Speu',     lat: 11.4534, lon: 104.5217 },
  { id: 'kampong-thom',     name: 'Stueng Sen',     province: 'Kampong Thom',     lat: 12.7111, lon: 104.8887 },
  { id: 'kampot',           name: 'Kampot',         province: 'Kampot',           lat: 10.6105, lon: 104.1820 },
  { id: 'kandal',           name: 'Ta Khmau',       province: 'Kandal',           lat: 11.4836, lon: 104.9492 },
  { id: 'kep',              name: 'Krong Kep',      province: 'Kep',              lat: 10.4847, lon: 104.3168 },
  { id: 'koh-kong',         name: 'Khemarak Phoumin', province: 'Koh Kong',       lat: 11.6153, lon: 102.9831 },
  { id: 'kratie',           name: 'Kratie',         province: 'Kratie',           lat: 12.4881, lon: 106.0190 },
  { id: 'mondulkiri',       name: 'Sen Monorom',    province: 'Mondulkiri',       lat: 12.4524, lon: 107.1881 },
  { id: 'oddar-meanchey',   name: 'Samraong',       province: 'Oddar Meanchey',   lat: 14.1822, lon: 103.6118 },
  { id: 'pailin',           name: 'Pailin',         province: 'Pailin',           lat: 12.8489, lon: 102.6094 },
  { id: 'phnom-penh',       name: 'Phnom Penh',     province: 'Phnom Penh',       lat: 11.5564, lon: 104.9282 },
  { id: 'preah-sihanouk',   name: 'Sihanoukville',  province: 'Preah Sihanouk',   lat: 10.6280, lon: 103.5223 },
  { id: 'preah-vihear',     name: 'Tbeng Meanchey', province: 'Preah Vihear',     lat: 13.8079, lon: 104.9803 },
  { id: 'prey-veng',        name: 'Prey Veng',      province: 'Prey Veng',        lat: 11.4854, lon: 105.3245 },
  { id: 'pursat',           name: 'Pursat',         province: 'Pursat',           lat: 12.5388, lon: 103.9192 },
  { id: 'ratanakiri',       name: 'Banlung',        province: 'Ratanakiri',       lat: 13.7395, lon: 106.9870 },
  { id: 'siem-reap',        name: 'Siem Reap',      province: 'Siem Reap',        lat: 13.3633, lon: 103.8564 },
  { id: 'stung-treng',      name: 'Stung Treng',    province: 'Stung Treng',      lat: 13.5236, lon: 105.9683 },
  { id: 'svay-rieng',       name: 'Svay Rieng',     province: 'Svay Rieng',       lat: 11.0879, lon: 105.7993 },
  { id: 'takeo',            name: 'Doun Kaev',      province: 'Takeo',            lat: 10.9908, lon: 104.7849 },
  { id: 'tboung-khmum',     name: 'Suong',          province: 'Tboung Khmum',     lat: 11.9143, lon: 105.6939 }
] as const;
