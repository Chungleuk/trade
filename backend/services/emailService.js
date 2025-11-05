import { logger } from '../utils/logger.js';

export class EmailService {
  constructor() {
    this.web3FormsKey = process.env.WEB3FORMS_ACCESS_KEY || 'a2927d87-5196-4690-a8dc-d06dcb7634f8';
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

      // Try Web3Forms first
      const success = await this.sendViaWeb3Forms(emailContent);
      if (success) return true;

      // Fallback to Formspree
      return await this.sendViaFormspree(emailContent);
    } catch (error) {
      logger.error('Error sending immediate alert email:', error);
      return false;
    }
  }


  /**
   * Send via Web3Forms
   */
  async sendViaWeb3Forms(emailContent) {
    try {
      // Use URLSearchParams for Node.js compatibility
      const formData = new URLSearchParams();
      formData.append('access_key', this.web3FormsKey);
      formData.append('email', this.recipientEmail);
      formData.append('subject', emailContent.subject);
      formData.append('message', emailContent.html);
      formData.append('from_name', 'TradingView Alert System');

      const response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      const data = await response.json();

      if (response.ok && data.success) {
        logger.info('✅ Email sent successfully via Web3Forms');
        return true;
      } else {
        logger.warn('❌ Web3Forms error:', data);
        return false;
      }
    } catch (error) {
      logger.error('❌ Web3Forms request failed:', error);
      return false;
    }
  }

  /**
   * Send via Formspree (fallback)
   */
  async sendViaFormspree(emailContent) {
    try {
      const formspreeUrl = process.env.FORMSPREE_URL || 'https://formspree.io/f/xpznvqko';
      
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
          <p><strong>Entry:</strong> ${alert.entry}</p>
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
Entry: ${alert.entry}
Target: ${alert.target || 'N/A'}
Stop: ${alert.stop || 'N/A'}
Risk: ${alert.risk || '0.65%'}
Timeframe: ${alert.timeframe || '15'}m
Time: ${new Date().toLocaleString()}
    `.trim();
  }

}

