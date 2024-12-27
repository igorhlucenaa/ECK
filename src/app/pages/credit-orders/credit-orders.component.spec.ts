import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditOrdersComponent } from './credit-orders.component';

describe('CreditOrdersComponent', () => {
  let component: CreditOrdersComponent;
  let fixture: ComponentFixture<CreditOrdersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditOrdersComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditOrdersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
