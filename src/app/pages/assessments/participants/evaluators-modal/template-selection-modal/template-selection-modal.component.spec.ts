import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateSelectionModalComponent } from './template-selection-modal.component';

describe('TemplateSelectionModalComponent', () => {
  let component: TemplateSelectionModalComponent;
  let fixture: ComponentFixture<TemplateSelectionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateSelectionModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TemplateSelectionModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
