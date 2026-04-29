import { logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    this.recipientEmail = process.env.ALERT_EMAIL || 'leechungleuk@gmail.com';
  }

  /**
   * Send immediate alert email (first email)
   */
  async sendImmediateAlert(alert) {
    try {
      const emailContent = {
        subject: `📧 FIRST EMAIL - 🚨 Trading Alert: ${alert.action} ${alert.symbol}`,
        html: this.generateImmediateAlertHTML(alert),
        text: this.generateImmediateAlertText(alert)
      };

      return await this.sendViaFormspree(emailContent);
    } catch (error) {
      logger.error('Error sending immediate alert email:', error);
      return false;
    }
  }

  /**
   * Send via Formspree
   */
  async sendViaFormspree(emailContent) {
    try {
      const formspreeUrl = process.env.FORMSPREE_URL || '';
      if (!formspreeUrl || !formspreeUrl.includes('formspree.io')) {
        logger.warn('FORMSPREE_URL not set or invalid. Create a form at formspree.io and set FORMSPREE_URL env var.');
        return false;
      }
      
      const response = await fetch(formspreeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          email: this.recipientEmail,
          subject: emailContent.subject,
          message: emailContent.text,
          _replyto: this.recipientEmail,
          _subject: emailContent.subject
        })
      });

      if (response.ok) {
        logger.info('✅ Email sent successfully via Formspree');
        return true;
      } else {
        logger.warn('❌ Formspree error:', await response.text());
        return false;
      }
    } catch (error) {
      logger.error('❌ Formspree request failed:', error);
      return false;
    }
  }

  /**
   * Generate immediate alert HTML
   */
  generateImmediateAlertHTML(alert) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🚨 NEW TRADING ALERT 🚨</h2>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
          <p><strong>Action:</strong> ${alert.action}</p>
          <p><strong>Symbol:</strong> ${alert.symbol}</p>
          <p><strong>Entry:</strong> ${alert.entry !== '' && alert.entry != null ? alert.entry : 'N/A'}</p>
          <p><strong>Target:</strong> ${alert.target || 'N/A'}</p>
          <p><strong>Stop:</strong> ${alert.stop || 'N/A'}</p>
          <p><strong>Risk:</strong> ${alert.risk || '0.65%'}</p>
          <p><strong>Timeframe:</strong> ${alert.timeframe || '15'}m</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;
  }

  /**
   * Generate immediate alert text
   */
  generateImmediateAlertText(alert) {
    return `
🚨 NEW TRADING ALERT 🚨

Action: ${alert.action}
Symbol: ${alert.symbol}
Entry: ${alert.entry !== '' && alert.entry != null ? alert.entry : 'N/A'}
Target: ${alert.target || 'N/A'}
Stop: ${alert.stop || 'N/A'}
Risk: ${alert.risk || '0.65%'}
Timeframe: ${alert.timeframe || '15'}m
Time: ${new Date().toLocaleString()}
    `.trim();
  }

}

