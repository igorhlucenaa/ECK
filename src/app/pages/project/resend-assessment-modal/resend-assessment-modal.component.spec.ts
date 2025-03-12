import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResendAssessmentModalComponent } from './resend-assessment-modal.component';

describe('ResendAssessmentModalComponent', () => {
  let component: ResendAssessmentModalComponent;
  let fixture: ComponentFixture<ResendAssessmentModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResendAssessmentModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResendAssessmentModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
