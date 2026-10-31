<script setup lang="ts">
import PasswordField from '../../components/PasswordField.vue'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhBuildings, PhShieldCheck } from '@phosphor-icons/vue'
import { api, request } from '../../lib/backend'
import { contexts, refreshProfile, user } from '../../app/auth'
import { language, errorMessage } from '../../lib/i18n'
import { passwordPattern, strongPassword } from '@rafik/shared/password'
const router = useRouter()
const name = ref(''),
  email = ref(''),
  institution = ref(''),
  password = ref(''),
  confirm = ref('')
const busy = ref(false),
  loading = ref(true),
  initialized = ref(false),
  error = ref('')
onMounted(async () => {
  try {
    initialized.value = (
      await request<{ initialized: boolean }>('/v1/auth/setup-status')
    ).initialized
    if (initialized.value) await router.replace('/login')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
})
async function setup() {
  error.value = ''
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
  try {
    user.value = await api.setup({
      name: name.value.trim(),
      email: email.value.trim().toLowerCase(),
      institution: institution.value.trim(),
      password: password.value,
    })
    await refreshProfile()
    const admin = contexts.value.find(
      (context) => context.kind === 'institution' && context.role === 'admin',
    )
    await router.replace(admin?.path || '/access')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="container auth-layout auth-centered">
    <section class="auth-intro">
      <PhBuildings :size="34" class="accent-icon" aria-hidden="true" />
      <h1>{{ language('Set up your institution', 'إعداد المؤسسة') }}</h1>
      <p>
        {{
          language(
            'Create the first administrator account for your university or training institution.',
            'أنشئ حساب المشرف الأول ومساحة عمل الجامعة أو المؤسسة التدريبية.',
          )
        }}
      </p>
      <div class="auth-promise">
        <PhShieldCheck :size="25" aria-hidden="true" />
        <p>
          {{
            language(
              'No email verification. Your password is stored as a secure hash.',
              'لا حاجة للتحقق من البريد الإلكتروني. تُحفظ كلمة المرور بصيغة مشفرة آمنة.',
            )
          }}
        </p>
      </div>
    </section>
    <section class="auth-form panel">
      <template v-if="loading"
        ><p role="status">{{ language('Checking setup…', 'جارٍ التحقق من الإعداد…') }}</p></template
      >
      <template v-else-if="!initialized">
        <h2>{{ language('Create the super admin', 'إنشاء المشرف العام') }}</h2>
        <p>
          {{
            language(
              'The first person to finish this form becomes the institution’s super admin. Keep this service on a private network until setup is complete.',
              'أول شخص يكمل هذا النموذج يصبح المشرف العام للمؤسسة. أبقِ الخدمة على شبكة خاصة حتى يكتمل الإعداد.',
            )
          }}
        </p>
        <form class="form-stack" @submit.prevent="setup">
          <label for="name">{{ language('Your full name', 'اسمك الكامل') }}</label>
          <input id="name" v-model="name" autocomplete="name" maxlength="80" required />
          <label for="institution">{{
            language('University or training institution name', 'اسم الجامعة أو المؤسسة التدريبية')
          }}</label>
          <input
            id="institution"
            v-model="institution"
            autocomplete="organization"
            maxlength="100"
            required
          />
          <label for="email">{{
            language('Sign-in email address', 'البريد المستخدم لتسجيل الدخول')
          }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="username"
            maxlength="254"
            required
          />
          <p class="small-print">
            {{
              language(
                'This address is an account identifier. Rafik does not send a verification email.',
                'هذا العنوان معرّف للحساب. لا يرسل رفيق رسالة للتحقق من البريد.',
              )
            }}
          </p>
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
              busy
                ? language('Creating institution…', 'جارٍ إنشاء المؤسسة…')
                : language('Create institution and account', 'إنشاء المؤسسة والحساب')
            }}
          </button>
        </form>
      </template>
      <p v-else>
        {{
          language(
            'Setup is already complete. Continue to sign in.',
            'اكتمل الإعداد. تابع لتسجيل الدخول.',
          )
        }}
        <RouterLink to="/login">{{ language('Sign in', 'تسجيل الدخول') }}</RouterLink>
      </p>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    </section>
  </div>
</template>
