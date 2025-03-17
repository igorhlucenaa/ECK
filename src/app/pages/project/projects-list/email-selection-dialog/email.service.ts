import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private apiUrl =
    'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail';

  constructor(private http: HttpClient) {}

  sendEmail(
    email: string,
    templateId: string,
    participantId: string,
    assessmentId: string
  ): Observable<any> {
    const body = { email, templateId, participantId, assessmentId };
    return this.http.post(this.apiUrl, body);
  }
}
