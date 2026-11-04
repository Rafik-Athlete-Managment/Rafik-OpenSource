/** Map detail/editor routes onto their owning sidebar item. */
export function sectionPath(path: string) {
  if (path.startsWith('/training/')) return '/training'
  if (/^\/(members|athletes)\//.test(path)) return '/people'
  if (path.startsWith('/record/')) return path === '/record/new' ? '/training' : '/workouts'
  return path
    .replace(/^\/events(?=\/|$)/, '/schedule')
    .replace(/^\/deliver\//, '/plans/')
    .replace(/^\/review\//, '/workouts/')
    .replace(/^\/assessments\//, '/training/')
}
