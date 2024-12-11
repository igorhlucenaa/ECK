import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { TablerIconsModule } from 'angular-tabler-icons';
import { MaterialModule } from 'src/app/material.module';

interface comments {
  id: number;
  img: string;
  title: string;
  subtitle: string;
  date: string;
  status: string;
  color: string;
}

@Component({
  selector: 'app-recent-comments',
  standalone: true,
  imports:[MaterialModule, TablerIconsModule, RouterModule],
  templateUrl: './recent-comments.component.html',
})
export class AppRecentCommentsComponent {
  comments: comments[] = [
    {
      id: 1,
      img: '/assets/images/profile/user-1.jpg',
      title: 'Andrew McDownland',
      subtitle:
        'Lorem Ipsum is simply dummy text of the printing and type setting industry.',
      date: 'April 14, 2022',
      status: 'Pending',
      color: 'warning',
    },
    {
      id: 2,
      img: '/assets/images/profile/user-2.jpg',
      title: 'Christopher Jamil',
      subtitle:
        'Lorem Ipsum has beenorem Ipsum is simply dummy text of the printing and type setting industry.',
      date: 'April 14, 2022',
      status: 'Approved',
      color: 'success',
    },
    {
      id: 3,
      img: '/assets/images/profile/user-3.jpg',
      title: 'Julia Roberts',
      subtitle:
        'Lorem Ipsum is simply dummy text of the printing and type setting industry.',
      date: 'April 14, 2022',
      status: 'Rejected',
      color: 'error',
    },
    {
      id: 4,
      img: '/assets/images/profile/user-4.jpg',
      title: 'James Johnson',
      subtitle:
        'Lorem Ipsum is simply dummy text of the printing and type setting industry.',
      date: 'April 14, 2022',
      status: 'Pending',
      color: 'primary',
    },
  ];

  constructor() {}
}
