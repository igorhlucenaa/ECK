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
    assessmentId: string,
    evaluatedParticipantId?: string,
    options?: { projectId?: string; clientId?: string }
  ): Observable<{ success: boolean; token: string; linkId?: string }> {
    const body = {
      email,
      templateId,
      participantId,
      assessmentId,
      evaluatedParticipantId,
      projectId: options?.projectId,
      clientId: options?.clientId,
    };
    return this.http.post<{ success: boolean; token: string; linkId?: string }>(this.apiUrl, body);
  }
}
