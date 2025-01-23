import * as functions from 'firebase-functions';
import * as nodemailer from 'nodemailer';

// Definição do tipo para os dados recebidos pela função
interface EmailRequest {
  email: string; // Email do destinatário
  subject: string; // Assunto do email
  body: string; // Corpo do email
}

// Configurar o transporte para envio de emails
const transporter = nodemailer.createTransport({
  service: 'gmail', // Usando Gmail como exemplo
  auth: {
    user: functions.config().email.user, // Configurado pelo Firebase CLI
    pass: functions.config().email.pass,
  },
});

// Função para enviar emails
export const sendEmail = functions.https.onCall(
  async (request: functions.https.CallableRequest<EmailRequest>, context) => {
    const { email, subject, body } = request.data;

    // Validação dos campos obrigatórios
    if (!email || !subject || !body) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Os campos email, subject e body são obrigatórios.'
      );
    }

    const mailOptions = {
      from: 'ECK Avaliação 360 <seu-email@gmail.com>', // Nome e email remetente
      to: email, // Destinatário
      subject: subject, // Assunto
      text: body, // Corpo do email
    };

    try {
      await transporter.sendMail(mailOptions);
      console.log(`Email enviado para: ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw new functions.https.HttpsError(
        'internal',
        'Erro ao enviar email. Por favor, tente novamente mais tarde.'
      );
    }
  }
);
