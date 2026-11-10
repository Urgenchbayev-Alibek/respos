import type { Messages } from '../../types';
import type { qrMenu as ru } from '../ru/qrMenu';

export const qrMenu: Messages<typeof ru> = {
  title: 'Menyu',
  metaDescription: 'Restoran menyusi: taomlar, narxlar va rasmlar.',
  loading: 'Menyu yuklanmoqda…',
  search: 'Taomlarni qidirish',
  categories: 'Toifalar',
  table: '{{number}}-stol',
  nothingFound: 'Hech narsa topilmadi',
  empty: 'Menyu hozircha boʻsh',
  fromPrice: '{{price}} dan',
  demo: 'Demo-menyu',
  notFound: {
    title: 'Menyu topilmadi',
    text: 'Havola yoki QR-kodni tekshiring — restoran menyu manzilini oʻzgartirgan boʻlishi mumkin.',
  },
  error: {
    title: 'Menyuni yuklab boʻlmadi',
    text: 'Internetni tekshirib, qaytadan urinib koʻring.',
    retry: 'Qayta urinish',
  },
  call: {
    waiter: 'Ofitsiantni chaqirish',
    bill: 'Hisobni soʻrash',
    sentWaiter: 'Ofitsiant tez orada keladi',
    sentBill: 'Hisob tez orada keltiriladi',
    tooMany: 'Chaqiruvingiz allaqachon yuborildi. Bir daqiqa kuting.',
    tableNotFound: 'Stol topilmadi — xodimlarga xabar bering.',
    failed: 'Chaqiruvni yuborib boʻlmadi. Qaytadan urinib koʻring.',
  },
};
