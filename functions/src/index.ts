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

// Função para obter o Modelo de e-mail pelo ID
const getTemplateById = async (templateId: string) => {
  const templateRef = admin.firestore().collection('mailTemplates');
  const snapshot = await templateRef.doc(templateId).get();

  if (!snapshot.exists) {
    throw new Error('Modelo de e-mail não encontrado.');
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

  const bodyStyles = `
    font-family: ${templateContent.body.values.fontFamily.value};
    color: ${templateContent.body.values.textColor};
    background-color: ${templateContent.body.values.backgroundColor};
    text-align: ${templateContent.body.values.contentAlign};
    width: ${templateContent.body.values.contentWidth};
    margin: 0 auto;
  `;

  html += `<div style="${bodyStyles}">`;

  for (const row of rows) {
    const rowStyles = `
      padding: ${row.values.padding};
      background-color: ${row.values.backgroundColor};
    `;
    html += `<div style="${rowStyles}">`;

    for (const column of row.columns) {
      html += '<div>';

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

          // Substituir tudo entre $% $% pelo nome do participante
          textContent = textContent.replace(
            /\$%.*?\$%/g,
            replacements.participantName
          );

          // Substituir [LINK_AVALIACAO] pelo link
          textContent = textContent.replace(
            '[LINK_AVALIACAO]',
            replacements.LINK_AVALIACAO
          );

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
    const { email, templateId, participantId, assessmentId } = req.body;

    if (!email || !templateId || !participantId || !assessmentId) {
      res.status(400).send({
        error:
          'Campos obrigatórios faltando: email, templateId, participantId, assessmentId.',
      });
      return;
    }

    const emailUser =
      EMAIL_USER_PARAM.value() ||
      process.env.EMAIL_USER ||
      'igorhlucenaa@gmail.com';
    const emailPass =
      EMAIL_PASS_PARAM.value() ||
      process.env.EMAIL_PASS ||
      'nkik bvji wshf xzpg';

    const transporter = getTransporter(emailUser, emailPass);

    try {
      // Buscar o nome do participante
      const participantRef = admin
        .firestore()
        .collection('participants')
        .doc(participantId);
      const participantDoc = await participantRef.get();

      if (!participantDoc.exists) {
        res.status(404).send({ error: 'Participante não encontrado.' });
        return;
      }

      const participantData = participantDoc.data();
      const participantName = participantData?.name || 'Participante';

      const template = await getTemplateById(templateId);

      if (!template) {
        res.status(404).send({ error: 'Modelo de e-mail não encontrado.' });
        return;
      }

      const assessmentLink = `https://eck360.web.app/assessment?token=${
        Math.random().toString(36).substr(2) + Date.now().toString(36)
      }&participant=${participantId}&assessment=${assessmentId}`;

      let emailHtml;
      try {
        const parsedContent = JSON.parse(template.content);

        // Passar o nome do participante e o link
        emailHtml = renderTemplateToHtml(parsedContent, {
          LINK_AVALIACAO: assessmentLink,
          participantName: participantName, // Passamos o nome explicitamente
        });
      } catch (err) {
        res
          .status(500)
          .send({ error: 'Erro ao processar o Modelo de e-mail.' });
        return;
      }

      // Restante do código permanece igual
      const assessmentLinkObj = {
        assessmentId,
        token: Math.random().toString(36).substr(2) + Date.now().toString(36),
        status: 'sent',
      };

      await participantRef.update({
        assessmentLinks:
          admin.firestore.FieldValue.arrayUnion(assessmentLinkObj),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const mailOptions = {
        from: `ECK Avaliação 360 <${emailUser}>`,
        to: email,
        subject: template.subject,
        html: emailHtml,
      };

      await transporter.sendMail(mailOptions);

      await participantRef.update({
        deliveryStatus: 'sent',
        lastEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send({ success: true });
    } catch (error: any) {
      console.error('Erro ao enviar e-mail:', error);
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
      res
        .status(500)
        .send({ error: `Erro ao enviar e-mail: ${error.message}` });
    }
  });
});
