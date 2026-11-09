import type { faq as ruFaq } from '../ru/faq';
import type { Messages } from '../../types';

export const faq: Messages<typeof ruFaq> = {
  title: 'Savol va javoblar',
  lead: 'Halol javob beramiz — hali tayyor bo‘lmagan narsalar haqida ham.',
  more: 'Javob topmadingizmi?',
  items: [
    {
      q: 'Payme, Click yoki bank terminali orqali to‘lov qabul qilsa bo‘ladimi?',
      a: 'Hozircha yo‘q. Hozir to‘lov tizimda qo‘lda qayd etiladi (naqd, karta, o‘tkazma) — pulning o‘zi odatiy terminalingiz yoki kassangiz orqali o‘tadi. Payme, Click va bank terminallari bilan integratsiya rejalashtirilgan, lekin ulanmagan.',
    },
    {
      q: 'Fiskalizatsiya va onlayn-NKM bormi?',
      a: 'Yo‘q, cheklarni fiskalizatsiya qilish hozircha ulanmagan. O‘zbekiston fiskal yechimlari bilan integratsiya rejalashtirilgan va talablar hamda provayderlar tekshirilgandan so‘ng tanlanadi. Unga qadar joriy kassangizdan foydalaning.',
    },
    {
      q: 'Tizim qaysi qurilmalarda ishlaydi?',
      a: 'RestaurantOS — veb-ilova. U planshet, telefon, noutbuk va kompyuterlardagi zamonaviy brauzerda ishlaydi. Alohida ilova o‘rnatish shart emas.',
    },
    {
      q: 'Boshqa restoranlar mening maʼlumotlarimni ko‘radimi?',
      a: 'Yo‘q. Har bir tashkilotning maʼlumotlari ajratilgan: maʼlumotlarga har qanday so‘rov sizning tashkilotingiz va filialingiz bilan cheklanadi, xodimning kirishi esa uning roli va huquqlari bilan.',
    },
    {
      q: 'Internet uzilib qolsa nima bo‘ladi?',
      a: 'Ishlash uchun internet kerak. Hozircha to‘liq oflayn rejim yo‘q. Aloqa tiklangach, ekranlar serverdan joriy maʼlumotlarni avtomatik yuklaydi.',
    },
    {
      q: 'O‘zbek tili qo‘llab-quvvatlanadimi?',
      a: 'Ha. Interfeys rus va o‘zbek (lotin) tillarida mavjud. Tilni har bir xodim o‘zi tanlaydi.',
    },
    {
      q: 'Bir nechta filialni ulash mumkinmi?',
      a: 'Ha, arxitektura bitta tashkilotda bir nechta filialni qo‘llab-quvvatlaydi. Shartlar tarifga bog‘liq.',
    },
    {
      q: 'Narxi qancha?',
      a: 'Narxlar hozircha aniqlanmoqda. Ariza qoldiring — muassasangiz uchun pilot shartlari haqida aytib beramiz.',
    },
  ],
};
