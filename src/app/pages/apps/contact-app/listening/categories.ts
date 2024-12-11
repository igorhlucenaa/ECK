export interface Category {
  id: number;
  name: string;
  icon: string;
  count: number;
  color?: string;
  active: boolean;
  frequentlycontacted?: boolean;
  starred?: boolean;
}

export const filter = [
  {
    id: 1,
    name: 'All',
    icon: 'mail',
    count: 0,
    active: true,
  },
  {
    id: 2,
    name: 'Frequent',
    icon: 'send',
    count: 0,
    active: false,
  },
  {
    id: 3,
    name: 'Starred',
    icon: 'note',
    count: 0,
    active: false,
  },
];

export const label: Category[] = [
  {
    id: 701,
    name: 'Engineering',
    icon: 'folder',
    count: 0,
    color: '#5D87FF',
    active: false,
  },
  {
    id: 702,
    name: 'Support',
    icon: 'folder',
    count: 0,
    color: '#49BEFF',
    active: false,
  },
  {
    id: 703,
    name: 'Sales',
    icon: 'folder',
    count: 0,
    color: '#FA896B',
    active: false,
  },
];
