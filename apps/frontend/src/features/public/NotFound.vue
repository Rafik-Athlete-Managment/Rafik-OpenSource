<script setup lang="ts">
import { PhTray } from '@phosphor-icons/vue'
import { language } from '../../lib/i18n'
</script>
<template>
  <div class="container page empty-state empty-state--centered">
    <PhTray :size="28" aria-hidden="true" />
    <p class="overline">404</p>
    <h1>{{ language('That page isn’t here.', 'هذه الصفحة غير موجودة.') }}</h1>
    <p>
      {{
        language(
          'Return to Rafik to continue in your institution.',
          'عد إلى رفيق للمتابعة في مؤسستك.',
        )
      }}
    </p>
    <RouterLink class="button" to="/">{{
      language('Return to Rafik', 'العودة إلى رفيق')
    }}</RouterLink>
  </div>
</template>
