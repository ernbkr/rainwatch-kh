window.RADAR_MAP_CONFIG = Object.freeze({
  styleUrl: 'https://tiles.openfreemap.org/styles/liberty',
  radarOpacity: 0.65,
  terrain: Object.freeze({
    sourceId: 'mapterhorn-terrain',
    protocol: 'mapterhorn',
    tiles: Object.freeze(['mapterhorn://{z}/{x}/{y}']),
    encoding: 'terrarium',
    tileSize: 512,
    attribution: '<a href="https://mapterhorn.com/attribution">© Mapterhorn</a>',
    exaggeration: 1.5,
    minExaggeration: 0,
    maxExaggeration: 3,
    pitch: 60
  }),
  imageLayout: Object.freeze({
    width: 1069,
    height: 800,
    crop: Object.freeze({
      x: 0,
      y: 0,
      width: 800,
      height: 800
    })
  }),
  views: Object.freeze({
    PHN: Object.freeze({
      center: [104.623076, 11.541039],
      zoom: 8.75,
      coordinates: Object.freeze([
        [104.188, 12.248],
        [105.657, 12.249],
        [105.656, 10.811],
        [104.193, 10.811]
      ])
    }),
    '240KM': Object.freeze({
      center: [105.743223, 11.177565],
      zoom: 6.75,
      coordinates: Object.freeze([
        [102.721, 13.676],
        [107.119, 13.676],
        [107.119, 9.364],
        [102.721, 9.364]
      ])
    }),
    CAMBODIA: Object.freeze({
      center: [104.043894, 11.738617],
      zoom: 6.72,
      coordinates: Object.freeze([
        [100.768147, 15.573022],
        [109.103853, 15.573022],
        [109.103853, 7.406978],
        [100.768147, 7.406978]
      ])
    })
  })
});
