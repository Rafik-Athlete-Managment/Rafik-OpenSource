<script setup lang="ts">
import PasswordField from '../../components/PasswordField.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { PhLockKey, PhBuildings } from '@phosphor-icons/vue'
import { api } from '../../lib/backend'
import { contexts, refreshProfile, user } from '../../app/auth'
import { safeNext } from '../../app/router'
import { language, errorMessage } from '../../lib/i18n'
const route = useRoute(),
  router = useRouter()
const email = ref(''),
  password = ref(''),
  busy = ref(false),
  error = ref('')
const next = computed(() => safeNext(route.query.next, '/access'))
async function login() {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    user.value = await api.login(email.value.trim().toLowerCase(), password.value)
    await refreshProfile()
    await router.replace(route.query.next ? next.value : contexts.value[0]?.path || next.value)
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
      <h1>{{ language('Institution sign-in', 'تسجيل الدخول إلى المؤسسة') }}</h1>
      <p>
        {{
          language(
            'Sign in to continue to your university or training institution.',
            'سجّل الدخول للمتابعة إلى جامعتك أو مؤسستك التدريبية.',
          )
        }}
      </p>
    </section>
    <section class="auth-form panel">
      <PhLockKey :size="25" class="accent-icon" aria-hidden="true" />
      <h2>{{ language('Sign in', 'تسجيل الدخول') }}</h2>
      <form class="form-stack" :aria-busy="busy" @submit.prevent="login">
        <label for="email">{{ language('Email address', 'البريد الإلكتروني') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          maxlength="254"
          required
        />
        <label for="password">{{ language('Password', 'كلمة المرور') }}</label>
        <PasswordField
          id="password"
          v-model="password"
          autocomplete="current-password"
          maxlength="128"
          required
        />
        <button class="button full" :disabled="busy">
          <span v-if="busy" class="login-spinner" aria-hidden="true" />
          {{
            busy
              ? language('Signing in…', 'جارٍ تسجيل الدخول…')
              : language('Sign in', 'تسجيل الدخول')
          }}
        </button>
      </form>
      <p class="sr-only" role="status">
        {{ busy ? language('Signing in. Please wait.', 'جارٍ تسجيل الدخول. يرجى الانتظار.') : '' }}
      </p>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p>
      <p class="small-print">
        {{
          language(
            'If you cannot sign in, contact your institution’s super admin for a password setup link.',
            'إذا تعذر تسجيل الدخول، تواصل مع المشرف العام في مؤسستك للحصول على رابط إعداد كلمة المرور.',
          )
        }}
      </p>
    </section>
  </div>
</template>

<style scoped>
.login-spinner {
  display: inline-block;
  inline-size: 18px;
  block-size: 18px;
  flex-shrink: 0;
  border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
  border-block-start-color: currentColor;
  border-radius: 50%;
  animation: login-spin 800ms linear infinite;
}
@keyframes login-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .login-spinner {
    animation: none;
  }
}
</style>
