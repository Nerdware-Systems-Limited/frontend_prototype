import { describe, it, expect } from 'vitest'
import {
  sniffGeojsonText, suggestColumn, rowsToFilter, filterToRows, describeFilter, suggestedFilterRows, buildFieldMap, parseAvailableColumns, relatedLayerHints, unresolvedFields,
} from '../../app/utils/gisFile'

// Head of /home/bruce/Downloads/roads_joined.geojson (truncated mid-geometry on purpose).
const HEAD = `{"type":"FeatureCollection","name":"roads_joined","crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"features":[
{ "type": "Feature", "properties": { "OBJECTID": 1, "RID_8": "A1", "key": "A1", "road_class": "A", "road_agency": "KeNHA", "county": "Kisumu" }, "geometry": { "type": "MultiLineString", "coordinates": [ [ [ 34.2, 4.4, 0.0 ], [ 34.`

describe('gisFile', () => {
  it('reads attribute names from a truncated GeoJSON head', () => {
    const s = sniffGeojsonText(HEAD)
    expect(s.columns).toEqual(['OBJECTID', 'RID_8', 'key', 'road_class', 'road_agency', 'county'])
    expect(s.samples.road_agency).toEqual(['KeNHA'])
  })

  it('does not need a column literally named road_id', () => {
    const cols = sniffGeojsonText(HEAD).columns
    expect(suggestColumn('road_id', cols)).toEqual({ column: 'RID_8', exact: false })
    expect(buildFieldMap(['road_id'], cols)).toEqual({ road_id: 'RID_8' })
    expect(unresolvedFields(['road_id'], cols, { road_id: 'RID_8' })).toEqual([])
  })

  it('prefers an exact name and leaves identity pairs out of the map', () => {
    expect(suggestColumn('road_id', ['x', 'ROAD_ID', 'RID_8'])).toEqual({ column: 'ROAD_ID', exact: true })
    expect(buildFieldMap(['road_id'], ['road_id'])).toEqual({})
  })

  it('honours the user\'s own choice over the suggestion', () => {
    expect(buildFieldMap(['road_id'], ['RID_8', 'key'], { road_id: 'key' })).toEqual({ road_id: 'key' })
  })

  it('reports fields with no column at all', () => {
    expect(unresolvedFields(['road_id'], ['name'], {})).toEqual(['road_id'])
    expect(unresolvedFields(['road_id'], [], {})).toEqual([])  // columns unknown: let the server decide
  })

  it('learns columns from the backend error', () => {
    const msg = 'field_map refers to column(s) not in the file: id. Available: OBJECTID, RID_8, key.'
    expect(parseAvailableColumns(msg)).toEqual(['OBJECTID', 'RID_8', 'key'])
    expect(parseAvailableColumns('nothing here')).toEqual([])
  })

  it('suggests the related road layers for a road inventory', () => {
    const keys = relatedLayerHints(sniffGeojsonText(HEAD)).map(h => h.key)
    expect(keys).toContain('national-roads-register')
    expect(keys).toContain('rural-road-network')
    expect(keys).toContain('urban-road-network')
    expect(keys).not.toContain('nmt-paths')
    expect(relatedLayerHints({ columns: ['name'], samples: {} })).toEqual([])
  })

  it('turns editor rows into an API row filter and back', () => {
    const rows = [
      { mode: 'include' as const, column: 'road_agency', values: 'KeRRA, KURA' },
      { mode: 'include' as const, column: 'road_agency', values: 'kura, KWS' },
      { mode: 'exclude' as const, column: 'road_class', values: 'U' },
      { mode: 'include' as const, column: '', values: 'x' },
      { mode: 'include' as const, column: 'county', values: '  ' },
    ]
    const f = rowsToFilter(rows)
    expect(f).toEqual({ include: { road_agency: ['KeRRA', 'KURA', 'kura', 'KWS'] }, exclude: { road_class: ['U'] } })
    expect(filterToRows(f).map(r => r.column)).toEqual(['road_agency', 'road_class'])
    expect(describeFilter(f)).toBe('road_agency = KeRRA | KURA | kura | KWS · road_class ≠ U')
    expect(rowsToFilter([])).toEqual({})
  })

  it('suggests per-layer row filters from the file columns', () => {
    const sniff = sniffGeojsonText(HEAD)
    expect(suggestedFilterRows('rural-road-network', sniff)).toEqual([{ mode: 'include', column: 'road_agency', values: 'KeRRA' }])
    expect(suggestedFilterRows('urban-road-network', sniff)[0].values).toBe('KURA')
    expect(suggestedFilterRows('national-roads-register', sniff)).toEqual([])
    expect(suggestedFilterRows('rural-road-network', { columns: ['road_class'], samples: {} })[0]).toMatchObject({ column: 'road_class', values: 'C' })
  })
})
