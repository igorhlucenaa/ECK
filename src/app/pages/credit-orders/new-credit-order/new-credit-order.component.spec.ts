import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NewCreditOrderComponent } from './new-credit-order.component';

describe('NewCreditOrderComponent', () => {
  let component: NewCreditOrderComponent;
  let fixture: ComponentFixture<NewCreditOrderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewCreditOrderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NewCreditOrderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
