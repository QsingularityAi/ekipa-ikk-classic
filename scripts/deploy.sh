#!/bin/bash

# Deployment script for App Engagement Intelligence system
# Requirements: 4.1, 5.1 - Automated deployment with environment configuration

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-localhost:5000}"
IMAGE_NAME="${IMAGE_NAME:-app-engagement-intelligence}"
VERSION="${VERSION:-latest}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Help function
show_help() {
    cat << EOF
Usage: $0 [OPTIONS] ENVIRONMENT

Deploy App Engagement Intelligence system to specified environment.

ENVIRONMENTS:
    development     Deploy to development environment
    staging         Deploy to staging environment
    production      Deploy to production environment

OPTIONS:
    -h, --help      Show this help message
    -v, --version   Specify version tag (default: latest)
    -r, --registry  Specify Docker registry (default: localhost:5000)
    --build-only    Only build the Docker image, don't deploy
    --no-build      Skip building, use existing image
    --dry-run       Show what would be deployed without actually deploying

EXAMPLES:
    $0 development
    $0 staging --version v1.2.3
    $0 production --registry my-registry.com --version v1.0.0
    $0 development --build-only
EOF
}

# Parse command line arguments
ENVIRONMENT=""
BUILD_ONLY=false
NO_BUILD=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            VERSION="$2"
            shift 2
            ;;
        -r|--registry)
            DOCKER_REGISTRY="$2"
            shift 2
            ;;
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --no-build)
            NO_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        development|staging|production)
            ENVIRONMENT="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate environment
if [[ -z "$ENVIRONMENT" ]]; then
    log_error "Environment is required"
    show_help
    exit 1
fi

if [[ ! "$ENVIRONMENT" =~ ^(development|staging|production)$ ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    show_help
    exit 1
fi

# Set full image name
FULL_IMAGE_NAME="${DOCKER_REGISTRY}/${IMAGE_NAME}:${VERSION}"

log_info "Starting deployment to $ENVIRONMENT environment"
log_info "Image: $FULL_IMAGE_NAME"

# Pre-deployment checks
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    
    # Check if required environment files exist
    ENV_FILE="$PROJECT_ROOT/environments/.env.$ENVIRONMENT"
    if [[ ! -f "$ENV_FILE" ]]; then
        log_warn "Environment file not found: $ENV_FILE"
        log_warn "Using default configuration"
    fi
    
    # Check if Kubernetes is available for staging/production
    if [[ "$ENVIRONMENT" != "development" ]]; then
        if ! command -v kubectl &> /dev/null; then
            log_error "kubectl is required for $ENVIRONMENT deployment"
            exit 1
        fi
        
        if ! kubectl cluster-info &> /dev/null; then
            log_error "Cannot connect to Kubernetes cluster"
            exit 1
        fi
    fi
    
    log_info "Prerequisites check passed"
}

# Build Docker image
build_image() {
    if [[ "$NO_BUILD" == true ]]; then
        log_info "Skipping build (--no-build specified)"
        return
    fi
    
    log_info "Building Docker image..."
    
    cd "$PROJECT_ROOT"
    
    # Build the image
    docker build \
        --target production \
        --tag "$FULL_IMAGE_NAME" \
        --build-arg NODE_ENV="$ENVIRONMENT" \
        --build-arg VERSION="$VERSION" \
        .
    
    log_info "Docker image built successfully: $FULL_IMAGE_NAME"
    
    # Push to registry if not local development
    if [[ "$ENVIRONMENT" != "development" && "$DOCKER_REGISTRY" != "localhost:5000" ]]; then
        log_info "Pushing image to registry..."
        docker push "$FULL_IMAGE_NAME"
        log_info "Image pushed successfully"
    fi
}

# Deploy to development environment
deploy_development() {
    log_info "Deploying to development environment..."
    
    cd "$PROJECT_ROOT"
    
    # Use Docker Compose for development
    export IMAGE_TAG="$VERSION"
    export ENVIRONMENT="development"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would execute: docker-compose up -d"
        return
    fi
    
    # Stop existing containers
    docker-compose down --remove-orphans
    
    # Start services
    docker-compose up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 10
    
    # Health check
    if curl -f http://localhost:3000/health &> /dev/null; then
        log_info "Development deployment successful!"
        log_info "Application is available at: http://localhost:3000"
        log_info "Grafana dashboard: http://localhost:3001 (admin/admin)"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Deploy to staging environment
deploy_staging() {
    log_info "Deploying to staging environment..."
    
    NAMESPACE="app-engagement-intelligence-staging"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would deploy to Kubernetes namespace: $NAMESPACE"
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    kubectl apply -f "$PROJECT_ROOT/k8s/staging/" -n "$NAMESPACE"
    
    # Update deployment with new image
    kubectl set image deployment/app-engagement-intelligence \
        app="$FULL_IMAGE_NAME" \
        -n "$NAMESPACE"
    
    # Wait for rollout to complete
    kubectl rollout status deployment/app-engagement-intelligence -n "$NAMESPACE" --timeout=300s
    
    log_info "Staging deployment successful!"
}

# Deploy to production environment
deploy_production() {
    log_info "Deploying to production environment..."
    
    # Additional safety checks for production
    if [[ "$VERSION" == "latest" ]]; then
        log_error "Cannot deploy 'latest' tag to production. Please specify a version."
        exit 1
    fi
    
    # Confirm production deployment
    if [[ "$DRY_RUN" != true ]]; then
        echo -n "Are you sure you want to deploy to PRODUCTION? (yes/no): "
        read -r confirmation
        if [[ "$confirmation" != "yes" ]]; then
            log_info "Production deployment cancelled"
            exit 0
        fi
    fi
    
    NAMESPACE="app-engagement-intelligence-production"
    
    if [[ "$DRY_RUN" == true ]]; then
        log_info "DRY RUN: Would deploy to Kubernetes namespace: $NAMESPACE"
        return
    fi
    
    # Create namespace if it doesn't exist
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Apply Kubernetes manifests
    kubectl apply -f "$PROJECT_ROOT/k8s/production/" -n "$NAMESPACE"
    
    # Update deployment with new image
    kubectl set image deployment/app-engagement-intelligence \
        app="$FULL_IMAGE_NAME" \
        -n "$NAMESPACE"
    
    # Wait for rollout to complete
    kubectl rollout status deployment/app-engagement-intelligence -n "$NAMESPACE" --timeout=600s
    
    log_info "Production deployment successful!"
}

# Cleanup function
cleanup() {
    log_info "Cleaning up..."
    # Add any cleanup tasks here
}

# Set trap for cleanup
trap cleanup EXIT

# Main deployment flow
main() {
    check_prerequisites
    
    if [[ "$BUILD_ONLY" == true ]]; then
        build_image
        log_info "Build completed. Exiting (--build-only specified)"
        exit 0
    fi
    
    build_image
    
    case "$ENVIRONMENT" in
        development)
            deploy_development
            ;;
        staging)
            deploy_staging
            ;;
        production)
            deploy_production
            ;;
    esac
    
    log_info "Deployment to $ENVIRONMENT completed successfully!"
}

# Run main function
main