# Lead360 Platform Infrastructure Documentation

**Last Updated**: January 2026  
**Environment**: Development Server  
**Platform**: Multi-Tenant SaaS CRM/ERP for Service Businesses

---

## Table of Contents

1. [Infrastructure Overview](#infrastructure-overview)
2. [Domain & DNS Configuration](#domain--dns-configuration)
3. [SSL/TLS Configuration](#ssltls-configuration)
4. [Application Architecture](#application-architecture)
5. [Database Configuration](#database-configuration)
6. [Nginx Reverse Proxy Setup](#nginx-reverse-proxy-setup)
7. [Port Mapping & Traffic Flow](#port-mapping--traffic-flow)
8. [Filesystem Structure](#filesystem-structure)
9. [Security & Firewall](#security--firewall)
10. [Development Workflow](#development-workflow)
11. [Troubleshooting Reference](#troubleshooting-reference)

---

## Infrastructure Overview

### Server Specifications

| Component | Details |
|-----------|---------|
| **Server Type** | VPS (Development) |
| **Operating System** | Debian-based Linux |
| **Web Server** | Nginx 1.26.2 |
| **Node Runtime** | v22.11.0 (via NVM) |
| **Database** | MariaDB 10.11.13 |
| **Server IP** | 145.223.120.93 |

### Technology Stack

**Backend API**
- Framework: NestJS (Express-based)
- ORM: Prisma + @prisma/client
- Config Management: @nestjs/config
- Runtime Mode: Development (watch/reload)

**Frontend Application**
- Framework: Next.js
- Deployment: Development server on port 7000
- Multi-tenant routing via subdomain parsing

**Database**
- Engine: MariaDB 10.11.13
- Database Name: `lead360`
- Connection: Prisma-managed

---

## Domain & DNS Configuration

### DNS Provider
- **Provider**: Cloudflare
- **Primary Domain**: lead360.app
- **DNS Record Type**: A records pointing to 145.223.120.93

### Domain Routing Strategy

#### 1. Public Marketing Site
```
https://lead360.app
https://www.lead360.app
```
- **Purpose**: Public-facing website for lead generation and sales
- **Served From**: Static files in `/var/www/lead360.app/public`
- **Port**: 443 (HTTPS only)

#### 2. API Endpoint
```
https://api.lead360.app
```
- **Purpose**: RESTful API for all backend operations
- **Upstream**: Proxied to `http://127.0.0.1:8000`
- **Framework**: NestJS
- **Health Check**: `https://api.lead360.app/health`
  - Returns: `{ status: "ok", service: "lead360-api", ts: ... }`

#### 3. Admin/Backoffice Application
```
https://app.lead360.app
```
- **Purpose**: Business user dashboard and administration
- **Upstream**: Proxied to `http://127.0.0.1:7000`
- **Framework**: Next.js
- **Access**: Authenticated users only

#### 4. Multi-Tenant Customer Portals (Wildcard)
```
https://{tenant}.lead360.app
```
- **Purpose**: Customer-facing portals for each business tenant
- **Examples**: 
  - `https://acmeplumbing.lead360.app`
  - `https://joespainting.lead360.app`
- **Upstream**: Same Next.js app on `http://127.0.0.1:7000`
- **Tenant Resolution**: Parsed from subdomain via Host header
- **Exclusions**: `app`, `api`, `www` are reserved and NOT treated as tenants

---

## SSL/TLS Configuration

### Certificate Provider
- **Issuer**: Let's Encrypt
- **Management**: Certbot (assumed)

### Certificate Coverage

| Domain Pattern | Certificate Type | Status |
|----------------|------------------|--------|
| `lead360.app` | Standard | ✅ Active |
| `www.lead360.app` | Standard | ✅ Active |
| `*.lead360.app` | Wildcard | ✅ Active |

### HTTPS Enforcement
- All traffic redirected from HTTP (80) → HTTPS (443)
- Nginx configured for HTTP/2
- TLS handshake issues resolved by correcting Cloudflare DNS A-record IP

---

## Application Architecture

### Multi-Tenant Design
- **Tenant Identification**: Subdomain parsing from `Host` header
- **Data Isolation**: All queries scoped by `tenant_id` (Prisma interceptor)
- **Subdomain Exclusions**: `app`, `api`, `www` are NOT tenants

### Application Ports (Internal)

| Service | Port | Bind Address | Public Access |
|---------|------|--------------|---------------|
| NestJS API | 8000 | 127.0.0.1 | via Nginx (api.lead360.app) |
| Next.js App | 7000 | 127.0.0.1 | via Nginx (app + wildcard) |

**Security Note**: Internal services bind to loopback (`127.0.0.1`) and are NOT directly accessible from the internet.

### CORS Configuration (NestJS API)
- Allowed Origins:
  - `https://app.lead360.app`
  - `https://*.lead360.app` (regex-based for tenant subdomains)
- Methods: GET, POST, PUT, PATCH, DELETE (standard REST)
- Credentials: Enabled

---

## Database Configuration

### MariaDB Settings

| Parameter | Value |
|-----------|-------|
| **Version** | 10.11.13 (Debian build) |
| **Database Name** | `lead360` |
| **Character Set** | utf8mb4 (recommended) |
| **Collation** | utf8mb4_unicode_ci (recommended) |

### Database Users

**Application User**
- Username: `lead360_user`
- Host Restrictions: 
  - `lead360_user@127.0.0.1`
  - `lead360_user@localhost`
- Permissions: CRUD on `lead360` database
- Connection: Prisma-managed

### Prisma Configuration

**Connection String Format**:
```
DATABASE_URL="mysql://lead360_user:{password}@127.0.0.1:3306/lead360"
```

**Prisma Commands**:
- Schema Pull: `prisma db pull` (confirmed working)
- Migration: `prisma migrate dev`
- Generate Client: `prisma generate`

### Multi-Tenant Database Strategy
- Single database with `tenant_id` column on all business-owned tables
- Composite indexes: `(tenant_id, created_at)`, `(tenant_id, status)`, etc.
- Global Prisma middleware enforces tenant scoping on ALL queries

---

## Nginx Reverse Proxy Setup

### Configuration Locations
- Main Config: `/etc/nginx/nginx.conf`
- Site Configs: `/etc/nginx/sites-available/` and `/etc/nginx/sites-enabled/`
- Logs: `/var/www/lead360.app/logs/`

### Traffic Routing Logic

```
Public Request (HTTPS:443) 
    ↓
Nginx (Port 443, HTTP/2)
    ↓
Routes based on Host header:
    ├─ lead360.app → Static files (/var/www/lead360.app/public)
    ├─ www.lead360.app → Static files (/var/www/lead360.app/public)
    ├─ api.lead360.app → Proxy to 127.0.0.1:8000 (NestJS)
    ├─ app.lead360.app → Proxy to 127.0.0.1:7000 (Next.js)
    └─ {tenant}.lead360.app → Proxy to 127.0.0.1:7000 (Next.js)
```

### Expected Nginx Behavior
- **200 OK**: Service is running and responding
- **502 Bad Gateway**: Upstream service (7000 or 8000) is down
- **404 Not Found**: Route not defined or static file missing

---

## Port Mapping & Traffic Flow

### Public-Facing Ports

| Port | Protocol | Purpose | Status |
|------|----------|---------|--------|
| 80 | HTTP | Redirect to HTTPS | Open (UFW) |
| 443 | HTTPS | All production traffic | Open (UFW) |

### Internal Service Ports (Loopback Only)

| Port | Service | Framework | Direct Access |
|------|---------|-----------|---------------|
| 7000 | Frontend App | Next.js | ❌ Blocked (127.0.0.1 only) |
| 8000 | Backend API | NestJS | ❌ Blocked (127.0.0.1 only) |
| 3306 | Database | MariaDB | ❌ Blocked (127.0.0.1 only) |

### Traffic Flow Diagram

```
Internet (Port 443)
    ↓
Cloudflare DNS → 145.223.120.93
    ↓
UFW Firewall (Allow 80, 443)
    ↓
Nginx (443 → HTTP/2)
    ↓
    ├─ Static Files → /var/www/lead360.app/public
    ├─ API Proxy → 127.0.0.1:8000 (NestJS)
    └─ App Proxy → 127.0.0.1:7000 (Next.js)
         ↓
    Backend connects to MariaDB (127.0.0.1:3306)
```

---

## Filesystem Structure

### Base Directory
```
/var/www/lead360.app/
```

### Folder Layout

```
/var/www/lead360.app/
├── public/              # Static marketing site (lead360.app, www.lead360.app)
├── api/                 # NestJS API project
│   ├── src/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── .env
│   ├── package.json
│   └── node_modules/
├── app/                 # Next.js application (app + tenant portals)
│   ├── src/
│   ├── .env.local
│   ├── package.json
│   └── node_modules/
└── logs/                # Nginx access/error logs
    ├── access.log
    └── error.log
```

### File Permissions

**Strategy**: Group write enabled for seamless VS Code editing without breaking service permissions

- **Group**: `www-data` (Nginx service group)
- **User**: `root` added to `www-data` group
- **Permissions**: 
  - Directories: `775` (rwxrwxr-x)
  - Files: `664` (rw-rw-r--)

**Command to Fix Permissions**:
```bash
sudo chown -R www-data:www-data /var/www/lead360.app/
sudo chmod -R 775 /var/www/lead360.app/
```

---

## Security & Firewall

### UFW (Uncomplicated Firewall)

**Status**: Active

**Allowed Inbound Ports**:
```bash
80/tcp    # HTTP (redirects to HTTPS)
443/tcp   # HTTPS (all production traffic)
```

**Blocked Ports** (default deny):
- 7000 (Next.js app - internal only)
- 8000 (NestJS API - internal only)
- 3306 (MariaDB - internal only)

### Security Practices
1. **Loopback Binding**: Internal services bind to `127.0.0.1` (not `0.0.0.0`)
2. **Nginx as Gatekeeper**: All public traffic proxied through Nginx
3. **Database Host Restriction**: MariaDB user restricted to `127.0.0.1` and `localhost`
4. **Environment Variables**: Sensitive credentials in `.env` files (not committed to git)
5. **SSL/TLS Enforcement**: All HTTP traffic redirected to HTTPS

---

## Development Workflow

### Starting Services (Development Mode)

#### 1. Start NestJS API (Watch Mode)
```bash
cd /var/www/lead360.app/api
npm run start:dev
```
- Auto-reloads on file changes
- Runs on `http://127.0.0.1:8000`
- Accessible via `https://api.lead360.app`

#### 2. Start Next.js Application (Dev Mode)
```bash
cd /var/www/lead360.app/app
npm run dev -- -p 7000 -H 127.0.0.1
```
- Auto-reloads on file changes
- Runs on `http://127.0.0.1:7000`
- Accessible via `https://app.lead360.app` and `https://{tenant}.lead360.app`

#### 3. Verify Services
```bash
# Check API health
curl https://api.lead360.app/health

# Check App (should return HTML)
curl https://app.lead360.app

# Check tenant portal
curl https://testbusiness.lead360.app
```

### Database Workflow (Prisma)

#### Pull Existing Schema
```bash
cd /var/www/lead360.app/api
npx prisma db pull
```

#### Create New Migration
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name {migration_name}
```

#### Generate Prisma Client
```bash
cd /var/www/lead360.app/api
npx prisma generate
```

#### View Database in Prisma Studio
```bash
cd /var/www/lead360.app/api
npx prisma studio
```
- Opens on `http://localhost:5555`
- Use SSH tunnel if accessing remotely

---

## Troubleshooting Reference

### Common Issues & Solutions

#### Issue: 502 Bad Gateway
**Cause**: Upstream service (7000 or 8000) is not running

**Solution**:
```bash
# Check if processes are running
ps aux | grep node

# Restart API
cd /var/www/lead360.app/api && npm run start:dev

# Restart App
cd /var/www/lead360.app/app && npm run dev -- -p 7000 -H 127.0.0.1
```

#### Issue: Wildcard Subdomain Not Working
**Cause**: DNS A-record pointing to wrong IP or SSL certificate issue

**Solution**:
```bash
# Verify DNS resolves correctly
nslookup testbusiness.lead360.app

# Check Nginx logs
tail -f /var/www/lead360.app/logs/error.log

# Verify SSL certificate includes wildcard
sudo certbot certificates
```

#### Issue: Database Connection Refused
**Cause**: MariaDB not running or wrong connection string

**Solution**:
```bash
# Check MariaDB status
sudo systemctl status mariadb

# Restart MariaDB
sudo systemctl restart mariadb

# Test connection manually
mysql -u lead360_user -p -h 127.0.0.1 lead360
```

#### Issue: CORS Errors from Frontend
**Cause**: API not allowing requests from subdomain

**Solution**:
- Verify CORS configuration in NestJS includes `*.lead360.app` regex
- Check browser console for specific origin being blocked
- Update CORS config in `api/src/main.ts`

#### Issue: Prisma Client Out of Sync
**Cause**: Schema changed but client not regenerated

**Solution**:
```bash
cd /var/www/lead360.app/api
npx prisma generate
npm run build  # If running production build
```

---

## Environment Variables Reference

### API (.env location: `/var/www/lead360.app/api/.env`)

```bash
# Database
DATABASE_URL="mysql://lead360_user:{password}@127.0.0.1:3306/lead360"

# Application
NODE_ENV=development
PORT=8000
API_VERSION=v1

# JWT / Auth
JWT_SECRET={secret_key}
JWT_EXPIRES_IN=7d

# CORS
CORS_ORIGIN=https://app.lead360.app,*.lead360.app

# Twilio (future)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=

# Email Provider (future)
EMAIL_PROVIDER_API_KEY=

# File Storage (future)
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

### App (.env.local location: `/var/www/lead360.app/app/.env.local`)

```bash
# API Endpoint
NEXT_PUBLIC_API_URL=https://api.lead360.app/api/v1

# Application
NODE_ENV=development
PORT=7000

# Auth
NEXTAUTH_URL=https://app.lead360.app
NEXTAUTH_SECRET={secret_key}
```

---

## Nginx Service Management

### Common Commands

```bash
# Test Nginx configuration
sudo nginx -t

# Reload Nginx (without downtime)
sudo systemctl reload nginx

# Restart Nginx (brief downtime)
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx

# View error logs
sudo tail -f /var/www/lead360.app/logs/error.log

# View access logs
sudo tail -f /var/www/lead360.app/logs/access.log
```

---

## Monitoring & Health Checks

### API Health Endpoint
```bash
curl https://api.lead360.app/health
```
**Expected Response**:
```json
{
  "status": "ok",
  "service": "lead360-api",
  "ts": "2026-01-01T12:00:00.000Z"
}
```

### Application Health Check
```bash
curl -I https://app.lead360.app
```
**Expected Response**:
```
HTTP/2 200
```

### Database Connectivity
```bash
mysql -u lead360_user -p -h 127.0.0.1 -e "SELECT 1;"
```

---

## Critical Reminders

### DNS / IP Issues
- ✅ **RESOLVED**: Cloudflare A records now correctly point to `145.223.120.93`
- Previous TLS handshake errors were caused by incorrect IP in DNS

### Service Dependencies
1. **Nginx** must be running (public gateway)
2. **MariaDB** must be running (data layer)
3. **NestJS API** must be running on `127.0.0.1:8000`
4. **Next.js App** must be running on `127.0.0.1:7000`

### Multi-Tenant Parsing
- Subdomains are parsed from `Host` header in Next.js application
- Tenants must exist in database for valid routing
- Reserved subdomains: `app`, `api`, `www`

---

## Production Deployment Considerations (Future)

**Current State**: Development environment with manual process management

**Production Recommendations**:
1. **Process Manager**: PM2 or systemd services for Node apps
2. **Database**: Managed MariaDB instance or replica setup
3. **SSL Auto-Renewal**: Certbot cronjob verified
4. **Monitoring**: APM (New Relic, DataDog) + uptime checks
5. **Backups**: Automated database backups with retention policy
6. **CI/CD**: GitHub Actions or GitLab CI for automated deployments
7. **Rate Limiting**: Nginx or API-level rate limiting per tenant
8. **CDN**: Cloudflare caching for static assets

---

## Document Change Log

| Date | Author | Changes |
|------|--------|---------|
| Jan 2026 | System | Initial infrastructure documentation created |

---

**End of Infrastructure Documentation**

For questions or updates, maintain this document in the project knowledge base.