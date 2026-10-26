// Sample data so the screens look real while the backend is not built yet.
import type { Status } from '@/components/Chips';

export type Txn = {
  id: string;
  item: string;
  sub: string;
  amount: string;
  status: Status;
  group: 'Today' | 'Earlier';
};

export const txns: Txn[] = [
  { id: '1', item: 'Toyota Camry 2015', sub: 'Chidi · 2:14 PM', amount: '8,000.37', status: 'Paid', group: 'Today' },
  { id: '2', item: 'MacBook Air M2', sub: 'Late payment · 1:02 PM', amount: '1,150.42', status: 'Needs attention', group: 'Today' },
  { id: '3', item: 'iPhone 15 Pro 256GB', sub: 'Ada · expires in 24:10', amount: '1,250.18', status: 'Pending', group: 'Today' },
  { id: '4', item: 'Samsung 55" TV', sub: 'Expires in 1:48:02', amount: '412.64', status: 'Pending', group: 'Today' },
  { id: '5', item: 'LG Fridge 420L', sub: 'Tue · expired unpaid', amount: '640.51', status: 'Expired', group: 'Earlier' },
  { id: '6', item: 'Solar panel kit 5kVA', sub: 'Bola · Mon', amount: '2,300.15', status: 'Paid', group: 'Earlier' },
];

export const seller = {
  name: 'Emeka',
  shop: 'Emeka Autos',
  link: 'ceenit.app/emeka-autos',
  freeUsed: 3,
  freeTotal: 5,
  totalReceived: '24,860.42',
  naira: '≈ ₦39.8M · naira is an estimate',
  paid: 18,
  pending: 3,
};

export const categories = ['Cars', 'Gadgets', 'Solar', 'Appliances', 'Furniture', 'Freelancer', 'Other'];

/** Names that cannot be used as a link name. */
export const reservedLinkNames = ['admin', 'pay', 'support', 'ceenit', 'help', 'login', 'api'];
