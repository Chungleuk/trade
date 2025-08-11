// Simple webhook service for low-traffic scenarios
export class WebhookService {
  private static readonly WEBHOOK_SITE_URL = 'https://webhook.site';
  private static webhookId: string | null = null;

  // Generate a unique webhook URL using webhook.site
  static async generateWebhookUrl(): Promise<string> {
    try {
      // Create a new webhook endpoint
      const response = await fetch(`${this.WEBHOOK_SITE_URL}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to create webhook endpoint');
      }
      
      const data = await response.json();
      this.webhookId = data.uuid;
      
      return `${this.WEBHOOK_SITE_URL}/${this.webhookId}`;
    } catch (error) {
      console.error('Error generating webhook URL:', error);
      // Fallback to a static webhook URL
      return `${this.WEBHOOK_SITE_URL}/unique-id-${Date.now()}`;
    }
  }

  // Poll for new webhook requests
  static async pollForNewAlerts(): Promise<any[]> {
    if (!this.webhookId) {
      return [];
    }

    try {
      const response = await fetch(`${this.WEBHOOK_SITE_URL}/token/${this.webhookId}/requests`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch webhook requests');
      }

      const requests = await response.json();
      
      // Filter for POST requests with content
      return requests.data
        .filter((req: any) => req.method === 'POST' && req.content)
        .map((req: any) => ({
          content: req.content,
          timestamp: req.created_at,
          headers: req.headers,
        }));
    } catch (error) {
      console.error('Error polling for alerts:', error);
      return [];
    }
  }

  // Alternative: Use a simple form-based approach
  static getFormBasedWebhookUrl(): string {
    // Use a service like Formspree, Netlify Forms, or similar
    return 'https://formspree.io/f/your-form-id';
  }
}