import nodemailer from "nodemailer";

export async function dispatchApprovedEmail(input: {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromName: string | null;
  fromEmail: string;
  replyToEmail: string;
  to: string;
  subject: string;
  body: string;
  complianceFooter: string;
}) {
  const transporter = nodemailer.createTransport({
    host: input.host,
    port: input.port,
    secure: input.secure,
    auth: { user: input.username, pass: input.password },
  });
  const result = await transporter.sendMail({
    from: { name: input.fromName || undefined, address: input.fromEmail },
    to: input.to,
    replyTo: input.replyToEmail,
    subject: input.subject,
    text: `${input.body}${input.complianceFooter}`,
  });
  return result.messageId;
}
