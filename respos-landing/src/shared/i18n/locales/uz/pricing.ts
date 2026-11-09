import type { pricing as ruPricing } from '../ru/pricing';
import type { Messages } from '../../types';

export const pricing: Messages<typeof ruPricing> = {
  title: 'Tariflar',
  lead:
    'Tariflar hozircha maʼlumot uchun: narx aniqlanmoqda va filiallar hamda xodimlar soniga bog‘liq. Muassasangiz haqida aytib bering — mos variantni tanlaymiz.',
  priceTbd: 'Narxlar aniqlanmoqda',
  note: 'Obunani onlayn to‘lash hozircha ulanmagan. Pilot bosqichida tarif kelishuvdan so‘ng qo‘lda belgilanadi.',
  limitsFromServer: 'Tarif limitlari',
  branches_one: '{{count}} filial',
  branches_few: '{{count}} filial',
  branches_many: '{{count}} filial',
  branches_other: '{{count}} filial',
  users_one: '{{count}} foydalanuvchi',
  users_few: '{{count}} foydalanuvchi',
  users_many: '{{count}} foydalanuvchi',
  users_other: '{{count}} foydalanuvchi',
  plans: {
    starter: {
      name: 'Starter',
      audience: 'Bitta muassasa uchun',
      features: ['Bitta filial', 'Zal, bronlar va buyurtmalar', 'Menyu va oshxona ekrani', 'Asosiy hisobotlar'],
    },
    business: {
      name: 'Business',
      audience: 'O‘sib borayotgan restoran uchun',
      features: [
        'Starter’dagi hamma narsa',
        'Ombor, retseptlar va xaridlar',
        'Kengaytirilgan tahlil',
        'Moslashuvchan rollar va audit jurnali',
      ],
    },
    enterprise: {
      name: 'Enterprise',
      audience: 'Muassasalar tarmog‘i uchun',
      features: [
        'Business’dagi hamma narsa',
        'Bir nechta filial',
        'Integratsiyalar — ulanishiga qarab',
        'Joriy etishda yordam',
      ],
    },
  },
};
