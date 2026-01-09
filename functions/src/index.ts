import { onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineString } from 'firebase-functions/params';

// Inicializar Firebase Admin apenas se ainda não foi inicializado
if (!admin.apps.length) {
  admin.initializeApp();
}

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
          let headingText = content.values.text;

          // Aplicar as mesmas substituições dos textos
          const expirationPlaceholder = '___EXPIRATION_PLACEHOLDER___';
          const expirationPlaceholderWithAsterisk = '___EXPIRATION_ASTERISK_PLACEHOLDER___';

          if (replacements.projectDeadline) {
            headingText = headingText.replace(
              /\*\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*/g,
              expirationPlaceholderWithAsterisk
            );
            headingText = headingText.replace(
              /\$%DATA DE EXPIRAÇÃO DO PROJETO\$%/g,
              expirationPlaceholder
            );
          }

          headingText = headingText.replace(
            /\$%.*?\$%/g,
            replacements.participantName || 'Participante'
          );

          if (replacements.projectDeadline) {
            headingText = headingText.replace(
              expirationPlaceholderWithAsterisk,
              replacements.projectDeadline
            );
            headingText = headingText.replace(
              expirationPlaceholder,
              replacements.projectDeadline
            );
          }

          html += `<${content.values.headingType} style="${containerStyles} ${headingStyles}">${headingText}</${content.values.headingType}>`;
        } else if (content.type === 'text') {
          const textStyles = `
            font-size: ${content.values.fontSize};
            text-align: ${content.values.textAlign};
            line-height: ${content.values.lineHeight};
          `;
          let textContent = content.values.text;

          // Substituir data de expiração primeiro (antes de substituir nome genérico)
          // Usar placeholder temporário para proteger a data de expiração
          const expirationPlaceholder = '___EXPIRATION_PLACEHOLDER___';
          const expirationPlaceholderWithAsterisk = '___EXPIRATION_ASTERISK_PLACEHOLDER___';

          if (replacements.projectDeadline) {
            // Proteger a data de expiração com asteriscos: *$%DATA DE EXPIRAÇÃO DO PROJETO$%*
            textContent = textContent.replace(
              /\*\$%DATA DE EXPIRAÇÃO DO PROJETO\$%\*/g,
              expirationPlaceholderWithAsterisk
            );
            // Proteger a data de expiração sem asteriscos: $%DATA DE EXPIRAÇÃO DO PROJETO$%
            textContent = textContent.replace(
              /\$%DATA DE EXPIRAÇÃO DO PROJETO\$%/g,
              expirationPlaceholder
            );
          }

          // Substituir tudo entre $% $% pelo nome do participante
          textContent = textContent.replace(
            /\$%.*?\$%/g,
            replacements.participantName || 'Participante'
          );

          // Restaurar a data de expiração substituindo os placeholders
          if (replacements.projectDeadline) {
            textContent = textContent.replace(
              expirationPlaceholderWithAsterisk,
              replacements.projectDeadline
            );
            textContent = textContent.replace(
              expirationPlaceholder,
              replacements.projectDeadline
            );
          }

          // Substituir [LINK_AVALIACAO] pelo link
          textContent = textContent.replace(
            '[LINK_AVALIACAO]',
            replacements.LINK_AVALIACAO
          );

          // Substituir [LINK_RELATORIO] pelo link do relatório se disponível
          if (replacements.LINK_RELATORIO) {
            textContent = textContent.replace(
              '[LINK_RELATORIO]',
              replacements.LINK_RELATORIO
            );
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
export const sendEmail = onRequest(
  {
    region: 'us-central1',
    cors: true,
  },
  async (req, res) => {
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
      'catt vkem hnzg gwns';

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
      const projectId = participantData?.projectId;

      // Buscar a data limite do projeto
      let projectDeadline: string = '';
      if (projectId) {
        try {
          const projectRef = admin
            .firestore()
            .collection('projects')
            .doc(projectId);
          const projectDoc = await projectRef.get();

          if (projectDoc.exists) {
            const projectData = projectDoc.data();
            let deadline: Date | undefined;

            if (projectData?.deadline) {
              if (projectData.deadline.toDate) {
                // Firestore Timestamp
                deadline = projectData.deadline.toDate();
              } else if (projectData.deadline instanceof Date) {
                deadline = projectData.deadline;
              } else if (typeof projectData.deadline === 'string') {
                deadline = new Date(projectData.deadline);
              }

              if (deadline) {
                // Formatar data no formato brasileiro: DD/MM/YYYY
                const day = String(deadline.getDate()).padStart(2, '0');
                const month = String(deadline.getMonth() + 1).padStart(2, '0');
                const year = deadline.getFullYear();
                projectDeadline = `${day}/${month}/${year}`;
              }
            }
          }
        } catch (error) {
          console.error('Erro ao buscar deadline do projeto:', error);
          // Continua sem a data limite se houver erro
        }
      }

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

        // Passar o nome do participante, data limite e o link
        emailHtml = renderTemplateToHtml(parsedContent, {
          LINK_AVALIACAO: assessmentLink,
          participantName: participantName,
          projectDeadline: projectDeadline,
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
  }
);
