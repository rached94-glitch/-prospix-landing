import { useState, useEffect, useCallback } from 'react'
import MapGL, { Marker, Popup, Source, Layer } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [{
    id: 'osm',
    type: 'raster',
    source: 'osm',
    paint: {
      'raster-brightness-min': 0.1,
      'raster-brightness-max': 0.75,
      'raster-saturation': -0.3,
      'raster-contrast': 0.1,
    },
  }],
}

function scoreColor(score) {
  if (score > 80) return '#10b981'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

// Approximate a circle as a GeoJSON LineString (64 points)
function makeCircleLine(lng, lat, radiusKm) {
  const pts = 64
  const coords = []
  for (let i = 0; i <= pts; i++) {
    const angle = (i / pts) * 2 * Math.PI
    const dLng  = (radiusKm / 111.32) / Math.cos(lat * Math.PI / 180) * Math.cos(angle)
    const dLat  = (radiusKm / 111.32) * Math.sin(angle)
    coords.push([lng + dLng, lat + dLat])
  }
  return { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
}

// Circle fill polygon
function makeCircleFill(lng, lat, radiusKm) {
  const pts = 64
  const coords = []
  for (let i = 0; i < pts; i++) {
    const angle = (i / pts) * 2 * Math.PI
    const dLng  = (radiusKm / 111.32) / Math.cos(lat * Math.PI / 180) * Math.cos(angle)
    const dLat  = (radiusKm / 111.32) * Math.sin(angle)
    coords.push([lng + dLng, lat + dLat])
  }
  coords.push(coords[0])
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
}

export default function LeadMap({ leads = [], selectedLead, searchParams, onSelectLead }) {
  const [popupLead, setPopupLead] = useState(null)
  const [viewState, setViewState] = useState({ longitude: 2.5, latitude: 46.5, zoom: 6 })

  useEffect(() => {
    if (searchParams?.lat && searchParams?.lng) {
      setViewState({ longitude: searchParams.lng, latitude: searchParams.lat, zoom: 12 })
    }
  }, [searchParams?.lat, searchParams?.lng])

  useEffect(() => {
    console.log('[Map] leads reçus:', leads.length, leads.length > 0 ? `premier: ${leads[0]?.name}` : '(vide)')
  }, [leads])

  const handleMarkerClick = useCallback((lead) => {
    setPopupLead(lead)
    onSelectLead(lead)
  }, [onSelectLead])

  const radiusKm  = searchParams?.radius ?? 5
  const hasCenter = !!(searchParams?.lat && searchParams?.lng)
  const circleLine = hasCenter ? makeCircleLine(searchParams.lng, searchParams.lat, radiusKm) : null
  const circleFill = hasCenter ? makeCircleFill(searchParams.lng, searchParams.lat, radiusKm) : null

  return (
    <MapGL
      {...viewState}
      onMove={e => setViewState(e.viewState)}
      style={{ width: '100%', height: '100%' }}
      mapStyle={MAP_STYLE}
    >
      {/* Circle fill */}
      {circleFill && (
        <Source id="radius-fill" type="geojson" data={circleFill}>
          <Layer
            id="radius-fill-layer"
            type="fill"
            paint={{
              'fill-color': '#00d4ff',
              'fill-opacity': 0.04,
            }}
          />
        </Source>
      )}

      {/* Circle dashed outline */}
      {circleLine && (
        <Source id="radius-line" type="geojson" data={circleLine}>
          <Layer
            id="radius-line-layer"
            type="line"
            paint={{
              'line-color': '#00d4ff',
              'line-width': 1.5,
              'line-dasharray': [4, 3],
              'line-opacity': 0.55,
            }}
          />
        </Source>
      )}

      {/* Markers */}
      {leads
        .filter(lead => lead.lat != null && lead.lng != null)
        .map(lead => {
          const lat = parseFloat(lead.lat)
          const lng = parseFloat(lead.lng)
          if (isNaN(lat) || isNaN(lng)) return null

          const score      = lead.score?.total ?? lead.score ?? 0
          const color      = scoreColor(score)
          const isSelected = selectedLead?.id === lead.id || selectedLead?._id === lead._id

          return (
            <Marker
              key={lead.id ?? lead._id}
              longitude={lng}
              latitude={lat}
              anchor="center"
              onClick={e => { e.originalEvent.stopPropagation(); handleMarkerClick(lead) }}
            >
              <div style={{ position: 'relative', width: isSelected ? 20 : 14, height: isSelected ? 20 : 14 }}>
                {/* Pulse ring for selected marker */}
                {isSelected && (
                  <div
                    className="marker-pulse-ring"
                    style={{ borderColor: color, borderWidth: 2, borderStyle: 'solid' }}
                  />
                )}
                {/* Dot */}
                <div
                  title={lead.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    background: color,
                    border: `2px solid rgba(255,255,255,${isSelected ? 0.9 : 0.25})`,
                    cursor: 'pointer',
                    boxShadow: `0 0 ${isSelected ? 18 : 7}px ${color}${isSelected ? 'cc' : '88'}`,
                    transform: isSelected ? 'scale(1.1)' : 'scale(1)',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>
            </Marker>
          )
        })}

      {/* Popup */}
      {popupLead && (
        <Popup
          longitude={parseFloat(popupLead.lng)}
          latitude={parseFloat(popupLead.lat)}
          anchor="bottom"
          onClose={() => setPopupLead(null)}
          closeButton
          closeOnClick={false}
          style={{ color: '#111' }}
        >
          <div style={{ fontFamily: 'sans-serif', minWidth: 160, fontSize: 13, padding: '2px 4px' }}>
            <b style={{ display: 'block', marginBottom: 4 }}>{popupLead.name}</b>
            ⭐ {popupLead.google?.rating ?? '—'}{' '}
            <span style={{ color: '#666', fontSize: 11 }}>
              ({popupLead.google?.totalReviews ?? 0} avis)
            </span>
            <br />
            <span style={{ color: scoreColor(popupLead.score?.total ?? 0), fontWeight: 600 }}>
              Score : {popupLead.score?.total ?? 0}/100
            </span>
          </div>
        </Popup>
      )}
    </MapGL>
  )
}
