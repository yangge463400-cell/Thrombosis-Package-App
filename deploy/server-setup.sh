#!/usr/bin/env bash
# ============================================================
# 血栓检测服务 · 腾讯云服务器一键部署脚本
#
# 前置（本地已完成，见 deploy/README.md）：
#   /opt/thrombosis/thrombosis-backend.jar   后端 jar（已上传）
#   /opt/thrombosis/db/schema.sql seed.sql   数据库脚本（已上传）
#   /opt/thrombosis/admin-dist/              管理端静态文件（已上传）
#   /etc/nginx/certs/jiangsuhongqing.com.pem/.key   SSL 证书（已上传，可选）
#
# 用法：root 登录服务器后  bash server-setup.sh
# 可重复执行：env 文件不覆盖；演示数据清理只做一次
# ============================================================
set -uo pipefail

DOMAIN="jiangsuhongqing.com"
APP_DIR="/opt/thrombosis"
DB_NAME="thrombosis"
DB_USER="thrombosis"
DB_PASS='Thrombosis@2026'            # ← 数据库密码，可修改
ADMIN_PASS='Admin@2026'              # ← 平台管理员初始密码（admin）
HOSPITAL_ADMIN_PASS='Hospital@2026'  # ← 医院管理员初始密码（hospital_admin）
STAFF_PASS='Doctor@2026'             # ← 医护初始密码（13800000000）

echo "== [0/6] 前置检查 =="
[ -f "$APP_DIR/thrombosis-backend.jar" ] || { echo "!! 缺少 $APP_DIR/thrombosis-backend.jar，请先在本地打包上传"; exit 1; }
[ -f "$APP_DIR/db/schema.sql" ] || { echo "!! 缺少 $APP_DIR/db/schema.sql，请先上传"; exit 1; }
mkdir -p "$APP_DIR/admin-dist" /etc/nginx/certs

echo "== [1/6] 安装 JDK21 / MySQL / Nginx =="
if command -v apt >/dev/null 2>&1; then
  export DEBIAN_FRONTEND=noninteractive
  apt update -y && apt install -y openjdk-21-jre-headless mysql-server nginx openssl curl
  systemctl enable --now mysql
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y java-21-openjdk java-21-openjdk-devel mysql-server nginx openssl curl
  systemctl enable --now mysqld
  echo ">> 提示：CentOS/TencentOS 的 MySQL 首次 root 临时密码见 /var/log/mysqld.log，"
  echo ">> 若下方数据库步骤失败，请先手动登录改密后重跑本脚本"
else
  echo "!! 未识别的包管理器，请手动安装 openjdk-21 / mysql-server / nginx"; exit 1
fi
java -version 2>&1 | head -1

echo "== [2/6] MySQL 初始化 =="
# 以 root 连接（兼容 Ubuntu auth_socket 与密码两种方式）
sql_root() {
  if mysql -uroot -e "SELECT 1" >/dev/null 2>&1; then mysql -uroot "$@";
  elif sudo mysql -e "SELECT 1" >/dev/null 2>&1; then sudo mysql "$@";
  else echo "!! 无法以 root 连接 MySQL，请先设置 root 密码后重试"; exit 1; fi
}
sql_root <<'SQL'
CREATE DATABASE IF NOT EXISTS thrombosis DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
SQL
sql_root <<SQL
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
ALTER USER '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
# MySQL 只监听本机
grep -qs "^bind-address.*127.0.0.1" /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || \
  echo "bind-address = 127.0.0.1" >> /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null || true
grep -qs "^bind-address" /etc/my.cnf 2>/dev/null || \
  sed -i '/\[mysqld\]/a bind-address=127.0.0.1' /etc/my.cnf 2>/dev/null || true
systemctl restart mysql 2>/dev/null || systemctl restart mysqld 2>/dev/null || true
sleep 2

# 建表 + 基础数据
M="mysql -u${DB_USER} -p${DB_PASS} -h127.0.0.1 ${DB_NAME}"
$M < "$APP_DIR/db/schema.sql"
$M < "$APP_DIR/db/seed.sql"
# 生产：清理演示业务数据（仅首次执行；账号由后端首启自动创建）
if [ ! -f "$APP_DIR/.db-cleaned" ]; then
  $M <<'SQL'
DELETE FROM pay_bill; DELETE FROM test_result; DELETE FROM verify_record;
DELETE FROM medication_record; DELETE FROM medication;
DELETE FROM message; DELETE FROM orders; DELETE FROM user;
SQL
  touch "$APP_DIR/.db-cleaned"
  echo ">> 演示业务数据已清理"
fi

echo "== [3/6] 后端环境变量与 systemd 托管 =="
if [ ! -f "$APP_DIR/thrombosis.env" ]; then
  JWT=$(openssl rand -hex 32)
  cat > "$APP_DIR/thrombosis.env" <<EOF
SPRING_PROFILES_ACTIVE=prod
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
JWT_SECRET=${JWT}
WX_APPID=
WX_SECRET=
CORS_ORIGINS=https://${DOMAIN}
INIT_ADMIN_PASSWORD=${ADMIN_PASS}
INIT_HOSPITAL_ADMIN_PASSWORD=${HOSPITAL_ADMIN_PASS}
INIT_STAFF_PASSWORD=${STAFF_PASS}
EOF
  chmod 600 "$APP_DIR/thrombosis.env"
  echo ">> 已生成 $APP_DIR/thrombosis.env（WX_APPID/WX_SECRET 拿到后填入并重启服务）"
else
  echo ">> $APP_DIR/thrombosis.env 已存在，跳过（如需重置请手动删除后重跑）"
fi

cat > /etc/systemd/system/thrombosis.service <<EOF
[Unit]
Description=Thrombosis backend (Spring Boot)
After=network.target mysql.service

[Service]
Type=simple
WorkingDirectory=${APP_DIR}
EnvironmentFile=${APP_DIR}/thrombosis.env
ExecStart=/usr/bin/java -Xms1g -Xmx2g -jar ${APP_DIR}/thrombosis-backend.jar
SuccessExitStatus=143
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now thrombosis
sleep 8
echo "-- 后端自检："
curl -s http://127.0.0.1:8080/api/hospitals | head -c 100; echo

echo "== [4/6] Nginx + HTTPS =="
CERT="/etc/nginx/certs/${DOMAIN}.pem"
KEY="/etc/nginx/certs/${DOMAIN}.key"
NG_CONF=""
if [ -d /etc/nginx/sites-available ]; then
  NG_CONF="/etc/nginx/sites-available/thrombosis"
  rm -f /etc/nginx/sites-enabled/default
  ln -sf "$NG_CONF" /etc/nginx/sites-enabled/thrombosis
else
  NG_CONF="/etc/nginx/conf.d/thrombosis.conf"
fi

if [ -f "$CERT" ] && [ -f "$KEY" ]; then
  cat > "$NG_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}
server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN} www.${DOMAIN};
    ssl_certificate     ${CERT};
    ssl_certificate_key ${KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    root ${APP_DIR}/admin-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
    location / { try_files \$uri \$uri/ /index.html; }
    client_max_body_size 10m;
}
EOF
else
  echo ">> 未检测到证书（$CERT），先写 HTTP 配置；上传证书后重跑本脚本即自动切换 HTTPS"
  cat > "$NG_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${APP_DIR}/admin-dist;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        location / { try_files \$uri \$uri/ /index.html; }
    }
    location / { try_files \$uri \$uri/ /index.html; }
    client_max_body_size 10m;
}
EOF
fi
nginx -t && systemctl reload nginx

echo "== [5/6] 防火墙放行（云上安全组仍需控制台放行 80/443）=="
command -v ufw >/dev/null 2>&1 && ufw allow 80/tcp && ufw allow 443/tcp
command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --permanent --add-service=http --add-service=https && firewall-cmd --reload
echo ">> 完成"

echo "== [6/6] 验证 =="
echo "后端:    curl http://127.0.0.1:8080/api/hospitals"
[ -f "$CERT" ] && echo "外网:    https://${DOMAIN}/api/hospitals   与   https://${DOMAIN}（管理端）"
echo "默认管理端账号: admin / \$INIT_ADMIN_PASSWORD（见 $APP_DIR/thrombosis.env）"
