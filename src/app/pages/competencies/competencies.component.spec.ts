import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompetenciesComponent } from './competencies.component';

describe('CompetenciesComponent', () => {
  let component: CompetenciesComponent;
  let fixture: ComponentFixture<CompetenciesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompetenciesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompetenciesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
