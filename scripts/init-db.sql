-- Database initialization script for App Engagement Intelligence system
-- Requirements: 4.1, 5.1 - Database schema and compliance tables

-- Create database if it doesn't exist
-- Note: This is handled by Docker Compose environment variables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS compliance;
CREATE SCHEMA IF NOT EXISTS engagement;

-- User profiles table
CREATE TABLE IF NOT EXISTS analytics.user_profiles (
    user_id VARCHAR(255) PRIMARY KEY, -- pseudonymized user ID
    age_group VARCHAR(10) NOT NULL CHECK (age_group IN ('22-30', '31-40', '41-55', '56-65', '66+')),
    registration_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_active_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    total_sessions INTEGER NOT NULL DEFAULT 0,
    average_session_duration INTEGER NOT NULL DEFAULT 0, -- in milliseconds
    features_used TEXT[] NOT NULL DEFAULT '{}',
    digital_tasks_completed INTEGER NOT NULL DEFAULT 0,
    phone_calls_last_month INTEGER NOT NULL DEFAULT 0,
    paper_forms_last_month INTEGER NOT NULL DEFAULT 0,
    communication_channels TEXT[] NOT NULL DEFAULT '{}',
    notification_frequency VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (notification_frequency IN ('high', 'medium', 'low')),
    content_complexity VARCHAR(10) NOT NULL DEFAULT 'detailed' CHECK (content_complexity IN ('simple', 'detailed')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- User events table (time-series optimized)
CREATE TABLE IF NOT EXISTS analytics.user_events (
    event_id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    session_id VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('page_view', 'feature_usage', 'task_completion', 'abandonment')),
    screen_name VARCHAR(255),
    feature_id VARCHAR(255),
    duration INTEGER, -- in milliseconds
    success BOOLEAN,
    age_group VARCHAR(10),
    digital_literacy_score INTEGER,
    preferred_channel VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);

-- Partition user_events table by month for better performance
CREATE TABLE IF NOT EXISTS analytics.user_events_y2024m01 PARTITION OF analytics.user_events
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE IF NOT EXISTS analytics.user_events_y2024m02 PARTITION OF analytics.user_events
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- Add more partitions as needed

-- Consent records table
CREATE TABLE IF NOT EXISTS compliance.consent_records (
    consent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('analytics', 'personalization', 'marketing')),
    granted BOOLEAN NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    version VARCHAR(10) NOT NULL DEFAULT '1.0',
    ip_address INET,
    user_agent TEXT,
    consent_method VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit log table (immutable)
CREATE TABLE IF NOT EXISTS compliance.audit_log (
    entry_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255), -- pseudonymized user ID, can be NULL for system events
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Intervention strategies table
CREATE TABLE IF NOT EXISTS engagement.intervention_strategies (
    strategy_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('nudge', 'incentive', 'education', 'gamification')),
    trigger_event_type VARCHAR(50) NOT NULL,
    trigger_conditions JSONB NOT NULL DEFAULT '{}',
    content_title VARCHAR(255) NOT NULL,
    content_message TEXT NOT NULL,
    content_action_button VARCHAR(100),
    content_media_url VARCHAR(500),
    channels TEXT[] NOT NULL DEFAULT '{}',
    timing_delay INTEGER DEFAULT 0, -- in milliseconds
    timing_frequency VARCHAR(50) DEFAULT 'once',
    timing_expires_after INTEGER, -- in milliseconds
    target_age_groups TEXT[] NOT NULL DEFAULT '{}',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Intervention deliveries table
CREATE TABLE IF NOT EXISTS engagement.intervention_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    intervention_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    strategy_id VARCHAR(255) NOT NULL REFERENCES engagement.intervention_strategies(strategy_id),
    channel VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'expired')),
    scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    delivery_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Intervention responses table
CREATE TABLE IF NOT EXISTS engagement.intervention_responses (
    response_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_id UUID NOT NULL REFERENCES engagement.intervention_deliveries(delivery_id),
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    response_type VARCHAR(50) NOT NULL CHECK (response_type IN ('delivered', 'opened', 'clicked', 'converted', 'dismissed')),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- A/B test experiments table
CREATE TABLE IF NOT EXISTS analytics.ab_experiments (
    experiment_id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    traffic_split JSONB NOT NULL, -- e.g., {"control": 50, "variant": 50}
    success_metric VARCHAR(100) NOT NULL,
    variants JSONB NOT NULL, -- experiment variants configuration
    results JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- A/B test assignments table
CREATE TABLE IF NOT EXISTS analytics.ab_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    experiment_id VARCHAR(255) NOT NULL REFERENCES analytics.ab_experiments(experiment_id),
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    variant VARCHAR(100) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(experiment_id, user_id)
);

-- A/B test conversions table
CREATE TABLE IF NOT EXISTS analytics.ab_conversions (
    conversion_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES analytics.ab_assignments(assignment_id),
    user_id VARCHAR(255) NOT NULL, -- pseudonymized user ID
    conversion_type VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    value DECIMAL(10,2) DEFAULT 0,
    metadata JSONB DEFAULT '{}'
);

-- System metrics table
CREATE TABLE IF NOT EXISTS analytics.system_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_age_group ON analytics.user_profiles(age_group);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON analytics.user_profiles(last_active_date);

CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON analytics.user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON analytics.user_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON analytics.user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_session_id ON analytics.user_events(session_id);

CREATE INDEX IF NOT EXISTS idx_consent_records_user_id ON compliance.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_consent_records_type ON compliance.consent_records(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_records_timestamp ON compliance.consent_records(timestamp);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON compliance.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON compliance.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON compliance.audit_log(timestamp);

CREATE INDEX IF NOT EXISTS idx_intervention_deliveries_user_id ON engagement.intervention_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_deliveries_status ON engagement.intervention_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_intervention_deliveries_scheduled ON engagement.intervention_deliveries(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_intervention_responses_delivery_id ON engagement.intervention_responses(delivery_id);
CREATE INDEX IF NOT EXISTS idx_intervention_responses_user_id ON engagement.intervention_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_intervention_responses_type ON engagement.intervention_responses(response_type);

CREATE INDEX IF NOT EXISTS idx_ab_assignments_experiment_id ON analytics.ab_assignments(experiment_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_user_id ON analytics.ab_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON analytics.system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON analytics.system_metrics(timestamp);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON analytics.user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intervention_strategies_updated_at BEFORE UPDATE ON engagement.intervention_strategies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_intervention_deliveries_updated_at BEFORE UPDATE ON engagement.intervention_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_experiments_updated_at BEFORE UPDATE ON analytics.ab_experiments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default intervention strategies
INSERT INTO engagement.intervention_strategies (
    strategy_id, name, type, trigger_event_type, trigger_conditions,
    content_title, content_message, content_action_button,
    channels, target_age_groups
) VALUES 
(
    'nudge_claim_completion',
    'Claim Completion Nudge',
    'nudge',
    'abandonment',
    '{"screenName": "claim_form"}',
    'Complete Your Claim',
    'You were almost done! Complete your claim in just 2 more steps.',
    'Continue Claim',
    ARRAY['push', 'email'],
    ARRAY['22-30', '31-40', '41-55']
),
(
    'education_digital_services',
    'Digital Services Education',
    'education',
    'page_view',
    '{"screenName": "dashboard", "sessionCount": {"$lt": 5}}',
    'Discover Digital Services',
    'Did you know you can manage your insurance completely online? Explore our digital services.',
    'Learn More',
    ARRAY['email', 'in_app'],
    ARRAY['56-65', '66+']
),
(
    'gamification_feature_discovery',
    'Feature Discovery Gamification',
    'gamification',
    'feature_usage',
    '{"featuresUsed": {"$size": {"$gte": 3}}}',
    'You''re on a Roll!',
    'You''ve discovered 3 features! Try one more to unlock your digital expert badge.',
    'Explore More',
    ARRAY['push', 'in_app'],
    ARRAY['22-30', '31-40']
);

-- Create views for common queries
CREATE OR REPLACE VIEW analytics.user_engagement_summary AS
SELECT 
    up.user_id,
    up.age_group,
    up.total_sessions,
    up.average_session_duration,
    up.digital_tasks_completed,
    up.phone_calls_last_month + up.paper_forms_last_month as traditional_channel_usage,
    CASE 
        WHEN up.total_sessions >= 10 AND up.digital_tasks_completed >= 5 THEN 'high'
        WHEN up.total_sessions >= 3 AND up.digital_tasks_completed >= 1 THEN 'medium'
        ELSE 'low'
    END as engagement_level,
    up.last_active_date
FROM analytics.user_profiles up;

CREATE OR REPLACE VIEW compliance.consent_status_summary AS
SELECT 
    user_id,
    MAX(CASE WHEN consent_type = 'analytics' AND granted = true THEN timestamp END) as analytics_consent_date,
    MAX(CASE WHEN consent_type = 'personalization' AND granted = true THEN timestamp END) as personalization_consent_date,
    MAX(CASE WHEN consent_type = 'marketing' AND granted = true THEN timestamp END) as marketing_consent_date,
    BOOL_OR(CASE WHEN consent_type = 'analytics' THEN granted END) as has_analytics_consent,
    BOOL_OR(CASE WHEN consent_type = 'personalization' THEN granted END) as has_personalization_consent,
    BOOL_OR(CASE WHEN consent_type = 'marketing' THEN granted END) as has_marketing_consent
FROM compliance.consent_records
WHERE timestamp = (
    SELECT MAX(timestamp) 
    FROM compliance.consent_records cr2 
    WHERE cr2.user_id = consent_records.user_id 
    AND cr2.consent_type = consent_records.consent_type
)
GROUP BY user_id;

-- Grant permissions (adjust as needed for your environment)
-- GRANT USAGE ON SCHEMA analytics TO app_user;
-- GRANT USAGE ON SCHEMA compliance TO app_user;
-- GRANT USAGE ON SCHEMA engagement TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA analytics TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA compliance TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA engagement TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA analytics TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA compliance TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA engagement TO app_user;

-- Insert sample data for development (optional)
-- This would be removed in production
INSERT INTO analytics.user_profiles (
    user_id, age_group, total_sessions, digital_tasks_completed, 
    phone_calls_last_month, communication_channels
) VALUES 
('pseudo_sample_001', '31-40', 5, 2, 3, ARRAY['push', 'email']),
('pseudo_sample_002', '56-65', 2, 0, 8, ARRAY['email', 'sms']),
('pseudo_sample_003', '22-30', 15, 8, 0, ARRAY['push', 'in_app'])
ON CONFLICT (user_id) DO NOTHING;

-- Log database initialization
INSERT INTO compliance.audit_log (action, details) 
VALUES ('database_initialized', ('{"version": "1.0", "timestamp": "' || NOW() || '"}')::jsonb);

COMMIT;