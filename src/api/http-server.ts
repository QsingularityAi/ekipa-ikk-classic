import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { DashboardAPI } from './dashboard-api';
import { DashboardApiConfig, ApiResponse } from './interfaces';
import { MetricsPeriod } from '../analytics/metrics-collector';

/**
 * HTTP Server for Dashboard API
 * Provides REST endpoints for the dashboard functionality
 */
export class HttpServer {
  private app: express.Application;
  private server: any;
  private dashboardAPI: DashboardAPI;
  private config: DashboardApiConfig;

  constructor(dashboardAPI: DashboardAPI, config: DashboardApiConfig) {
    this.dashboardAPI = dashboardAPI;
    this.config = config;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: this.config.corsOrigins,
      credentials: true
    }));

    // JSON parsing
    this.app.use(express.json());

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Error handling middleware
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
          details: { error: error.message }
        },
        timestamp: new Date()
      });
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date(),
          uptime: process.uptime(),
          version: '1.0.0'
        },
        timestamp: new Date()
      });
    });

    // Dashboard metrics endpoint
    this.app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
      try {
        const period = (req.query.period as MetricsPeriod) || 'monthly';
        const result = await this.dashboardAPI.getDashboardMetrics(period);
        res.json(result);
      } catch (error) {
        this.handleError(res, error, 'DASHBOARD_METRICS_ERROR');
      }
    });

    // User insights endpoint
    this.app.get('/api/dashboard/insights', async (req: Request, res: Response) => {
      try {
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        const ageGroup = req.query.ageGroup as string;
        
        const result = await this.dashboardAPI.getUserInsights(startDate, endDate, ageGroup);
        res.json(result);
      } catch (error) {
        this.handleError(res, error, 'USER_INSIGHTS_ERROR');
      }
    });

    // Real-time metrics endpoint
    this.app.get('/api/dashboard/realtime', async (req: Request, res: Response) => {
      try {
        const result = await this.dashboardAPI.getRealTimeMetrics();
        res.json(result);
      } catch (error) {
        this.handleError(res, error, 'REALTIME_METRICS_ERROR');
      }
    });

    // Historical report endpoint
    this.app.get('/api/dashboard/historical', async (req: Request, res: Response) => {
      try {
        const period = (req.query.period as MetricsPeriod) || 'monthly';
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        
        const result = await this.dashboardAPI.getHistoricalReport(period, startDate, endDate);
        res.json(result);
      } catch (error) {
        this.handleError(res, error, 'HISTORICAL_REPORT_ERROR');
      }
    });

    // Export metrics endpoint
    this.app.get('/api/dashboard/export', async (req: Request, res: Response) => {
      try {
        const period = (req.query.period as MetricsPeriod) || 'monthly';
        const format = (req.query.format as 'json' | 'csv') || 'json';
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        
        const result = await this.dashboardAPI.exportMetrics(period, format, startDate, endDate);
        
        if (result.success && result.data) {
          if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="metrics-${period}.csv"`);
          } else {
            res.setHeader('Content-Type', 'application/json');
          }
          res.send(result.data);
        } else {
          res.json(result);
        }
      } catch (error) {
        this.handleError(res, error, 'EXPORT_ERROR');
      }
    });

    // Feature adoption metrics endpoint
    this.app.get('/api/dashboard/features', async (req: Request, res: Response) => {
      try {
        const featureId = req.query.featureId as string;
        const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
        const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
        
        const result = await this.dashboardAPI.getFeatureAdoptionMetrics(featureId, startDate, endDate);
        res.json(result);
      } catch (error) {
        this.handleError(res, error, 'FEATURE_ADOPTION_ERROR');
      }
    });

    // System status endpoint
    this.app.get('/api/system/status', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          status: 'running',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        },
        timestamp: new Date()
      });
    });

    // API documentation endpoint
    this.app.get('/api/docs', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          title: 'App Engagement Intelligence API',
          version: '1.0.0',
          endpoints: {
            'GET /health': 'Health check endpoint',
            'GET /api/dashboard/metrics': 'Get dashboard metrics (query: period)',
            'GET /api/dashboard/insights': 'Get user insights (query: startDate, endDate, ageGroup)',
            'GET /api/dashboard/realtime': 'Get real-time metrics',
            'GET /api/dashboard/historical': 'Get historical report (query: period, startDate, endDate)',
            'GET /api/dashboard/export': 'Export metrics data (query: period, format, startDate, endDate)',
            'GET /api/dashboard/features': 'Get feature adoption metrics (query: featureId, startDate, endDate)',
            'GET /api/system/status': 'Get system status',
            'GET /api/docs': 'This documentation'
          },
          parameters: {
            period: 'daily | weekly | monthly | quarterly | yearly',
            format: 'json | csv',
            dates: 'ISO 8601 format (YYYY-MM-DD)'
          }
        },
        timestamp: new Date()
      });
    });

    // Root endpoint
    this.app.get('/', (req: Request, res: Response) => {
      res.json({
        success: true,
        data: {
          message: 'App Engagement Intelligence API',
          version: '1.0.0',
          documentation: '/api/docs',
          health: '/health'
        },
        timestamp: new Date()
      });
    });

    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Endpoint ${req.method} ${req.originalUrl} not found`,
          details: { availableEndpoints: '/api/docs' }
        },
        timestamp: new Date()
      });
    });
  }

  private handleError(res: Response, error: any, code: string): void {
    console.error(`API Error [${code}]:`, error);
    res.status(500).json({
      success: false,
      error: {
        code,
        message: error.message || 'An error occurred',
        details: { error: error.toString() }
      },
      timestamp: new Date()
    });
  }

  /**
   * Start the HTTP server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, () => {
          console.log(`🌐 HTTP Server started on port ${this.config.port}`);
          console.log(`📊 Dashboard API: http://localhost:${this.config.port}/api/dashboard/metrics`);
          console.log(`🔍 Health Check: http://localhost:${this.config.port}/health`);
          console.log(`📖 API Docs: http://localhost:${this.config.port}/api/docs`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          console.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the HTTP server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🛑 HTTP Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the Express app instance
   */
  public getApp(): express.Application {
    return this.app;
  }
}