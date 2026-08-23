import { isProd } from "../env";

// Minimal mailer abstraction. Defaults to a console driver so password-reset
// and staff-invite flows work out of the box in development without SMTP
// credentials. Swap sendMail()'s body for nodemailer/SES/Postmark/etc. in
// production by setting real SMTP_* env vars and wiring them here.
export async function sendMail(input: { to: string; subject: string; text: string }) {
  if (isProd) {
    console.warn(
      "[mailer] No production email driver configured. Wire SMTP/SES/Postmark in src/lib/mailer.ts."
    );
  }
  console.log(`\n----- EMAIL (${isProd ? "PROD-UNCONFIGURED" : "DEV"}) -----`);
  console.log(`To: ${input.to}`);
  console.log(`Subject: ${input.subject}`);
  console.log(input.text);
  console.log("-----------------------------\n");
}
