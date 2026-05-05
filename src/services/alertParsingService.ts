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
    if (typeof data !== 'object' || data === null) return false;
    if (typeof data.action !== 'string' || (data.action !== 'BUY' && data.action !== 'SELL')) return false;
    if (typeof data.symbol !== 'string') return false;
    if (
      data.entry != null &&
      typeof data.entry !== 'string' &&
      typeof data.entry !== 'number'
    ) {
      return false;
    }
    return true;
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
      entry: data.entry != null ? String(data.entry) : '',
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

    if (!action || !symbol) {
      return null;
    }

    return {
      id: data.id || this.generateAlertId(),
      action,
      symbol: symbol.toUpperCase(),
      timeframe: data.timeframe || data.tf || '15',
      entry: entry ?? '',
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
   * Generate a unique alert ID (for new alerts / manual entry)
   */
  static generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /** True for alerts created via the Manual signal form (message is stored with this prefix). */
  static isManualEntryAlert(alert: { message?: string }): boolean {
    return (alert.message ?? '').trimStart().startsWith('Manual signal');
  }

  /**
   * Parse analyst-style multi-line pastes, e.g.
   * "XAUUSD, 29/4/2026\nSELL\nTarget: 4633.418\nStop Loss: 4670.115"
   */
  static parseManualPaste(text: string): {
    symbol?: string;
    action?: 'BUY' | 'SELL';
    entry?: string;
    target?: string;
    stop?: string;
    createdAt?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    const trimmed = text.trim();
    if (!trimmed) {
      return { warnings: ['Nothing to parse'] };
    }

    let createdAt: string | undefined;

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] ?? '';

    const commaParts = firstLine.split(',').map((p) => p.trim()).filter(Boolean);
    let symbol: string | undefined;
    if (commaParts.length >= 1 && /^[A-Za-z][A-Za-z0-9]{2,11}$/.test(commaParts[0])) {
      symbol = commaParts[0].toUpperCase();
      if (commaParts.length >= 2 && commaParts[1].toLowerCase() !== 'date') {
        const parsed = this.parseLooseDateTime(commaParts[1]);
        if (parsed) createdAt = parsed;
        else warnings.push(`Could not parse date: "${commaParts[1]}"`);
      }
    }

    if (!symbol) {
      const symMatch = trimmed.match(
        /\b([A-Z]{6}|XAUUSD|XAGUSD|BTCUSD|ETHUSD|US30|NAS100)\b/i
      );
      if (symMatch) symbol = symMatch[1].toUpperCase();
    }

    let action: 'BUY' | 'SELL' | undefined;
    const actionLine = lines.find((l) => /^(BUY|SELL)$/i.test(l));
    if (actionLine) {
      action = actionLine.toUpperCase() as 'BUY' | 'SELL';
    } else {
      const actionM = trimmed.match(/\b(BUY|SELL)\b/i);
      if (actionM) action = actionM[1].toUpperCase() as 'BUY' | 'SELL';
    }

    const targetM = trimmed.match(/target\s*:\s*([-+]?[\d.]+)/i);
    const stopM = trimmed.match(/stop\s*loss\s*:\s*([-+]?[\d.]+)/i);
    const entryM = trimmed.match(/entry\s*:\s*([-+]?[\d.]+)/i);
    const tpM = trimmed.match(/\bTP\s*:\s*([-+]?[\d.]+)/i);
    const slM = trimmed.match(/\bSL\s*:\s*([-+]?[\d.]+)/i);

    let target = targetM?.[1] ?? tpM?.[1];
    let stop = stopM?.[1] ?? slM?.[1];
    let entry = entryM?.[1];

    if (!createdAt) {
      const dateLine = trimmed.match(
        /(?:^|\n)\s*(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}):(\d{2}))?/m
      );
      if (dateLine) {
        const combined =
          dateLine[2] != null
            ? `${dateLine[1]} ${dateLine[2]}:${dateLine[3]}`
            : dateLine[1];
        const parsed = this.parseLooseDateTime(combined);
        if (parsed) createdAt = parsed;
      }
    }

    if (target && stop && !entry) {
      const t = parseFloat(target);
      const s = parseFloat(stop);
      if (!Number.isNaN(t) && !Number.isNaN(s)) {
        entry = this.formatPriceEstimate((t + s) / 2);
        warnings.push('Entry estimated as midpoint between target and stop — confirm before saving.');
      }
    }

    if (!symbol) warnings.push('Symbol not detected — enter manually.');
    if (!action) warnings.push('BUY/SELL not detected — choose manually.');

    return { symbol, action, entry, target, stop, createdAt, warnings };
  }

  /** Reward:risk ratio from horizontal distances (same units as prices). */
  static computeRR(
    action: 'BUY' | 'SELL',
    entry: string,
    target: string,
    stop: string
  ): string | null {
    const e = parseFloat(entry);
    const t = parseFloat(target);
    const s = parseFloat(stop);
    if ([e, t, s].some((n) => Number.isNaN(n))) return null;
    const riskDist = action === 'BUY' ? Math.abs(e - s) : Math.abs(s - e);
    const rewardDist = action === 'BUY' ? Math.abs(t - e) : Math.abs(e - t);
    if (riskDist <= 0) return null;
    return (rewardDist / riskDist).toFixed(2);
  }

  private static formatPriceEstimate(n: number): string {
    const s = n.toFixed(8).replace(/\.?0+$/, '');
    return s || '0';
  }

  private static parseLooseDateTime(input: string): string | null {
    const t = input.trim();
    const iso = t.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s]+(\d{1,2}):(\d{2}))?/
    );
    if (iso) {
      const y = parseInt(iso[1], 10);
      const mo = parseInt(iso[2], 10);
      const d = parseInt(iso[3], 10);
      const hh = iso[4] != null ? parseInt(iso[4], 10) : 12;
      const mm = iso[5] != null ? parseInt(iso[5], 10) : 0;
      const dt = new Date(y, mo - 1, d, hh, mm, 0);
      return dt.toISOString();
    }
    const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!dmy) return null;
    const d = parseInt(dmy[1], 10);
    const mo = parseInt(dmy[2], 10);
    const y = parseInt(dmy[3], 10);
    const hh = dmy[4] != null ? parseInt(dmy[4], 10) : 12;
    const mm = dmy[5] != null ? parseInt(dmy[5], 10) : 0;
    const dt = new Date(y, mo - 1, d, hh, mm, 0);
    return dt.toISOString();
  }

  /**
   * Validate that an alert has the minimum required fields
   */
  static validateAlert(alert: Partial<TradingAlert>): boolean {
    const sym = typeof alert.symbol === 'string' ? alert.symbol.trim() : '';
    return !!(
      alert.action &&
      sym &&
      (alert.action === 'BUY' || alert.action === 'SELL')
    );
  }
}