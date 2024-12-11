import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';

// table 1
export interface productsData {
  id: number;
  imagePath: string;
  uname: string;
  productName: string;
  budget: number;
  priority: string;
}

const PRODUCT_DATA: productsData[] = [
  {
    id: 1,
    imagePath: 'assets/images/profile/user-1.jpg',
    uname: 'Sunil Joshi',
    productName: 'Elite Admin',
    budget: 3.9,
    priority: 'low',
  },
  {
    id: 2,
    imagePath: 'assets/images/profile/user-2.jpg',
    uname: 'Andrew McDownland',
    productName: 'Real Homes Theme',
    budget: 24.5,
    priority: 'medium',
  },
  {
    id: 3,
    imagePath: 'assets/images/profile/user-3.jpg',
    uname: 'Christopher Jamil',
    productName: 'MedicalPro Theme',
    budget: 12.8,
    priority: 'high',
  },
  {
    id: 4,
    imagePath: 'assets/images/profile/user-4.jpg',
    uname: 'Nirav Joshi',
    productName: 'Hosting Press HTML',
    budget: 2.4,
    priority: 'critical',
  },
  {
    id: 5,
    imagePath: 'assets/images/profile/user-5.jpg',
    uname: 'John Deo',
    productName: 'Helping Hands',
    budget: 2.4,
    priority: 'low',
  },
];

interface month {
    value: string;
    viewValue: string;
  }

@Component({
  selector: 'app-product-performance2',
  standalone: true,
  imports:[MaterialModule, CommonModule],
  templateUrl: './product-performance2.component.html',
})
export class AppProductPerformance2Component implements OnInit {
    months: month[] = [
        { value: 'mar', viewValue: 'March 2023' },
        { value: 'apr', viewValue: 'April 2023' },
        { value: 'june', viewValue: 'June 2023' },
      ];

  // table 1
  displayedColumns1: string[] = ['assigned', 'name', 'priority', 'budget'];
  dataSource1 = PRODUCT_DATA;

  ngOnInit(): void {}
}
