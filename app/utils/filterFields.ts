/** Built-in option lists for filter fields. A filter's own `options` override these. */
import type { FilterField, FilterOption } from '~/types/dashboard'
import { AGENCY_OPTIONS } from '~/utils/widgetRegistry'

export const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia',
  'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
  'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
]

export const FIELD_LABELS: Record<FilterField, string> = {
  date_range: 'Date range', agency: 'Agency', county: 'County', road: 'Road',
  mode: 'Transport mode', severity: 'Severity', vehicle_class: 'Vehicle class',
}

export const FIELD_OPTIONS: Partial<Record<FilterField, FilterOption[]>> = {
  agency: AGENCY_OPTIONS.map(a => ({ value: a.value, label: a.value })),
  county: KENYA_COUNTIES.map(c => ({ value: c, label: c })),
  severity: [
    { value: 'fatal', label: 'Fatal' }, { value: 'serious', label: 'Serious' }, { value: 'minor', label: 'Minor' },
  ],
  mode: [
    { value: 'road', label: 'Road' }, { value: 'rail', label: 'Rail' },
    { value: 'air', label: 'Air' }, { value: 'maritime', label: 'Maritime' },
  ],
  vehicle_class: [
    { value: 'psv', label: 'PSV' }, { value: 'goods', label: 'Goods' }, { value: 'private', label: 'Private' },
    { value: 'government', label: 'Government' }, { value: 'motorcycle', label: 'Motorcycle' },
  ],
}

export const DEFAULT_CONTROL: Record<FilterField, 'select' | 'multiselect' | 'daterange' | 'segmented'> = {
  date_range: 'daterange', agency: 'select', county: 'select', road: 'select',
  mode: 'segmented', severity: 'segmented', vehicle_class: 'select',
}
