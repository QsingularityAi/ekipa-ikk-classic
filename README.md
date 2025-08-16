# App Engagement Intelligence System

A comprehensive behavioral analytics and user engagement platform designed to increase digital adoption for IKK classic insurance app users while maintaining strict GDPR and GDNG compliance.

## 🎯 Overview

The App Engagement Intelligence system analyzes user behavior patterns, identifies engagement barriers, and delivers personalized interventions across multiple channels to drive digital adoption. The system processes user interactions in real-time and provides actionable insights to reduce manual processes and improve user experience.

### Key Features

- **Real-time Behavioral Analytics**: Track user interactions and identify engagement patterns
- **AI-Powered Interventions**: Personalized nudges and recommendations based on user behavior
- **Multi-Channel Delivery**: Push notifications, email, SMS, and in-app messaging
- **Privacy-First Design**: GDPR and GDNG compliant data processing
- **Age-Appropriate Personalization**: Tailored content for different age groups and digital literacy levels
- **A/B Testing Framework**: Optimize intervention strategies with statistical validation
- **Comprehensive Analytics**: Dashboard with engagement metrics and ROI tracking

## 📊 System Dashboards

The App Engagement Intelligence system provides comprehensive monitoring and analytics through various specialized dashboards:

### Business Intelligence
![Business Intelligence Dashboard](images/Business%20intelligence.png)

### Real-time Operations
![Real-time Operations Dashboard](images/Real-time%20Operations.png)

### System Monitoring
![System Monitoring Dashboard](images/Syatem%20monitoring.png)

### User Engagement Analytics
![User Engagement Analytics Dashboard](images/User%20Engagement%20Analytics.png)

## 🏗️ Architecture

The system follows a microservices architecture with the following core components:

- **Event Collection Service**: Captures and validates user interaction events
- **Analytics Service**: Processes events to generate insights and user segments
- **Engagement Service**: Generates and delivers personalized interventions
- **Compliance Service**: Ensures GDPR/GDNG compliance throughout the system
- **Notification Service**: Multi-channel intervention delivery

For detailed architecture information, see [ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/ikk-classic/app-engagement-intelligence.git
   cd app-engagement-intelligence
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp environments/.env.development .env
   # Edit .env with your configuration
   ```

4. **Start development services**
   ```bash
   docker-compose up -d postgres redis
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the application**
   ```bash
   npm run dev
   ```

The application will be available at:
- API: http://localhost:3000
- Health Check: http://localhost:3000/health
- Metrics: http://localhost:9090/metrics

### Using Docker Compose

For a complete development environment:

```bash
docker-compose up -d
```

This starts:
- App Engagement Intelligence API (port 3000)
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- Prometheus monitoring (port 9091)
- Grafana dashboard (port 3001)

## 📊 Usage Examples

### Submit User Events

```typescript
import { EngagementIntelligenceClient } from './src';

const client = new EngagementIntelligenceClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'your-api-key'
});

// Submit user interaction event
await client.events.submit({
  eventId: 'evt_123456',
  userId: 'user_789',
  sessionId: 'session_abc',
  eventType: 'page_view',
  metadata: {
    screenName: 'dashboard',
    duration: 30000
  },
  userContext: {
    ageGroup: '31-40',
    digitalLiteracyScore: 7
  }
});
```

### Get Analytics Dashboard

```bash
curl -X GET "http://localhost:3000/analytics/dashboard?timeRange=24h" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Manage User Consent

```typescript
// Grant consent
await client.compliance.grantConsent('user_123', 'analytics', true);

// Check consent status
const consent = await client.compliance.getConsent('user_123');
```

## 🧪 Testing

### Run Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Test Categories

- **Unit Tests**: Individual component testing
- **Integration Tests**: Service integration testing
- **End-to-End Tests**: Complete user journey validation
- **Performance Tests**: Load and stress testing
- **Compliance Tests**: GDPR/GDNG compliance validation

## 🚢 Deployment

### Environment Configuration

The system supports three deployment environments:

- **Development**: Local development with Docker Compose
- **Staging**: Kubernetes cluster for testing
- **Production**: Multi-zone Kubernetes deployment

### Deployment Script

```bash
# Deploy to development
./scripts/deploy.sh development

# Deploy to staging
./scripts/deploy.sh staging --version v1.2.3

# Deploy to production
./scripts/deploy.sh production --version v1.0.0 --registry my-registry.com
```

### Environment Variables

Key environment variables for production:

```bash
# Database
DB_HOST=your-db-host
DB_PASSWORD=secure-password

# Security
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-32-char-encryption-key
HASH_SALT=your-hash-salt

# External Services
PUSH_NOTIFICATION_API_KEY=your-fcm-key
EMAIL_SERVICE_API_KEY=your-sendgrid-key
SMS_SERVICE_API_KEY=your-twilio-key
```

## 📈 Monitoring

### Health Checks

- **Application Health**: `GET /health`
- **Database Health**: Connection and query performance
- **External Services**: Third-party service availability
- **Compliance Status**: GDPR/GDNG compliance monitoring

### Metrics

The system exposes Prometheus metrics at `/metrics`:

- Request rates and latencies
- User engagement metrics
- Intervention delivery rates
- Compliance violation counts
- System resource usage

### Dashboards

Grafana dashboards are available for:

- System performance monitoring
- User engagement analytics
- Intervention effectiveness
- Compliance reporting

## 🔒 Security & Compliance

### Privacy by Design

- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Use data only for stated purposes
- **Consent Management**: Granular consent collection and management
- **Data Anonymization**: Pseudonymization of user identifiers
- **Right to be Forgotten**: Automated data deletion

### Security Features

- **Authentication**: JWT-based authentication
- **Authorization**: Role-based access control
- **Encryption**: Data encrypted at rest and in transit
- **Rate Limiting**: API rate limiting and DDoS protection
- **Audit Logging**: Comprehensive audit trail

### Compliance

- **GDPR Compliance**: Full compliance with EU data protection regulation
- **GDNG Compliance**: German health data protection compliance
- **Audit Trail**: Immutable audit logs for all data processing
- **Data Retention**: Automated data lifecycle management

## 📚 API Documentation

Comprehensive API documentation is available at [docs/API.md](docs/API.md).

### Key Endpoints

- `POST /events` - Submit user interaction events
- `GET /analytics/dashboard` - Get engagement analytics
- `POST /interventions` - Create and deliver interventions
- `POST /compliance/consent` - Manage user consent
- `GET /health` - System health check

### Authentication

All API endpoints require JWT authentication:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/endpoint
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting with Airbnb configuration
- **Prettier**: Code formatting
- **Jest**: Testing framework
- **Conventional Commits**: Commit message format

### Testing Requirements

- Unit test coverage >80%
- Integration tests for all API endpoints
- End-to-end tests for critical user journeys
- Performance tests for scalability validation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation

- [API Documentation](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)

### Getting Help

- **Issues**: GitHub Issues for bug reports and feature requests
- **Discussions**: GitHub Discussions for questions and ideas
- **Email**: dev-team@ikk-classic.de for direct support

### Status

- **Build Status**: ![Build Status](https://github.com/ikk-classic/app-engagement-intelligence/workflows/CI/badge.svg)
- **Coverage**: ![Coverage](https://codecov.io/gh/ikk-classic/app-engagement-intelligence/branch/main/graph/badge.svg)
- **Version**: ![Version](https://img.shields.io/github/v/release/ikk-classic/app-engagement-intelligence)

## 🗺️ Roadmap

### Current Version (v1.0)
- ✅ Real-time event processing
- ✅ Basic intervention delivery
- ✅ GDPR/GDNG compliance
- ✅ Multi-channel notifications

### Upcoming Features (v1.1)
- 🔄 Advanced ML models for prediction
- 🔄 Real-time personalization engine
- 🔄 Enhanced analytics dashboard
- 🔄 Mobile SDK for easier integration

### Future Enhancements (v2.0)
- 📋 Multi-tenant architecture
- 📋 Advanced A/B testing platform
- 📋 Predictive analytics
- 📋 Global deployment support

---

**Built with ❤️ by the IKK classic development team**