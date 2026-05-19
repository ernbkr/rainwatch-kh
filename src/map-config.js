window.RADAR_MAP_CONFIG = Object.freeze({
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
      center: [105.801068, 11.002651],
      zoom: 9.44,
      coordinates: Object.freeze([
        [104.188, 12.248],
        [105.657, 12.249],
        [105.656, 10.811],
        [104.193, 10.811]
      ])
    }),
    '240KM': Object.freeze({
      center: [105.642707, 11.540633],
      zoom: 7.88,
      coordinates: Object.freeze([
        [102.69901, 13.676],
        [107.14099, 13.676],
        [107.14099, 9.364],
        [102.69901, 9.364]
      ])
    }),
    CAMBODIA: Object.freeze({
      center: [105.486617, 12.349317],
      zoom: 6.47,
      coordinates: Object.freeze([
        [100.75, 15.559],
        [109.11, 15.561],
        [109.017, 7.465],
        [100.778, 7.406978]
      ])
    })
  })
});
