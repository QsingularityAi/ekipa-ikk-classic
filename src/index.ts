// Main entry point for App Engagement Intelligence system
import { SystemOrchestrator } from './system-orchestrator';

// Export all modules for library usage
export * from './types';
export * from './analytics';
export * from './engagement';
export * from './compliance';
export * from './api';
export * from './system-orchestrator';

// Main application entry point
async function main() {
  console.log('🚀 Starting App Engagement Intelligence System...');
  
  try {
    // Initialize the system orchestrator
    const system = new SystemOrchestrator();
    
    // Start all system components (including HTTP server)
    console.log('🚀 Starting system components...');
    await system.start();
    
    // Validate system functionality
    console.log('🔍 Validating system components...');
    const isValid = await system.validateSystemBehavior();
    
    if (!isValid) {
      console.error('❌ System validation failed');
      process.exit(1);
    }
    
    console.log('✅ System validation completed successfully');
    
    // Get and display system health
    const health = await system.getSystemHealth();
    console.log('📊 System Health:', JSON.stringify(health, null, 2));
    
    console.log('🎉 App Engagement Intelligence System is running!');
    console.log('🔧 System monitoring active');
    console.log('⚠️  Running in development mode without external services');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Received SIGINT, shutting down gracefully...');
      await system.shutdown();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
      await system.shutdown();
      process.exit(0);
    });
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('💥 Failed to start system:', error);
    process.exit(1);
  }
}

// Run the application if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Unhandled error in main:', error);
    process.exit(1);
  });
}