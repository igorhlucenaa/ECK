import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ParticipantResponsesModalComponent } from './participant-responses-modal.component';

describe('ParticipantResponsesModalComponent', () => {
  let component: ParticipantResponsesModalComponent;
  let fixture: ComponentFixture<ParticipantResponsesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParticipantResponsesModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ParticipantResponsesModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
