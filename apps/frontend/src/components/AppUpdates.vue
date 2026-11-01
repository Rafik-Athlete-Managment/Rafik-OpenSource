<!-- Update notice: tells the user when a newer web app version is ready to load. -->
<script setup lang="ts">
import { checkAppUpdate, updatesSupported, updateState } from '../app/updates'
import { language as l } from '../lib/i18n'
</script>
<template>
  <section
    v-if="updatesSupported"
    class="panel app-updates"
    :aria-label="l('App updates', 'تحديثات التطبيق')"
  >
    <h2>{{ l('App updates', 'تحديثات التطبيق') }}</h2>
    <p role="status">
      {{
        updateState === 'ready'
          ? l(
              'An update is ready. Finish your work, then close all Rafik tabs and reopen Rafik to use it. Do not clear your browser data.',
              'التحديث جاهز. أكمل عملك، ثم أغلق جميع علامات تبويب رفيق وافتح رفيق مجدداً. لا تمسح بيانات المتصفح.',
            )
          : updateState === 'current'
            ? l('You’re using the latest available version.', 'تستخدم أحدث نسخة متاحة.')
            : updateState === 'failed'
              ? l(
                  'Could not check or download the update. Check your connection and try again. Your current work stays here.',
                  'تعذر التحقق من التحديث أو تنزيله. تحقق من اتصالك وحاول مجدداً. يبقى عملك الحالي محفوظاً هنا.',
                )
              : updateState === 'checking'
                ? l('Checking for updates…', 'جارٍ التحقق من التحديثات…')
                : l(
                    'Updates wait until you finish. Your work will not be interrupted.',
                    'تنتظر التحديثات حتى تنتهي. لن تتم مقاطعة عملك.',
                  )
      }}
    </p>
    <button
      class="button secondary small"
      :disabled="updateState === 'checking'"
      @click="checkAppUpdate"
    >
      {{ l('Check for updates', 'التحقق من التحديثات') }}
    </button>
  </section>
</template>
