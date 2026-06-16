import { useState } from 'react'
import { Link } from 'react-router-dom'
import PlatformStats from '../components/PlatformStats'

const features = [
  {
    icon: '⚡',
    title: 'حجز سريع',
    description: 'اختر التخصص والطبيب واحجز الموعد خلال دقائق.',
  },
  {
    icon: '🔔',
    title: 'إشعارات فورية',
    description: 'استقبل تحديثات حالة الموعد والتنبيهات المهمة فوراً.',
  },
  {
    icon: '👨‍⚕️',
    title: 'أطباء موثوقون',
    description: 'ملفات مهنية وتقييمات تساعدك على اختيار الطبيب المناسب.',
  },
  {
    icon: '📅',
    title: 'إدارة المواعيد',
    description: 'تابع مواعيدك القادمة وسجل زياراتك من مكان واحد.',
  },
  {
    icon: '⭐',
    title: 'تقييمات الأطباء',
    description: 'شارك تجربتك واقرأ آراء المرضى بعد الزيارات المكتملة.',
  },
  {
    icon: '🕒',
    title: 'ساعات عمل دقيقة',
    description: 'اعرض الأوقات المتاحة فقط حسب جدول الطبيب وأيام العطل.',
  },
]

const popularSpecialties = [
  {
    icon: '❤️',
    title: 'أمراض القلب',
    description: 'متابعة القلب، الضغط، والفحوصات الدورية.',
  },
  {
    icon: '🦷',
    title: 'طب الأسنان',
    description: 'حجوزات علاج الأسنان والتنظيف والاستشارات.',
  },
  {
    icon: '👶',
    title: 'طب الأطفال',
    description: 'رعاية الأطفال والمتابعة الصحية المنتظمة.',
  },
  {
    icon: '👁️',
    title: 'طب العيون',
    description: 'فحص النظر ومتابعة صحة العين.',
  },
  {
    icon: '🧴',
    title: 'الأمراض الجلدية',
    description: 'استشارات البشرة والشعر والحساسية الجلدية.',
  },
  {
    icon: '🧠',
    title: 'طب الأعصاب',
    description: 'متابعة الأعصاب والصداع واضطرابات الحركة.',
  },
  {
    icon: '🦴',
    title: 'جراحة العظام',
    description: 'العظام والمفاصل والإصابات الرياضية.',
  },
  {
    icon: '🩺',
    title: 'الطب العام',
    description: 'استشارات عامة ورعاية أولية للأسرة.',
  },
]

const dashboardPreviews = [
  {
    icon: '👤',
    title: 'لوحة المريض',
    description: 'مواعيد قادمة، إشعارات فورية، وأطباء متميزون في واجهة واحدة.',
    rows: ['المواعيد القادمة', 'الإشعارات', 'الأطباء المتميزون'],
    accent: 'from-teal-600 to-emerald-500',
  },
  {
    icon: '👨‍⚕️',
    title: 'لوحة الطبيب',
    description: 'إدارة المواعيد، الإحصائيات، وساعات العمل بدقة.',
    rows: ['مواعيد اليوم', 'إحصائيات سريعة', 'إعدادات الطبيب'],
    accent: 'from-emerald-600 to-teal-500',
  },
  {
    icon: '🛡️',
    title: 'لوحة الإدارة',
    description: 'إشراف شامل على الأطباء، المرضى، والمواعيد.',
    rows: ['إحصائيات المنصة', 'إدارة الأطباء', 'مراجعة التقييمات'],
    accent: 'from-slate-800 to-teal-700',
  },
]

const patientSteps = [
  'اختر التخصص',
  'اختر الطبيب',
  'اختر الوقت المناسب',
  'احصل على إشعار وتابع موعدك',
]

const doctorFeatures = [
  {
    icon: '📋',
    title: 'إدارة المواعيد',
    description: 'أكد، أكمل، أو ألغ المواعيد من لوحة الطبيب بسهولة.',
  },
  {
    icon: '🕒',
    title: 'تحديد ساعات العمل',
    description: 'حدد الأيام والساعات التي يستقبل فيها المرضى الحجوزات.',
  },
  {
    icon: '📅',
    title: 'أيام العطل والإجازات',
    description: 'امنع الحجز في أيام الغياب أو العطل الرسمية للعيادة.',
  },
  {
    icon: '📊',
    title: 'الإحصائيات والتقييمات',
    description: 'تابع أداء العيادة، المواعيد، وتوزيع تقييمات المرضى.',
  },
]

const trustBadges = [
  'مصادقة آمنة عبر Supabase',
  'تنبيهات داخل التطبيق والبريد الإلكتروني',
  'منع الحجز المزدوج',
  'حماية بيانات المستخدمين',
]

function PrimaryLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-13 min-h-13 items-center justify-center rounded-2xl bg-teal-700 px-6 text-sm font-black text-white shadow-lg transition hover:-translate-y-1 hover:bg-teal-800 hover:shadow-xl sm:h-14 sm:px-7 sm:text-base"
    >
      {children}
    </Link>
  )
}

export default function LandingPage() {
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-gradient-to-b from-slate-50 via-white to-teal-50 text-slate-950"
      dir="rtl"
      lang="ar"
    >
      <div className="pointer-events-none fixed -right-20 top-10 hidden h-72 w-72 rounded-full bg-teal-300/15 blur-3xl md:block" />
      <div className="pointer-events-none fixed -bottom-24 -left-20 hidden h-80 w-80 rounded-full bg-emerald-300/15 blur-3xl md:block" />

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-20 px-4 py-5 sm:px-6 lg:px-8">
        <header className="sticky top-4 z-30 rounded-3xl border border-white/80 bg-white/80 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
          <div className="relative flex items-center justify-between gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-3 text-lg font-black text-teal-800"
              onClick={() => setShowMobileMenu(false)}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-xl text-white shadow-md">
                🩺
              </span>
              <span>Tabibi</span>
            </Link>

            <button
              type="button"
              onClick={() => setShowMobileMenu((currentValue) => !currentValue)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-100 bg-white text-2xl font-black text-teal-800 shadow-sm transition hover:bg-teal-50 md:hidden"
              aria-label="فتح القائمة"
              aria-expanded={showMobileMenu}
            >
              ☰
            </button>

            <nav className="hidden gap-3 md:flex md:items-center">
              <Link
                to="/login"
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-teal-200 bg-white px-5 text-sm font-black text-teal-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-teal-50 hover:shadow-md"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-800 hover:shadow-xl"
              >
                إنشاء حساب
              </Link>
            </nav>

            <div
              className={`absolute left-0 top-full mt-3 w-64 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 text-right shadow-xl transition-all duration-200 md:hidden ${
                showMobileMenu
                  ? 'translate-y-0 scale-100 opacity-100'
                  : 'pointer-events-none -translate-y-1 scale-95 opacity-0'
              }`}
            >
              <Link
                to="/login"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                إنشاء حساب
              </Link>
              <a
                href="#about"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                من نحن
              </a>
              <a
                href="#contact"
                onClick={() => setShowMobileMenu(false)}
                className="block rounded-xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-teal-50 hover:text-teal-800"
              >
                تواصل معنا
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-10 pt-4 lg:grid-cols-2 lg:items-center lg:pt-10">
          <div className="text-center lg:text-right">
            <p className="text-sm font-black text-teal-700">منصة المواعيد الطبية</p>
            <h1 className="mt-4 text-4xl font-black leading-tight tracking-normal text-slate-950 sm:text-5xl lg:text-6xl">
              احجز موعدك الطبي بسهولة
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600 lg:mx-0">
              منصة ذكية تربط المرضى بالأطباء وتساعدك على إدارة مواعيدك الطبية في مكان واحد.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <PrimaryLink to="/register">ابدأ الآن</PrimaryLink>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {['مرضى', 'أطباء', 'مواعيد آمنة'].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-lg">
            <span className="absolute -right-2 top-10 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl border border-teal-100 bg-white text-2xl shadow-lg sm:flex">
              🩺
            </span>
            <span className="absolute -left-3 top-24 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-white text-2xl shadow-lg sm:flex">
              ❤️
            </span>
            <span className="absolute -right-4 bottom-24 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-white text-2xl shadow-lg sm:flex">
              📅
            </span>
            <span className="absolute -left-2 bottom-8 z-10 hidden h-14 w-14 items-center justify-center rounded-2xl border border-slate-100 bg-white text-2xl shadow-lg sm:flex">
              🏥
            </span>

            <div className="absolute inset-6 rounded-[2rem] bg-gradient-to-br from-teal-200/40 to-emerald-200/40 blur-3xl" />
            <div className="relative rounded-[2rem] border border-white/90 bg-white/90 p-5 shadow-2xl backdrop-blur sm:p-6">
              <div className="rounded-3xl bg-gradient-to-br from-teal-700 to-emerald-500 p-6 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-teal-50">موعدك القادم</p>
                    <h2 className="mt-2 text-2xl font-black">د. سارة العلوي</h2>
                    <p className="mt-1 text-sm font-semibold text-teal-50">
                      أمراض القلب
                    </p>
                  </div>
                  <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 text-5xl ring-1 ring-white/20">
                    👩‍⚕️
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-xs font-bold text-teal-50">الوقت</p>
                    <p className="mt-1 text-lg font-black">10:30</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 p-4">
                    <p className="text-xs font-bold text-teal-50">الحالة</p>
                    <p className="mt-1 text-lg font-black">مؤكد</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl">
                    🔔
                  </span>
                  <div>
                    <p className="font-black text-slate-950">إشعار فوري</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      تم تأكيد موعدك من طرف الطبيب.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl">
                      ⭐
                    </span>
                    <div>
                      <p className="font-black text-slate-950">تقييم الطبيب</p>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        4.9 من 5
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    موثوق
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <PlatformStats />

        <section id="about">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-teal-700">التخصصات</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              التخصصات الأكثر طلباً
            </h2>
            <p className="mt-4 text-sm font-semibold leading-8 text-slate-600">
              اختر من أشهر التخصصات الطبية واحجز موعدك بسهولة.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {popularSpecialties.map((specialty) => (
              <article
                key={specialty.title}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-teal-100 hover:shadow-lg"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-3xl ring-1 ring-teal-100 transition group-hover:scale-105">
                  {specialty.icon}
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {specialty.title}
                </h3>
                <p className="mt-2 min-h-14 text-sm font-semibold leading-7 text-slate-600">
                  {specialty.description}
                </p>
                <Link
                  to="/register"
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-50 px-4 text-sm font-black text-teal-700 transition hover:bg-teal-700 hover:text-white"
                >
                  استعراض الأطباء
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-teal-700">تجربة المنصة</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              شاهد Tabibi من الداخل
            </h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {dashboardPreviews.map((preview) => (
              <article
                key={preview.title}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className={`bg-gradient-to-br ${preview.accent} p-5 text-white`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white/80">معاينة</p>
                      <h3 className="mt-2 text-xl font-black">{preview.title}</h3>
                    </div>
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 text-3xl">
                      {preview.icon}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <p className="text-sm font-semibold leading-7 text-slate-600">
                    {preview.description}
                  </p>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <div className="mb-4 grid grid-cols-3 gap-2">
                      <span className="h-2 rounded-full bg-teal-200" />
                      <span className="h-2 rounded-full bg-emerald-200" />
                      <span className="h-2 rounded-full bg-slate-200" />
                    </div>
                    <div className="space-y-2">
                      {preview.rows.map((row) => (
                        <div
                          key={row}
                          className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3 py-3 shadow-sm"
                        >
                          <span className="text-sm font-black text-slate-700">{row}</span>
                          <span className="h-2 w-14 rounded-full bg-teal-100" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-teal-700">المميزات</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              كل ما تحتاجه لإدارة مواعيدك الطبية
            </h2>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-2xl ring-1 ring-teal-100">
                  {feature.icon}
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-950">{feature.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-teal-700">خطوات بسيطة</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              كيف يعمل Tabibi؟
            </h2>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-4">
            {patientSteps.map((step, index) => (
              <article
                key={step}
                className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700 text-lg font-black text-white shadow-md">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-base font-black text-slate-950">{step}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-sm font-black text-teal-700">للأطباء</p>
              <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
                حل متكامل للأطباء
              </h2>
              <p className="mt-4 text-sm font-semibold leading-8 text-slate-600">
                لوحة عملية تساعد الطبيب على إدارة الجدول، الملف المهني، الإجازات،
                والإحصائيات اليومية من مكان واحد.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {doctorFeatures.map((feature) => (
                <article
                  key={feature.title}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-1 hover:bg-white hover:shadow-lg"
                >
                  <span className="text-2xl">{feature.icon}</span>
                  <h3 className="mt-3 text-base font-black text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-600">
                    {feature.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-teal-100 bg-teal-50/70 p-6 shadow-sm sm:p-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-black text-teal-700">الثقة والأمان</p>
            <h2 className="mt-3 text-3xl font-black tracking-normal text-slate-950 sm:text-4xl">
              تجربة موثوقة وآمنة للرعاية الطبية
            </h2>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trustBadges.map((badge) => (
              <div
                key={badge}
                className="rounded-2xl border border-white/80 bg-white px-4 py-4 text-sm font-black text-slate-700 shadow-sm"
              >
                ✓ {badge}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] bg-gradient-to-br from-teal-700 to-emerald-500 p-8 text-center text-white shadow-2xl sm:p-10">
          <h2 className="text-3xl font-black tracking-normal sm:text-4xl">
            ابدأ رحلتك الطبية مع Tabibi اليوم
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-8 text-teal-50">
            أنشئ حسابك الآن وابدأ في إدارة مواعيدك أو عيادتك بتجربة سهلة وآمنة.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/register"
              className="inline-flex items-center justify-center rounded-xl bg-white px-6 py-3 font-bold text-teal-700 shadow-md transition hover:bg-teal-50 hover:text-teal-800"
            >
              إنشاء حساب
            </Link>
            <Link
              to="/login"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/40 bg-white/10 px-7 text-base font-black text-white transition hover:-translate-y-1 hover:bg-white/20"
            >
              تسجيل الدخول
            </Link>
          </div>
        </section>

        <footer id="contact" className="border-t border-slate-200 py-8">
          <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-right">
            <div>
              <Link to="/" className="text-xl font-black text-teal-800">
                Tabibi
              </Link>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                مواعيدك الطبية بسهولة وأمان
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/login"
                className="text-sm font-black text-slate-600 transition hover:text-teal-700"
              >
                تسجيل الدخول
              </Link>
              <Link
                to="/register"
                className="text-sm font-black text-slate-600 transition hover:text-teal-700"
              >
                إنشاء حساب
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
