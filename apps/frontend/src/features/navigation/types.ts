export type AttentionTask = {
  key: string
  kind: 'workout' | 'checkin' | 'message'
  id: string
  relationship_id: string
  name: string
  detail: string
  title: string
  happened_at: string
  unread: number
}
export type AttentionPage = {
  items: AttentionTask[]
  total: number
  clients: number
  plans: number
}
