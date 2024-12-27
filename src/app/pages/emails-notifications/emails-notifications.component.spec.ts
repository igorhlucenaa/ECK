import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailsNotificationsComponent } from './emails-notifications.component';

describe('EmailsNotificationsComponent', () => {
  let component: EmailsNotificationsComponent;
  let fixture: ComponentFixture<EmailsNotificationsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailsNotificationsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailsNotificationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
