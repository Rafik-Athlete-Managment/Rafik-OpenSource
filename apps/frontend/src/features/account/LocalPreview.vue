<script setup lang="ts">
import PageHeading from '../../components/PageHeading.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { PhArrowRight } from '@phosphor-icons/vue'
import { api, localPreview } from '../../lib/backend'
import { user, refreshProfile } from '../../app/auth'
import { language, t, errorMessage } from '../../lib/i18n'
const busy = ref('')
const error = ref('')
const router = useRouter()
async function enter(role: 'orgadmin' | 'orgtrainer' | 'orgtrainee' | 'operator') {
  busy.value = role
  error.value = ''
  try {
    user.value = await api.preview(role + '@rafik.test')
    await refreshProfile()
    await router.push(role === 'operator' ? '/platform' : '/dashboard')
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
</script>
<template>
  <div class="container page narrow">
    <template v-if="localPreview"
      ><PageHeading class="page-heading"
        ><div>
          <span class="tag">{{ language('Local preview', 'معاينة محلية') }}</span>
          <h1>
            {{
              language(
                'Choose a role. Explore the whole workflow.',
                'اختر دوراً واستكشف رحلة العمل كاملة.',
              )
            }}
          </h1>
          <p>
            {{
              language(
                'These are synthetic accounts in the local database. Use them to try planning, training, and reviewing without sending any real email.',
                'هذه حسابات تجريبية في قاعدة البيانات المحلية. جرّب التخطيط والتدريب والمراجعة بلا رسائل حقيقية.',
              )
            }}
          </p>
        </div></PageHeading
      >
      <h2>{{ language('Institutions', 'المؤسسات') }}</h2>
      <p class="preview-context">
        {{
          language(
            'Each institution owns its people, programs and training history. Choose an administrator, coach or athlete account to explore its institution.',
            'لكل مؤسسة أفرادها وبرامجها وسجلها التدريبي. اختر حساب مسؤول أو مدرب أو رياضي لاستكشاف مساحة عمله.',
          )
        }}
      </p>
      <div class="preview-accounts">
        <button
          v-for="account in [
            {
              role: 'orgadmin' as const,
              name: 'Rania Mansour',
              description: language('Madar Training · Administrator', 'مدار للتدريب · مسؤولة'),
            },
            {
              role: 'orgtrainer' as const,
              name: 'Kareem Nasser',
              description: language('Madar Training · Coach', 'مدار للتدريب · مدرب'),
            },
            {
              role: 'orgtrainee' as const,
              name: 'Sara Khalil',
              description: language('Madar Training · Athlete', 'مدار للتدريب · رياضية'),
            },
          ]"
          :key="account.role"
          class="preview-account panel"
          :disabled="!!busy"
          @click="enter(account.role)"
        >
          <span class="avatar">{{ account.name[0] }}</span
          ><span
            ><strong>{{ account.name }}</strong
            ><small>{{ account.description }}</small></span
          ><PhArrowRight :size="22" class="directional" aria-hidden="true" />
        </button>
      </div>
      <h2>{{ language('Platform operations', 'عمليات المنصة') }}</h2>
      <div class="preview-accounts">
        <button class="preview-account panel" :disabled="!!busy" @click="enter('operator')">
          <span class="avatar">A</span
          ><span
            ><strong>Amina</strong
            ><small>{{
              language(
                'Platform operator: audited local operations',
                'مشغلة المنصة: العمليات المحلية المسجَّلة',
              )
            }}</small></span
          ><PhArrowRight :size="22" aria-hidden="true" />
        </button>
      </div>
      <p v-if="busy" role="status">{{ t('loading') }}</p>
      <p v-if="error" class="notice error" role="alert">{{ error }}</p> </template
    ><template v-else
      ><h1>
        {{
          language(
            'Sample accounts are only available locally.',
            'الحسابات التجريبية متاحة محلياً فقط.',
          )
        }}
      </h1>
    </template>
  </div>
</template>

<style scoped>
h2 {
  font-size: 1.2rem;
  margin-block: 32px 16px;
}
.preview-context {
  margin-bottom: 20px;
  color: var(--muted);
}
</style>
