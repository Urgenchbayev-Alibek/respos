import type { contacts as ruContacts, legal as ruLegal } from '../ru/pages';
import type { Messages } from '../../types';

export const contacts: Messages<typeof ruContacts> = {
  title: 'Aloqa',
  lead: 'Biz bilan bog‘lanishning eng tez yo‘li — ariza qoldirish. Ish vaqtida javob beramiz.',
  formTitle: 'Demo uchun ariza',
  formText: 'Muassasa haqida aytib bering, biz qayta qo‘ng‘iroq qilamiz.',
  channelsTitle: 'Telefon, Telegram va e-mail',
  channelsText: 'To‘g‘ridan-to‘g‘ri kontaktlar tijoriy ishga tushirishdan oldin eʼlon qilinadi.',
  hoursTitle: 'Ish vaqti',
  hoursText: 'Du–Ju, 9:00–18:00 (Toshkent, UTC+5)',
  cityTitle: 'Qayerda ishlaymiz',
  cityText: 'O‘zbekiston, Toshkentdan boshlab',
};

export const legal: Messages<typeof ruLegal> = {
  draftBadge: 'Loyiha — yuridik tekshiruv talab etiladi',
  draftNote:
    'Ushbu hujjat — amaldagi tahrir emas, balki tuzilma-namuna. Matn tijoriy ishga tushirishdan oldin O‘zbekiston Respublikasi qonunchiligini hisobga olgan holda yurist tomonidan tayyorlanadi va tekshiriladi.',
  placeholder: 'Bo‘lim matni yuridik tekshiruvdan so‘ng qo‘shiladi.',
  privacy: {
    title: 'Maxfiylik siyosati',
    sections: [
      'Umumiy qoidalar',
      'Qanday maʼlumotlarni yig‘amiz',
      'Maʼlumotlarni qayta ishlash maqsadlari',
      'Qayta ishlashning huquqiy asoslari',
      'Maʼlumotlarni saqlash va himoya qilish',
      'Maʼlumotlarni uchinchi shaxslarga berish',
      'Shaxsga doir maʼlumotlar subyektining huquqlari',
      'Cookie fayllari',
      'Maʼlumotlar bo‘yicha aloqa',
    ],
  },
  terms: {
    title: 'Foydalanuvchi kelishuvi',
    sections: [
      'Atamalar va taʼriflar',
      'Kelishuv predmeti',
      'Ro‘yxatdan o‘tish va hisob qaydnomalari',
      'Tomonlarning huquq va majburiyatlari',
      'Tariflar va to‘lov tartibi',
      'Javobgarlikni cheklash',
      'Demo va ulanmagan funksiyalar',
      'Kelishuvni o‘zgartirish va bekor qilish',
      'Qo‘llaniladigan huquq va nizolarni hal qilish',
    ],
  },
};
