import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmailTemplateListComponent } from './email-template-list.component';

describe('EmailTemplateListComponent', () => {
  let component: EmailTemplateListComponent;
  let fixture: ComponentFixture<EmailTemplateListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmailTemplateListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EmailTemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
