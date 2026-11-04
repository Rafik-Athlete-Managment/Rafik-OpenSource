import { ref } from 'vue'
import { instanceLogo, request } from './backend'

export type InstanceBranding = {
  name: string
  accent: string
  background_light: string
  background_dark: string
  logo_mime: string | null
  updated_at: string
}

export const instanceBranding = ref<InstanceBranding>({
  name: 'Rafik',
  accent: '#285943',
  background_light: '#f8f8f3',
  background_dark: '#171e1a',
  logo_mime: null,
  updated_at: '',
})

/** Applies the saved brand colors and chooses readable accent text for the page. */
export function syncAccentContrast() {
  const root = document.documentElement
  const palette = instanceBranding.value
  root.style.setProperty('--instance-page-light', palette.background_light)
  root.style.setProperty('--instance-page-dark', palette.background_dark)
  const ink = (hex: string, darkText = '#17211b') => {
    const values =
      hex
        .slice(1)
        .match(/.{2}/g)
        ?.map((value) => parseInt(value, 16) / 255) || []
    const luminance = values.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    )
    return 0.2126 * luminance[0]! + 0.7152 * luminance[1]! + 0.0722 * luminance[2]! > 0.179
      ? darkText
      : '#f3f6f1'
  }
  root.style.setProperty('--instance-ink-light', ink(palette.background_light, '#121b15'))
  root.style.setProperty('--instance-ink-dark', ink(palette.background_dark))
  const parse = (color: string) => {
    const hex = color.match(/^#([\da-f]{6})$/i)?.[1]
    if (hex) return hex.match(/.{2}/g)?.map((part) => parseInt(part, 16)) || []
    return (
      color
        .match(/[\d.]+/g)
        ?.slice(0, 3)
        .map(Number) || []
    )
  }
  const luminance = (values: number[]) => {
    const [r, g, b] = values.map((channel) => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const pageChannels = parse(getComputedStyle(root).getPropertyValue('--page').trim())
  const accentChannels = parse(palette.accent)
  if (pageChannels.length !== 3 || accentChannels.length !== 3) return
  const pageLuminance = luminance(pageChannels)
  const target = (pageLuminance + 0.05) / 0.05 > 1.05 / (pageLuminance + 0.05) ? 0 : 255
  const contrast = (values: number[]) => {
    const value = luminance(values)
    return (Math.max(value, pageLuminance) + 0.05) / (Math.min(value, pageLuminance) + 0.05)
  }
  let accessibleAccent = accentChannels
  for (let amount = 0; amount <= 1 && contrast(accessibleAccent) < 10; amount += 0.02) {
    accessibleAccent = accentChannels.map((channel) =>
      Math.round(channel * (1 - amount) + target * amount),
    )
  }
  root.style.setProperty(
    '--accent',
    `#${accessibleAccent.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`,
  )
  root.style.setProperty('--accent-hover', 'color-mix(in srgb, var(--accent) 86%, var(--ink))')
  root.style.setProperty('--on-accent', luminance(accessibleAccent) > 0.179 ? '#17211b' : '#ffffff')
}

/** Saves the current branding values and refreshes the CSS theme colors. */
export function applyBranding(value: InstanceBranding) {
  instanceBranding.value = value
  document.documentElement.style.setProperty('--instance-accent', value.accent)
  syncAccentContrast()
  document.title = `${value.name} | Training, connected`
}

/** Loads the installation's branding from the API before the page is themed. */
export async function loadBranding() {
  applyBranding(await request<InstanceBranding>('/v1/instance/branding', { feedback: 'none' }))
}

/** Returns the cache-aware URL for the institution's current logo. */
export const brandingLogoUrl = () => instanceLogo(instanceBranding.value.updated_at)
