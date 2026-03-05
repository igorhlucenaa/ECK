import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AssessmentResponsesModalComponent } from './assessment-responses-modal.component';

describe('AssessmentResponsesModalComponent', () => {
  let component: AssessmentResponsesModalComponent;
  let fixture: ComponentFixture<AssessmentResponsesModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssessmentResponsesModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AssessmentResponsesModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
