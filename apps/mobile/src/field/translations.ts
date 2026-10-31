export type Language = 'en' | 'ar'
// English keys also translate persisted messages from earlier app builds.
const arabic: Record<string, string> = {
  'The server compatibility response is unsupported. Ask your institution to check the app and server versions.':
    'استجابة توافق الخادم غير مدعومة. اطلب من مؤسستك التحقق من إصداري التطبيق والخادم.',
  'Saved event opened from this device. Refresh roster online for the latest data.':
    'فُتح الموعد المحفوظ على هذا الجهاز. حدّث القائمة أثناء الاتصال للحصول على أحدث البيانات.',
  'The server returned invalid institution access. Check the API URL and server version.':
    'أعاد الخادم بيانات صلاحيات مؤسسة غير صالحة. تحقق من عنوان API وإصدار الخادم.',
  'Could not reach your institution. Check your connection and try again.':
    'تعذر الوصول إلى مؤسستك. تحقق من الاتصال وأعد المحاولة.',
  'The email or password is incorrect. Check your institution URL too.':
    'البريد الإلكتروني أو كلمة المرور غير صحيحة. تحقق أيضاً من عنوان المؤسسة.',
  'Too many attempts. Wait a few minutes before trying again.':
    'محاولات كثيرة. انتظر بضع دقائق قبل المحاولة مجدداً.',
  'RAFIK FIELD': 'رفيق الميداني',
  'Opening encrypted field storage': 'جارٍ فتح التخزين الميداني المشفّر',
  'Sign in to your institution': 'سجّل الدخول إلى مؤسستك',
  'Institution API URL': 'عنوان API الخاص بالمؤسسة',
  'Account email': 'البريد الإلكتروني للحساب',
  Password: 'كلمة المرور',
  'Signing in…': 'جارٍ تسجيل الدخول…',
  'Sign in': 'تسجيل الدخول',
  'Signed out. Saved field work is retained for this account.':
    'تم تسجيل الخروج. يُحتفظ بالعمل الميداني المحفوظ لهذا الحساب.',
  'Signed out on this device. Server revocation was not confirmed. Saved work is retained; contact your institution if this device is lost.':
    'تم تسجيل الخروج على هذا الجهاز دون تأكيد إلغاء الجلسة على الخادم. العمل محفوظ؛ تواصل مع مؤسستك إذا فُقد الجهاز.',
  'Use your institution account. Each server keeps its own data and sign-in.':
    'استخدم حساب مؤسستك. لكل خادم بياناته وتسجيل دخوله المستقل.',
  'Saved attendance reappears only for the same account and institution server.':
    'يظهر الحضور المحفوظ مجدداً للحساب وخادم المؤسسة نفسيهما فقط.',
  'This account currently has no institution coach access. Any saved work remains blocked for review.':
    'لا يملك هذا الحساب صلاحية مدرب حالياً. يبقى العمل المحفوظ محظور الإرسال للمراجعة.',
  'Signing out…': 'جارٍ تسجيل الخروج…',
  'Sign out': 'تسجيل الخروج',
  'Saved institution': 'مساحة عمل محفوظة',
  'Checking coach access': 'جارٍ التحقق من صلاحية المدرب',
  'No coach institution': 'لا توجد مساحة عمل للمدرب',
  'Refresh access': 'تحديث الصلاحيات',
  'Event completed and confirmed by your institution. The device copy was removed.':
    'اكتمل الموعد وأكدته مؤسستك. أُزيلت نسخة الجهاز.',
  'Saved field changes confirmed by your institution.': 'أكدت مؤسستك التغييرات الميدانية المحفوظة.',
  'Schedule refreshed. Open an event online to save its attendance roster.':
    'تم تحديث الجدول. افتح موعداً أثناء الاتصال لحفظ قائمة حضوره.',
  'Saved changes are shown below. Confirm or resolve them before downloading a newer roster.':
    'تظهر التغييرات المحفوظة أدناه. أكدها أو عالجها قبل تنزيل قائمة أحدث.',
  'Event package saved for field capture on this device.':
    'حُفظت بيانات الموعد للتسجيل الميداني على هذا الجهاز.',
  'This event is read-only. Its offline roster has been removed.':
    'هذا الموعد للقراءة فقط. أُزيلت قائمته المحفوظة دون اتصال.',
  'Saving attendance on this device…': 'جارٍ حفظ الحضور على هذا الجهاز…',
  'Attendance saved on this device. Awaiting institution confirmation.':
    'حُفظ الحضور على هذا الجهاز بانتظار تأكيد المؤسسة.',
  'Completion saved on device; waiting for institution confirmation.':
    'حُفظ طلب الإنهاء على الجهاز بانتظار تأكيد المؤسسة.',
  'Scores saved on device; waiting for institution confirmation.':
    'حُفظت النتائج على الجهاز بانتظار تأكيد المؤسسة.',
  'Complete this event?': 'إنهاء هذا الموعد؟',
  'All attendance and assessment results must already be confirmed. Completing clears the saved event package from this device.':
    'يجب تأكيد كل الحضور ونتائج التقييم أولاً. يزيل الإنهاء بيانات الموعد المحفوظة من هذا الجهاز.',
  'Keep event open': 'إبقاء الموعد مفتوحاً',
  'Complete event': 'إنهاء الموعد',
  'Remove saved event from this device?': 'إزالة الموعد المحفوظ من هذا الجهاز؟',
  'This permanently discards its pending changes and offline roster on this device. An unconfirmed change may already exist on the server. Server records are not undone.':
    'يحذف ذلك التغييرات المعلقة والقائمة المحفوظة على الجهاز نهائياً. قد يكون التغيير غير المؤكد موجوداً على الخادم بالفعل. لا تتراجع سجلات الخادم.',
  'Keep saved work': 'الاحتفاظ بالعمل المحفوظ',
  'Discard device copy': 'حذف نسخة الجهاز',
  'Device copy removed. Open the event online to review current server records.':
    'أُزيلت نسخة الجهاز. افتح الموعد أثناء الاتصال لمراجعة سجلات الخادم الحالية.',
  'Event attendance': 'حضور الموعد',
  'Coach schedule': 'جدول المدرب',
  'Saved attendance needs review': 'الحضور المحفوظ يحتاج للمراجعة',
  'Sending is paused at': 'الإرسال متوقف عند',
  'an earlier event': 'موعد سابق',
  '. Resolve it before sending more changes.': '. عالجه قبل إرسال تغييرات أخرى.',
  'Review saved change': 'مراجعة التغيير المحفوظ',
  'Upcoming 14 days ·': 'الأيام الأربعة عشر القادمة ·',
  '. Saved events remain available outside this window.':
    '. تبقى المواعيد المحفوظة متاحة خارج هذه الفترة.',
  'Refreshing…': 'جارٍ التحديث…',
  'Refresh schedule and sync': 'تحديث الجدول والمزامنة',
  'Completed · View confirmed summary online': 'مكتمل · عرض الملخص المؤكد أثناء الاتصال',
  'Cancelled · View details online': 'ملغى · عرض التفاصيل أثناء الاتصال',
  'Saved on this device · Open roster': 'محفوظ على هذا الجهاز · فتح القائمة',
  'Open online to save roster': 'افتح أثناء الاتصال لحفظ القائمة',
  'Load more events': 'تحميل مواعيد إضافية',
  'No field events to show': 'لا توجد مواعيد ميدانية للعرض',
  'Ask your institution to assign you as event staff. Open the event online before heading offline.':
    'اطلب من مؤسستك تعيينك ضمن موظفي الموعد. افتحه أثناء الاتصال قبل العمل دون اتصال.',
  'Back to schedule': 'العودة إلى الجدول',
  'Event completed': 'اكتمل الموعد',
  'Confirmed by your institution. Attendance and results below are read-only. The offline event package has been removed. Open correction history below while online.':
    'أكدته مؤسستك. الحضور والنتائج أدناه للقراءة فقط. أُزيلت بيانات الموعد المحفوظة دون اتصال. راجع سجل التصحيحات أدناه أثناء الاتصال.',
  'Field entry opens at the scheduled start': 'يُفتح التسجيل الميداني عند بداية الموعد',
  'Attendance, scores and completion unlock': 'يتاح الحضور والنتائج والإنهاء في',
  'device time': 'توقيت الجهاز',
  '). You can download and review the roster now. If the time is wrong, ask staff to reschedule the event in the web app, then refresh its roster online.':
    '). يمكنك تنزيل القائمة ومراجعتها الآن. إذا كان التوقيت خاطئاً، اطلب إعادة الجدولة عبر الويب ثم حدّث القائمة أثناء الاتصال.',
  'Roster downloaded': 'نُزّلت القائمة في',
  '. Permission is checked again when sending.': '. يُتحقق من الصلاحية مجدداً عند الإرسال.',
  'Access blocked. Saved work is retained for explicit review or discard; attendance entry is locked.':
    'الوصول محظور. يبقى العمل محفوظاً للمراجعة أو الحذف الصريح؛ تسجيل الحضور مقفل.',
  'Sending is paused. Review the saved changes against current server records below. Keep or export what you need before explicitly discarding this device copy and reopening online.':
    'الإرسال متوقف. راجع حالة الرياضي وقارن العمل المحفوظ بسجلات الخادم أدناه. يمكنك تصدير العمل قبل حذف نسخة الجهاز وتنزيل قائمة حديثة.',
  'Sync saved field work': 'مزامنة العمل الميداني المحفوظ',
  'Refresh roster': 'تحديث القائمة',
  'This older attendance package has no assessment definition. Resolve saved attendance, then refresh online to enter scores.':
    'لا تتضمن هذه الحزمة القديمة تعريف التقييم. عالج الحضور المحفوظ ثم حدّث أثناء الاتصال لإدخال النتائج.',
  'Find athlete in this event': 'البحث عن رياضي في هذا الموعد',
  'athletes in event ·': 'رياضيين في الموعد ·',
  shown: 'معروض',
  'Attendance:': 'الحضور:',
  'Downloaded server attendance': 'الحضور المنزّل من الخادم',
  'Inactive athlete — entry unavailable': 'رياضي غير نشط — التسجيل غير متاح',
  'Confirmed assessment · revision': 'تقييم مؤكد · النسخة',
  'Not recorded': 'غير مسجل',
  'Assessor note:': 'ملاحظة المقيم:',
  'Scores:': 'النتائج:',
  'Score draft saved on device': 'مسودة النتائج محفوظة على الجهاز',
  'Scores editor open': 'محرر النتائج مفتوح',
  'Review saved scores': 'مراجعة النتائج المحفوظة',
  'Review / correct scores': 'مراجعة النتائج أو تصحيحها',
  'Record assessment scores': 'تسجيل نتائج التقييم',
  'No athletes match this name.': 'لا يوجد رياضيون بهذا الاسم.',
  'This event has no athletes.': 'لا يوجد رياضيون في هذا الموعد.',
  'saved change(s) awaiting confirmation.': 'تغييرات محفوظة بانتظار التأكيد.',
  'Submit or discard': 'أرسل أو احذف',
  'score draft(s) before completing.': 'مسودات نتائج قبل الإنهاء.',
  'Completion waiting for confirmation': 'الإنهاء بانتظار التأكيد',
  'Remove device copy / discard pending work': 'إزالة نسخة الجهاز وحذف العمل المعلق',
  'Opening event roster': 'جارٍ فتح قائمة الموعد',
  'No offline roster exists. Connect to your institution and reopen this event.':
    'لا توجد قائمة محفوظة دون اتصال. اتصل بمؤسستك وافتح الموعد مجدداً.',
  'Only this account’s explicitly opened rosters are stored on this device. Sync runs while the app is active.':
    'تُحفظ قوائم هذا الحساب المفتوحة صراحة فقط على الجهاز. تعمل المزامنة أثناء نشاط التطبيق.',
  'Draft restored from this device.': 'استُعيدت المسودة من هذا الجهاز.',
  'Saving score draft on this device…': 'جارٍ حفظ مسودة النتائج على الجهاز…',
  'Score draft saved on this device. Not yet submitted.':
    'حُفظت مسودة النتائج على الجهاز ولم تُرسل بعد.',
  'Draft was not saved. Retry device save or explicitly discard it before leaving.':
    'لم تُحفظ المسودة. أعد حفظها على الجهاز أو احذفها صراحة قبل المغادرة.',
  'Scores were not queued. Keep the draft and retry after resolving the error above.':
    'لم تُضف النتائج إلى الطابور. احتفظ بالمسودة وأعد المحاولة بعد معالجة الخطأ.',
  '· Assessment scores': '· نتائج التقييم',
  'Assessor-led performance measurements. These are not clinical findings.':
    'قياسات أداء بإشراف المقيم، وليست نتائج سريرية.',
  'Allowed:': 'المسموح:',
  'no minimum': 'دون حد أدنى',
  'no maximum': 'دون حد أقصى',
  to: 'إلى',
  'Assessor note (optional)': 'ملاحظة المقيم (اختياري)',
  'Assessor note': 'ملاحظة المقيم',
  'Saving scores…': 'جارٍ حفظ النتائج…',
  'Save score correction': 'حفظ تصحيح النتائج',
  'Save scores': 'حفظ النتائج',
  'Close editor': 'إغلاق المحرر',
  'Discard draft': 'حذف المسودة',
  'Retry device save': 'إعادة الحفظ على الجهاز',
  'Someone changed this record. Review the server event before correcting it.':
    'عدّل شخص آخر هذا السجل. راجع موعد الخادم قبل تصحيحه.',
  'The server rejected this operation ID. Review before making a new change.':
    'رفض الخادم معرّف العملية. راجع السجل قبل إنشاء تغيير جديد.',
  'Your current account no longer has permission for this event.':
    'لم يعد حسابك الحالي مخولاً لهذا الموعد.',
  'This event is no longer available to your account.': 'لم يعد هذا الموعد متاحاً لحسابك.',
  'Your institution access is no longer available.': 'لم يعد وصولك إلى المؤسسة متاحاً.',
  'Sign in again to the same account and institution to send saved work.':
    'سجّل الدخول مجدداً إلى الحساب والمؤسسة نفسيهما لإرسال العمل المحفوظ.',
  'The event has not started or was cancelled. Review the server event.':
    'لم يبدأ الموعد أو أُلغي. راجع موعد الخادم.',
  'Complete or explicitly skip participant workouts in the web app before finishing this group event.':
    'أكمل تمارين المشاركين أو تخطّها صراحة في تطبيق الويب قبل إنهاء هذا الموعد الجماعي.',
  'Assessment results are required. Complete this correction in the web app.':
    'نتائج التقييم مطلوبة. أكمل التصحيح في تطبيق الويب.',
  'Confirm attendance before saving scores or completing this event.':
    'أكد الحضور قبل حفظ النتائج أو إنهاء الموعد.',
  'Check every assessment value and its limits before correcting this record.':
    'تحقق من كل قيمة وحدودها قبل تصحيح السجل.',
  'The request could not be completed.': 'تعذر إكمال الطلب.',
  'Assessor notes must be at most 2000 characters.': 'يجب ألا تتجاوز ملاحظات المقيم ٢٠٠٠ حرف.',
  'Download the assessment definition and results online.':
    'نزّل تعريف التقييم ونتائجه أثناء الاتصال.',
  'Saved on device — waiting to send': 'محفوظ على الجهاز — بانتظار الإرسال',
  'Sending to institution…': 'جارٍ الإرسال إلى المؤسسة…',
  'Saved on device — server confirmation unknown': 'محفوظ على الجهاز — تأكيد الخادم غير معروف',
  'Confirmed by institution': 'أكدته المؤسسة',
  'Needs your review — sending paused': 'يحتاج مراجعتك — الإرسال متوقف',
  'Access blocked — saved work retained': 'الوصول محظور — العمل المحفوظ باقٍ',
  'Confirmation unknown. Retry sends this exact change; do not re-enter it.':
    'التأكيد غير معروف. تعيد المحاولة إرسال التغيير نفسه؛ لا تدخله مجدداً.',
  'Resolve saved changes before replacing this offline roster.':
    'عالج التغييرات المحفوظة قبل استبدال القائمة دون اتصال.',
  'Save or discard score drafts before downloading a newer event.':
    'أرسل مسودات النتائج أو احذفها قبل تنزيل موعد أحدث.',
  'Open an authorized event online before recording field work.':
    'افتح موعداً مصرحاً به أثناء الاتصال قبل التسجيل الميداني.',
  'Field capture is available after a scheduled event starts.':
    'يتاح التسجيل الميداني بعد بداية موعد مجدول.',
  'Resolve the earlier saved change before editing this event.':
    'عالج التغيير المحفوظ السابق قبل تعديل الموعد.',
  'Confirm every saved attendance and score before completing this event.':
    'أكد كل الحضور والنتائج المحفوظة قبل إنهاء الموعد.',
  'Save or discard score drafts before completing this event.':
    'أرسل مسودات النتائج أو احذفها قبل إنهاء الموعد.',
  'Event revision changed. Refresh before completing it.': 'تغيرت نسخة الموعد. حدّثه قبل الإنهاء.',
  'This athlete is unavailable for field capture.': 'التسجيل الميداني غير متاح لهذا الرياضي.',
  'Resolve this athlete’s previous change before editing attendance.':
    'عالج تغيير الرياضي السابق قبل تعديل الحضور.',
  'Attendance changed. Reopen the athlete before saving.':
    'تغير الحضور. افتح الرياضي مجدداً قبل الحفظ.',
  'Download the assessment definition online before entering scores.':
    'نزّل تعريف التقييم أثناء الاتصال قبل إدخال النتائج.',
  'Confirm this athlete’s earlier score or attendance before recording another result.':
    'أكد نتيجة الرياضي أو حضوره السابق قبل تسجيل نتيجة أخرى.',
  'Mark this athlete present before recording scores.': 'سجّل حضور الرياضي قبل تسجيل النتائج.',
  'Assessment scores changed. Reopen the athlete before correcting them.':
    'تغيرت نتائج التقييم. افتح الرياضي مجدداً قبل التصحيح.',
  'Saved change belongs to another account or institution.':
    'التغيير المحفوظ يخص حساباً أو مؤسسة أخرى.',
  'The saved event is unavailable; attendance acknowledgment is retained for retry.':
    'الموعد المحفوظ غير متاح؛ يبقى تأكيد الحضور لإعادة المحاولة.',
  'Unexpected attendance acknowledgment. The original change is retained for retry.':
    'تأكيد حضور غير متوقع. يبقى التغيير الأصلي لإعادة المحاولة.',
  'Unexpected assessment acknowledgment. The original result is retained for retry.':
    'تأكيد تقييم غير متوقع. تبقى النتيجة الأصلية لإعادة المحاولة.',
  'Unexpected completion acknowledgment. Retry the original finish operation.':
    'تأكيد إنهاء غير متوقع. أعد محاولة عملية الإنهاء الأصلية.',
  'Wait for the current request to settle before removing saved work.':
    'انتظر انتهاء الطلب الحالي قبل إزالة العمل المحفوظ.',
  'This event is unavailable for score drafts.': 'مسودات النتائج غير متاحة لهذا الموعد.',
  'Open this athlete’s assessment package before saving a score draft.':
    'افتح بيانات تقييم الرياضي قبل حفظ مسودة نتائج.',
  'Resolve this athlete’s saved result or event completion before editing a draft.':
    'عالج نتيجة الرياضي المحفوظة أو إنهاء الموعد قبل تعديل مسودة.',
  'Enter your institution HTTPS API URL without credentials, a query or a fragment.':
    'أدخل عنوان HTTPS لواجهة مؤسستك دون بيانات دخول أو استعلام أو جزء إضافي.',
  'Remote institutions require HTTPS. Local HTTP is limited to localhost or the Android emulator.':
    'تتطلب المؤسسات البعيدة HTTPS. يُسمح بـHTTP محلياً للجهاز المحلي أو محاكي Android فقط.',
  'The encrypted cache key needs recovery. No records were removed.':
    'يحتاج مفتاح التخزين المشفّر للاسترداد. لم تُحذف سجلات.',
  'Encrypted storage is unavailable. Install the native SQLCipher build; Expo Go is unsupported.':
    'التخزين المشفّر غير متاح. ثبّت النسخة الأصلية الداعمة لـSQLCipher؛ لا يُدعم Expo Go.',
  'The server returned an invalid response.': 'أعاد الخادم استجابة غير صالحة.',
  'The server session is invalid. Sign in again.': 'جلسة الخادم غير صالحة. سجّل الدخول مجدداً.',
  'Saved institution access needs a fresh sign-in.':
    'يتطلب وصول المؤسسة المحفوظ تسجيل دخول جديداً.',
  'This sign-in session is closed.': 'جلسة تسجيل الدخول مغلقة.',
  'The refreshed session changed identity.': 'تغيرت هوية الجلسة المحدّثة.',
  'Previously opened events remain below.': 'تبقى المواعيد المفتوحة سابقاً أدناه.',
  'Previously opened events remain available for this account.':
    'تبقى المواعيد المفتوحة سابقاً متاحة لهذا الحساب.',
  training: 'تدريب',
  assessment: 'تقييم',
  scheduled: 'مجدول',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  present: 'حاضر',
  absent: 'غائب',
  excused: 'معذور',
  unmarked: 'غير محدد',
  Present: 'حاضر',
  Absent: 'غائب',
  Excused: 'معذور',
}

export function translate(language: Language, text: string): string {
  if (language === 'en' || !text) return text
  if (arabic[text]) return arabic[text]
  for (const suffix of [
    ' Previously opened events remain below.',
    ' Previously opened events remain available for this account.',
  ]) {
    if (text.endsWith(suffix))
      return (
        translate(language, text.slice(0, -suffix.length)) +
        ' ' +
        translate(language, suffix.trim())
      )
  }
  for (const key of [
    'Saved on device — waiting to send',
    'Sending to institution…',
    'Saved on device — server confirmation unknown',
    'Confirmed by institution',
    'Needs your review — sending paused',
    'Access blocked — saved work retained',
  ]) {
    if (text.startsWith(key + '. '))
      return arabic[key] + '. ' + translate(language, text.slice(key.length + 2))
  }
  let match = /^Confirm attendance for (\d+) athletes?\.$/.exec(text)
  if (match) return `أكد الحضور لعدد ${match[1]} من الرياضيين.`
  match = /^Confirm scores for (\d+) present athletes?\.$/.exec(text)
  if (match) return `أكد النتائج لعدد ${match[1]} من الرياضيين الحاضرين.`
  match = /^Score draft for (.+) discarded from this device\.$/.exec(text)
  if (match) return `حُذفت مسودة نتائج ${match[1]} من هذا الجهاز.`
  match = /^Score draft for (.+) saved on this device\. Submit it to confirm the result\.$/.exec(
    text,
  )
  if (match) return `حُفظت مسودة نتائج ${match[1]} على الجهاز. أرسلها لتأكيد النتيجة.`
  match = /^Enter (.+)\.$/.exec(text)
  if (match) return `أدخل ${match[1]}.`
  match = /^(.+) must be at most 1000 characters\.$/.exec(text)
  if (match) return `يجب ألا يتجاوز ${match[1]} ألف حرف.`
  match = /^Check (.+) and its allowed limits\.$/.exec(text)
  if (match) return `تحقق من ${match[1]} وحدوده المسموحة.`
  match = /^The server rejected this request \((.+)\)\.$/.exec(text)
  if (match) return `رفض الخادم الطلب (${match[1]}).`
  if (
    [
      'Network request failed',
      'Failed to fetch',
      'The operation was aborted.',
      'The operation was aborted',
    ].includes(text)
  )
    return 'تعذر الاتصال بالمؤسسة. يبقى عملك محفوظاً على الجهاز؛ أعد المحاولة عند الاتصال.'

  if (text.startsWith('Invalid ')) return 'بيانات غير صالحة. حدّث الموعد من مؤسستك وأعد المحاولة.'
  return text
}
