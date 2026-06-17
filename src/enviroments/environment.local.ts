const functionsBaseUrl = 'http://127.0.0.1:5001/pwa-workana/us-central1';

export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyCxUZGayShvR7Ckm3Dpk4JUPgDwoIvquWY',
    authDomain: 'pwa-workana.firebaseapp.com',
    databaseURL: 'https://pwa-workana.firebaseio.com',
    projectId: 'pwa-workana',
    storageBucket: 'pwa-workana.firebasestorage.app',
    messagingSenderId: '166389194595',
    appId: '1:166389194595:web:caa5f30d07b6bcca',
  },
  functions: {
    sendEmailUrl: `${functionsBaseUrl}/sendEmail`,
    triggerPendingAssessmentRemindersUrl: `${functionsBaseUrl}/triggerPendingAssessmentReminders`,
    generateReportPdfUrl: `${functionsBaseUrl}/generateReportPdf`,
  },
};
