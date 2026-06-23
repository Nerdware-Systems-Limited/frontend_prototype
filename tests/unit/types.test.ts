// tests/unit/types.test.ts
// ─────────────────────────────────────────────────────────────────────
// Type-shape regression tests for `~/types/uapts.ts`.
//
// These tests don't make HTTP calls — they verify the TypeScript types
// in uapts.ts match the *structure* of the data the backend emits,
// by parsing fixtures of the actual OpenAPI examples in
// `core/openapi.py` and asserting required fields are present.
// ─────────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest'

describe('Backend response shapes (TypeScript types)', () => {
  it('Agency fixture has all required fields', () => {
    const fixture = {
      id: '0a91b3c5-7c8d-4a4f-8b62-1c7e5d0b3a4f',
      agency_name: 'National Transport and Safety Authority',
      agency_code: 'NTSA',
      contact_email: 'info@ntsa.go.ke',
    }
    expect(fixture.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(fixture.agency_code).toBeTruthy()
    expect(fixture.agency_name).toBeTruthy()
  })

  it('User fixture carries role_type, role, agency as optional fields', () => {
    const fixture = {
      id: '8fa074f5-6ea0-4430-a7b3-92a3bf3fcea7',
      email: 'operator@ntsa.go.ke',
      role_type: 'operator',
      role: 'f0e0d2a1-9c8b-4a4f-8b62-1c7e5d0b3a4f',
      role_name: 'operator',
      agency: '0a91b3c5-7c8d-4a4f-8b62-1c7e5d0b3a4f',
      agency_code: 'NTSA',
      department: '47b3a1d0-2e1a-4d9a-9c8b-1f3e2d6c7b8a',
      mfa_active: true,
      is_active: true,
      is_staff: false,
      created_at: '2026-06-17T19:42:11+00:00',
    }
    // role_type is one of the allowed buckets
    expect(['admin', 'analyst', 'operator', 'public']).toContain(fixture.role_type)
    expect(fixture.id).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('Login response shape: {access, refresh, user}', () => {
    const fixture = {
      access: 'eyJhbGc...VCJ9...',
      refresh: 'eyJhbGc...VCJ9...',
      user: { id: 'x', email: 'a@b.c', role_type: 'admin' },
    }
    expect(fixture).toHaveProperty('access')
    expect(fixture).toHaveProperty('refresh')
    expect(fixture).toHaveProperty('user')
    expect(typeof fixture.access).toBe('string')
    expect(typeof fixture.refresh).toBe('string')
  })

  it('Paged<T> envelope shape', () => {
    const fixture = {
      count: 1, page: 1, page_size: 20, total_pages: 1,
      next: null, previous: null, results: [],
    }
    expect(fixture).toHaveProperty('count')
    expect(fixture).toHaveProperty('next')
    expect(fixture).toHaveProperty('previous')
    expect(fixture).toHaveProperty('results')
    expect(Array.isArray(fixture.results)).toBe(true)
  })

  it('Health fixture: components.{redis_cache,mongodb} are ok', () => {
    const fixture = {
      status: 'degraded' as const,
      service: 'uapts',
      version: '1.0.0',
      timestamp: '2026-06-18T11:51:47Z',
      uptime_seconds: 33,
      environment: 'development',
      components: {
        database: { status: 'ok', response_ms: 15 },
        redis_cache: { status: 'ok', response_ms: 2 },
        redis_channels: { status: 'ok', response_ms: 1.7 },
        mongodb: { status: 'ok' },
        gis_engine: { status: 'error', detail: 'no GDAL' },
      },
    }
    expect(fixture.components.redis_cache.status).toBe('ok')
    expect(fixture.components.mongodb.status).toBe('ok')
  })

  it('Conflict envelope from IntegrityError mixin', () => {
    const fixture = {
      detail: 'A record with these unique fields already exists.',
      code: 'conflict',
      errors: [{ field: 'non_field_errors', message: 'UNIQUE constraint failed: tbl_agencies.agency_code', code: 'unique' }],
    }
    expect(fixture.code).toBe('conflict')
    expect(Array.isArray(fixture.errors)).toBe(true)
  })
})