import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddAssessmentsModalComponent } from './add-assessments-modal.component';

describe('AddAssessmentsModalComponent', () => {
  let component: AddAssessmentsModalComponent;
  let fixture: ComponentFixture<AddAssessmentsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddAssessmentsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddAssessmentsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
