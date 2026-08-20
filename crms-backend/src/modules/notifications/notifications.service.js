const nodemailer = require('nodemailer');

// We will use a singleton pattern to cache the transport and test account
let transporter = null;
let testAccount = null;

async function initTransporter() {
  if (transporter) return transporter;

  try {
    // Generate test SMTP service account from ethereal.email
    // Only needed if you don't have a real mail account for testing
    testAccount = await nodemailer.createTestAccount();
    
    // create reusable transporter object using the default SMTP transport
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user, // generated ethereal user
        pass: testAccount.pass, // generated ethereal password
      },
    });

    console.log('✉️ Ethereal Email SMTP service initialized.');
    return transporter;
  } catch (err) {
    console.error('Failed to initialize Ethereal Email transport:', err);
    throw err;
  }
}

async function sendEmail({ to, subject, html }) {
  try {
    const t = await initTransporter();
    const info = await t.sendMail({
      from: '"CRMS Notifications" <no-reply@crms.vnrvjiet.ac.in>', // sender address
      to, // list of receivers
      subject, // Subject line
      html, // html body
    });

    console.log('✉️ Email sent to: %s', to);
    console.log('✉️ Preview URL: %s', nodemailer.getTestMessageUrl(info));
    return info;
  } catch (err) {
    console.error(`Failed to send email to ${to}:`, err);
    // Don't throw - we don't want booking creation to fail if email fails
  }
}

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  const d = new Date(timeStr);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Notifies the requester when their booking is created
 */
async function notifyRequesterNewBooking(booking, user) {
  if (!user || !user.email) return;
  
  const statusHtml = booking.status === 'Approved' 
    ? '<b>Approved</b> (Auto-approved as you are the resource owner)'
    : '<b>Pending</b> (Waiting for approval)';

  const html = `
    <h2>Booking Request Received</h2>
    <p>Hi ${user.name},</p>
    <p>Your booking request for <b>${booking.resource?.resourceName}</b> has been received.</p>
    <ul>
      <li><b>Booking ID:</b> ${booking.bookingId}</li>
      <li><b>Date:</b> ${formatDate(booking.bookingDate)}</li>
      <li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li>
      <li><b>Status:</b> ${statusHtml}</li>
    </ul>
    <p>Thank you,</p>
    <p>CRMS Team</p>
  `;

  await sendEmail({
    to: user.email,
    subject: `CRMS: Booking Request ${booking.status} - ${booking.resource?.resourceName}`,
    html,
  });
}

/**
 * Notifies the approver that they have a new pending request
 */
async function notifyApproverActionRequired(booking, approverUser) {
  if (!approverUser || !approverUser.email) return;

  const html = `
    <h2>Action Required: New Booking Request</h2>
    <p>Hi ${approverUser.name},</p>
    <p>A new booking request requires your approval.</p>
    <ul>
      <li><b>Resource:</b> ${booking.resource?.resourceName}</li>
      <li><b>Date:</b> ${formatDate(booking.bookingDate)}</li>
      <li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li>
      <li><b>Purpose:</b> ${booking.purpose}</li>
    </ul>
    <p>Please log in to the CRMS Admin Dashboard to approve or reject this request.</p>
    <p>Thank you,</p>
    <p>CRMS Team</p>
  `;

  await sendEmail({
    to: approverUser.email,
    subject: `CRMS: Action Required - Booking Request for ${booking.resource?.resourceName}`,
    html,
  });
}

/**
 * Notifies the requester when their booking is approved or rejected
 */
async function notifyRequesterDecision(booking, approverUser, decision, remarks) {
  // We need the requester's email. We assume booking.requesterUser is populated or fetched.
  if (!booking.requesterUser || !booking.requesterUser.email) return;

  const color = decision === 'Approved' ? 'green' : 'red';
  const remarksHtml = remarks ? `<p><b>Remarks:</b> ${remarks}</p>` : '';

  const html = `
    <h2>Booking ${decision}</h2>
    <p>Hi ${booking.requesterUser.name},</p>
    <p>Your booking request for <b>${booking.resource?.resourceName}</b> has been <strong style="color: ${color};">${decision.toLowerCase()}</strong> by ${approverUser.name}.</p>
    <ul>
      <li><b>Date:</b> ${formatDate(booking.bookingDate)}</li>
      <li><b>Time:</b> ${formatTime(booking.startTime)} to ${formatTime(booking.endTime)}</li>
    </ul>
    ${remarksHtml}
    <p>Thank you,</p>
    <p>CRMS Team</p>
  `;

  await sendEmail({
    to: booking.requesterUser.email,
    subject: `CRMS: Booking ${decision} - ${booking.resource?.resourceName}`,
    html,
  });
}

module.exports = {
  notifyRequesterNewBooking,
  notifyApproverActionRequired,
  notifyRequesterDecision,
};
