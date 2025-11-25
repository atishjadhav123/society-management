const nodemailer = require('nodemailer');

// Create transporter (configure with your email service)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Email templates - FIXED: Proper function structure
const emailTemplates = {
    'welcome-free-trial': (context) => ({
        subject: 'Welcome to SocietyPro - Verify Your Email',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .button { background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
                    .footer { text-align: center; padding: 20px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to SocietyPro!</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${context.name},</h2>
                        <p>Thank you for starting your 14-day free trial with SocietyPro!</p>
                        <p>You now have full access to all features to manage your housing society efficiently.</p>
                        
                        <p><strong>Your trial ends on:</strong> ${new Date(context.trialEndsAt).toLocaleDateString()}</p>
                        
                        <p>Please verify your email address to get started:</p>
                        <p style="text-align: center;">
                            <a href="${context.verificationLink}" class="button">Verify Email Address</a>
                        </p>
                        
                        <p><strong>What's next?</strong></p>
                        <ul>
                            <li>Complete your society profile setup</li>
                            <li>Invite committee members</li>
                            <li>Set up your first maintenance collection</li>
                            <li>Schedule a free onboarding call with our expert</li>
                        </ul>
                        
                        <p>Need help? Reply to this email or contact our support team.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} jatish933@gmail.com All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    }),
    'resend-verification': (context) => ({
        subject: 'Verify Your Email - SocietyPro',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #3B82F6; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f9f9f9; }
                    .button { background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; }
                    .footer { text-align: center; padding: 20px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Verify Your Email</h1>
                    </div>
                    <div class="content">
                        <h2>Hello ${context.name},</h2>
                        <p>We received a request to verify your email address for your SocietyPro account.</p>
                        
                        <p>Click the button below to verify your email:</p>
                        <p style="text-align: center;">
                            <a href="${context.verificationLink}" class="button">Verify Email Address</a>
                        </p>
                        
                        <p>If you didn't request this verification, you can safely ignore this email.</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} jatish933@gmail.com All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    })
};

exports.sendEmail = async ({ to, subject, template, context }) => {
    try {
        console.log(`📧 Attempting to send email to: ${to}, template: ${template}`);

        // Check if template exists
        if (!emailTemplates[template]) {
            console.error(`❌ Email template not found: ${template}`);
            throw new Error(`Email template '${template}' not found`);
        }

        const emailTemplate = emailTemplates[template](context);

        // Use provided subject or template subject
        const finalSubject = subject || emailTemplate.subject;

        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@societypro.com',
            to,
            subject: finalSubject,
            html: emailTemplate.html
        };

        console.log('📤 Sending email with options:', { to, subject: finalSubject });

        const result = await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}`);
        return result;

    } catch (error) {
        console.error('❌ Email sending error:', error.message);
        throw error;
    }
};