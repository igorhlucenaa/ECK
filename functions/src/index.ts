import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';
const cors = require('cors')({ origin: true });

admin.initializeApp();

// Definindo parâmetros configuráveis (não chamar .value() aqui)
const EMAIL_USER_PARAM = defineString('EMAIL_USER');
const EMAIL_PASS_PARAM = defineString('EMAIL_PASS');

// Configuração do transporte de e-mail (usando valores em tempo de execução)
const getTransporter = (emailUser: string, emailPass: string) => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // false para STARTTLS
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

// Função para obter o template de e-mail pelo ID
const getTemplateById = async (templateId: string) => {
  const templateRef = admin.firestore().collection('mailTemplates');
  const snapshot = await templateRef.doc(templateId).get();

  if (!snapshot.exists) {
    throw new Error('Template de e-mail não encontrado.');
  }

  return snapshot.data();
};

// Função para renderizar o HTML a partir do template
function renderTemplateToHtml(
  templateContent: any,
  replacements: { [key: string]: string }
): string {
  const rows = templateContent.body.rows;
  let html = '';

  // Estilos globais do body
  const bodyStyles = `
    font-family: ${templateContent.body.values.fontFamily.value};
    color: ${templateContent.body.values.textColor};
    background-color: ${templateContent.body.values.backgroundColor};
    text-align: ${templateContent.body.values.contentAlign};
    width: ${templateContent.body.values.contentWidth};
    margin: 0 auto;
  `;

  html += `<div style="${bodyStyles}">`;

  // Iterar sobre as rows
  for (const row of rows) {
    const rowStyles = `
      padding: ${row.values.padding};
      background-color: ${row.values.backgroundColor};
    `;
    html += `<div style="${rowStyles}">`;

    // Iterar sobre as columns
    for (const column of row.columns) {
      html += '<div>';

      // Iterar sobre os contents
      for (const content of column.contents) {
        const containerStyles = `padding: ${content.values.containerPadding};`;

        if (content.type === 'heading') {
          const headingStyles = `
            font-size: ${content.values.fontSize};
            text-align: ${content.values.textAlign};
            line-height: ${content.values.lineHeight};
          `;
          html += `<${content.values.headingType} style="${containerStyles} ${headingStyles}">${content.values.text}</${content.values.headingType}>`;
        } else if (content.type === 'text') {
          const textStyles = `
            font-size: ${content.values.fontSize};
            text-align: ${content.values.textAlign};
            line-height: ${content.values.lineHeight};
          `;
          let textContent = content.values.text;
          // Substituir placeholders
          for (const [key, value] of Object.entries(replacements)) {
            textContent = textContent.replace(`[${key}]`, value);
          }
          html += `<div style="${containerStyles} ${textStyles}">${textContent}</div>`;
        } else if (content.type === 'social') {
          const socialStyles = `
            text-align: ${content.values.align};
          `;
          html += `<div style="${containerStyles} ${socialStyles}">Ícones sociais (personalize conforme necessário)</div>`;
        }
      }

      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div>';
  return html;
}

// Função para enviar o e-mail
export const sendEmail = onRequest((req, res) => {
  cors(req, res, async () => {
    // Torne a função de callback assíncrona
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

    // Resolver os valores de email e senha em tempo de execução
    const emailUser =
      EMAIL_USER_PARAM.value() ||
      process.env.EMAIL_USER ||
      'igorhlucenaa@gmail.com';
    const emailPass =
      EMAIL_PASS_PARAM.value() ||
      process.env.EMAIL_PASS ||
      'nkik bvji wshf xzpg';

    // Criar o transporter em tempo de execução
    const transporter = getTransporter(emailUser, emailPass);

    try {
      // Obtendo o template de e-mail pelo ID
      const template = await getTemplateById(templateId);

      // Verificar se o template foi encontrado
      if (!template) {
        res.status(404).send({ error: 'Template de e-mail não encontrado.' });
        return;
      }

      // Gerar o link de avaliação
      const assessmentLink = `https://eck360.web.app/assessment?token=${
        Math.random().toString(36).substr(2) + Date.now().toString(36)
      }&participant=${participantId}&assessment=${assessmentId}`;

      // Parsear o template e renderizar o HTML
      let emailHtml;
      try {
        const parsedContent = JSON.parse(template.content);
        console.log('Conteúdo em JSON:', parsedContent);

        // Renderizar o template com substituições
        emailHtml = renderTemplateToHtml(parsedContent, {
          LINK_AVALIACAO: assessmentLink,
        });

        console.log('HTML gerado:', emailHtml);
      } catch (err) {
        res
          .status(500)
          .send({ error: 'Erro ao processar o template de e-mail.' });
        return;
      }

      // Criar o objeto do link de avaliação
      const assessmentLinkObj = {
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
        assessmentLinks:
          admin.firestore.FieldValue.arrayUnion(assessmentLinkObj),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Configurar as opções do e-mail
      const mailOptions = {
        from: `ECK Avaliação 360 <${emailUser}>`, // Usar emailUser diretamente
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
      res
        .status(500)
        .send({ error: `Erro ao enviar e-mail: ${error.message}` });
    }
  });
});
