import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticipantsConfirmationDialogComponent } from './participants-confirmation-dialog.component';

describe('ParticipantsConfirmationDialogComponent', () => {
  let component: ParticipantsConfirmationDialogComponent;
  let fixture: ComponentFixture<ParticipantsConfirmationDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantsConfirmationDialogComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticipantsConfirmationDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
