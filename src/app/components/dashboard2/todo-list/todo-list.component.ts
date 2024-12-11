import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

interface user {
  image: string;
  name: string;
}

interface todos {
  id: number;
  message: string;
  date?: string;
  users ?: user[];
  time ?: string;
  timecolor ?: string;
}

@Component({
  selector: 'app-todo-list',
  standalone: true,
  imports:[MaterialModule, TablerIconsModule, CommonModule],
  templateUrl: './todo-list.component.html',
})
export class AppTodoListComponent {
  constructor() {}

  todos: todos[] = [
    {
      id: 1,
      message: 'Schedule meeting with',
      users: [
        {
          image: 'assets/images/profile/user-1.jpg',
          name: 'Steve',
        },
         {
          image: 'assets/images/profile/user-2.jpg',
          name: 'Jessica',
        },
      ],
    },
    {
      id: 2,
      message: 'Give purchase report to',
      date: '26 jun 2023',
       users: [
        {
          image: 'assets/images/profile/user-3.jpg',
          name: 'John',
        },
      ],
      time:'Today',
      timecolor: 'error'
    },
    {
      id: 3,
      message: 'Book flight for holiday',
      date: '26 jun 2023',
    },
    {
      id: 4,
      message: 'Forward  all tasks',
      date: '26 jun 2023',
      time:'2 weeks',
      timecolor: 'warning'
    },
    {
      id: 5,
      message: 'Schedule dinner with',
      users: [
        {
          image: 'assets/images/profile/user-5.jpg',
          name: 'Steve',
        },
         {
          image: 'assets/images/profile/user-6.jpg',
          name: 'Jessica',
        },
      ],
    },
    {
      id: 6,
      message: 'Book hotel for celebration',
      date: '26 jun 2023',
    },
  ];
}
