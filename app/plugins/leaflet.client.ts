// app/plugins/leaflet.client.ts
//
// Provide Leaflet to the rest of the app via the `$leaflet` Nuxt
// property. The plugin is `.client.ts` so Leaflet (which needs
// `window`) only loads in the browser.
//
// We intentionally do not pre-resolve here. UaptsMap.vue re-resolves
// the plugin payload itself because Vite's CJS↔ESM interop can wrap
// the real export under `.default` at any depth — handing back a
// pre-resolved value means UaptsMap.vue would have to trust that
// shape, which has been a recurring source of `Lc.map is not a
// function` errors. Letting the consumer walk the namespace keeps
// the resolution logic in one place.
import * as LeafletNS from 'leaflet'

export default defineNuxtPlugin(() => {
  return {
    provide: { leaflet: LeafletNS },
  }
})
