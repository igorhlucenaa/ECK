import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';

admin.initializeApp();

// Método híbrido para definir variáveis de ambiente corretamente
const EMAIL_USER =
  defineString('EMAIL_USER').value() ||
  process.env.EMAIL_USER ||
  'igorhlucenaa@gmail.com';

const EMAIL_PASS =
  defineString('EMAIL_PASS').value() ||
  process.env.EMAIL_PASS ||
  'nkik bvji wshf xzpg';

// Configuração correta do transporte SMTP
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', // Servidor SMTP do Gmail
  port: 587, // Porta correta para STARTTLS
  secure: false, // false para STARTTLS, true para SSL
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Função para buscar o template de e-mail correto no Firestore
const getTemplate = async (clientId: string, emailType: string) => {
  const templateRef = admin.firestore().collection('mailTemplates');
  const snapshot = await templateRef
    .where('clientId', '==', clientId)
    .where('emailType', '==', emailType)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new Error('Template de e-mail não encontrado.');
  }

  return snapshot.docs[0].data();
};

// Função de envio de e-mail utilizando Firebase Functions v2
export const sendEmail = onCall(async (request) => {
  const { email, clientId, emailType } = request.data;

  if (!email || !clientId || !emailType) {
    throw new Error('Campos obrigatórios faltando.');
  }

  try {
    // Obtendo o template correto
    const template = await getTemplate(clientId, emailType);

    // Converter o content de string JSON para objeto, se necessário
    let emailHtml;
    try {
      const parsedContent = JSON.parse(template.content);
      emailHtml = parsedContent.body.rows[0].columns[0].contents[0].values.text;
    } catch (err) {
      throw new Error('Erro ao processar o template de e-mail.');
    }

    const mailOptions = {
      from: `ECK Avaliação 360 <${EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: emailHtml,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email enviado para: ${email}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar email:', error);
    throw new Error('Erro ao enviar email.');
  }
});
