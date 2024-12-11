import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

// table 1
export interface productsalesData {
  id: number;
  imagePath: string;
  uname: string;
  post: string;
  productName: string;
  percent: number;
}

const PRODUCT_SALES: productsalesData[] = [
  {
    id: 1,
    imagePath: 'assets/images/products/s1.jpg',
    uname: 'Is it good butterscotch ice-cream?',
    productName: '546,000',
    post: 'Ice-Cream, Milk, Powder',
    percent: 45,
  },
  {
    id: 2,
    imagePath: 'assets/images/products/s2.jpg',
    uname: 'Supreme fresh tomato available',
    productName: '780,000',
    post: 'Market, Mall',
    percent: 20,
  },
  {
    id: 3,
    imagePath: 'assets/images/products/s3.jpg',
    uname: 'Red color candy from Gucci',
    productName: '457,000',
    post: 'Chocolate, Yummy',
    percent: 60,
  },
  {
    id: 4,
    imagePath: 'assets/images/products/s4.jpg',
    uname: 'Stylish night lamp for night',
    productName: '125,000',
    post: 'Elecric, Wire, Current',
    percent: 20,
  },
];

@Component({
  selector: 'app-product-sales',
  standalone: true,
  imports:[MaterialModule, TablerIconsModule],
  templateUrl: './product-sales.component.html',
})
export class AppProductSalesComponent {
  // table 1
  displayedColumns2: string[] = ['assigned', 'percent', 'name', 'action'];
  dataSource2 = PRODUCT_SALES;

  constructor() {}
}
