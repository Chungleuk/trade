# Trading Backend API

A robust Node.js/Express backend for managing trading signals and MT5 Expert Advisor communication.

## 🚀 Features

- **Real-time MT5 Communication**: HTTP endpoints for MT5 EA connection and signal exchange
- **Signal Management**: Queue-based signal processing with acknowledgment system
- **Health Monitoring**: Built-in health checks and status endpoints
- **CORS Enabled**: Cross-origin request support for frontend integration
- **Graceful Shutdown**: Proper cleanup on server termination

## 📡 API Endpoints

### Status & Health
- `GET /status` - Backend status and version info
- `GET /health` - Detailed health check with system metrics

### MT5 Communication
- `POST /mt5/connect` - MT5 EA connection establishment
- `POST /mt5/heartbeat` - Connection health monitoring
- `POST /mt5/disconnect` - MT5 EA disconnection

### Signal Management
- `POST /signals/pending` - Retrieve pending trading signals
- `POST /signals/ack` - Acknowledge signal processing

## 🛠️ Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```

3. **Development mode (auto-restart):**
   ```bash
   npm run server:dev
   ```

## 🌐 Usage

### Local Development
- **Port**: 3001 (configurable via PORT environment variable)
- **Status**: http://localhost:3001/status
- **Health**: http://localhost:3001/health

### Test Endpoints
```bash
# Test status
curl http://localhost:3001/status

# Test health
curl http://localhost:3001/health

# Test MT5 connection
curl -X POST http://localhost:3001/mt5/connect \
  -H "Content-Type: application/json" \
  -d '{"account":"12345","terminal":"MT5"}'
```

## 🚀 Deployment

### Render (Recommended)
1. **Connect GitHub repository**
2. **Select branch**: `revised2`
3. **Build Command**: `npm install`
4. **Start Command**: `node server.js`
5. **Environment Variables**: Set PORT if needed

### Environment Variables
Create a `.env` file based on `.env.example`:
```bash
PORT=3001
NODE_ENV=production
```

## 📊 Monitoring

### Health Check Response
```json
{
  "status": "healthy",
  "uptime": 123.45,
  "timestamp": "2025-08-17T11:00:00.000Z",
  "memory": {
    "rss": 12345678,
    "heapTotal": 9876543,
    "heapUsed": 5432109
  },
  "version": "v22.17.1"
}
```

### Status Response
```json
{
  "status": "Trading Backend Running on Render!",
  "timestamp": "2025-08-17T11:00:00.000Z",
  "version": "1.0.0"
}
```

## 🔧 Development

### Project Structure
```
project/
├── server.js          # Main server file
├── package.json       # Dependencies and scripts
├── .gitignore        # Git ignore rules
├── README.md         # This file
└── src/              # Frontend React app
```

### Scripts
- `npm start` - Start production server
- `npm run server` - Start server (alias)
- `npm run server:dev` - Start with auto-restart
- `npm run dev` - Start frontend development server
- `npm run build` - Build frontend for production

## 🔒 Security

- **CORS**: Configured for cross-origin requests
- **Rate Limiting**: Ready for future implementation
- **Authentication**: Prepared for JWT/API key integration
- **Input Validation**: Basic request body parsing

## 📈 Next Steps

1. **Database Integration**: Add PostgreSQL for signal persistence
2. **Authentication**: Implement JWT-based security
3. **Signal Queue**: Add Bull queue for signal processing
4. **WebSocket**: Real-time communication upgrade
5. **Logging**: Winston-based structured logging
6. **Testing**: Jest test suite
7. **Monitoring**: Prometheus metrics

## 🆘 Support

- **Issues**: Create GitHub issue
- **Documentation**: Check this README
- **API Testing**: Use provided curl examples

## 📄 License

MIT License - see LICENSE file for details
