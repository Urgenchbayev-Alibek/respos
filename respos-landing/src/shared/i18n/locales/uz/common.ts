import type { common as ruCommon } from '../ru/common';
import type { Messages } from '../../types';

export const common: Messages<typeof ruCommon> = {
  brand: 'RestaurantOS',
  nav: {
    home: 'Bosh sahifa',
    features: 'Imkoniyatlar',
    pricing: 'Tariflar',
    faq: 'Savollar',
    contacts: 'Aloqa',
    demo: 'Demo so‘rash',
    booking: 'Stol band qilish',
    login: 'Kirish',
    openMenu: 'Menyuni ochish',
    closeMenu: 'Menyuni yopish',
    skipToContent: 'Asosiy mazmunga o‘tish',
    primary: 'Asosiy navigatsiya',
    language: 'Sayt tili',
  },
  footer: {
    tagline: 'Restoranni boshqarish tizimi: stollar, buyurtmalar, oshxona, ombor, kassa va hisobotlar.',
    product: 'Mahsulot',
    company: 'Kompaniya',
    legal: 'Hujjatlar',
    privacy: 'Maxfiylik siyosati',
    terms: 'Foydalanuvchi kelishuvi',
    rights: '© {{year}} RestaurantOS. Barcha huquqlar himoyalangan.',
    madeFor: 'O‘zbekiston restoranlari uchun yaratilgan',
  },
  actions: {
    requestDemo: 'Demo so‘rash',
    seeFeatures: 'Imkoniyatlarni ko‘rish',
    allFeatures: 'Barcha imkoniyatlar',
    contactUs: 'Biz bilan bog‘lanish',
    backHome: 'Bosh sahifaga',
  },
  status: {
    demo: 'Demo',
    planned: 'Rejalashtirilgan',
    notConnected: 'Ulanmagan',
  },
  mock: {
    caption: 'Interfeys namunasi, demo maʼlumotlar',
    floor: 'Zal',
    floorArea: 'Asosiy zal',
    free: 'Bo‘sh',
    busy: 'Band',
    reserved: 'Bron',
    kds: 'Oshxona',
    ticketNew: 'Yangi',
    ticketCooking: 'Tayyorlanmoqda',
    ticketReady: 'Tayyor',
    table: 'Stol',
    dashboard: 'Kun sharhi',
    revenue: 'Tushum',
    orders: 'Buyurtmalar',
    avgCheck: 'O‘rtacha chek',
    byHour: 'Soatlar bo‘yicha buyurtmalar',
    dishes: {
      plov: 'Osh',
      achichuk: 'Achchiq-chuchuk',
      tea: 'Choy',
      shashlik: 'Shashlik',
      lagman: 'Lag‘mon',
      manti: 'Manti',
      samsa: 'Somsa',
    },
  },
  meta: {
    home: {
      title: 'RestaurantOS',
      description:
        'O‘zbekiston restoranlari uchun stollar, buyurtmalar, oshxona (KDS), ombor, xaridlar, kassa smenalari va hisobotlar bitta tizimda.',
    },
    features: {
      title: 'Imkoniyatlar',
      description: 'RestaurantOS modullari: zal va bronlar, menyu, buyurtmalar, KDS, ombor va retseptlar, xaridlar, kassa, hisobotlar, rollar.',
    },
    pricing: {
      title: 'Tariflar',
      description: 'Starter, Business va Enterprise tariflari. Narxlar aniqlanmoqda — biz bilan bog‘laning.',
    },
    faq: {
      title: 'Savol va javoblar',
      description: 'To‘lovlar, qurilmalar, maʼlumotlar xavfsizligi va joriy etish haqida halol javoblar.',
    },
    contacts: {
      title: 'Aloqa',
      description: 'RestaurantOS jamoasi bilan qanday bog‘lanish mumkin.',
    },
    demo: {
      title: 'Namoyishga ariza',
      description: 'Ariza qoldiring — RestaurantOS’ni restoraningiz misolida ko‘rsatamiz.',
    },
    booking: {
      title: 'Stol band qilish',
      description: 'Onlayn stol band qilish: sana, vaqt va mehmonlar sonini tanlang.',
    },
    privacy: { title: 'Maxfiylik siyosati', description: 'RestaurantOS maxfiylik siyosati loyihasi.' },
    terms: { title: 'Foydalanuvchi kelishuvi', description: 'RestaurantOS foydalanuvchi kelishuvi loyihasi.' },
    notFound: { title: 'Sahifa topilmadi', description: 'Bunday sahifa mavjud emas.' },
  },
  notFound: {
    title: 'Sahifa topilmadi',
    text: 'Havola eskirgan yoki manzilda xatolik bo‘lishi mumkin.',
  },
};
