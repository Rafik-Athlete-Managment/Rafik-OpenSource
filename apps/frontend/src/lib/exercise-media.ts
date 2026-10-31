import catalog from '../content/exercise-videos.json'
import type { Exercise } from './domain'
import illustrations from '../content/exercise-media.json'
export interface ExerciseVideo {
  id: string
  exerciseId: string
  name: string
  licenseUrl: string
  creator: string
  source: { apiRecordUrl: string; exerciseId: number }
  video: { path: string }
  poster: { path: string }
}
export const exerciseVideos = catalog.items as ExerciseVideo[]
const byId = new Map(exerciseVideos.map((item) => [item.id, item]))
const byExercise = new Map(exerciseVideos.map((item) => [item.exerciseId, item]))
export function videoForExercise(e?: Omit<Exercise, 'kind'> & { kind?: string }) {
  if (!e || e.media_url) return undefined
  return e.media_ref
    ? byId.get(e.media_ref)
    : !e.owner_id && !e.institution_id
      ? byExercise.get(e.id)
      : undefined
}
const api = import.meta.env.VITE_API_URL || 'http://127.0.0.1:55331'
export const exerciseAssetUrl = (path: string) => api + path

export function illustrationsForExercise(e?: Omit<Exercise, 'kind'> & { kind?: string }) {
  if (!e || e.media_url) return undefined
  return illustrations.items.find((item) =>
    e.media_ref
      ? item.id === e.media_ref
      : !e.owner_id && !e.institution_id && item.exerciseId === e.id,
  )
}

/** Public reference posters only; private uploads stay behind ResourceAsset's authorized fetch. */
export function exerciseThumbnail(e?: Exercise) {
  if (!e || e.media_asset) return undefined
  const video = videoForExercise(e)
  if (video) return exerciseAssetUrl(video.poster.path)
  return illustrationsForExercise(e)?.frames[0]?.path.replace('/v1/catalog', '')
}

export function hasExerciseMedia(e?: Exercise) {
  return Boolean(
    e && (e.media_asset || e.media_url || videoForExercise(e) || illustrationsForExercise(e)),
  )
}
