// app/composables/api/useTraining.ts
// ─────────────────────────────────────────────────────────────────────
// M14 - Training Institutes Management.
// Backs NTSA/KMA/KCAA accredited driving & transport training centres.
//
// Backend surface: /api/v1/training/
//   /courses/, /cohorts/, /enrollments/, /sessions/,
//   /attendance/, /completions/, /revenue/
// ─────────────────────────────────────────────────────────────────────

import { useApi, cleanQuery } from './_client'
import type { Paged } from '~/types/uapts'

// ── Enums ────────────────────────────────────────────────────────────

export type CourseCategory =
  | 'class_a_motorcycle' | 'class_b_light' | 'class_c_heavy'
  | 'class_d_psv' | 'class_e_special' | 'defensive_driving'
  | 'first_aid' | 'maritime_basic' | 'maritime_advanced'
  | 'aviation_ground' | 'aviation_cabin_crew' | 'other'

export type DeliveryMode = 'in_person' | 'online' | 'blended'
export type CertificationBody = 'ntsa' | 'kcaa' | 'kma' | 'nita' | 'other'
export type CohortStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
export type EnrollmentStatus =
  | 'registered' | 'confirmed' | 'attending' | 'completed'
  | 'failed' | 'withdrawn' | 'deferred'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'waived' | 'refunded'
export type CompletionOutcome = 'pass' | 'fail' | 'distinction' | 'incomplete' | 'deferred_resit'
export type RevenueStream =
  | 'student_fee' | 'government_grant' | 'sponsorship'
  | 'exam_fee' | 'material_fee' | 'other'
export type PaymentMethod = 'mpesa' | 'bank' | 'cash' | 'cheque' | 'waiver' | 'other'
export type SessionType = 'theory' | 'practical' | 'simulation' | 'assessment' | 'remedial'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'

// ── Shapes ────────────────────────────────────────────────────────────

export interface TrainingCourse {
  id: string
  institute: string
  institute_name: string
  institute_reg: string
  name: string
  course_code: string
  course_category: CourseCategory
  delivery_mode: DeliveryMode | null
  certification_body: CertificationBody | null
  duration_hours: number | null
  duration_days: number | null
  fee_kes: string | null
  is_active: boolean
  description: string
  created_at: string
  updated_at: string
}

export interface TrainingCohort {
  id: string
  course: string
  course_detail: {
    id: string
    institute: string
    institute_name: string
    name: string
    course_code: string
    course_category: CourseCategory
    delivery_mode: DeliveryMode | null
    fee_kes: string | null
    is_active: boolean
  }
  cohort_code: string
  status: CohortStatus
  start_date: string
  end_date: string
  capacity: number
  enrolled_count: number
  fill_rate_pct: number
  facilitator: string | null
  facilitator_name: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface TrainingEnrollment {
  id: string
  cohort: string
  cohort_detail: {
    id: string
    course: string
    course_name: string
    cohort_code: string
    status: CohortStatus
    start_date: string
    end_date: string
    capacity: number
    enrolled_count: number
    fill_rate_pct: number
  }
  student: string | null
  national_id: string
  full_name: string
  phone_number: string
  email: string
  status: EnrollmentStatus
  payment_status: PaymentStatus
  amount_paid_kes: string
  enrolled_at: string
  confirmed_at: string | null
  withdrawn_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface TrainingCompletion {
  id: string
  enrollment: string
  enrollment_detail: TrainingEnrollment
  outcome: CompletionOutcome
  score_pct: number | null
  theory_score_pct: number | null
  practical_score_pct: number | null
  attendance_rate_pct: number | null
  completed_at: string
  certificate_number: string
  certificate_issued_at: string | null
  certificate_expiry: string | null
  is_certificate_valid: boolean
  issued_by: string | null
  issued_by_name: string
  created_at: string
  updated_at: string
}

export interface TrainingSession {
  id: string
  cohort: string
  cohort_code: string
  title: string
  session_type: SessionType | null
  scheduled_at: string
  duration_minutes: number | null
  facilitator: string | null
  facilitator_name: string | null
  venue: string
  is_completed: boolean
  completed_at: string | null
  notes: string
  created_at: string
  updated_at: string
}

export interface TrainingRevenue {
  id: string
  cohort: string
  cohort_code: string
  enrollment: string | null
  enrollment_name: string
  revenue_stream: RevenueStream
  payment_method: PaymentMethod | null
  amount_kes: string
  transaction_reference: string
  received_at: string
  recorded_by: string | null
  recorded_by_name: string | null
  notes: string
  created_at: string
  updated_at: string
}

// ── Query types ───────────────────────────────────────────────────────

export interface TrainingQuery {
  institute?: number
  course?: string | number
  cohort?: string | number
  status?: string
  page?: number
  page_size?: number
  search?: string
  ordering?: string
}

// ── Composable ────────────────────────────────────────────────────────

export function useTraining() {
  const $api = useApi()

  return {
    courses: (q?: TrainingQuery & {
      course_category?: string
      delivery_mode?: string
      certification_body?: string
      is_active?: boolean
      name?: string
    }) =>
      $api<Paged<TrainingCourse>>('/api/v1/training/courses/', { query: cleanQuery(q) }),

    course: (id: string) =>
      $api<TrainingCourse>(`/api/v1/training/courses/${id}/`),

    cohorts: (q?: TrainingQuery & {
      start_date_from?: string
      start_date_to?: string
      facilitator?: number
    }) =>
      $api<Paged<TrainingCohort>>('/api/v1/training/cohorts/', { query: cleanQuery(q) }),

    cohort: (id: string) =>
      $api<TrainingCohort>(`/api/v1/training/cohorts/${id}/`),

    cohortStats: (id: string) =>
      $api<TrainingCohort>(`/api/v1/training/cohorts/${id}/stats/`),

    cohortEnrollments: (id: string) =>
      $api<TrainingCohort>(`/api/v1/training/cohorts/${id}/enrollments/`),

    cohortSessions: (id: string) =>
      $api<TrainingCohort>(`/api/v1/training/cohorts/${id}/sessions/`),

    enrollments: (q?: TrainingQuery & {
      payment_status?: string
      full_name?: string
      national_id?: string
      enrolled_at_from?: string
      enrolled_at_to?: string
    }) =>
      $api<Paged<TrainingEnrollment>>('/api/v1/training/enrollments/', { query: cleanQuery(q) }),

    sessions: (q?: TrainingQuery & {
      session_type?: string
      is_completed?: boolean
      scheduled_from?: string
      scheduled_to?: string
    }) =>
      $api<Paged<TrainingSession>>('/api/v1/training/sessions/', { query: cleanQuery(q) }),

    attendance: (q?: TrainingQuery & {
      session?: string
      enrollment?: string
      attendance_status?: string
    }) =>
      $api<Paged<any>>('/api/v1/training/attendance/', { query: cleanQuery(q) }),

    completions: (q?: TrainingQuery & { outcome?: string }) =>
      $api<Paged<TrainingCompletion>>('/api/v1/training/completions/', { query: cleanQuery(q) }),

    revenue: (q?: TrainingQuery & {
      revenue_stream?: string
      received_at_from?: string
      received_at_to?: string
    }) =>
      $api<Paged<TrainingRevenue>>('/api/v1/training/revenue/', { query: cleanQuery(q) }),

    revenueSummary: (q?: {
      institute?: number
      course?: string
      cohort?: string
      received_at_from?: string
      received_at_to?: string
    }) =>
      $api<TrainingRevenue>('/api/v1/training/revenue/summary/', { query: cleanQuery(q) }),
  }
}
