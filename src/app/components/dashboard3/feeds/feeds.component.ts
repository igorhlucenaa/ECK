import { Component } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { NgScrollbarModule } from 'ngx-scrollbar';
import { MaterialModule } from 'src/app/material.module';

interface msgs {
  id: number;
  img: string;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-feeds',
  standalone: true,
  imports:[NgScrollbarModule, MaterialModule, TablerIconsModule],
  templateUrl: './feeds.component.html',
})
export class AppFeedsComponent {
  
  // This is for Mymessages
  msgs: msgs[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'You have 4 pending tasks',
      subtitle: 'Pawan deep',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'Server #1 overloaded',
      subtitle: 'pamela',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'New order received.',
      subtitle: 'Arijit.com',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'New user registered',
      subtitle: 'kat@gmail.com',
    },
  ];

  constructor() {}
}
