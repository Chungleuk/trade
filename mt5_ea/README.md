# Trading Signal EA for MetaTrader 5

This Expert Advisor (EA) receives trading signals from your Node.js backend and automatically executes trades with risk management.

## Features

- **Automatic Trade Execution**: Receives signals and executes trades automatically
- **Risk Management**: Calculates position size based on your risk percentage
- **Stop Loss & Take Profit**: Automatically sets SL/TP based on signal data
- **HTTP Communication**: Uses HTTP requests to communicate with your backend
- **Heartbeat Monitoring**: Sends regular heartbeat messages to maintain connection
- **Signal Acknowledgment**: Reports back on signal processing status

## Installation

### 1. Copy Files
1. Copy `TradingSignalEA.mq5` to your MetaTrader 5 `MQL5/Experts` folder
2. Restart MetaTrader 5 or refresh the Navigator panel

### 2. Enable Web Requests
1. In MetaTrader 5, go to **Tools** → **Options** → **Expert Advisors**
2. Check **"Allow WebRequest for listed URL"**
3. Add your backend URL (e.g., `http://localhost:3001`) to the list
4. Click **OK**

### 3. Compile the EA
1. In MetaTrader 5, press **F4** or go to **View** → **MetaEditor**
2. Open `TradingSignalEA.mq5`
3. Press **F7** to compile
4. Fix any compilation errors if they occur

## Configuration

### Input Parameters

- **ServerURL**: Your backend server URL (default: `http://localhost:3001`)
- **RiskPercent**: Risk percentage per trade (default: 1.0%)
- **AutoExecute**: Whether to automatically execute trades (default: true)
- **UseStopLoss**: Whether to use stop loss (default: true)
- **UseTakeProfit**: Whether to use take profit (default: true)
- **MagicNumber**: Magic number for trade identification (default: 123456)
- **PollInterval**: How often to poll for signals in milliseconds (default: 5000)

### Example Configuration
```
ServerURL: http://your-domain.com:3001
RiskPercent: 0.73
AutoExecute: true
UseStopLoss: true
UseTakeProfit: true
MagicNumber: 123456
PollInterval: 5000
```

## Usage

### 1. Attach to Chart
1. Drag the EA from the Navigator panel to any chart
2. Configure the input parameters
3. Click **OK**

### 2. Monitor Status
- Check the **Experts** tab for EA messages
- Look for connection, signal reception, and trade execution messages
- Monitor for any error messages

### 3. Signal Processing
The EA will:
1. Connect to your backend server
2. Poll for new signals every 5 seconds (configurable)
3. Validate incoming signals
4. Execute trades automatically (if enabled)
5. Send acknowledgments back to the server

## Communication Protocol

### Outgoing Messages

#### Connection Message
```json
{
  "type": "mt5_connect",
  "account": "12345",
  "terminal": "MetaTrader 5",
  "version": "5.0.0.1234"
}
```

#### Heartbeat Message
```json
{
  "type": "mt5_heartbeat",
  "account": "12345",
  "timestamp": "2024-01-01 12:00:00"
}
```

#### Signal Acknowledgment
```json
{
  "type": "signal_ack",
  "signalId": "signal-123",
  "status": "executed",
  "message": "Trade executed successfully",
  "account": "12345"
}
```

### Incoming Messages

#### Signal Response
```json
{
  "signals": [
    {
      "signal": {
        "id": "signal-123",
        "action": "BUY",
        "symbol": "EURUSD",
        "entry": "1.1704",
        "target": "1.1718",
        "stop": "1.1689",
        "timeframe": "15",
        "source": "TradingView"
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues

1. **"Failed to initialize HTTP client"**
   - Check that WebRequest is enabled for your server URL
   - Verify your backend server is running

2. **"Signal validation failed"**
   - Check that the symbol exists in your Market Watch
   - Verify price data is valid

3. **"Order execution failed"**
   - Check your account has sufficient margin
   - Verify trading is allowed on the symbol
   - Check for any trading restrictions

4. **Connection issues**
   - Verify your backend server is accessible
   - Check firewall settings
   - Ensure the server URL is correct

### Debug Mode
Enable detailed logging by checking the **"Allow DLL imports"** option in Expert Advisors settings.

## Security Notes

- The EA sends your account login number to the backend
- Consider implementing authentication if needed
- Use HTTPS in production environments
- Regularly monitor for unauthorized access

## Support

For issues or questions:
1. Check the MetaTrader 5 Experts log
2. Verify your backend server is running
3. Test the connection manually
4. Check the compilation for any errors

## Version History

- **v1.00**: Initial release with HTTP-based communication
- Basic signal processing and trade execution
- Risk management and position sizing
- Heartbeat monitoring and connection management
