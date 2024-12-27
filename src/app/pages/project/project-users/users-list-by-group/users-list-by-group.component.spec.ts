import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersListByGroupComponent } from './users-list-by-group.component';

describe('UsersListByGroupComponent', () => {
  let component: UsersListByGroupComponent;
  let fixture: ComponentFixture<UsersListByGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersListByGroupComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UsersListByGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
