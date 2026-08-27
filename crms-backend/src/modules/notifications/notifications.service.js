const nodemailer = require('nodemailer');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || 'CRMS Notifications <no-reply@crms.vnrvjiet.ac.in>';

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
    html: `<h2>Booking Request Received</h2><p>Hi ${escapeHtml(user.name)},</p><p>Your booking request for <b>${escapeHtml(booking.resource?.resourceName)}</b> has been received.</p><ul><li><b>Booking ID:</b> ${booking.bookingId}</li><li><b>Date:</b> ${formatDate(booking.bookingDate)}</li><li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li><li><b>Status:</b> ${statusHtml}</li></ul><p>Thank you,</p><p>CRMS Team</p>`,
  });
}

async function notifyApproverActionRequired(booking, approverUser) {
  if (!approverUser?.email) return;
  await sendEmail({
    to: approverUser.email,
    subject: `CRMS: Action Required - Booking Request for ${booking.resource?.resourceName || ''}`,
    html: `<h2>Action Required: New Booking Request</h2><p>Hi ${escapeHtml(approverUser.name)},</p><p>A new booking request requires your approval.</p><ul><li><b>Resource:</b> ${escapeHtml(booking.resource?.resourceName)}</li><li><b>Date:</b> ${formatDate(booking.bookingDate)}</li><li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li><li><b>Purpose:</b> ${escapeHtml(booking.purpose)}</li></ul><p>Please log in to the CRMS Admin Dashboard to approve or reject this request.</p><p>Thank you,</p><p>CRMS Team</p>`,
  });
}

async function notifyRequesterDecision(booking, approverUser, decision, remarks) {
  if (!booking.requesterUser?.email) return;
  const color = decision === 'Approved' ? 'green' : 'red';
  const remarksHtml = remarks ? `<p><b>Remarks:</b> ${escapeHtml(remarks)}</p>` : '';
  await sendEmail({
    to: booking.requesterUser.email,
    subject: `CRMS: Booking ${decision} - ${booking.resource?.resourceName || ''}`,
    html: `<h2>Booking ${escapeHtml(decision)}</h2><p>Hi ${escapeHtml(booking.requesterUser.name)},</p><p>Your booking request for <b>${escapeHtml(booking.resource?.resourceName)}</b> has been <strong style="color: ${color};">${escapeHtml(decision.toLowerCase())}</strong> by ${escapeHtml(approverUser?.name)}.</p><ul><li><b>Date:</b> ${formatDate(booking.bookingDate)}</li><li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li></ul>${remarksHtml}<p>Thank you,</p><p>CRMS Team</p>`,
  });
}

module.exports = { notifyRequesterNewBooking, notifyApproverActionRequired, notifyRequesterDecision };
