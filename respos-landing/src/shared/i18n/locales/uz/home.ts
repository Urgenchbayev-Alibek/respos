import type { home as ruHome } from '../ru/home';
import type { Messages } from '../../types';

export const home: Messages<typeof ruHome> = {
  hero: {
    eyebrow: 'O‘zbekistondagi restoranlar, kafelar va choyxonalar uchun',
    title: 'Butun restoran — bitta tushunarli tizimda',
    lead:
      'Zal, buyurtmalar, oshxona, ombor, kassa va hisobotlar birgalikda ishlaydi. Ofitsiant buyurtmani planshetda qabul qiladi, oshxona uni darhol ko‘radi, egasi esa kunlik raqamlarni qo‘lda jadvalsiz ko‘radi.',
    points: [
      'Brauzerda ishlaydi: planshet, telefon, noutbuk',
      'Interfeys rus va o‘zbek tillarida',
      'Har bir restoranning maʼlumotlari alohida saqlanadi',
    ],
  },
  roles: {
    title: 'Jamoadagi har kimga — o‘z ish ekrani',
    lead: 'Rollar va huquqlar sozlanadi: xodim faqat o‘z ishi uchun keraklisini ko‘radi.',
    items: {
      owner: {
        title: 'Egasiga',
        text: 'Tushum, o‘rtacha chek, mashhur taomlar va qoldiqlar — har bir filial bo‘yicha, menejerga qo‘ng‘iroqsiz.',
      },
      manager: {
        title: 'Menejerga',
        text: 'Menyu, stollar, xodimlar, xaridlar va kassa smenalari — bitta panelda nazorat ostida.',
      },
      waiter: {
        title: 'Ofitsiantga',
        text: 'Zal sxemasi, bir necha bosishda buyurtma va taom tayyor bo‘lganda bildirishnoma.',
      },
      kitchen: {
        title: 'Oshxonaga',
        text: 'Buyurtmalar navbati, taymerlar va stansiyalar bo‘yicha holatlar bilan oshxona ekrani (KDS).',
      },
    },
  },
  modules: {
    title: 'RestaurantOS nimalar qila oladi',
    lead: 'Modullar o‘zaro bog‘langan: buyurtma oshxonaga boradi, ingredientlarni hisobdan chiqaradi va hisobotga tushadi.',
  },
  steps: {
    title: 'Qanday boshlash kerak',
    items: [
      {
        title: 'Ariza qoldiring',
        text: 'Restoran haqida aytib bering: nechta zal, stol va xodim bor.',
      },
      {
        title: 'Ko‘rsatamiz va sozlaymiz',
        text: 'Namoyish o‘tkazamiz, birgalikda menyu, zal va xodimlar rollarini kiritamiz.',
      },
      {
        title: 'Ishlang',
        text: 'Jamoa planshet va telefonlardan ishlaydi, siz esa hisobotlarni real vaqtda ko‘rasiz.',
      },
    ],
  },
  cta: {
    title: 'Restoraningiz misolida ko‘ramizmi?',
    text: 'Namoyish taxminan 30 daqiqa davom etadi. Asosiy ssenariylarni ko‘rsatamiz va savollarga javob beramiz.',
  },
  showcase: {
    title: 'Zal, oshxona va raqamlar — bitta ekranda',
    floor: 'Zal sxemasi bo‘sh, band va bron qilingan stollarni ko‘rsatadi.',
    kds: 'Oshxona buyurtmalarni darhol oladi va tayyorligini belgilaydi.',
    dashboard: 'Egasi tushum va soatlar bo‘yicha yuklamani ko‘radi.',
  },
};
