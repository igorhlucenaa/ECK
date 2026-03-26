import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvaluatorsModalComponent } from './evaluators-modal.component';

describe('EvaluatorsModalComponent', () => {
  let component: EvaluatorsModalComponent;
  let fixture: ComponentFixture<EvaluatorsModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EvaluatorsModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EvaluatorsModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
