export type Role = 'admin' | 'trainer' | 'trainee'
export type Context = {
  member_id?: string
  id: string
  institution_id?: string
  kind: 'institution'
  name: string
  role: Role
  path: string
}
export type Member = {
  id: string
  user_id: string | null
  name: string
  joined_at?: string
  email?: string
  roles: Role[]
  active: boolean
  revision: number
  trainer_id: string | null
  /** Sport and coaching-specialty IDs; descriptive only, never an authority grant. */
  sports?: string[]
  /** Active coaching team: one primary link plus supporting links with their sport/specialty. */
  coaches?: {
    id: string
    coach: string
    kind: 'primary' | 'supporting'
    sport: string | null
    revision: number
  }[]
}
export type Institution = {
  invitationsNext: number | null
  eventsNext: number | null
  summary: { trainees: number; trainers: number; unassigned: number }
  institution: { id: string; name: string; revision: number }
  self: { id: string; roles: Role[] }
  members: Member[]
  names: { id: string; name: string }[]
  invitations: { id: string; email: string; roles: Role[]; expires_at: string }[]
  events: {
    id: string
    kind: string
    created_at: string
    subject_id: string | null
    actor_id?: string | null
    detail?: unknown
    actor_name?: string | null
    subject_name?: string | null
  }[]
}
export type Sport = {
  id: string
  name: string
  kind: 'sport' | 'specialty'
  archived: boolean
  revision: number
}
