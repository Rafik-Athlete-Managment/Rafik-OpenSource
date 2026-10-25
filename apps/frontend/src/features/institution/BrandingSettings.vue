<script setup lang="ts">
import FileDropzone from '../../components/FileDropzone.vue'
import { onMounted, ref } from 'vue'
import { language as l } from '../../lib/i18n'
import { request } from '../../lib/backend'
import { applyBranding, brandingLogoUrl, instanceBranding, loadBranding } from '../../lib/branding'

const props = defineProps<{ institutionId: string }>()
const name = ref('Rafik')
const accent = ref('#285943')
const backgroundLight = ref('#f8f8f3')
const backgroundDark = ref('#171e1a')
const logo = ref<string | null | undefined>()
const logoPreview = ref('')
const error = ref('')
const loading = ref(true)
const saving = ref(false)
const canManage = ref(false)
onMounted(async () => {
  try {
    await loadBranding()
    canManage.value = (
      await request<{ allowed: boolean }>(
        `/v1/instance/branding/can-manage?institution=${encodeURIComponent(props.institutionId)}`,
      )
    ).allowed
    name.value = instanceBranding.value.name
    accent.value = instanceBranding.value.accent
    backgroundLight.value = instanceBranding.value.background_light
    backgroundDark.value = instanceBranding.value.background_dark
    if (instanceBranding.value.logo_mime) logoPreview.value = brandingLogoUrl()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
function selectLogo(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (file.size > 512 * 1024 || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    error.value = l(
      'Choose a PNG, JPEG or WebP image up to 512 KB.',
      'اختر صورة PNG أو JPEG أو WebP بحجم لا يتجاوز 512 كيلوبايت.',
    )
    return
  }
  error.value = ''
  const reader = new FileReader()
  reader.onload = () => {
    const result = String(reader.result || '')
    logo.value = result.slice(result.indexOf(',') + 1)
    logoPreview.value = result
  }
  reader.readAsDataURL(file)
}
function removeLogo() {
  logo.value = null
  logoPreview.value = ''
}
async function save() {
  saving.value = true
  error.value = ''
  try {
    const value = await request<typeof instanceBranding.value>(`/v1/institution/branding`, {
      method: 'POST',
      body: JSON.stringify({
        name: name.value,
        accent: accent.value,
        background_light: backgroundLight.value,
        background_dark: backgroundDark.value,
        logo: logo.value,
      }),
      feedback: 'success',
      successMessage: l('Instance branding updated.', 'تم تحديث هوية التثبيت.'),
    })
    applyBranding(value)
    logo.value = undefined
    if (value.logo_mime) logoPreview.value = brandingLogoUrl()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="panel form-stack instance-branding">
    <h2>{{ l('Instance branding', 'هوية التثبيت') }}</h2>
    <p class="small-print">
      {{
        l(
          'Applies to this installation and is stored with its database. Rafik attribution remains visible.',
          'تُطبّق على هذا التثبيت وتُحفظ مع قاعدة بياناته. تبقى الإشارة إلى رفيق ظاهرة.',
        )
      }}
    </p>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="!loading && !canManage" class="small-print">
      {{
        l(
          'Only the first super admin for this installation can change these settings.',
          'يمكن للمشرف العام الأول لهذا التثبيت فقط تغيير هذه الإعدادات.',
        )
      }}
    </p>
    <form v-if="canManage" class="form-stack" @submit.prevent="save">
      <fieldset class="form-stack" :disabled="loading || saving">
        <legend class="sr-only">{{ l('Branding options', 'خيارات الهوية') }}</legend>
        <div class="brand-layout">
          <div class="brand-fields">
            <label
              >{{ l('Installation name', 'اسم التثبيت')
              }}<input v-model="name" maxlength="60" required
            /></label>
            <div class="brand-colors">
              <label class="brand-color"
                >{{ l('Accent color', 'اللون الأساسي') }}<input v-model="accent" type="color"
              /></label>
              <label class="brand-color"
                >{{ l('Light theme background', 'خلفية الوضع الفاتح')
                }}<input v-model="backgroundLight" type="color"
              /></label>
              <label class="brand-color"
                >{{ l('Dark theme background', 'خلفية الوضع الداكن')
                }}<input v-model="backgroundDark" type="color"
              /></label>
            </div>
          </div>
          <div class="brand-logo">
            <FileDropzone
              :label="l('Institution logo', 'شعار المؤسسة')"
              :hint="
                l('PNG, JPEG or WebP · up to 512 KB', 'PNG أو JPEG أو WebP · حتى 512 كيلوبايت')
              "
              accept="image/png,image/jpeg,image/webp"
              :disabled="saving"
              @change="selectLogo"
            />
            <div v-if="logoPreview" class="brand-preview">
              <img :src="logoPreview" alt="" /><button
                type="button"
                class="text-link danger-action"
                @click="removeLogo"
              >
                {{ l('Remove custom logo', 'إزالة الشعار المخصص') }}
              </button>
            </div>
          </div>
        </div>
        <div class="brand-footer">
          <button class="button" :disabled="loading || saving">
            {{ saving ? l('Saving…', 'جارٍ الحفظ…') : l('Save branding', 'حفظ الهوية') }}
          </button>
          <div class="brand-attribution">{{ l('Powered by Rafik', 'بدعم من رفيق') }}</div>
        </div>
      </fieldset>
    </form>
  </section>
</template>
