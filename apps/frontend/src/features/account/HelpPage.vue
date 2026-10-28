<script setup lang="ts">
import AppUpdates from '../../components/AppUpdates.vue'
import { language, t } from '../../lib/i18n'
</script>
<template>
  <div class="container page prose-page">
    <p class="overline">{{ t('help') }}</p>
    <h1>{{ language('Help', 'المساعدة') }}</h1>
    <p class="small-print">
      {{
        language(
          'Use Schedule to browse scheduled group training and assessments without selecting an athlete. Filter by activity type or status, then open an event for attendance, results and correction history. Session history contains athletes’ recorded workouts.',
          'استخدم الجدول لتصفح التدريبات الجماعية والتقييمات المجدولة دون اختيار رياضي. رشّح حسب نوع النشاط أو حالته، ثم افتح الموعد لعرض الحضور والنتائج وتاريخ التصحيحات. يعرض سجل الحصص تمارين الرياضيين المسجلة.',
        )
      }}
    </p>
    <section>
      <h2>{{ language('Messages and programs', 'الرسائل والبرامج') }}</h2>
      <p>
        {{
          language(
            'Open Messages: Chats lists your conversations and Contacts lists people and groups. Choose a contact to open or resume their conversation; search narrows the list as you type. Open group conversation on a training group starts its shared conversation; using it again returns to the same conversation. Two-person conversations are reused instead of duplicated. To assign training, open Programs, publish the program, then choose Assign this program. Publishing shares it in the institution library so coaches can see it; coaches can assign it only to athletes they are responsible for.',
            'افتح الرسائل: تعرض المحادثات محادثاتك وتعرض جهات الاتصال الأشخاص والمجموعات. اختر جهة اتصال لفتح محادثتها أو متابعتها؛ يضيّق البحث القائمة أثناء الكتابة. يفتح خيار محادثة المجموعة محادثة المجموعة التدريبية نفسها، ويعيدك إليها عند استخدامه مرة أخرى. يعاد استخدام المحادثات الثنائية لتجنب تكرارها. لتعيين التدريب، افتح البرامج وانشر البرنامج ثم اختر تعيين هذا البرنامج. يشارك النشر البرنامج في مكتبة المؤسسة ليتمكن المدربون من رؤيته؛ ويمكن للمدرب تعيينه فقط للرياضيين المسؤول عنهم.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Athlete health and privacy', 'صحة الرياضي والخصوصية') }}</h2>
      <p>
        {{
          language(
            'Athletes can share a limited participation status with their assigned coach after the institution records the required consent setup and the athlete agrees. Coaches see only the current status and effective date. Administrators manage consent prerequisites but cannot view athlete health records. Athletes can download a copy of their status and correction history. Do not enter diagnoses or medical details. Withdrawing stops coach access; closed records are automatically deleted after 12 months.',
            'يمكن للرياضي مشاركة حالة مشاركة محدودة مع مدربه المعيّن بعد تسجيل إعداد الموافقة المطلوب وموافقة الرياضي. يرى المدربون الحالة الحالية وتاريخ سريانها فقط. يدير المسؤولون متطلبات الموافقة ولا يمكنهم رؤية سجلات صحة الرياضي. يمكن للرياضي تنزيل نسخة من الحالة وسجل التصحيحات. لا تُدخل تشخيصات أو تفاصيل طبية. يؤدي سحب الموافقة إلى إيقاف وصول المدرب، وتُحذف السجلات المغلقة تلقائيًا بعد 12 شهرًا.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Training sessions and feedback', 'الجلسات التدريبية والتقييمات') }}</h2>
      <p>
        {{
          language(
            'Use Calendar to schedule training and assessor-led assessments. Record attendance, check-ins and athlete-visible notes in the event. There are no session packages, allowances or commercial session limits.',
            'استخدم التقويم لجدولة التدريب والتقييمات التي يقودها المقيمون. سجّل الحضور ووقت تسجيله والملاحظات المرئية للرياضي ضمن الموعد. لا توجد باقات جلسات أو أرصدة أو حدود تجارية للجلسات.',
          )
        }}
      </p>
      <p>
        {{
          language(
            'Session details hold attendance, check-in time and athlete-visible notes. Analytics separates athlete session experience from coaches’ workplace feedback. Coaches use My feedback for an optional monthly workplace rating; athletes can rate completed sessions from their completion screen. Neither question has a preselected answer.',
            'تضم تفاصيل الجلسة الحضور ووقت تسجيله وملاحظات مرئية للرياضي. تفصل التحليلات تجربة الرياضيين عن آراء المدربين في بيئة العمل. يستخدم المدربون تقييماتي للتقييم الشهري الاختياري، ويمكن للرياضيين تقييم الجلسات من شاشة الإكمال. لا إجابة مختارة مسبقاً.',
          )
        }}
      </p>
    </section>
    <section class="help-institutions">
      <h2>{{ language('Your institution dashboard', 'لوحة مؤسستك') }}</h2>
      <p>
        {{
          language(
            'Your account opens its assigned dashboard: administrators use People & access to manage invitations and permissions, Analytics to review recorded activity, and Programs to publish plans; coaches see their assigned coaching work; athletes see their own training. Administrators can change an account’s single institution role in People & access. Each institution keeps its own people, programs and history.',
            'يفتح حسابك لوحة الدور المعيّن له: يدير المسؤولون الدعوات والصلاحيات في الأشخاص والصلاحيات، ويراجعون النشاط المسجل في التحليلات، وينشرون الخطط في البرامج؛ ويرى المدربون مهامهم التدريبية، ويرى الرياضيون تدريبهم. يمكن للمسؤول تغيير دور الحساب الواحد داخل المؤسسة من الأشخاص والصلاحيات. تحتفظ كل مؤسسة بأشخاصها وبرامجها وسجلها.',
          )
        }}
      </p>
      <RouterLink class="text-link" to="/dashboard">{{
        language('Open your dashboard', 'افتح لوحة التحكم')
      }}</RouterLink>
      <details>
        <summary>{{ language('I administer an institution', 'أنا مسؤول مؤسسة') }}</summary>
        <p>
          {{
            language(
              'Start in People & access: invite administrators, coaches or athletes and assign a responsible coach. In Programs, publish a plan and review who will receive it. Calendar schedules training and assessor-led assessments; the Library section contains reusable groups and assessment templates.',
              'ابدأ في الأشخاص والصلاحيات: ادعُ المسؤولين والمدربين والرياضيين وعيّن المدرب المسؤول. انشر خطة في البرامج وراجع المستلمين. استخدم التقويم لجدولة التدريب والتقييمات؛ ويحتوي قسم المكتبة على المجموعات وقوالب التقييم القابلة لإعادة الاستخدام.',
            )
          }}
        </p>
        <p>
          {{
            language(
              'Analytics shows institution workload, participation and gaps. Its totals and definitions describe recorded activity. They do not rate coach quality. Reassigning a coach preserves the institution’s training history.',
              'تعرض التحليلات أعباء العمل والمشاركة والنواقص في المؤسسة. تصف الأرقام النشاط المسجّل ولا تقيّم جودة المدرب. يبقى سجل المؤسسة محفوظاً عند تغيير المدرب المسؤول.',
            )
          }}
        </p>
      </details>
      <details>
        <summary>{{ language('I train people in an institution', 'أنا مدرب في مؤسسة') }}</summary>
        <p>
          {{
            language(
              'Your coach dashboard opens to your assigned work. Athlete plans and Nutrition plans show current published assignments without choosing an athlete first. Use status filters for expired or replaced plans. Session history lists recorded workouts across your authorized athletes, with an optional athlete filter. Calendar includes events where you are designated staff. Analytics follows your current responsibility, and conversations show their participants.',
              'تعرض خطط الرياضيين البرامج المسندة السارية مباشرة، ويعرض سجل الحصص التدريبات المسجلة لكل الرياضيين المصرّح لك بالاطلاع عليهم، دون الحاجة لاختيار رياضي أولاً. استخدم البحث والمرشحات الاختيارية لعرض الخطط القادمة أو المنتهية. تعرض خطط التغذية الخطط المنشورة دون كشف يوميات الطعام. يعرض التقويم المواعيد المسندة إليك، وتخص التحليلات مسؤوليتك الحالية. افتح الحصة لمراجعتها وتقديم ملاحظاتك.',
            )
          }}
        </p>
      </details>
    </section>
    <section>
      <h2>{{ language('Exercises and uploaded files', 'التمارين والملفات المرفوعة') }}</h2>
      <p>
        {{
          language(
            'Create an exercise with multiple body areas, muscle groups and equipment. Upload its demonstration directly or reuse an uploaded file. Institution exercises are shared only inside that institution; coach-created exercises remain private to their coach. Published assignments preserve their instructions and demonstration.',
            'أنشئ تمريناً بمناطق جسم ومجموعات عضلية ومعدات متعددة. ارفع الشرح مباشرة أو أعد استخدام ملف مرفوع. تشارك تمارين المؤسسة داخلها فقط، وتبقى تمارين المدرب خاصة به. تحتفظ التكليفات المنشورة بالتعليمات والشرح.',
          )
        }}
      </p>
      <p>
        {{
          language(
            'Resources manages exercise uploads. Archiving removes a file from new selections while keeping existing plan references working. Private conversation files remain in their conversation. A two-person conversation cannot be joined by another staff member. Group conversations allow administrators to join explicitly.',
            'تدير الموارد ملفات التمارين. تمنع الأرشفة الاختيارات الجديدة وتبقي مراجع الخطط الحالية. تبقى ملفات المحادثة الخاصة فيها. لا يستطيع موظف آخر الانضمام إلى محادثة ثنائية. تسمح المحادثات الجماعية للمسؤولين بالانضمام الصريح.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Use a coach’s invitation', 'استخدم دعوة المدرب') }}</h2>
      <p>
        {{
          language(
            'Open the link your coach shared. Sign in using the exact email they invited, then accept the plan. If the invitation expired, ask the coach to create a new one.',
            'افتح الرابط الذي شاركه مدربك. ادخل بالبريد الذي دعاه، ثم اقبل الخطة. إذا انتهت الدعوة اطلب رابطاً جديداً.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Understand save status', 'افهم حالة الحفظ') }}</h2>
      <p>
        {{
          language(
            '“Saved on this device” means the browser has your work. “Synced with your account” means the server has acknowledged it. Keep the workout open while reconnecting, or reopen it from History to retry.',
            '«محفوظ على هذا الجهاز» يعني أن المتصفح يحتفظ بعملك. «تمت المزامنة مع حسابك» يعني أن الخادم أكد استلامه. أبقِ الحصة مفتوحة عند الاتصال أو افتحها من السجل لإعادة المحاولة.',
          )
        }}
      </p>
      <p>
        {{
          language(
            'If another device saved a newer version, download your local draft before loading the latest server version. Nothing is silently overwritten.',
            'إذا حفظ جهاز آخر نسخة أحدث، نزّل مسودتك المحلية قبل تحميل نسخة الخادم. لن تتم الكتابة فوق عملك بصمت.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Prepare and share a program', 'جهّز برنامجاً وشاركه') }}</h2>
      <p>
        {{
          language(
            'Open Coaching → Programs. Start with a blank session, add exercises from your library, and preview the result. Save a draft while you work or publish the finished program, then invite athletes from Athletes.',
            'افتح التدريب ← الخطط. ابدأ بالخطة الجاهزة، وعدّل التمارين، وعاين الحصة. احفظها وانشرها، ثم أنشئ دعوة ضمن الرياضيين. شارك الرابط عبر وسيلة التواصل المعتادة.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Get help with a failed save', 'المساعدة عند فشل الحفظ') }}</h2>
      <p>
        {{
          language(
            'Account settings shows sessions waiting to sync and downloadable support details. Include those details when reporting a problem to the person running your preview. Keep private workout notes out of public bug reports.',
            'تعرض الإعدادات الحصص التي تنتظر المزامنة وتفاصيل دعم قابلة للتنزيل. أرفقها عند إبلاغ مسؤول المعاينة بالمشكلة. لا تضع ملاحظات التمرين الخاصة في البلاغات العامة.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Know who receives a message', 'اعرف من يستقبل الرسالة') }}</h2>
      <p>
        {{
          language(
            'A conversation lists the people who can read its history and send messages. Institution administrators join visibly. The notification bell keeps updates grouped by their source. In this local preview, optional email is intercepted for testing; no real email or push is sent.',
            'توضح المحادثة من يستطيع قراءة سجلها وإرسال الرسائل، ويظهر انضمام مسؤول المؤسسة. يفصل جرس الإشعارات تحديثات مساحات العمل. في هذه المعاينة المحلية تُعترض الرسائل الاختيارية للاختبار ولا يُرسل بريد أو إشعار دفع فعلي.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>{{ language('Make nutrition actionable', 'حوّل التغذية إلى خطوات عملية') }}</h2>
      <p>
        {{
          language(
            'Independent coaches: open Nutrition, choose an athlete, enter agreed calorie/macronutrient targets and build a suggested day. The calculator only converts your chosen budget into grams. Save the plan to share it. Athletes choose who can see a record, select food or a suggested meal, adjust the amount actually eaten and save. Suggested meals never count as logged food automatically. Unknown values stay blank.',
            'للمدرب المستقل: افتح التغذية واختر رياضياً وحدد الأهداف المتفق عليها للسعرات والمغذيات وأضف يوماً مقترحاً. تحوّل الحاسبة السعرات التي اخترتها إلى غرامات فقط. احفظ الخطة لمشاركتها. للرياضي: حدد من يرى السجل واختر طعاماً أو وجبة مقترحة وعدّل الكمية التي تناولتها ثم احفظ. لا تُسجل المقترحات كطعام متناول تلقائياً. تبقى القيم المجهولة فارغة.',
          )
        }}
      </p>
      <p>
        {{
          language(
            'The food library starts with 15 sourced USDA staples. Use a label or a saved food for other choices; check the nutrient basis before changing portions. Institution admins and assigned coaches can publish scoped plans in Nutrition. Athletes decide whether to share their institution diary; personal records remain separate.',
            'تبدأ مكتبة الطعام بخمسة عشر طعاماً موثقاً من وزارة الزراعة الأمريكية. استخدم الملصق أو طعاماً محفوظاً للخيارات الأخرى وراجع أساس القيم قبل تعديل الكميات. يمكن لمسؤولي المؤسسة والمدربين المسند إليهم الرياضيون نشر خطط في التغذية. يقرر الرياضي مشاركة سجل المؤسسة، وتبقى السجلات الشخصية منفصلة.',
          )
        }}
      </p>
    </section>
    <section>
      <h2>
        {{ language('Find exercises and see the movement', 'ابحث عن التمارين وشاهد الحركة') }}
      </h2>
      <p>
        {{
          language(
            'Filter Exercises by body area, equipment, recording type or video availability, then select a result to see the instructions and preview. Available videos play silently when visible; use Pause at any time. Reduced-motion settings prevent automatic playback. Exercises without video show written guidance or static reference positions. The plan editor searches the full library and keeps up to three approved alternatives.',
            'رشّح التمارين حسب منطقة الجسم والمعدات ونوع التسجيل وتوفر الفيديو، ثم اختر تمريناً لعرض التعليمات والشرح. تُشغّل الفيديوهات بصمت عند ظهورها ويمكن إيقافها في أي وقت. تمنع إعدادات تقليل الحركة التشغيل التلقائي. تعرض التمارين الأخرى تعليمات مكتوبة أو وضعيات ثابتة. يبحث محرر الخطة في المكتبة الكاملة ويحفظ حتى ثلاثة بدائل معتمدة.',
          )
        }}
      </p>
      <a class="text-link" href="/exercise-media/CREDITS.txt" target="_blank" rel="noopener">{{
        language('Exercise illustration credits and license', 'مصادر الرسوم التوضيحية وترخيصها')
      }}</a>
    </section>
    <AppUpdates />
  </div>
</template>

<style scoped>
.help-institutions details {
  margin-top: 20px;
}
.help-institutions summary {
  font-weight: 600;
}
.help-institutions details p {
  margin-top: 16px;
}
</style>
