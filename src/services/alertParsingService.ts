import { TradingAlert } from '../types/alert';

export class AlertParsingService {
  /**
   * Parse incoming webhook data into a standardized TradingAlert format
   * Handles both JSON format and TradingView strategy text messages
   */
  static parseAlert(rawData: any): Omit<TradingAlert, 'timestamp'> | null {
    try {
      // If it's already a properly formatted JSON alert
      if (this.isValidJsonAlert(rawData)) {
        return this.parseJsonAlert(rawData);
      }

      // If it's a string message from TradingView strategy
      if (typeof rawData === 'string') {
        return this.parseTradingViewMessage(rawData);
      }

      // If it's an object but not in our expected format, try to extract what we can
      if (typeof rawData === 'object' && rawData !== null) {
        return this.parseGenericObject(rawData);
      }

      console.warn('Unable to parse alert data:', rawData);
      return null;
    } catch (error) {
      console.error('Error parsing alert:', error);
      return null;
    }
  }

  /**
   * Check if the data is a valid JSON alert format
   */
  private static isValidJsonAlert(data: any): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      typeof data.action === 'string' &&
      (data.action === 'BUY' || data.action === 'SELL') &&
      typeof data.symbol === 'string' &&
      typeof data.entry === 'string'
    );
  }

  /**
   * Parse a properly formatted JSON alert
   */
  private static parseJsonAlert(data: any): Omit<TradingAlert, 'timestamp'> {
    return {
      id: data.id || this.generateAlertId(),
      action: data.action.toUpperCase() as 'BUY' | 'SELL',
      symbol: data.symbol.toUpperCase(),
      timeframe: data.timeframe || '15',
      entry: data.entry,
      target: data.target,
      stop: data.stop,
      rr: data.rr,
      risk: data.risk,
      message: data.message,
      rawMessage: JSON.stringify(data),
      status: 'active'
    };
  }

  /**
   * Parse TradingView strategy text messages
   * Example: "26/7/2025 Fixed Target/Stop Logic VIDYA Strategy (...): order BUY @ 100 filled on EURUSD. New strategy position is 100"
   */
  private static parseTradingViewMessage(message: string): Omit<TradingAlert, 'timestamp'> | null {
    try {
      // Extract basic information using regex patterns
      const actionMatch = message.match(/order\s+(BUY|SELL)\s+@/i);
      const symbolMatch = message.match(/filled\s+on\s+([A-Z0-9]+)/i);
      const contractsMatch = message.match(/@\s+(\d+(?:\.\d+)?)\s+filled/i);
      const positionMatch = message.match(/position\s+is\s+([-]?\d+(?:\.\d+)?)/i);
      const strategyMatch = message.match(/^[\d\/\s]+(.+?Strategy.*?)(?:\s*\(|:)/i);

      if (!actionMatch || !symbolMatch) {
        console.warn('Could not extract required fields from TradingView message');
        return null;
      }

      const action = actionMatch[1].toUpperCase() as 'BUY' | 'SELL';
      const symbol = symbolMatch[1].toUpperCase();
      const contracts = contractsMatch ? contractsMatch[1] : '1';
      const position = positionMatch ? positionMatch[1] : contracts;
      const strategyName = strategyMatch ? strategyMatch[1].trim() : 'TradingView Strategy';

      // For TradingView messages, we'll use the contracts as entry price placeholder
      // In a real scenario, you'd want to get the actual price from the market data
      const entry = contracts;

      return {
        id: this.generateAlertId(),
        action,
        symbol,
        timeframe: '15', // Default timeframe
        entry,
        message: `${strategyName} - Position: ${position}`,
        rawMessage: message,
        strategyName,
        status: 'active'
      };
    } catch (error) {
      console.error('Error parsing TradingView message:', error);
      return null;
    }
  }

  /**
   * Parse generic object that might contain some useful fields
   */
  private static parseGenericObject(data: any): Omit<TradingAlert, 'timestamp'> | null {
    // Try to extract what we can from the object
    const action = this.extractAction(data);
    const symbol = this.extractSymbol(data);
    const entry = this.extractEntry(data);

    if (!action || !symbol || !entry) {
      return null;
    }

    return {
      id: data.id || this.generateAlertId(),
      action,
      symbol: symbol.toUpperCase(),
      timeframe: data.timeframe || data.tf || '15',
      entry,
      target: data.target || data.tp,
      stop: data.stop || data.sl,
      rr: data.rr || data.risk_reward,
      risk: data.risk,
      message: data.message || data.msg,
      rawMessage: JSON.stringify(data),
      status: 'active'
    };
  }

  /**
   * Extract action from various possible field names
   */
  private static extractAction(data: any): 'BUY' | 'SELL' | null {
    const actionFields = ['action', 'side', 'order_action', 'type'];
    
    for (const field of actionFields) {
      if (data[field]) {
        const value = data[field].toString().toUpperCase();
        if (value.includes('BUY') || value.includes('LONG')) return 'BUY';
        if (value.includes('SELL') || value.includes('SHORT')) return 'SELL';
      }
    }
    
    return null;
  }

  /**
   * Extract symbol from various possible field names
   */
  private static extractSymbol(data: any): string | null {
    const symbolFields = ['symbol', 'ticker', 'instrument', 'pair'];
    
    for (const field of symbolFields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field];
      }
    }
    
    return null;
  }

  /**
   * Extract entry price from various possible field names
   */
  private static extractEntry(data: any): string | null {
    const entryFields = ['entry', 'price', 'entry_price', 'fill_price', 'close'];
    
    for (const field of entryFields) {
      if (data[field]) {
        return data[field].toString();
      }
    }
    
    return null;
  }

  /**
   * Generate a unique alert ID
   */
  private static generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate that an alert has the minimum required fields
   */
  static validateAlert(alert: Partial<TradingAlert>): boolean {
    return !!(
      alert.action &&
      alert.symbol &&
      alert.entry &&
      (alert.action === 'BUY' || alert.action === 'SELL')
    );
  }
}