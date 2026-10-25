import { ref, watch } from 'vue'
import { formatDate } from './dates'
export const locale = ref<'en' | 'ar'>(localStorage.getItem('rafik.locale') === 'ar' ? 'ar' : 'en')
export const language = (en: string, ar: string) => (locale.value === 'ar' ? ar : en)
export const words = {
  home: ['Home', 'الرئيسية'],
  today: ['Today', 'اليوم'],
  history: ['History', 'السجل'],
  coach: ['Coach', 'المدرب'],
  coaching: ['Coaching', 'التدريب'],
  training: ['My training', 'تدريبي'],
  clients: ['Athletes', 'الرياضيون'],
  plans: ['Programs', 'البرامج'],
  settings: ['Settings', 'الإعدادات'],
  help: ['Help', 'المساعدة'],
  signIn: ['Sign in', 'تسجيل الدخول'],
  signOut: ['Sign out', 'تسجيل الخروج'],
  back: ['Back', 'رجوع'],
  save: ['Save changes', 'حفظ التغييرات'],
  saving: ['Saving…', 'جارٍ الحفظ…'],
  saved: ['Saved', 'تم الحفظ'],
  cancel: ['Cancel', 'إلغاء'],
  retry: ['Try again', 'حاول مجدداً'],
  close: ['Close', 'إغلاق'],
  loading: ['Loading…', 'جارٍ التحميل…'],
  email: ['Email address', 'البريد الإلكتروني'],
  name: ['Your name', 'اسمك'],
  sample: ['Sample workout', 'تمرين تجريبي'],
  sampleAccount: ['Sample account', 'حساب تجريبي'],
  preview: ['Preview', 'معاينة'],
  start: ['Start workout', 'ابدأ التمرين'],
  resume: ['Resume workout', 'تابع التمرين'],
  finish: ['Finish session', 'إنهاء الحصة'],
  minutes: ['min', 'دقيقة'],
  exercises: ['exercises', 'تمارين'],
  sets: ['sets', 'مجموعات'],
  reps: ['Reps', 'التكرارات'],
  load: ['Load', 'الوزن'],
  rest: ['Rest', 'راحة'],
  done: ['Done', 'تم'],
  completed: ['Completed', 'مكتمل'],
  inProgress: ['In progress', 'قيد التنفيذ'],
  view: ['View session', 'عرض الحصة'],
  nextExercise: ['Next exercise', 'التمرين التالي'],
  previous: ['Previous result', 'النتيجة السابقة'],
  localSave: ['Saved on this device', 'محفوظ على هذا الجهاز'],
  synced: ['Synced with your account', 'تمت المزامنة مع حسابك'],
  syncing: ['Syncing…', 'جارٍ المزامنة…'],
  waiting: ['Saved here. Waiting to sync.', 'محفوظ هنا. بانتظار المزامنة.'],
  syncFailed: ['Saved here. Sync needs attention.', 'محفوظ هنا. تحتاج المزامنة إلى مراجعة.'],
  note: ['Note for your coach', 'ملاحظة لمدربك'],
  feedback: ['Coach feedback', 'ملاحظات المدرب'],
  review: ['Review session', 'مراجعة الحصة'],
  sendFeedback: ['Save feedback', 'حفظ الملاحظات'],
  reviewed: ['Reviewed', 'تمت المراجعة'],
  draft: ['Draft', 'مسودة'],
  published: ['Published', 'منشور'],
  editPlan: ['Edit program', 'تعديل البرنامج'],
  newPlan: ['New program', 'برنامج جديد'],
  publish: ['Publish program', 'نشر البرنامج'],
  invite: ['Invite an athlete', 'دعوة رياضي'],
  createLink: ['Create invitation link', 'إنشاء رابط الدعوة'],
  copyLink: ['Copy link', 'نسخ الرابط'],
  copied: ['Copied', 'تم النسخ'],
  pending: ['Pending', 'معلق'],
  active: ['Active', 'نشط'],
  revoked: ['Revoked', 'ملغى'],
  expires: ['Expires', 'تنتهي في'],
  remove: ['Remove', 'إزالة'],
  addExercise: ['Add exercise', 'إضافة تمرين'],
  addDay: ['Add day', 'إضافة يوم'],
  units: ['Weight units', 'وحدة الوزن'],
  timezone: ['Timezone', 'المنطقة الزمنية'],
  language: ['Language', 'اللغة'],
  privacy: ['Privacy', 'الخصوصية'],
  export: ['Export my data', 'تصدير بياناتي'],
  noHistory: ['Your first session starts here.', 'حصتك الأولى تبدأ هنا.'],
  bodyweight: ['Bodyweight', 'وزن الجسم'],
  localPreview: ['Explore sample accounts', 'استكشف الحسابات التجريبية'],
  plan: ['Plan', 'الخطة'],
  days: ['days', 'أيام'],
  accepted: ['Accepted', 'مقبول'],
  expired: ['Expired', 'منتهي'],
  instruction: ['How to do it', 'طريقة الأداء'],
  optional: ['Optional', 'اختياري'],
  kg: ['kg', 'كغ'],
  lb: ['lb', 'رطل'],
  exercise: ['Exercise', 'تمرين'],
  skipRest: ['Skip rest', 'تجاوز الراحة'],
  clear: ['Clear', 'مسح'],
  publishedVersion: ['Published version', 'نسخة منشورة'],
  openPlan: ['Open plan', 'افتح الخطة'],
  noName: ['Your name', 'اسمك'],
  acknowledge: ['Mark reviewed', 'تمت المراجعة'],
  allCaughtUp: ['You’re all caught up.', 'تمت مراجعة كل شيء.'],
  choosePlan: ['Choose a published plan', 'اختر خطة منشورة'],
  nextWorkout: ['Your next workout', 'تمرينك القادم'],
  saveDraft: ['Save draft', 'حفظ المسودة'],
  deleteAccount: ['Delete my account', 'حذف حسابي'],
  contentTitle: ['Build your base', 'ابنِ أساسك'],
  newSession: ['Start a new session', 'ابدأ حصة جديدة'],
} as const
export type Word = keyof typeof words
export const t = (key: Word) => words[key][locale.value === 'ar' ? 1 : 0]
watch(
  locale,
  (value) => {
    localStorage.setItem('rafik.locale', value)
    document.documentElement.lang = value
    document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr'
  },
  { immediate: true },
)
export const dateLabel = (value: string) => formatDate(value, locale.value)
export function errorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error)
  const teamErrors: Record<string, [string, string]> = {
    retired_workout: [
      'This draft belongs to the retired personal workout system. Export it from Settings for reference; it cannot sync to an institution workout.',
      'تنتمي هذه المسودة إلى نظام التمارين الشخصي المتوقف. يمكنك تصديرها من الإعدادات للرجوع إليها؛ ولا يمكن مزامنتها مع تمرين المؤسسة.',
    ],
    invalid_credentials: [
      'The email or password is incorrect.',
      'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    ],
    password_length: [
      'Use 8–128 characters with an uppercase letter, a lowercase letter, a number and a symbol.',
      'استخدم ٨–١٢٨ حرفاً مع حرف كبير وحرف صغير ورقم ورمز.',
    ],
    setup_already_complete: [
      'Institution setup is already complete. Sign in with an administrator account.',
      'اكتمل إعداد المؤسسة. سجّل الدخول بحساب مسؤول.',
    ],
    account_exists: [
      'An account already uses this email. Sign in to accept the invitation.',
      'يوجد حساب بهذا البريد. سجّل الدخول لقبول الدعوة.',
    ],
    invitation_email_mismatch: [
      'Use the email address the administrator invited.',
      'استخدم عنوان البريد الذي دعاك إليه المسؤول.',
    ],
    password_setup_unavailable: [
      'This password setup link is expired or no longer valid. Ask an administrator for a new one.',
      'انتهت صلاحية رابط إعداد كلمة المرور أو لم يعد صالحاً. اطلب رابطاً جديداً من المسؤول.',
    ],
    account_suspended: [
      'Sign-in access is suspended. Contact platform support.',
      'تم تعليق تسجيل الدخول. تواصل مع دعم المنصة.',
    ],
    conversation_unavailable: [
      'This conversation is unavailable in this institution. Refresh your conversations or contact an institution administrator.',
      'هذه المحادثة غير متاحة في مساحة العمل. حدّث المحادثات أو تواصل مع مسؤول المؤسسة.',
    ],
    notification_unavailable: [
      'This update is no longer available. Return to Notifications for current updates.',
      'لم يعد هذا التحديث متاحاً. ارجع إلى الإشعارات للتحديثات الحالية.',
    ],
    invalid_assessment: [
      'Check the assessment drills, names, units and bounds.',
      'تحقق من الاختبارات وأسمائها ووحداتها وحدودها.',
    ],
    invalid_results: ['Complete every drill with a valid result.', 'أكمل كل اختبار بنتيجة صالحة.'],
    event_unavailable: [
      'This event is no longer available in this role.',
      'لم يعد هذا الموعد متاحاً بهذا الدور.',
    ],
    event_not_started: ['Recording opens when the event starts.', 'يفتح التسجيل عند بدء الموعد.'],
    inactive_participant: [
      'An event participant is no longer active. Update staff or cancel and reschedule with the current roster.',
      'أحد المشاركين غير نشط. حدّث الموظفين أو ألغِ الموعد وأعد جدولته بالقائمة الحالية.',
    ],
    event_has_results: [
      'This event has recorded results. Correct the results instead of cancelling it.',
      'لهذا الموعد نتائج مسجلة. صحّح النتائج بدلاً من إلغائه.',
    ],
    results_required: [
      'Record results for every present athlete before finishing.',
      'سجل نتائج كل رياضي حاضر قبل الإنهاء.',
    ],
    attendance_required: [
      'Record attendance first. Results require the athlete to be marked present.',
      'سجل الحضور أولاً. تتطلب النتائج تحديد الرياضي كحاضر.',
    ],
    template_unavailable: [
      'This assessment template is unavailable. Choose an active template in this institution.',
      'قالب التقييم غير متاح. اختر قالباً نشطاً في المؤسسة.',
    ],
    program_unavailable: [
      'This program is no longer available in this institution. Return to the program library.',
      'لم يعد البرنامج متاحاً في هذه المساحة. عُد إلى مكتبة البرامج.',
    ],
    feedback_unavailable: [
      'Only your completed, eligible sessions can be rated.',
      'يمكنك تقييم جلساتك المكتملة والمؤهلة فقط.',
    ],
    feedback_period_changed: [
      'The feedback month has changed. Reload before submitting.',
      'تغيّر شهر التقييم. أعد التحميل قبل الإرسال.',
    ],
    makeup_unavailable: [
      'This session is not available for a makeup booking.',
      'هذه الجلسة غير متاحة لحجز تعويضي.',
    ],
    trainer_unavailable: [
      'This coach is no longer available. Choose an active institution coach.',
      'هذا المدرب لم يعد متاحاً. اختر مدرباً نشطاً في المؤسسة.',
    ],
    trainee_unavailable: [
      'This athlete is no longer in your assigned scope. Refresh the people list before continuing.',
      'لم يعد هذا الرياضي ضمن مسؤوليتك. حدّث قائمة الأشخاص قبل المتابعة.',
    ],
    invalid_program_cover: [
      'Use a JPG, PNG or WebP image up to 2 MB from this institution.',
      'استخدم صورة JPG أو PNG أو WebP حتى ٢ ميغابايت من هذه المساحة.',
    ],
    invalid_program_details: [
      'Check the program description and experience level.',
      'تحقق من وصف البرنامج ومستوى الخبرة.',
    ],
    invalid_recipients: [
      'Select between 1 and 50 people and review the assignment again.',
      'اختر من ١ إلى ٥٠ شخصاً وراجع التعيين مجدداً.',
    ],
    assignment_unavailable: [
      'This assignment is not active today. Refresh your training institution.',
      'هذا التعيين غير نشط اليوم. حدّث مساحة تدريبك.',
    ],
    not_scheduled_today: [
      'This session is scheduled for another day. Open today’s training or resume a started session.',
      'هذه الحصة مجدولة ليوم آخر. افتح تدريب اليوم أو استأنف حصة بدأت سابقاً.',
    ],
    workspace_unavailable: [
      'Your access to this institution or view is no longer available. Choose another institution or contact an administrator.',
      'لم يعد الوصول إلى هذه المؤسسة أو هذا العرض متاحاً. اختر مساحة أخرى أو تواصل مع المسؤول.',
    ],
    coaching_not_enabled: [
      'Set up your independent coaching institution first.',
      'أعدّ مساحة التدريب المستقل أولاً.',
    ],
    last_admin: [
      'Add another active administrator before removing this administrator or deleting the account.',
      'أضف مسؤولاً نشطاً آخر قبل إزالة هذا المسؤول أو حذف الحساب.',
    ],
    invalid_roles: [
      'Choose at least one institution role.',
      'اختر دوراً واحداً على الأقل داخل المؤسسة.',
    ],
    invalid_trainer: [
      'Choose an active coach from this institution. A person cannot be their own coach.',
      'اختر مدرباً نشطاً من هذه المؤسسة. لا يمكن للشخص أن يكون مدرب نفسه.',
    ],
    duplicate_sport: [
      'A sport or specialty with this name already exists.',
      'توجد رياضة أو تخصص بهذا الاسم مسبقاً.',
    ],
    kind_fixed: [
      'A sport cannot become a specialty after it is created. Archive it and add a new one.',
      'لا يمكن تحويل الرياضة إلى تخصص بعد إنشائها. أرشفها وأضف عنصراً جديداً.',
    ],
    sport_limit: [
      'This institution has reached 200 sports and specialties. Archive or rename existing ones.',
      'بلغت المؤسسة ٢٠٠ رياضة وتخصص. أرشف أو أعد تسمية العناصر الحالية.',
    ],
    invalid_sport: [
      'Choose an active sport this person can take part in. Athletes are linked to sports only.',
      'اختر رياضة نشطة يمكن لهذا الشخص المشاركة فيها. يُربط الرياضيون بالرياضات فقط.',
    ],
    invalid_member: [
      'Choose an active athlete or coach. Administrators are not linked to sports.',
      'اختر رياضياً أو مدرباً نشطاً. لا يُربط المسؤولون بالرياضات.',
    ],
    sport_not_covered: [
      'The coach must cover this sport or specialty, and an athlete must take part in the sport. Update their sports first.',
      'يجب أن يغطي المدرب هذه الرياضة أو التخصص، وأن يشارك الرياضي في الرياضة. حدّث رياضاتهم أولاً.',
    ],
    already_primary: [
      'This coach is already the primary coach for this athlete.',
      'هذا المدرب هو المدرب الأساسي لهذا الرياضي بالفعل.',
    ],
    already_linked: [
      'This coach is already on the athlete’s coaching team. Remove the existing link first.',
      'هذا المدرب ضمن فريق التدريب لهذا الرياضي بالفعل. أزل الربط الحالي أولاً.',
    ],
    invitation_pending: [
      'There is already an active invitation for this email. Revoke it before creating another.',
      'توجد دعوة نشطة لهذا البريد. ألغها قبل إنشاء دعوة أخرى.',
    ],
    already_member: [
      'This person is already an active member. Review their existing membership.',
      'هذا الشخص عضو نشط بالفعل. راجع عضويته الحالية.',
    ],
    practice_exists: [
      'Your independent coaching institution is already available in the institution menu.',
      'مساحة تدريبك المستقل متاحة بالفعل في قائمة مساحات العمل.',
    ],

    invalid_context: [
      'The linked workout, response or file is unavailable. Remove the link or choose another.',
      'الحصة أو الإجابة أو الملف المرتبط غير متاح. أزل الرابط أو اختر غيره.',
    ],
    invalid_alternatives: [
      'Choose up to three approved alternatives.',
      'اختر حتى ثلاثة بدائل معتمدة.',
    ],
    invalid_alternative: [
      'An alternative is unavailable or uses a different recording type. Choose an active exercise of the same type.',
      'أحد البدائل غير متاح أو يستخدم نوع تسجيل مختلفاً. اختر تمريناً نشطاً من النوع نفسه.',
    ],
    invalid_exercise_choice: [
      'Choose an alternative approved in this workout.',
      'اختر بديلاً معتمداً في هذه الحصة.',
    ],
    inconsistent_exercise_choice: [
      'Use one exercise choice for all sets, then retry.',
      'استخدم اختيار تمرين واحداً لكل المجموعات ثم أعد المحاولة.',
    ],
    group_unavailable: [
      'This group was archived. Choose another active group.',
      'أُرشفت هذه المجموعة. اختر مجموعة نشطة أخرى.',
    ],
    transfer_owner_first: [
      'Transfer team ownership or close the team first.',
      'انقل ملكية الفريق أو أغلق الفريق أولاً.',
    ],
    reassign_clients_first: [
      'Finish athlete handoffs or close their team enrollments first.',
      'أكمل نقل الرياضيين أو أغلق انضمامهم للفريق أولاً.',
    ],
    close_enrollments_first: [
      'Close all athlete enrollments before closing the team.',
      'أغلق جميع انضمامات الرياضيين قبل إغلاق الفريق.',
    ],
    commercial_restricted: [
      'New team activity is paused. Review the team subscription; existing coaching remains available.',
      'نشاط الفريق الجديد متوقف. راجع اشتراك الفريق؛ التدريب الحالي ما زال متاحاً.',
    ],
    staff_limit: [
      'The team has reached its staff limit, including pending invitations.',
      'وصل الفريق إلى حد الموظفين، بما في ذلك الدعوات المعلقة.',
    ],
    client_limit: [
      'The team has reached its athlete admission limit.',
      'وصل الفريق إلى حد انضمام الرياضيين.',
    ],
    relationship_already_enrolled: [
      'This coaching relationship already belongs to a team. Close that enrollment first.',
      'هذه العلاقة التدريبية منضمة لفريق بالفعل. أغلق ذلك الانضمام أولاً.',
    ],
    enrollment_unavailable: [
      'This enrollment has changed. Refresh before continuing.',
      'تغير هذا الانضمام. حدّث الصفحة قبل المتابعة.',
    ],
    invalid_coach: [
      'Choose a current team coach other than the athlete or their current coach.',
      'اختر مدرباً حالياً في الفريق غير الرياضي ومدربه الحالي.',
    ],
    simulation_disabled: [
      'Local simulation is disabled on this backend.',
      'المحاكاة المحلية معطلة في هذا الخادم.',
    ],
    previous_workout_unresolved: [
      'Finish or explicitly skip the previous workout in this plan first.',
      'أكمل التمرين السابق في هذه الخطة أو تخطّه صراحةً أولاً.',
    ],
    legacy_workout_unresolved: [
      'Resume the unfinished workout before scheduling another in this plan.',
      'تابع التمرين غير المنجز قبل جدولة تمرين آخر في هذه الخطة.',
    ],
    workout_not_started_yet: [
      'Recording opens at the scheduled start time.',
      'يفتح التسجيل عند موعد البدء المحدد.',
    ],
    workout_not_actionable: [
      'This workout is not ready to start. Open the plan to check its schedule and status.',
      'هذا التمرين غير جاهز للبدء. افتح الخطة لمراجعة الموعد والحالة.',
    ],
    participation_unavailable: [
      'Training is currently restricted. Contact your coach.',
      'المشاركة في التدريب مقيدة حالياً. تواصل مع مدربك.',
    ],
    sequence_conflict: [
      'The plan has progressed. Refresh before continuing.',
      'تقدمت الخطة. حدّث الصفحة قبل المتابعة.',
    ],
    workout_already_recorded_for_date: [
      'This workout is already recorded on that date. Choose another date.',
      'تم تسجيل هذا التمرين في ذلك التاريخ. اختر تاريخاً آخر.',
    ],
    invalid_group_assignment: [
      'Select up to 50 of your active athletes in this group.',
      'اختر حتى ٥٠ من الرياضيين النشطين في هذه المجموعة.',
    ],
  }
  const known = Object.keys(teamErrors).find((key) => raw.includes(key))
  if (known) return language(...teamErrors[known]!)
  if (raw.includes('time_unavailable'))
    return language(
      'That time is no longer available. Refresh and choose another.',
      'لم يعد هذا الوقت متاحاً. حدّث الصفحة واختر وقتاً آخر.',
    )
  if (raw.includes('slot_booked'))
    return language(
      'This time is booked. Cancel or reschedule the appointment first.',
      'هذا الوقت محجوز. ألغِ الموعد أو غيّره أولاً.',
    )
  if (raw.includes('invalid_local_time'))
    return language(
      'This local time does not exist because clocks change. Choose another time.',
      'هذا الوقت المحلي غير موجود بسبب تغيير الساعة. اختر وقتاً آخر.',
    )
  if (raw.includes('invalid_availability'))
    return language(
      'Check the timezone and dates. Offer up to eight future times within one year.',
      'تحقق من التوقيت والتواريخ. أتح حتى ثمانية أوقات مستقبلية خلال سنة.',
    )
  if (raw.includes('appointment_unavailable'))
    return language(
      'This appointment can no longer be changed this way. Refresh its status.',
      'لم يعد تعديل هذا الموعد بهذه الطريقة متاحاً. حدّث حالته.',
    )
  if (raw.includes('upload_incomplete'))
    return language(
      'Upload has not finished. Select the original file to resume.',
      'لم يكتمل الرفع. اختر الملف الأصلي للمتابعة.',
    )
  if (raw.includes('file_cleanup_required'))
    return language(
      'File removal is incomplete. Retry removal before deleting the account.',
      'حذف الملف غير مكتمل. أعد محاولة الحذف قبل حذف الحساب.',
    )
  if (raw.includes('invalid_file'))
    return language(
      'Choose a nonempty PDF, text, JPEG, PNG or WebP file up to 10 MB.',
      'اختر ملف PDF أو نص أو JPEG أو PNG أو WebP غير فارغ بحجم حتى ١٠ ميغابايت.',
    )
  if (raw.includes('file_mismatch'))
    return language(
      'Choose the same original file, or start another upload.',
      'اختر الملف الأصلي نفسه أو ابدأ رفعاً آخر.',
    )
  if (raw.includes('resource_unavailable'))
    return language(
      'This resource is no longer available for this conversation. Check sharing first.',
      'لم يعد هذا المورد متاحاً لهذه المحادثة. تحقق من المشاركة أولاً.',
    )
  if (raw.includes('required_answer'))
    return language(
      'Complete the required questions before submitting.',
      'أكمل الأسئلة المطلوبة قبل الإرسال.',
    )
  if (raw.includes('invalid_window'))
    return language('Choose a date range of one year or less.', 'اختر فترة لا تتجاوز سنة واحدة.')
  if (raw.includes('relationship_archived') || raw.includes('request_unavailable'))
    return language(
      'This coaching relationship or request is no longer active. Your history is still available.',
      'علاقة التدريب أو الطلب لم يعد نشطاً. يبقى سجلك متاحاً.',
    )
  if (raw.includes('already_submitted'))
    return language(
      'The athlete has already submitted this response. Refresh to review it.',
      'أرسل الرياضي هذه الإجابة بالفعل. حدّث الصفحة لمراجعتها.',
    )
  if (raw.includes('wrong_email'))
    return language(
      'This invitation belongs to a different email. Sign in with the address your coach invited.',
      'هذه الدعوة لبريد آخر. سجّل الدخول بالبريد الذي استخدمه مدربك للدعوة.',
    )
  if (raw.includes('conflict'))
    return language(
      'This changed on another device. Your draft is safe here. Reload the latest version before saving.',
      'تم التعديل على جهاز آخر. مسودتك محفوظة هنا. حمّل أحدث نسخة قبل الحفظ.',
    )
  if (raw.includes('plan_changed'))
    return language(
      'Your coach updated this plan. Return to Today to open the latest version.',
      'حدّث مدربك الخطة. عد إلى اليوم لفتح أحدث نسخة.',
    )
  if (raw.includes('assignment_unavailable'))
    return language(
      'This workout is not available today. Return to Today to check the current schedule or contact your coach.',
      'هذا التمرين غير متاح اليوم. عد إلى اليوم للتحقق من الجدول أو تواصل مع مدربك.',
    )
  if (raw.includes('session_started'))
    return language(
      'This workout has already started. Its scheduled occurrence cannot be moved.',
      'بدأ هذا التمرين بالفعل ولا يمكن نقل موعده.',
    )
  if (raw.includes('expired') || raw.includes('invitation_unavailable'))
    return language(
      'This link has expired or was canceled. Ask your coach for a new invitation.',
      'انتهى هذا الرابط أو أُلغي. اطلب دعوة جديدة من مدربك.',
    )
  if (raw.includes('no_completed_sets'))
    return language(
      'Record at least one set before finishing.',
      'سجّل مجموعة واحدة على الأقل قبل الإنهاء.',
    )
  if (raw.includes('Token has expired') || raw.includes('otp') || raw.includes('token is invalid'))
    return language(
      'That code is invalid or expired. Check the latest email or request a new code.',
      'هذا الرمز غير صالح أو منتهٍ. تحقق من أحدث رسالة أو اطلب رمزاً جديداً.',
    )
  if (raw.includes('invalid') || raw.includes('check constraint'))
    return language(
      'Check the values and try again. Use the supported ranges for sets, results and schedule dates.',
      'تحقق من القيم وحاول مجدداً. استخدم النطاقات المسموحة للمجموعات والنتائج والتواريخ.',
    )
  if (raw.includes('rate') || raw.includes('too many'))
    return language(
      'Please wait a moment before trying again.',
      'انتظر قليلاً قبل المحاولة مجدداً.',
    )
  if (raw.includes('forbidden'))
    return language(
      'You do not have permission to open this record or perform this action. Contact your institution administrator if you need access.',
      'ليس لديك إذن لفتح هذا السجل أو تنفيذ هذا الإجراء. تواصل مع مسؤول مؤسستك إذا كنت تحتاج إلى الوصول.',
    )
  if (raw.includes('unauthenticated') || raw.includes('JWT'))
    return language(
      'Please sign in again to continue. Your work on this device is still here.',
      'سجّل الدخول مجدداً للمتابعة. عملك على هذا الجهاز ما زال محفوظاً.',
    )
  return language(
    'We couldn’t complete this. Your edits are still here. Check your connection and try again.',
    'تعذر إكمال الطلب. تعديلاتك ما زالت محفوظة. تحقق من الاتصال وحاول مجدداً.',
  )
}
