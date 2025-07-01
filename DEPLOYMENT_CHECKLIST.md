# Production Deployment Checklist

## Pre-Deployment Setup ✅

### Local Environment (MacBook)
- [ ] All code changes committed and tested locally
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Backend tests pass
- [ ] Docker is running locally
- [ ] Logged into Docker Hub (`docker login`)

### TrueNAS/Server Environment  
- [ ] Database files copied to `/mnt/volume1/docker/twinsuns/databases/`
- [ ] Directory structure correct:
  ```
  /mnt/volume1/docker/twinsuns/databases/
  ├── app_db/swu_app.db
  └── cards_db/swu_cards.db
  ```
- [ ] Portainer accessible and running
- [ ] Network ports 4000 and 8000 available

## Deployment Steps ✅

### 1. Build and Push Images (MacBook)
- [ ] Run `chmod +x deploy.sh` (first time only)
- [ ] Execute `./deploy.sh`
- [ ] Verify both images pushed to Docker Hub:
  - chanfriendly/starwarsunlimited-db-api-frontend:latest
  - chanfriendly/starwarsunlimited-db-api-backend:latest

### 2. Deploy Stack in Portainer (TrueNAS)
- [ ] Copy `docker-compose.prod.yaml` content
- [ ] Create new stack in Portainer named "twinsuns" 
- [ ] Paste compose file content
- [ ] Verify environment variables (especially server IP: 192.168.1.124)
- [ ] Deploy stack
- [ ] Check all containers start successfully

### 3. Verify Deployment
- [ ] Backend health check: `http://192.168.1.124:8000/health`
- [ ] Frontend accessible: `http://192.168.1.124:4000`
- [ ] API endpoints working: `http://192.168.1.124:8000/api/cards/`
- [ ] Check container logs for any errors
- [ ] Verify database connections working

## Post-Deployment ✅

### Testing
- [ ] Basic functionality test (browse cards, search, etc.)
- [ ] Cross-browser testing
- [ ] Mobile responsive testing
- [ ] Performance check (page load times)

### Security & Maintenance  
- [ ] Change JWT_SECRET from default value
- [ ] Set up automated backups for databases
- [ ] Document any custom configurations
- [ ] Plan update/rollback strategy

## Rollback Plan 🚨

If deployment fails:
1. Stop the stack in Portainer
2. Check container logs for specific errors
3. Verify database file permissions and locations
4. Re-deploy previous working version if needed
5. Review this checklist for missed steps

## Common Issues & Solutions 🔧

| Issue | Solution |
|-------|----------|
| Database connection errors | Check volume mount paths |
| Frontend can't reach backend | Verify CORS and API URL settings |
| Images won't pull | Confirm Docker Hub images exist and are public |
| Health checks failing | Check if services are actually running inside containers |

---

**Emergency Contact**: Check container logs first, then review README.md troubleshooting section.