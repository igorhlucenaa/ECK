import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailSelectionDialogComponent } from './email-selection-dialog.component';

describe('EmailSelectionDialogComponent', () => {
  let component: EmailSelectionDialogComponent;
  let fixture: ComponentFixture<EmailSelectionDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailSelectionDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailSelectionDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
