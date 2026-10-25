import type { Member } from './types'
export type Drill = {
  key: string
  name: string
  kind: 'number' | 'text'
  unit: string
  min?: number
  max?: number
}
export type AssessmentTemplate = {
  id: string
  title: string
  definition: Drill[]
  revision: number
  archived: boolean
}
export type TrainingGroup = {
  canEdit?: boolean
  id: string
  name: string
  members: Member[]
  revision: number
  archived: boolean
}
export type EventPerson = {
  session_note: string
  checked_in_at: string | null
  makeup_for: string | null
  member_id: string
  name: string
  duty: 'staff' | 'trainee'
  attendance: 'unmarked' | 'present' | 'absent' | 'excused'
  revision: number
  active: boolean
  roles: string[]
}
export type CalendarEvent = {
  id: string
  title: string
  kind: 'training' | 'assessment'
  starts_at: string
  ends_at: string
  timezone: string
  location: string
  state: 'scheduled' | 'cancelled' | 'completed'
  revision: number
  series_id: string
  definition: Drill[] | null
  people?: EventPerson[]
}
export type AssessmentResult = {
  event_id: string
  member_id: string
  values: Record<string, string | number>
  note: string
  revision: number
  recorded_at: string
  recorded_by: string
}
export type EventDetail = {
  historyNext: number | null
  event: CalendarEvent
  people: EventPerson[]
  results: AssessmentResult[]
  history: {
    id: string
    member_id: string
    revision: number
    recorded_at: string
    document: { values: Record<string, string | number>; note: string }
  }[]
}
