import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PreviewQuestionnaireComponent } from './preview-questionnaire.component';

describe('PreviewQuestionnaireComponent', () => {
  let component: PreviewQuestionnaireComponent;
  let fixture: ComponentFixture<PreviewQuestionnaireComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PreviewQuestionnaireComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PreviewQuestionnaireComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
