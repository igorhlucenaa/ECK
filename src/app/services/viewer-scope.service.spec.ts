import { TestBed } from '@angular/core/testing';
import { ViewerScopeService } from './viewer-scope.service';
import { AuthService } from './apps/authentication/auth.service';

describe('ViewerScopeService', () => {
  let service: ViewerScopeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ViewerScopeService,
        {
          provide: AuthService,
          useValue: {
            getCurrentUserEmail: jasmine.createSpy('getCurrentUserEmail'),
            getCurrentUserClientIds: jasmine
              .createSpy('getCurrentUserClientIds')
              .and.resolveTo([]),
          },
        },
      ],
    });
    service = TestBed.inject(ViewerScopeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
