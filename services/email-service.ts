import "server-only";

import { z } from "zod";
import nodemailer from "nodemailer";
import { getEmailFrom, getEmailPass, getEmailUser } from "@/lib/email";
import { buildAccountCreatedEmail } from "@/templates/account-created-email";
import { buildPasswordResetEmail } from "@/templates/password-reset-email";

const passwordResetEmailSchema = z.object({
  employeeName: z.string().trim().min(1),
  employeeEmail: z.string().trim().email(),
  resetUrl: z.string().url(),
  expiresHours: z.number().int().positive(),
});

const accountCreatedEmailSchema = z.object({
  employeeName: z.string().trim().min(1),
  recipientEmail: z.string().trim().email(),
  loginEmail: z.string().trim().email(),
  temporaryPassword: z.string().min(1),
  loginUrl: z.string().url(),
});

export type EmailDeliveryResult = {
  attempted: boolean;
  sent: boolean;
  provider: "nodemailer";
  message?: string;
  id?: string;
};

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  const user = getEmailUser();
  const pass = getEmailPass();

  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }

  return transporter;
}

export async function sendAccountCreatedEmail(
  input: z.infer<typeof accountCreatedEmailSchema>,
): Promise<EmailDeliveryResult> {
  const parsed = accountCreatedEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      attempted: false,
      sent: false,
      provider: "nodemailer",
      message: "Invalid email payload.",
    };
  }

  const mailer = getTransporter();
  const from = getEmailFrom();

  if (!mailer || !from) {
    return {
      attempted: false,
      sent: false,
      provider: "nodemailer",
      message: "EMAIL_USER or EMAIL_PASS is not configured.",
    };
  }

  try {
    const template = buildAccountCreatedEmail(parsed.data);
    const info = await mailer.sendMail({
      from,
      to: parsed.data.recipientEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.info("[email] nodemailer account-created sent", {
      email: parsed.data.recipientEmail,
      loginEmail: parsed.data.loginEmail,
      id: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    if (info.rejected.length > 0 && info.accepted.length === 0) {
      return {
        attempted: true,
        sent: false,
        provider: "nodemailer",
        message: `Email rejected for ${parsed.data.recipientEmail}.`,
        id: info.messageId,
      };
    }

    return {
      attempted: true,
      sent: true,
      provider: "nodemailer",
      id: info.messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email sending failed.";
    console.warn("[email] nodemailer account-created exception", {
      email: parsed.data.recipientEmail,
      loginEmail: parsed.data.loginEmail,
      error: message,
    });

    return {
      attempted: true,
      sent: false,
      provider: "nodemailer",
      message,
    };
  }
}

export async function sendPasswordResetEmail(
  input: z.infer<typeof passwordResetEmailSchema>,
): Promise<EmailDeliveryResult> {
  const parsed = passwordResetEmailSchema.safeParse(input);
  if (!parsed.success) {
    return {
      attempted: false,
      sent: false,
      provider: "nodemailer",
      message: "Invalid email payload.",
    };
  }

  const mailer = getTransporter();
  const from = getEmailFrom();

  if (!mailer || !from) {
    return {
      attempted: false,
      sent: false,
      provider: "nodemailer",
      message: "EMAIL_USER or EMAIL_PASS is not configured.",
    };
  }

  try {
    const template = buildPasswordResetEmail(parsed.data);
    const info = await mailer.sendMail({
      from,
      to: parsed.data.employeeEmail,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    console.info("[email] nodemailer password-reset sent", {
      email: parsed.data.employeeEmail,
      id: info.messageId,
    });

    if (info.rejected.length > 0 && info.accepted.length === 0) {
      return {
        attempted: true,
        sent: false,
        provider: "nodemailer",
        message: `Email rejected for ${parsed.data.employeeEmail}.`,
        id: info.messageId,
      };
    }

    return {
      attempted: true,
      sent: true,
      provider: "nodemailer",
      id: info.messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email sending failed.";
    console.warn("[email] nodemailer password-reset exception", {
      email: parsed.data.employeeEmail,
      error: message,
    });

    return {
      attempted: true,
      sent: false,
      provider: "nodemailer",
      message,
    };
  }
}
