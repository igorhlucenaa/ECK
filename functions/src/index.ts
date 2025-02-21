import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';

admin.initializeApp();

// Definindo variáveis de ambiente
const EMAIL_USER =
  defineString('EMAIL_USER').value() ||
  process.env.EMAIL_USER ||
  'igorhlucenaa@gmail.com';

const EMAIL_PASS =
  defineString('EMAIL_PASS').value() ||
  process.env.EMAIL_PASS ||
  'nkik bvji wshf xzpg';

// Configuração do transporte de e-mail
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // false para STARTTLS
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// Função para obter o template de e-mail pelo ID
const getTemplateById = async (templateId: string) => {
  const templateRef = admin.firestore().collection('mailTemplates');
  const snapshot = await templateRef.doc(templateId).get();

  if (!snapshot.exists) {
    throw new Error('Template de e-mail não encontrado.');
  }

  return snapshot.data();
};

// Função para enviar o e-mail
export const sendEmail = onRequest(async (req, res) => {
  console.log('Dados recebidos:', req.body); // Log para verificar os dados recebidos
  const { email, templateId, participantId, assessmentId } = req.body;

  // Verificar campos obrigatórios
  if (!email || !templateId || !participantId || !assessmentId) {
    res.status(400).send({
      error:
        'Campos obrigatórios faltando: email, templateId, participantId, assessmentId.',
    });
    return;
  }

  try {
    // Obtendo o template de e-mail pelo ID
    const template = await getTemplateById(templateId);

    // Verificar se o template foi encontrado
    if (!template) {
      res.status(404).send({ error: 'Template de e-mail não encontrado.' });
      return;
    }

    // Converter o conteúdo do template de string JSON para objeto
    let emailHtml = '';
    try {
      const parsedContent = JSON.parse(template.content);
      console.log('Este é o conteúdo em JSON:', parsedContent);

      // Encontrar o conteúdo de texto com o placeholder [LINK_AVALIACAO]
      const contents = parsedContent.body.rows[0].columns[0].contents;
      const textContentItem = contents.find((item: any) =>
        item.values.text.includes('[LINK_AVALIACAO]')
      );

      if (!textContentItem) {
        throw new Error(
          'Placeholder [LINK_AVALIACAO] não encontrado no template.'
        );
      }

      // Substituir o placeholder no texto encontrado
      const textContent = textContentItem.values.text;
      emailHtml = textContent.replace(
        '[LINK_AVALIACAO]',
        `https://seu-dominio.com/assessment?token=${
          Math.random().toString(36).substr(2) + Date.now().toString(36)
        }&participant=${participantId}&assessment=${assessmentId}`
      );

      console.log('Este é o conteúdo processado:', emailHtml);
    } catch (err) {
      res
        .status(500)
        .send({ error: 'Erro ao processar o template de e-mail.' });
      return;
    }

    // Criar o objeto do link de avaliação
    const assessmentLink = {
      assessmentId,
      token: Math.random().toString(36).substr(2) + Date.now().toString(36),
      status: 'sent', // Status inicial
    };

    // Salvar o link e status no Firestore (em participants)
    const participantRef = admin
      .firestore()
      .collection('participants')
      .doc(participantId);
    await participantRef.update({
      assessmentLinks: admin.firestore.FieldValue.arrayUnion(assessmentLink),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Configurar as opções do e-mail
    const mailOptions = {
      from: `ECK Avaliação 360 <${EMAIL_USER}>`,
      to: email,
      subject: template.subject,
      html: emailHtml,
    };

    // Enviar o e-mail
    await transporter.sendMail(mailOptions);
    console.log(`E-mail enviado para: ${email}`);

    // Atualizar status de entrega após envio bem-sucedido
    await participantRef.update({
      deliveryStatus: 'sent',
      lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Retornar resposta de sucesso
    res.status(200).send({ success: true });
  } catch (error: any) {
    console.error('Erro ao enviar e-mail:', error);

    // Atualizar status para 'failed' em caso de erro
    if (participantId) {
      await admin
        .firestore()
        .collection('participants')
        .doc(participantId)
        .update({
          deliveryStatus: 'failed',
          errorMessage: error.message,
        });
    }

    // Retornar erro
    res.status(500).send({ error: `Erro ao enviar e-mail: ${error.message}` });
  }
});
