import { ConfidentialClientApplication } from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient() {
  if (msalClient) return msalClient;

  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Missing Azure AD configuration");
  }

  msalClient = new ConfidentialClientApplication({
    auth: {
      clientId,
      clientSecret,
      authority: `https://login.microsoftonline.com/${tenantId}`,
    },
  });

  return msalClient;
}

async function getGraphClient() {
  const client = getMsalClient();

  const tokenResponse = await client.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });

  if (!tokenResponse?.accessToken) {
    throw new Error("Failed to acquire access token");
  }

  return Client.init({
    authProvider: (done) => {
      done(null, tokenResponse.accessToken);
    },
  });
}

interface SendEmailOptions {
  to: string;
  subject: string;
  body: string;
  from?: string;
}

export async function sendEmail({ to, subject, body, from }: SendEmailOptions) {
  // If Azure AD is not configured, log the email and return
  if (!process.env.AZURE_AD_CLIENT_ID) {
    console.log("Email would be sent (Azure AD not configured):");
    console.log({ to, subject, body });
    return { success: true, message: "Email logged (not sent - no Azure AD config)" };
  }

  const graphClient = await getGraphClient();

  const message = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: to,
          },
        },
      ],
    },
    saveToSentItems: true,
  };

  // Send from specified email or service account
  const senderEmail = from || process.env.LISTINGS_TEAM_EMAIL;

  await graphClient.api(`/users/${senderEmail}/sendMail`).post(message);

  return { success: true };
}

export function buildApprovalEmail(data: {
  listingAddress: string;
  listingId: string;
  approverName: string;
  photoCount: number;
  baseUrl: string;
}) {
  const viewUrl = `${data.baseUrl}/listing/${data.listingId}`;
  const downloadUrl = `${data.baseUrl}/api/listings/${data.listingId}/downloads`;

  const subject = `Photo Arrangement Approved: ${data.listingAddress}`;

  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #002349; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .details { margin: 20px 0; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; width: 120px; color: #6b7280; }
        .detail-value { color: #111827; }
        .button { display: inline-block; background-color: #002349; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; margin-right: 10px; }
        .button-secondary { background-color: #6b7280; }
        .success-icon { font-size: 48px; margin-bottom: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">✓ Listing Approved</h1>
        </div>
        <div class="content">
          <p>Great news! The photo arrangement has been reviewed and approved.</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Property:</span>
              <span class="detail-value">${data.listingAddress}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Photos:</span>
              <span class="detail-value">${data.photoCount} photos approved</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Reviewed by:</span>
              <span class="detail-value">${data.approverName}</span>
            </div>
          </div>

          <a href="${viewUrl}" class="button">View Photos</a>

          <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
            This email was sent from PhotoMagic. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function buildProposalEmail(data: {
  address: string;
  advisorName: string;
  photoCount: number;
  listingId: string;
  baseUrl: string;
  note?: string;
}) {
  const viewUrl = `${data.baseUrl}/listing/${data.listingId}`;
  const greeting = data.advisorName ? `Hi ${data.advisorName},` : "Hi,";
  const noteSection = data.note
    ? `<p style="margin-top: 16px; padding: 12px; background-color: #f3f4f6; border-left: 4px solid #002349; border-radius: 4px;"><strong>Note:</strong> ${data.note}</p>`
    : "";

  const subject = `PhotoMagic Order Proposal: ${data.address}`;

  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #002349; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #002349; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 10px; }
        ul { padding-left: 20px; }
        li { margin-bottom: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">PhotoMagic Order Proposal</h1>
        </div>
        <div class="content">
          <p>${greeting}</p>

          <p>Your PhotoMagic gallery for <strong>${data.address}</strong> is ready for review.</p>

          ${noteSection}

          <p><strong>A few quick steps:</strong></p>
          <ul>
            <li>Easily reorganize photos by dragging and dropping photos to change the order from your computer or phone.</li>
            <li>See a photo you don't want to use? Click the red X to move it to the Do Not Use folder, which will be added to Egnyte.</li>
            <li>When you're finished, click Approved.</li>
          </ul>

          <p>Once approved, our PhotoMagic team will download the images to Egnyte and alert our Listings team.</p>

          <a href="${viewUrl}" class="button">Review Gallery</a>

          <p style="margin-top: 30px;">Thank you!</p>

          <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
            This email was sent from PhotoMagic. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function buildChangesRequestedEmail(data: {
  address: string;
  reviewerName: string;
  note?: string;
  listingId: string;
  baseUrl: string;
}) {
  const viewUrl = `${data.baseUrl}/listing/${data.listingId}`;

  const subject = `Changes Requested: ${data.address}`;

  const noteSection = data.note
    ? `
          <div class="detail-row">
            <span class="detail-label">Note:</span>
            <span class="detail-value">${data.note}</span>
          </div>`
    : "";

  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #d97706; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .details { margin: 20px 0; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; width: 120px; color: #6b7280; }
        .detail-value { color: #111827; }
        .button { display: inline-block; background-color: #d97706; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">Changes Requested</h1>
        </div>
        <div class="content">
          <p>Changes have been requested on the photo order submission.</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Property:</span>
              <span class="detail-value">${data.address}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Reviewed by:</span>
              <span class="detail-value">${data.reviewerName}</span>
            </div>${noteSection}
          </div>

          <a href="${viewUrl}" class="button">View Listing</a>

          <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
            This email was sent from PhotoMagic. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}

export function buildSubmissionEmail(data: {
  listingAddress: string;
  listingId: string;
  submitterName: string;
  submitterEmail: string;
  photoCount: number;
  baseUrl: string;
}) {
  const reviewUrl = `${data.baseUrl}/admin/submissions/${data.listingId}`;

  const subject = `New Photo Arrangement: ${data.listingAddress}`;

  const body = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #C9A441; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .details { margin: 20px 0; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
        .detail-label { font-weight: 600; width: 120px; color: #6b7280; }
        .detail-value { color: #111827; }
        .button { display: inline-block; background-color: #C9A441; color: white !important; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-top: 20px; }
        .button:hover { background-color: #B18A35; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0; font-size: 24px;">New Photo Arrangement</h1>
        </div>
        <div class="content">
          <p>A new photo arrangement has been submitted for review.</p>

          <div class="details">
            <div class="detail-row">
              <span class="detail-label">Property:</span>
              <span class="detail-value">${data.listingAddress}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Submitted by:</span>
              <span class="detail-value">${data.submitterName} (${data.submitterEmail})</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Photos:</span>
              <span class="detail-value">${data.photoCount} photos</span>
            </div>
          </div>

          <a href="${reviewUrl}" class="button">Review Submission</a>

          <p style="margin-top: 30px; font-size: 14px; color: #6b7280;">
            This email was sent from PhotoMagic. Please do not reply directly to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return { subject, body };
}
