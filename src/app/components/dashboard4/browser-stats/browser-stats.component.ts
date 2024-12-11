import { Component } from '@angular/core';
import { MaterialModule } from 'src/app/material.module';

interface browers {
  id: number;
  color: string;
  title: string;
  percent: string;
  img: string;
}

@Component({
  selector: 'app-browser-stats',
  standalone: true,
  imports:[MaterialModule],
  templateUrl: './browser-stats.component.html',
})
export class AppBrowserStatsComponent {
  browers: browers[] = [
    {
      id: 1,
      color: 'primary',
      percent: '25',
      title: 'Google Chrome',
      img: 'assets/images/browser/chrome-logo.png',
    },
    {
      id: 2,
      color: 'accent',
      percent: '25',
      title: 'Mozila Firefox',
      img: 'assets/images/browser/firefox-logo.png',
    },
    {
      id: 3,
      color: 'warning',
      percent: '25',
      title: 'Apple Safari',
      img: 'assets/images/browser/safari-logo.png',
    },
    {
      id: 4,
      color: 'error',
      percent: '25',
      title: 'Internet Explorer',
      img: 'assets/images/browser/internet-logo.png',
    },
    {
      id: 5,
      color: 'success',
      percent: '25',
      title: 'Opera mini',
      img: 'assets/images/browser/opera-logo.png',
    },
    {
      id: 6,
      color: 'primary',
      percent: '25',
      title: 'Microsoft edge',
      img: 'assets/images/browser/internet-logo.png',
    },
    {
      id: 7,
      color: 'accent',
      percent: '25',
      title: 'Mozila Firefox',
      img: 'assets/images/browser/firefox-logo.png',
    },
  ];

  constructor() {}
}
