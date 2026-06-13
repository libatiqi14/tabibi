export type SpecialtyMeta = {
  labelAr: string
  icon: string
}

export const MEDICAL_SPECIALTIES = [
  'General Medicine',
  'Cardiology',
  'Dentistry',
  'Pediatrics',
  'Dermatology',
  'Ophthalmology',
  'ENT',
  'Neurology',
  'Psychiatry',
  'Orthopedics',
  'Gynecology',
  'Urology',
  'Gastroenterology',
  'Endocrinology',
  'Pulmonology',
  'Radiology',
  'Surgery',
  'Internal Medicine',
  'Nutrition',
  'Physiotherapy',
] as const

export const specialtyMeta: Record<string, SpecialtyMeta> = {
  'general medicine': {
    labelAr: 'الطب العام',
    icon: '🩺',
  },
  cardiology: {
    labelAr: 'أمراض القلب',
    icon: '❤️',
  },
  dentistry: {
    labelAr: 'طب الأسنان',
    icon: '🦷',
  },
  dentists: {
    labelAr: 'طب الأسنان',
    icon: '🦷',
  },
  pediatrics: {
    labelAr: 'طب الأطفال',
    icon: '👶',
  },
  dermatology: {
    labelAr: 'الأمراض الجلدية',
    icon: '🧴',
  },
  ophthalmology: {
    labelAr: 'طب العيون',
    icon: '👁️',
  },
  ent: {
    labelAr: 'الأنف والأذن والحنجرة',
    icon: '👂',
  },
  neurology: {
    labelAr: 'طب الأعصاب',
    icon: '🧠',
  },
  psychiatry: {
    labelAr: 'الطب النفسي',
    icon: '🧘',
  },
  orthopedics: {
    labelAr: 'جراحة العظام',
    icon: '🦴',
  },
  gynecology: {
    labelAr: 'أمراض النساء والتوليد',
    icon: '🤰',
  },
  urology: {
    labelAr: 'المسالك البولية',
    icon: '🚻',
  },
  gastroenterology: {
    labelAr: 'الجهاز الهضمي',
    icon: '🫄',
  },
  endocrinology: {
    labelAr: 'الغدد والسكري',
    icon: '🧬',
  },
  pulmonology: {
    labelAr: 'أمراض الرئة',
    icon: '🫁',
  },
  radiology: {
    labelAr: 'الأشعة',
    icon: '🩻',
  },
  surgery: {
    labelAr: 'الجراحة العامة',
    icon: '🏥',
  },
  'internal medicine': {
    labelAr: 'الطب الباطني',
    icon: '🩺',
  },
  nutrition: {
    labelAr: 'التغذية',
    icon: '🥗',
  },
  physiotherapy: {
    labelAr: 'العلاج الطبيعي',
    icon: '💪',
  },
}

export function getSpecialtyMeta(specialty: string): SpecialtyMeta {
  const normalizedSpecialty = specialty.trim().toLowerCase()

  return (
    specialtyMeta[normalizedSpecialty] ?? {
      labelAr: specialty,
      icon: '🏥',
    }
  )
}
