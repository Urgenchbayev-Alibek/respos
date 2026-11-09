import type { features as ruFeatures } from '../ru/features';
import type { Messages } from '../../types';

export const features: Messages<typeof ruFeatures> = {
  title: 'RestaurantOS imkoniyatlari',
  lead:
    'Restoranning kundalik ishi uchun o‘nta bog‘langan modul — stolni bron qilishdan smena hisobotigacha. Bosqichma-bosqich joriy etish mumkin.',
  plannedNote: '«Rejalashtirilgan» deb belgilangan funksiyalar hozircha ulanmagan va provayderlar tanlangandan keyin paydo bo‘ladi.',
  modules: {
    tables: {
      title: 'Stollar va bronlar',
      short: 'Zal sxemasi, stol holatlari, mehmon bronlari.',
      points: [
        'Hududlar va stollarning joriy holati bilan zal sxemasi',
        'Vaqt bo‘yicha to‘qnashuvlarni tekshiradigan bronlar',
        'Bronni tasdiqlash, o‘tqazish, kelmaslik va bekor qilish',
      ],
      badge: '',
    },
    menu: {
      title: 'Menyu',
      short: 'Kategoriyalar, taomlar, variantlar va modifikatorlar.',
      points: [
        'Kategoriyalar, taomlar, rasmlar va tayyorlash vaqti',
        'Porsiya variantlari va modifikator guruhlari',
        'Taomni sotuvdan tez olib qo‘yish («stop-list»)',
      ],
      badge: '',
    },
    orders: {
      title: 'Buyurtmalar',
      short: 'Stoldan, olib ketish va yetkazib berish uchun buyurtma.',
      points: [
        'Planshetdan bir necha bosishda buyurtma yaratish',
        'Pozitsiyalarga izohlar va modifikatorlar',
        'Aniq holatlar: yaratilgandan to‘lovgacha',
      ],
      badge: '',
    },
    kds: {
      title: 'Oshxona ekrani (KDS)',
      short: 'Oshxonada buyurtmalar real vaqtda.',
      points: [
        'Yangi pozitsiyalar oshxona ekranida darhol paydo bo‘ladi',
        'Stansiyalar bo‘yicha taqsimlash: issiq sex, gril, bar',
        'Ofitsiant taom tortishga tayyorligini ko‘radi',
      ],
      badge: '',
    },
    inventory: {
      title: 'Ombor va retseptlar',
      short: 'Qoldiqlar, texnologik kartalar va avtomatik hisobdan chiqarish.',
      points: [
        'Ingredientlar, o‘lchov birliklari va qoldiqlar',
        'Taomlar retseptlari (texnologik kartalar)',
        'Retsept bo‘yicha hisobdan chiqarish va ombor harakatlari jurnali',
      ],
      badge: '',
    },
    procurement: {
      title: 'Xaridlar',
      short: 'Yetkazib beruvchilar, buyurtmalar, qabul qilish.',
      points: [
        'Yetkazib beruvchilar ma’lumotnomasi',
        'Yetkazib beruvchilarga buyurtmalar va tovarni qabul qilish',
        'Kirim omborni avtomatik to‘ldiradi',
      ],
      badge: '',
    },
    payments: {
      title: 'To‘lovlar va kassa smenalari',
      short: 'To‘lovlarni qayd etish, smenani ochish va yopish.',
      points: [
        'To‘lovni qo‘lda qayd etish: naqd, karta, o‘tkazma',
        'Kassa smenasini yakunlar bilan ochish va yopish',
        'Payme, Click integratsiyalari va fiskalizatsiya — rejada',
      ],
      badge: 'planned',
    },
    reports: {
      title: 'Hisobotlar va dashboard',
      short: 'Tushum, o‘rtacha chek, mashhur taomlar.',
      points: [
        'Davr bo‘yicha tushum va buyurtmalar soni',
        'Mashhur taomlar va soatlar bo‘yicha yuklama',
        'Smenalar va ombor bo‘yicha hisobotlar',
      ],
      badge: '',
    },
    roles: {
      title: 'Rollar va audit',
      short: 'Kirish huquqlari va muhim amallar jurnali.',
      points: [
        'Tayyor rollar: egasi, menejer, ofitsiant, oshpaz, kassir, omborchi',
        'Kirish huquqlarini moslashuvchan sozlash',
        'Muhim amallar jurnali: bekor qilish, qaytarish, narxlarni o‘zgartirish',
      ],
      badge: '',
    },
    saas: {
      title: 'Bir nechta filial',
      short: 'Bitta akkauntda muassasalar tarmog‘i.',
      points: [
        'Bir nechta filialli tashkilot',
        'Umumiy menyu va filialning alohida sozlamalari',
        'Tashkilotlar o‘rtasida maʼlumotlarning qatʼiy ajratilishi',
      ],
      badge: '',
    },
  },
};
