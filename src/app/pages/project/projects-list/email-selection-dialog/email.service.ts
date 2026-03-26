import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/enviroments/environment';

@Injectable({
  providedIn: 'root',
})
export class EmailService {
  private apiUrl = environment.functions.sendEmailUrl;

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
