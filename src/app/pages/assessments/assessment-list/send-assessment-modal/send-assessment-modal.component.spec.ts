import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SendAssessmentModalComponent } from './send-assessment-modal.component';

describe('SendAssessmentModalComponent', () => {
  let component: SendAssessmentModalComponent;
  let fixture: ComponentFixture<SendAssessmentModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SendAssessmentModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SendAssessmentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
