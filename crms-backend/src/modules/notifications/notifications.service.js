const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'CRMS Notifications <pavanibandarupalli58@gmail.com>';

let transporter = null;

async function initTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  try {
    const configuredTransporter = await initTransporter();
    if (!configuredTransporter) {
      console.warn('Email notification skipped: SMTP is not configured.');
      return null;
    }
    return await configuredTransporter.sendMail({ from: SMTP_FROM, to, subject, html });
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
    return null;
  }
}

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return new Date(timeStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

async function notifyRequesterNewBooking(booking, user) {
  if (!user?.email) return;
  const statusHtml = booking.status === 'Approved'
    ? '<b>Approved</b> (Auto-approved as you are the resource owner)'
    : '<b>Pending</b> (Waiting for approval)';
  await sendEmail({
    to: user.email,
    subject: `CRMS: Booking Request ${booking.status} - ${booking.resource?.resourceName || ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #0f2c59; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">Booking Request Received</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #333333;">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${escapeHtml(user.name)}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5;">Your booking request for <strong>${escapeHtml(booking.resource?.resourceName)}</strong> has been successfully received by the CRMS system.</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid #0f2c59; padding: 15px; margin: 25px 0;">
            <p style="margin: 5px 0; font-size: 14px;"><strong>Booking ID:</strong> <span style="font-family: monospace;">${booking.bookingId}</span></p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Date:</strong> ${formatDate(booking.bookingDate)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Time:</strong> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Purpose:</strong> ${escapeHtml(booking.purpose)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Status:</strong> ${statusHtml}</p>
          </div>
          
          <p style="font-size: 14px; color: #666666; margin-bottom: 0;">Thank you,<br/><strong>VNRVJIET CRMS Team</strong></p>
        </div>
      </div>
    `,
  });
}

async function notifyApproverActionRequired(booking, approverUser) {
  if (!approverUser?.email) return;
  await sendEmail({
    to: approverUser.email,
    subject: `CRMS: Action Required - Booking Request for ${booking.resource?.resourceName || ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #d97706; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">Action Required</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #333333;">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${escapeHtml(approverUser.name)}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5;">A new booking request requires your approval.</p>
          
          <div style="background-color: #fdf6e3; border-left: 4px solid #d97706; padding: 15px; margin: 25px 0;">
            <p style="margin: 5px 0; font-size: 14px;"><strong>Resource:</strong> ${escapeHtml(booking.resource?.resourceName)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Date:</strong> ${formatDate(booking.bookingDate)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Time:</strong> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Purpose:</strong> ${escapeHtml(booking.purpose)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Requester:</strong> ${escapeHtml(booking.requesterUser?.name || 'Unknown')}</p>
          </div>
          
          <p style="font-size: 15px; text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'https://dev-crms.vjstartup.com'}/admin/approvals" style="background-color: #0f2c59; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Review Request in CRMS</a>
          </p>
          
          <p style="font-size: 14px; color: #666666; margin-bottom: 0;">Thank you,<br/><strong>VNRVJIET CRMS Team</strong></p>
        </div>
      </div>
    `,
  });
}

async function notifyRequesterDecision(booking, approverUser, decision, remarks) {
  if (!booking.requesterUser?.email) return;
  const color = decision === 'Approved' ? 'green' : 'red';
  const remarksHtml = remarks ? `<p><b>Remarks:</b> ${escapeHtml(remarks)}</p>` : '';
  const bgColor = decision === 'Approved' ? '#16a34a' : '#dc2626';
  await sendEmail({
    to: booking.requesterUser.email,
    subject: `CRMS: Booking ${decision} - ${booking.resource?.resourceName || ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: ${bgColor}; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 24px;">Booking ${escapeHtml(decision)}</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff; color: #333333;">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${escapeHtml(booking.requesterUser.name)}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.5;">Your booking request for <strong>${escapeHtml(booking.resource?.resourceName)}</strong> has been <strong style="color: ${color};">${escapeHtml(decision.toLowerCase())}</strong> by ${escapeHtml(approverUser?.name || 'an Administrator')}.</p>
          
          <div style="background-color: #f8f9fa; border-left: 4px solid ${bgColor}; padding: 15px; margin: 25px 0;">
            <p style="margin: 5px 0; font-size: 14px;"><strong>Date:</strong> ${formatDate(booking.bookingDate)}</p>
            <p style="margin: 5px 0; font-size: 14px;"><strong>Time:</strong> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</p>
            ${remarks ? `<p style="margin: 10px 0 5px; font-size: 14px; border-top: 1px dashed #ccc; padding-top: 10px;"><strong>Remarks:</strong> ${escapeHtml(remarks)}</p>` : ''}
          </div>
          
          <p style="font-size: 14px; color: #666666; margin-bottom: 0;">Thank you,<br/><strong>VNRVJIET CRMS Team</strong></p>
        </div>
      </div>
    `,
  });
}

module.exports = { notifyRequesterNewBooking, notifyApproverActionRequired, notifyRequesterDecision };
