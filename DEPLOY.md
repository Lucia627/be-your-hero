# Be Your Hero - 云服务器部署指南

## 推荐配置

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 1核 | 2核+ |
| 内存 | 1GB | 2GB+ |
| 带宽 | 3Mbps | 5Mbps+ |
| 系统 | Ubuntu 20.04/22.04 | Ubuntu 22.04 LTS |
| 硬盘 | 10GB SSD | 20GB SSD |

## 快速部署（5分钟）

### 1. 准备云服务器

购买云服务器（阿里云/腾讯云/AWS/腾讯云轻量等），选择 **Ubuntu 22.04**，开放安全组端口：
- `80`（HTTP）
- `443`（HTTPS，可选）
- `8080`（后端直连，可选）

### 2. 上传代码

```bash
# 在本地项目目录打包
zip -r be-your-hero.zip . -x "node_modules/*" ".git/*"

# 上传到服务器（替换为你的服务器IP）
scp be-your-hero.zip root@你的服务器IP:/opt/
```

### 3. 服务器上执行一键部署

```bash
ssh root@你的服务器IP

# 解压
cd /opt && unzip -o be-your-hero.zip -d be-your-hero && cd be-your-hero

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
```

部署脚本会自动完成：
- 安装 Node.js 18 + npm + PM2
- 安装项目依赖
- 创建数据目录和 .env 配置
- 用 PM2 启动集群模式（4 worker）
- 配置防火墙

### 4. 配置环境变量

```bash
nano /opt/be-your-hero/backend/.env
```

写入：
```env
PORT=8080
NODE_ENV=production
LLM_PROVIDER=openai
LLM_API_KEY=你的API密钥
LLM_API_URL=https://api.openai.com/v1/chat/completions
LLM_MODEL=gpt-4o
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW_MS=60000
```

### 5. 重启服务

```bash
cd /opt/be-your-hero/backend
pm2 restart all
```

### 6. 访问游戏

```
http://你的服务器IP:8080
```

---

## 进阶：Nginx + HTTPS（推荐）

### 安装 Nginx

```bash
apt update && apt install -y nginx certbot python3-certbot-nginx
```

### 配置 Nginx

复制 `nginx.conf` 到服务器，修改后使用：

```bash
cp /opt/be-your-hero/nginx.conf /etc/nginx/sites-available/be-your-hero
ln -s /etc/nginx/sites-available/be-your-hero /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx
```

### 配置 SSL（Let's Encrypt）

```bash
certbot --nginx -d yourdomain.com
```

---

## 运维命令

```bash
# 查看服务状态
pm2 status
pm2 logs be-your-hero

# 重启
pm2 restart be-your-hero

# 更新代码后
pm2 reload be-your-hero

# 查看资源使用
pm2 monit

# 开机自启
pm2 startup
pm2 save
```

---

## 数据库迁移

如果是从本地迁移到云服务器：

```bash
# 本地导出数据库
scp C:\Users\a1246\be-your-hero\backend\data\game.db root@服务器IP:/opt/be-your-hero/backend/data/

# 服务器上设置权限
chmod 644 /opt/be-your-hero/backend/data/game.db
```

---

## 性能优化（已内置）

- ✅ Gzip 压缩
- ✅ 静态资源缓存 24h
- ✅ PM2 Cluster 模式（多核利用）
- ✅ 请求限流保护
- ✅ 图片已压缩 60%
