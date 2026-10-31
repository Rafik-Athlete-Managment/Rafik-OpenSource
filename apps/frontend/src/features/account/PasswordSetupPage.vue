<script setup lang="ts">
import PasswordField from '../../components/PasswordField.vue'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../../lib/backend'
import { contexts, refreshProfile, user } from '../../app/auth'
import { language, errorMessage } from '../../lib/i18n'
import { passwordPattern, strongPassword } from '@rafik/shared/password'
const route = useRoute(),
  router = useRouter()
const password = ref(''),
  confirm = ref(''),
  busy = ref(false),
  error = ref('')
async function save() {
  if (password.value !== confirm.value) {
    error.value = language('The passwords do not match.', 'كلمتا المرور غير متطابقتين.')
    return
  }
  if (!strongPassword(password.value)) {
    error.value = language(
      'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
      'استخدم ٨–١٢٨ حرفاً، مع حرف كبير وحرف صغير ورقم ورمز.',
    )
    return
  }
  busy.value = true
  error.value = ''
  try {
    user.value = await api.completePasswordSetup(String(route.params.token), password.value)
    await refreshProfile()
    await router.replace(contexts.value[0]?.path || '/access')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="container auth-layout">
    <section class="auth-intro">
      <h1>{{ language('Set a new password', 'إعداد كلمة مرور جديدة') }}</h1>
      <p>
        {{
          language(
            'This one-time setup link was issued by an institution administrator. It expires after 24 hours.',
            'أصدر مسؤول المؤسسة رابط الإعداد لمرة واحدة. تنتهي صلاحيته بعد ٢٤ ساعة.',
          )
        }}
      </p>
    </section>
    <section class="auth-form panel">
      <h2>{{ language('Choose your password', 'اختر كلمة المرور') }}</h2>
      <form class="form-stack" @submit.prevent="save">
        <label for="password">{{ language('Password', 'كلمة المرور') }}</label>
        <PasswordField
          id="password"
          v-model="password"
          autocomplete="new-password"
          minlength="8"
          maxlength="128"
          :pattern="passwordPattern"
          required
        />
        <p class="small-print">
          {{
            language(
              'Use 8–128 characters and include an uppercase letter, a lowercase letter, a number and a symbol (spaces do not count as symbols).',
              'استخدم ٨–١٢٨ حرفاً، وأدرج حرفاً كبيراً وحرفاً صغيراً ورقماً ورمزاً (المسافة لا تُحسب رمزاً).',
            )
          }}
        </p>
        <label for="confirm">{{ language('Confirm password', 'تأكيد كلمة المرور') }}</label>
        <PasswordField
          id="confirm"
          v-model="confirm"
          autocomplete="new-password"
          minlength="8"
          maxlength="128"
          :pattern="passwordPattern"
          required
        />
        <button class="button full" :disabled="busy">
          {{
            busy ? language('Saving…', 'جارٍ الحفظ…') : language('Save password', 'حفظ كلمة المرور')
          }}
        </button>
      </form>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    </section>
  </div>
</template>
