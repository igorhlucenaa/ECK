export const environment = {
  production: true,
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
    sendEmailUrl: 'https://us-central1-pwa-workana.cloudfunctions.net/sendEmail',
    triggerPendingAssessmentRemindersUrl:
      'https://us-central1-pwa-workana.cloudfunctions.net/triggerPendingAssessmentReminders',
    generateReportPdfUrl:
      'https://us-central1-pwa-workana.cloudfunctions.net/generateReportPdf',
    createReportDocxExportUrl:
      'https://us-central1-pwa-workana.cloudfunctions.net/createReportDocxExport',
    getReportDocxExportStatusUrl:
      'https://us-central1-pwa-workana.cloudfunctions.net/getReportDocxExportStatus',
    downloadReportDocxExportUrl:
      'https://us-central1-pwa-workana.cloudfunctions.net/downloadReportDocxExport',
  },
};
