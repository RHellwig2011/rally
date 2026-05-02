/**
 * Email templates for donation-related communications
 */

export interface DonationConfirmationData {
  toEmail: string;
  donorName: string;
  campaignName: string;
  amount: number;
  teamMemberName?: string;
  message?: string;
  donationId?: string;
  date?: Date;
}

export interface DonationReceiptData {
  toEmail: string;
  donorName: string;
  campaignName: string;
  organizationName: string;
  amount: number;
  donationId: string;
  donationDate: Date;
  taxDeductible: boolean;
  platformFee?: number;
  netAmount?: number;
}

/**
 * Generate HTML email template for donation confirmation
 */
export function getDonationConfirmationTemplate(data: DonationConfirmationData): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(data.amount);

  const donationDate = data.date || new Date();
  const formattedDate = donationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You for Your Donation!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f7f7f7;
    }
    .container {
      background-color: white;
      border-radius: 8px;
      padding: 40px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .logo {
      width: 60px;
      height: 60px;
      background-color: #3b82f6;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 20px;
    }
    .logo-text {
      color: white;
      font-size: 24px;
      font-weight: bold;
    }
    h1 {
      color: #1f2937;
      font-size: 28px;
      margin: 0;
    }
    .success-badge {
      background-color: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      display: inline-block;
      font-size: 14px;
      margin-top: 10px;
    }
    .amount-box {
      background-color: #f3f4f6;
      border-radius: 8px;
      padding: 20px;
      margin: 30px 0;
      text-align: center;
    }
    .amount {
      font-size: 36px;
      font-weight: bold;
      color: #3b82f6;
      margin: 0;
    }
    .details {
      margin: 30px 0;
    }
    .detail-row {
      display: flex;
      justify-between;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .detail-label {
      color: #6b7280;
    }
    .detail-value {
      font-weight: 600;
      color: #1f2937;
    }
    .message-box {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      padding: 15px;
      margin: 20px 0;
      font-style: italic;
    }
    .footer {
      margin-top: 40px;
      padding-top: 30px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
    .button {
      display: inline-block;
      background-color: #3b82f6;
      color: white;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
    }
    .tax-notice {
      background-color: #fef3c7;
      border: 1px solid #fbbf24;
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">
        <span class="logo-text">BB</span>
      </div>
      <h1>Thank You, ${data.donorName}!</h1>
      <div class="success-badge">Donation Successful</div>
    </div>

    <div class="amount-box">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">Your generous donation of</p>
      <p class="amount">${formattedAmount}</p>
      <p style="margin: 0; color: #6b7280; font-size: 14px;">has been received</p>
    </div>

    <div class="details">
      <div class="detail-row">
        <span class="detail-label">Campaign:</span>
        <span class="detail-value">${data.campaignName}</span>
      </div>
      ${data.teamMemberName ? `
      <div class="detail-row">
        <span class="detail-label">Supporting:</span>
        <span class="detail-value">${data.teamMemberName}</span>
      </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Date:</span>
        <span class="detail-value">${formattedDate}</span>
      </div>
      ${data.donationId ? `
      <div class="detail-row">
        <span class="detail-label">Confirmation #:</span>
        <span class="detail-value">${data.donationId}</span>
      </div>
      ` : ''}
    </div>

    ${data.message ? `
    <div class="message-box">
      <strong>Your message:</strong><br>
      "${data.message}"
    </div>
    ` : ''}

    <div class="tax-notice">
      <strong>📋 Tax Information:</strong><br>
      This donation may be tax-deductible. Please keep this email for your records.
      A formal tax receipt will be sent separately if applicable.
    </div>

    <div style="text-align: center; margin-top: 30px;">
      <p style="color: #6b7280;">Want to make an even bigger impact?</p>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/raise/${data.campaignName}" class="button">
        Share This Campaign
      </a>
    </div>

    <div class="footer">
      <p>Thank you for supporting ${data.campaignName} through Bleacher Backers!</p>
      <p>Your generosity makes a real difference.</p>
      <p style="margin-top: 20px;">
        Bleacher Backers<br>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}" style="color: #3b82f6;">www.bleacherbackers.com</a>
      </p>
      <p style="font-size: 12px; margin-top: 20px;">
        You received this email because a donation was made using your email address.<br>
        If you did not make this donation, please contact us immediately.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate HTML email template for donation receipt (formal tax receipt)
 */
export function getDonationReceiptTemplate(data: DonationReceiptData): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(data.amount);

  const formattedDate = data.donationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const formattedTime = data.donationDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Donation Receipt</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      color: #000;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      background-color: white;
    }
    .receipt-header {
      border-bottom: 2px solid #000;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .receipt-title {
      font-size: 24px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 10px;
    }
    .receipt-subtitle {
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .receipt-body {
      margin: 30px 0;
    }
    .field-group {
      margin-bottom: 20px;
    }
    .field-label {
      font-weight: bold;
      display: inline-block;
      width: 150px;
    }
    .field-value {
      display: inline-block;
    }
    .amount-section {
      background-color: #f0f0f0;
      padding: 20px;
      margin: 30px 0;
      border: 1px solid #ccc;
    }
    .amount-large {
      font-size: 32px;
      font-weight: bold;
      text-align: center;
    }
    .tax-section {
      border: 2px solid #000;
      padding: 20px;
      margin: 30px 0;
    }
    .signature-section {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 12px;
      color: #666;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <div class="receipt-header">
    <div class="receipt-title">OFFICIAL DONATION RECEIPT</div>
    <div class="receipt-subtitle">For Income Tax Purposes</div>
  </div>

  <div class="receipt-body">
    <div class="field-group">
      <span class="field-label">Receipt Number:</span>
      <span class="field-value">${data.donationId}</span>
    </div>

    <div class="field-group">
      <span class="field-label">Date Issued:</span>
      <span class="field-value">${formattedDate}</span>
    </div>

    <div class="field-group">
      <span class="field-label">Donation Date:</span>
      <span class="field-value">${formattedDate} at ${formattedTime}</span>
    </div>

    <h3>DONOR INFORMATION</h3>
    <div class="field-group">
      <span class="field-label">Name:</span>
      <span class="field-value">${data.donorName}</span>
    </div>

    <div class="field-group">
      <span class="field-label">Email:</span>
      <span class="field-value">${data.toEmail}</span>
    </div>

    <h3>RECIPIENT INFORMATION</h3>
    <div class="field-group">
      <span class="field-label">Organization:</span>
      <span class="field-value">${data.organizationName}</span>
    </div>

    <div class="field-group">
      <span class="field-label">Campaign:</span>
      <span class="field-value">${data.campaignName}</span>
    </div>

    <div class="amount-section">
      <div class="field-group">
        <span class="field-label">Donation Amount:</span>
        <span class="field-value">${formattedAmount}</span>
      </div>
      ${data.platformFee ? `
      <div class="field-group">
        <span class="field-label">Platform Fee:</span>
        <span class="field-value">$${(data.platformFee / 100).toFixed(2)}</span>
      </div>
      ` : ''}
      ${data.netAmount ? `
      <div class="field-group">
        <span class="field-label">Amount to Campaign:</span>
        <span class="field-value">$${(data.netAmount / 100).toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="amount-large">${formattedAmount}</div>
    </div>

    ${data.taxDeductible ? `
    <div class="tax-section">
      <h3>TAX DEDUCTIBLE DONATION</h3>
      <p>
        This is to acknowledge that we have received your generous donation of ${formattedAmount}.
        ${data.organizationName} is a registered 501(c)(3) nonprofit organization.
        No goods or services were provided in exchange for this donation.
      </p>
      <p>
        <strong>Tax ID Number:</strong> XX-XXXXXXX<br>
        <strong>Deductible Amount:</strong> ${formattedAmount}
      </p>
    </div>
    ` : ''}

    <div class="signature-section">
      <p>Thank you for your generous support!</p>
      <br>
      <p>
        _____________________________<br>
        Authorized Signature<br>
        Bleacher Backers<br>
        ${new Date().toLocaleDateString()}
      </p>
    </div>
  </div>

  <div class="footer">
    <p>
      <strong>Bleacher Backers</strong><br>
      Email: support@bleacherbackers.com<br>
      Website: ${process.env.NEXT_PUBLIC_APP_URL}
    </p>
    <p>
      This receipt is an official document for tax purposes. Please retain for your records.<br>
      Receipt ID: ${data.donationId}<br>
      Generated on: ${new Date().toISOString()}
    </p>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email for donation confirmation
 */
export function getDonationConfirmationText(data: DonationConfirmationData): string {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(data.amount);

  const donationDate = data.date || new Date();
  const formattedDate = donationDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
Thank You, ${data.donorName}!

Your generous donation of ${formattedAmount} has been successfully received.

DONATION DETAILS:
-----------------
Campaign: ${data.campaignName}
${data.teamMemberName ? `Supporting: ${data.teamMemberName}\n` : ''}Date: ${formattedDate}
${data.donationId ? `Confirmation #: ${data.donationId}\n` : ''}
${data.message ? `\nYour message:\n"${data.message}"\n` : ''}

TAX INFORMATION:
----------------
This donation may be tax-deductible. Please keep this email for your records.
A formal tax receipt will be sent separately if applicable.

Want to make an even bigger impact? Share this campaign:
${process.env.NEXT_PUBLIC_APP_URL}/raise/${data.campaignName}

Thank you for supporting ${data.campaignName} through Bleacher Backers!
Your generosity makes a real difference.

--
Bleacher Backers
${process.env.NEXT_PUBLIC_APP_URL}

You received this email because a donation was made using your email address.
If you did not make this donation, please contact us immediately.
  `;
}