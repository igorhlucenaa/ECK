import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

// table 1
export interface projectsData {
  id: number;
  imagePath: string;
  uname: string;
  post: string;
  productName: string;
  budget: number;
  priority: string;
}

const PROJECT_DATA: projectsData[] = [
  {
    id: 1,
    imagePath: 'assets/images/profile/user-1.jpg',
    uname: 'Sunil Joshi',
    productName: 'Elite Admin',
    post: 'web designer',
    budget: 3.9,
    priority: 'low',
  },
  {
    id: 2,
    imagePath: 'assets/images/profile/user-2.jpg',
    uname: 'Andrew McDownland',
    productName: 'Real Homes',
    post: 'web designer',
    budget: 24.5,
    priority: 'medium',
  },
  {
    id: 3,
    imagePath: 'assets/images/profile/user-3.jpg',
    uname: 'Christopher Jamil',
    productName: 'MedicalPro Theme',
    post: 'web designer',
    budget: 12.8,
    priority: 'high',
  },
  {
    id: 4,
    imagePath: 'assets/images/profile/user-4.jpg',
    uname: 'Nirav Joshi',
    productName: 'Hosting Press',
    post: 'web designer',
    budget: 2.4,
    priority: 'critical',
  },
  {
    id: 5,
    imagePath: 'assets/images/profile/user-5.jpg',
    uname: 'John Deo',
    productName: 'Helping Hands',
    post: 'web designer',
    budget: 2.4,
    priority: 'low',
  },
];

@Component({
  selector: 'app-project-data',
  standalone: true,
  imports:[CommonModule, MaterialModule, TablerIconsModule],
  templateUrl: './project-data.component.html',
})
export class AppProjectDataComponent {

   // table 1
  displayedColumns2: string[] = ['assigned', 'name', 'priority', 'budget'];
  dataSource2 = PROJECT_DATA;
  
  constructor() {}
}
