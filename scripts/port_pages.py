#!/usr/bin/env python3
"""
Convert UAPTS_WEB_WIREFRAMES HTML pages into Vue 3 SFCs that use the new
Nuxt 4 default layout (TopNav + Sidebar live in the layout).

Strategy:
  - Strip the wireframe's <head>, <body> boilerplate
  - Strip the top-nav and sidebar markup (now in AppTopNav / AppSidebar)
  - Keep the main content as the page body
  - Add useNavSubtitle() + definePageMeta({ layout: 'default' })
  - Map wireframe route → Vue route (file renames)
"""
import os, re, sys

SRC = r"C:\Users\LastOS\Desktop\UAPTS_WEB_WIREFRAMES\pages"
DST = r"C:\Users\LastOS\Desktop\uapts_frontend_prototype\app\pages"

# Wireframe filename → Vue page filename + nav subtitle
PAGES = {
    "m02-traffic-map.html":     ("traffic-map.vue",          "Real-Time Traffic Map"),
    "m02-traffic-analytics.html":("traffic-analytics.vue",    "Traffic Analytics"),
    "m03-fleet-tracking.html":   ("fleet.vue",                 "Fleet Tracking"),
    "m03-trip-history.html":     ("trip-history.vue",          "Trip History"),
    "m05-safety-command.html":   ("safety.vue",                "Safety Command"),
    "m05-safety-analytics.html": ("safety-analytics.vue",      "Safety Analytics"),
    "m06-infrastructure.html":   ("infrastructure.vue",        "Infrastructure"),
    "m06-project-tracking.html": ("projects.vue",              "Project Tracking"),
    "m07-intermodal.html":       ("intermodal.vue",            "Intermodal Hub"),
    "m07-mode-performance.html": ("mode-performance.vue",      "Mode Performance"),
    "analytics-workbench.html":  ("analytics.vue",             "Analytics Workbench"),
    "query-builder.html":        ("query-builder.vue",         "Query Builder"),
    "report-center.html":        ("reports.vue",               "Report Center"),
    "kenha.html":                ("agency/kenha.vue",          "Road Assets · KeNHA"),
    "ntsa.html":                 ("agency/ntsa.vue",           "Safety · NTSA"),
    "sdr.html":                  ("agency/sdr.vue",            "Oversight · SDT"),
    "ai-workbench.html":         ("ai-workbench.vue",          "AI Predictive Workbench"),
    "notifications.html":        ("notifications.vue",         "Notifications"),
    "user-management.html":      ("users.vue",                 "User Management"),
    "audit-trail.html":          ("audit.vue",                 "Audit Trail"),
    "integration-hub.html":      ("integrations.vue",          "Integration Hub"),
    "settings.html":             ("settings.vue",              "Settings"),
}

def strip_block(html: str, start_re: str, end_re: str) -> str:
    """Remove a block of HTML matched by start_re .. end_re (DOTALL)."""
    return re.sub(start_re + r'.*?' + end_re, '', html, flags=re.S | re.I)

def extract_main(html: str) -> str:
    """Pull out everything inside <main class='main-content'>...</main>."""
    m = re.search(r'<main[^>]*class="main-content"[^>]*>(.*?)</main>', html, flags=re.S | re.I)
    return m.group(1).strip() if m else ''

def extract_subtitle(html: str) -> str:
    m = re.search(r'top-nav-subtitle[^>]*>(.*?)</div>', html, flags=re.S | re.I)
    if not m: return ''
    return re.sub(r'<[^>]+>', '', m.group(1)).strip()

def extract_h1(html: str) -> str:
    m = re.search(r'<h1[^>]*>(.*?)</h1>', html, flags=re.S | re.I)
    if not m: return ''
    return re.sub(r'<[^>]+>', '', m.group(1)).strip()

def rewrite_links(body: str) -> str:
    """Rewrite wireframe hrefs to Vue router paths.

    Wireframes use:
      ../index.html                     → /executive
      pages/X.html                      → /Y (Vue route)
      <a href="X.html">                 → <NuxtLink to="/X">
      <button onclick="UAPTS.openModal(...)"> → @click="..." (no-op stub)

    For now we just convert the obvious .html hrefs and leave the rest.
    """
    # .. / index.html → /executive
    body = re.sub(r'href="\.\./index\.html"', 'to="/executive"', body)
    body = re.sub(r'href="\.\./pages/([^"]+)"', r'to="/\1"', body)  # only used if nested
    # Plain pages/X.html within same dir → /X.html → /X (Vue route basename)
    body = re.sub(r'href="pages/([^"]+)\.html"', r'to="/\1"', body)
    body = re.sub(r'href="([^"/][^"]*?)\.html"', r'to="/\1"', body)
    return body

def to_kebab(name: str) -> str:
    """Turn a string into a PascalCase / spaced name → route slug.
    E.g. 'KeNHA - Road Asset Manager' → 'kenha-road-asset-manager'.
    Used for NuxtLink rewrite below."""
    s = re.sub(r'[^A-Za-z0-9 ]+', ' ', name)
    s = re.sub(r'\s+', '-', s.strip()).lower()
    return s

def html_to_vue(src_filename: str, dst_filename: str, subtitle: str) -> str:
    with open(os.path.join(SRC, src_filename), encoding='utf-8') as f:
        html = f.read()

    body = extract_main(html)
    body = rewrite_links(body)
    # Vue 3 SFC - wrap the body in <template>.
    h1 = extract_h1(html)

    vue = f'''<template>
  <!--
    Ported from UAPTS_WEB_WIREFRAMES/pages/{src_filename}
    h1: {h1}
    Top nav + sidebar live in app/layouts/default.vue (AppTopNav + AppSidebar).
  -->
  <div>
{body}
  </div>
</template>

<script setup lang="ts">
definePageMeta({{ layout: 'default' }})
useNavSubtitle('{subtitle}')
</script>
'''
    return vue

def main():
    os.makedirs(DST, exist_ok=True)
    os.makedirs(os.path.join(DST, 'agency'), exist_ok=True)

    written = []
    for src, (dst, subtitle) in PAGES.items():
        src_path = os.path.join(SRC, src)
        if not os.path.isfile(src_path):
            print(f"  MISSING source: {src}")
            continue
        vue = html_to_vue(src, dst, subtitle)
        dst_path = os.path.join(DST, dst)
        with open(dst_path, 'w', encoding='utf-8') as f:
            f.write(vue)
        written.append(dst)
        print(f"  wrote {dst}")

    print(f"\nTotal: {len(written)} pages")
    # Note: executive.vue already exists (we wrote it manually).
    # Skip its source in PAGES dict (no executive.html in wireframes).

if __name__ == '__main__':
    main()
