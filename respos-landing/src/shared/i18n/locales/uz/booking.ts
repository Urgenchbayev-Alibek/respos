import type { Messages } from '../../types';
import type { booking as ru } from '../ru/booking';

export const booking: Messages<typeof ru> = {
  title: 'Stol band qilish',
  lead: 'Sana, vaqt va mehmonlar sonini tanlang — bronni telefon yoki SMS orqali tasdiqlaymiz.',
  notConnected: {
    title: 'Onlayn bron qilish hali ulanmagan',
    text: 'Stol band qilish uchun bizga qo‘ng‘iroq qiling yoki yozing — kontaktlar «Kontaktlar» sahifasida.',
  },
  fields: {
    date: 'Sana',
    guests: 'Mehmonlar',
    time: 'Vaqt',
    name: 'Ismingiz',
    phone: 'Telefon',
    phoneHint: 'Format: +998 90 123-45-67',
    comment: 'Izoh',
    commentPlaceholder: 'Istaklar: deraza yonida, bolalar stuli, sabab',
    optional: 'ixtiyoriy',
    website: 'Sayt (bo‘sh qoldiring)',
  },
  slots: {
    loading: 'Bo‘sh vaqt yuklanmoqda…',
    empty: 'Bu sanada bo‘sh vaqt yo‘q. Boshqa sanani yoki kamroq mehmonni tanlang.',
    duration: 'Stol {{minutes}} daqiqaga band qilinadi.',
    unavailable: 'band',
  },
  submit: 'Band qilish',
  submitting: 'Yuborilmoqda…',
  errors: {
    summary: 'Belgilangan maydonlarni tekshiring.',
    required: 'Ushbu maydonni to‘ldiring.',
    time: 'Vaqtni tanlang.',
    phone: 'Raqamni +998 XX XXX-XX-XX formatida kiriting.',
    nameLength: '2 dan 100 gacha belgi kiriting.',
    tooLong: 'Matn juda uzun (ko‘pi bilan {{max}} belgi).',
    slotTaken: 'Bu vaqt hozirgina band qilindi. Boshqasini tanlang.',
    rateLimited: 'So‘rovlar juda ko‘p. Keyinroq urinib ko‘ring.',
    network: 'Server bilan bog‘lanib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.',
    server: 'Bronni yuborib bo‘lmadi. Keyinroq urinib ko‘ring yoki bizga qo‘ng‘iroq qiling.',
    availability: 'Bo‘sh vaqtni yuklab bo‘lmadi.',
  },
  success: {
    title: 'Bron so‘rovi qabul qilindi',
    text: '{{branch}}, {{date}} soat {{time}}, mehmonlar: {{guests}}. Bron tasdiqlanishini kutmoqda — siz bilan bog‘lanamiz.',
    again: 'Yana band qilish',
  },
};
