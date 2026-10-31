<script setup lang="ts">
import PasswordField from '../../components/PasswordField.vue'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, request } from '../../lib/backend'
import { user, refreshContexts, refreshProfile } from '../../app/auth'
import { language as l, errorMessage } from '../../lib/i18n'
import { passwordPattern, strongPassword } from '@rafik/shared/password'
const route = useRoute(),
  router = useRouter()
const data = ref<{
  organization: string
  email: string
  roles: string[]
  state: string
  expires_at: string
}>()
const email = ref(''),
  name = ref(''),
  password = ref(''),
  confirm = ref('')
const error = ref(''),
  busy = ref(false)
const path = '/v1/invitations/' + route.params.token
onMounted(async () => {
  try {
    const invitation = await request<{
      organization: string
      email: string
      roles: string[]
      state: string
      expires_at: string
    }>(path)
    data.value = invitation
    email.value = invitation.email
  } catch (e) {
    error.value = errorMessage(e)
  }
})
async function accept() {
  busy.value = true
  error.value = ''
  try {
    await request<{ institution_id: string; role: string }>(path, {
      method: 'POST',
      body: '{}',
    })
    await refreshContexts()
    await router.push('/dashboard')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
async function createAccount() {
  if (password.value !== confirm.value) {
    error.value = l('The passwords do not match.', 'كلمتا المرور غير متطابقتين.')
    return
  }
  if (!strongPassword(password.value)) {
    error.value = l(
      'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
      'استخدم ٨–١٢٨ حرفاً، مع حرف كبير وحرف صغير ورقم ورمز.',
    )
    return
  }
  busy.value = true
  error.value = ''
  try {
    const result = await api.acceptInvitation({
      token: String(route.params.token),
      email: email.value.trim().toLowerCase(),
      name: name.value.trim(),
      password: password.value,
    })
    user.value = result.user
    await refreshProfile()
    await router.replace('/dashboard')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}
</script>
<template>
  <div class="container page narrow">
    <h1>
      {{
        data
          ? l('Join ' + data.organization, 'الانضمام إلى ' + data.organization)
          : l('Institution invitation', 'دعوة المؤسسة')
      }}
    </h1>
    <p v-if="error" class="notice error" role="alert">{{ error }}</p>
    <section v-if="data" class="panel form-stack">
      <p>
        {{ l('Your institution access:', 'صلاحياتك في المؤسسة:') }}
        {{
          data.roles
            .map((r) =>
              l(
                { admin: 'Administrator', trainer: 'Trainer', trainee: 'Athlete' }[r] || r,
                { admin: 'مسؤول', trainer: 'مدرب', trainee: 'رياضي' }[r] || r,
              ),
            )
            .join(' · ')
        }}
      </p>
      <p>
        {{
          l(
            'This one-time invitation link expires in seven days. The email address identifies your account; it is not verified. Share this link only with its intended user.',
            'ينتهي رابط الدعوة لمرة واحدة بعد سبعة أيام. يعرّف البريد حسابك لكنه لا يُتحقق منه. شارك الرابط مع الشخص المقصود فقط.',
          )
        }}
      </p>
      <template v-if="user">
        <p>
          {{ l('Signed in as', 'مسجل باسم') }} <strong dir="ltr">{{ user.email }}</strong>
        </p>
        <button class="button" :disabled="busy" @click="accept">
          {{ busy ? l('Joining…', 'جارٍ الانضمام…') : l('Accept invitation', 'قبول الدعوة') }}
        </button>
      </template>
      <template v-else>
        <form class="form-stack" @submit.prevent="createAccount">
          <h2>{{ l('Set up your account', 'إعداد حسابك') }}</h2>
          <label for="invite-name">{{ l('Your full name', 'اسمك الكامل') }}</label>
          <input id="invite-name" v-model="name" autocomplete="name" maxlength="80" required />
          <label for="invite-email">{{
            l('Sign-in email', 'البريد المستخدم لتسجيل الدخول')
          }}</label>
          <input
            id="invite-email"
            v-model="email"
            type="email"
            autocomplete="username"
            maxlength="254"
            required
          />
          <label for="invite-password">{{ l('Create a password', 'أنشئ كلمة مرور') }}</label>
          <PasswordField
            id="invite-password"
            v-model="password"
            autocomplete="new-password"
            minlength="8"
            maxlength="128"
            :pattern="passwordPattern"
            required
          />
          <p class="small-print">
            {{
              l(
                'Use 8–128 characters and include an uppercase letter, a lowercase letter, a number and a symbol (spaces do not count as symbols).',
                'استخدم ٨–١٢٨ حرفاً، وأدرج حرفاً كبيراً وحرفاً صغيراً ورقماً ورمزاً (المسافة لا تُحسب رمزاً).',
              )
            }}
          </p>
          <label for="invite-confirm">{{ l('Confirm password', 'تأكيد كلمة المرور') }}</label>
          <PasswordField
            id="invite-confirm"
            v-model="confirm"
            autocomplete="new-password"
            minlength="8"
            maxlength="128"
            :pattern="passwordPattern"
            required
          />
          <button class="button" :disabled="busy">
            {{
              busy
                ? l('Creating account…', 'جارٍ إنشاء الحساب…')
                : l('Create account and join', 'إنشاء الحساب والانضمام')
            }}
          </button>
        </form>
      </template>
    </section>
  </div>
</template>
