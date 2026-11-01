<!-- Displays the privacy information for this Rafik installation. -->
<script setup lang="ts">
import { language, t } from '../../lib/i18n'
</script>
<template>
  <div class="container page prose-page">
    <p class="overline">{{ t('privacy') }}</p>
    <h1>{{ language('Your data in your institution’s instance.', 'بياناتك في نسخة مؤسستك.') }}</h1>
    <p class="lead">
      {{
        language(
          'Your institution operates this installation and controls its infrastructure. Ask its administrator for the institution’s privacy policy and operator contact details.',
          'تدير مؤسستك هذا التثبيت وتتحكم في بنيته التحتية. اطلب من المسؤول سياسة الخصوصية وبيانات التواصل الخاصة بالمشغّل.',
        )
      }}
    </p>
    <section>
      <h2>{{ language('What stays in the browser', 'ما يبقى في المتصفح') }}</h2>
      <p>
        {{
          language(
            'Recoverable drafts, language, appearance and local save diagnostics can remain on this device. Sign-in uses an HTTP-only session cookie. Clearing browser data can remove unsynced work; a device save is not a server backup.',
            'قد تبقى المسودات واللغة والمظهر وبيانات تشخيص الحفظ على هذا الجهاز. يستخدم الدخول ملف ارتباط للجلسة لا تتيحه JavaScript. قد يؤدي مسح بيانات المتصفح إلى فقدان العمل غير المتزامن؛ الحفظ على الجهاز ليس نسخة احتياطية للخادم.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('What is saved to an account', 'ما يُحفظ في الحساب') }}</h2>
      <p>
        {{
          language(
            'Accounts and institution records are stored through the server API in PostgreSQL. Private files are held by this installation. Server permissions restrict access by institution, role and coaching assignment; a supporting coach does not receive unrestricted access to nutrition or participation records.',
            'تُحفظ الحسابات وسجلات المؤسسة عبر واجهة الخادم في PostgreSQL. يحتفظ هذا التثبيت بالملفات الخاصة. يقيّد الخادم الوصول حسب المؤسسة والدور والتكليف التدريبي؛ لا يحصل المدرب المساند على وصول غير مقيّد إلى التغذية أو سجلات المشاركة.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Your choices', 'خياراتك') }}</h2>
      <p>
        {{
          language(
            'Settings provides account export and deletion controls. Institution records have their own retention rules. Participation sharing requires consent; withdrawing it stops coach access, and sensitive content in closed injury records is deleted after 12 months. Do not enter diagnoses or treatment details. No advertising or external analytics service is enabled by default.',
            'توفّر الإعدادات أدوات تصدير الحساب وحذفه، ولسجلات المؤسسة قواعد احتفاظ مستقلة. تتطلب مشاركة حالة المشاركة موافقة؛ يوقف سحبها وصول المدرب، ويُحذف المحتوى الحساس لسجلات الإصابة المغلقة بعد ١٢ شهراً. لا تدخل تشخيصاً أو تفاصيل علاج. لا تُفعّل خدمات إعلانية أو تحليلات خارجية افتراضياً.',
          )
        }}
      </p>
    </section>
    <RouterLink class="button secondary" to="/help">{{ t('help') }}</RouterLink>
  </div>
</template>
