<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { refreshContexts, logout } from '../../app/auth'
import { institution } from '../../app/institution'
import { language as l, errorMessage } from '../../lib/i18n'
const router = useRouter(),
  busy = ref(false),
  error = ref('')
async function retry() {
  busy.value = true
  error.value = ''
  try {
    await refreshContexts()
    if (institution.value) await router.replace('/dashboard')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function signOut() {
  await logout()
  await router.replace('/login')
}
</script>
<template>
  <div class="container page narrow">
    <h1>{{ l('Institution access', 'الوصول إلى المؤسسة') }}</h1>
    <p>
      {{
        l(
          'Your institution could not be opened. Check your connection, or ask an administrator to confirm your access. This installation serves one institution.',
          'تعذر فتح المؤسسة. تحقق من الاتصال أو اطلب من المسؤول تأكيد صلاحية وصولك. يخدم هذا التثبيت مؤسسة واحدة.',
        )
      }}
    </p>
    <p v-if="error" role="alert" class="notice error">{{ error }}</p>
    <div class="actions">
      <button class="button" :disabled="busy" @click="retry">
        {{ l('Retry', 'إعادة المحاولة') }}</button
      ><button class="button secondary" @click="signOut">
        {{ l('Sign out', 'تسجيل الخروج') }}
      </button>
    </div>
  </div>
</template>
