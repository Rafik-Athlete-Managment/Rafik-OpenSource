<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ready, user, contexts, refreshContexts } from '../../app/auth'
import { request } from '../../lib/backend'
import { language } from '../../lib/i18n'
const router = useRouter(),
  error = ref(''),
  busy = ref(true)
async function openEntry() {
  busy.value = true
  error.value = ''
  try {
    await ready()
    if (user.value) {
      await refreshContexts()
      await router.replace(contexts.value[0]?.path || '/access')
      return
    }
    const status = await request<{ initialized: boolean }>('/v1/auth/setup-status')
    await router.replace(status.initialized ? '/login' : '/setup')
  } catch {
    error.value = language(
      'The institution service could not be reached. Check the connection and retry.',
      'تعذر الاتصال بخدمة المؤسسة. تحقق من الاتصال وحاول مجدداً.',
    )
  } finally {
    busy.value = false
  }
}
onMounted(openEntry)
</script>
<template>
  <main class="container page narrow" aria-live="polite">
    <p v-if="busy">{{ language('Opening institution setup…', 'جارٍ فتح إعداد المؤسسة…') }}</p>
    <div v-else-if="error" class="notice error" role="alert">
      <p>{{ error }}</p>
      <button class="button secondary" @click="openEntry">
        {{ language('Retry', 'إعادة المحاولة') }}
      </button>
    </div>
  </main>
</template>
