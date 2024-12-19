import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ClientCustomizationComponent } from './client-customization.component';

describe('ClientCustomizationComponent', () => {
  let component: ClientCustomizationComponent;
  let fixture: ComponentFixture<ClientCustomizationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClientCustomizationComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ClientCustomizationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
