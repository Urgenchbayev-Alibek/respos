import type { demo as ruDemo } from '../ru/demo';
import type { Messages } from '../../types';

export const demo: Messages<typeof ruDemo> = {
  title: 'Namoyishga ariza',
  lead: 'Kontaktlaringizni qoldiring — qulay vaqtni kelishib olish va tizimni ko‘rsatish uchun bog‘lanamiz.',
  nextTitle: 'Keyin nima bo‘ladi',
  next: [
    'Ish vaqtida siz bilan bog‘lanamiz',
    'Muassasa formati va vazifalarni aniqlaymiz',
    'Tizimni onlayn yoki joyida ko‘rsatamiz',
  ],
  fields: {
    name: 'Ismingiz',
    phone: 'Telefon',
    phoneHint: 'Format: +998 90 123-45-67',
    email: 'E-mail',
    restaurantName: 'Muassasa nomi',
    city: 'Shahar',
    cityPlaceholder: 'Masalan, Toshkent',
    message: 'Izoh',
    messagePlaceholder: 'Nechta zal va stol bor, nimani avtomatlashtirmoqchisiz',
    optional: 'ixtiyoriy',
    website: 'Sayt (bo‘sh qoldiring)',
  },
  submit: 'Arizani yuborish',
  submitting: 'Yuborilmoqda…',
  consent: 'Formani yuborish orqali siz <privacy>maxfiylik siyosatiga</privacy> rozilik bildirasiz.',
  errors: {
    summary: 'Belgilangan maydonlarni tekshiring.',
    required: 'Bu maydonni to‘ldiring.',
    nameLength: '2 dan 100 gacha belgi kiriting.',
    phone: 'Raqamni +998 XX XXX-XX-XX formatida kiriting.',
    email: 'To‘g‘ri e-mail kiriting.',
    tooLong: 'Matn juda uzun (ko‘pi bilan {{max}} belgi).',
    rateLimited: 'Bu qurilmadan juda ko‘p ariza yuborildi. Keyinroq — taxminan bir soatdan so‘ng urinib ko‘ring.',
    network: 'Server bilan bog‘lanib bo‘lmadi. Internetni tekshirib, qaytadan urinib ko‘ring.',
    server: 'Arizani yuborib bo‘lmadi. Keyinroq urinib ko‘ring.',
  },
  success: {
    title: 'Ariza yuborildi',
    text: 'Rahmat! Eng yaqin ish vaqtida siz bilan bog‘lanamiz.',
    again: 'Yana bitta ariza yuborish',
  },
};
