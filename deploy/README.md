# 腾讯云 CVM 部署指南（后端 + 管理端 + 小程序上线）

> 目标机器：腾讯云 CVM（4核8G，公网 139.199.226.197），Linux
> 架构：微信小程序 / 浏览器 → Nginx(443, HTTPS+备案域名) → 127.0.0.1:8080(Spring Boot jar) → 127.0.0.1:3306(MySQL)

---

## 0. 上线前置条件清单（先逐项确认）

| 条件 | 状态要求 | 办理渠道 | 周期 |
|---|---|---|---|
| **已备案域名** | 小程序硬性要求（request 合法域名必须备案+HTTPS） | 腾讯云备案控制台 | 约 1~2 周 |
| **SSL 证书** | 同上 | 腾讯云免费 DV 证书（绑定域名后秒发） | 即时 |
| **微信小程序账号** | 提供 AppID / AppSecret 给后端 | mp.weixin.qq.com | 注册即得 |
| **小程序类目资质** | "医疗健康"类目通常要求《医疗机构执业许可证》等，先在 mp 平台确认可选类目与资质 | mp.weixin.qq.com | 视资质 |
| **短信服务** | 生产注册验证码：腾讯云 SMS（企业认证+签名/模板审批），后端接入后替换 AuthService.sendCode 的 fail-closed 分支 | console.cloud.tencent.com/sms | 审批 1~3 天 |
| **微信支付（如需线上收款）** | 商户号（营业执照+对公账户）+ APIv3 密钥证书；**后端真实支付尚未实现，需开发**（当前仅 mock） | pay.weixin.qq.com | 1~2 周+开发 |
| **用户隐私保护指引** | mp 平台"设置→服务内容声明→用户隐私保护指引"需填写并通过 | mp.weixin.qq.com | 即时 |

> 代码侧已内置的生产姿态（无需额外操作）：mock 登录/支付/验证码在生产 profile 全部关闭且 fail-closed；种子账号密码支持环境变量注入。

---

## 1. 服务器初始化（SSH 登录 CVM 后执行）

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y mysql-server nginx
sudo apt install -y openjdk-21-jre-headless

# TencentOS/CentOS 则用 yum/dnf：
# sudo dnf install -y java-21-openjdk java-21-openjdk-devel mysql-server nginx

java -version   # 确认 21

# MySQL 只监听本机（安全）
sudo sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' /etc/mysql/mysql.conf.d/mysqld.conf 2>/dev/null || true
sudo systemctl enable --now mysql
```

## 2. 数据库初始化

```bash
sudo mysql <<'SQL'
CREATE DATABASE thrombosis DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER 'thrombosis'@'127.0.0.1' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON thrombosis.* TO 'thrombosis'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# 建表 + 基础数据（字典/医院/套餐/banner）。注意：seed.sql 含演示订单等，
# 生产导入后执行下面的"演示数据清理 SQL"
mysql -u thrombosis -p thrombosis < backend/src/main/resources/db/schema.sql
mysql -u thrombosis -p thrombosis < backend/src/main/resources/db/seed.sql

# 生产：清理演示业务数据（保留字典/医院/套餐/banner）
mysql -u thrombosis -p thrombosis <<'SQL'
DELETE FROM pay_bill; DELETE FROM test_result; DELETE FROM verify_record;
DELETE FROM medication_record; DELETE FROM medication;
DELETE FROM message; DELETE FROM orders;
DELETE FROM user;   -- 账号由服务首次启动自动创建（见下）
SQL
```

服务首次启动时会自动创建：平台管理员、医院管理员、医护各 1 个（初始密码来自环境变量，见第 3 步）。

## 3. 后端打包与 systemd 托管

本地打包：

```bash
cd backend && ./mvnw.cmd -o -q clean package -DskipTests
# 产物：backend/target/thrombosis-backend-*.jar
scp target/thrombosis-backend-*.jar user@139.199.226.197:/opt/thrombosis/thrombosis-backend.jar
```

服务器上创建 `/opt/thrombosis/thrombosis.env`（权限 600，**不要提交 git**）：

```bash
SPRING_PROFILES_ACTIVE=prod
DB_HOST=127.0.0.1
DB_NAME=thrombosis
DB_USER=thrombosis
DB_PASSWORD=第2步设置的数据库密码
JWT_SECRET=openssl rand -hex 32 生成的值（至少32字符，勿复用仓库里的旧值）
WX_APPID=你的小程序AppID
WX_SECRET=你的小程序AppSecret
CORS_ORIGINS=https://你的域名
INIT_ADMIN_PASSWORD=平台管理员初始强密码
INIT_HOSPITAL_ADMIN_PASSWORD=医院管理员初始强密码
INIT_STAFF_PASSWORD=医护初始强密码
```

使用 `deploy/thrombosis.service`（本目录已提供）：

```bash
sudo cp deploy/thrombosis.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now thrombosis
sudo journalctl -u thrombosis -f    # 看日志，出现"Started ThrombosisApplication"即成功
curl http://127.0.0.1:8080/api/hospitals   # 本机自测
```

## 4. 管理端构建与部署

```bash
# 本地
cd admin && npm run build     # 产物 admin/dist/
scp -r dist/* user@139.199.226.197:/opt/thrombosis/admin-dist/
```

## 5. Nginx + HTTPS

1. 域名解析 A 记录 → 139.199.226.197；完成 ICP 备案
2. 腾讯云 SSL 控制台申请免费 DV 证书（域名验证后下载 nginx 格式）
3. 参考本目录 `nginx.conf.sample` 配置（管理端静态 + /api 反代 + HTTP 跳 HTTPS）
4. 腾讯云控制台【安全组】放行 80/443（**不要放行 3306/8080**）

验证：

```bash
curl https://你的域名/api/hospitals          # {"code":0,...}
浏览器打开 https://你的域名                   # 管理端登录页
```

## 6. 小程序上线步骤

1. `miniapp/config/index.js`：`BASE_URL` 改为 `https://你的域名`；确认 `DEV.requestPaymentMock`（支付未接入前保持 true 只适用于演示，正式版支付不可用，见"缺口"）
2. 微信开发者工具 → 导入项目（填你的 AppID）→ 真机预览联调
3. mp.weixin.qq.com → 开发管理 → 开发设置 → **服务器域名**：request 合法域名填 `https://你的域名`
4. mp 平台填写**用户隐私保护指引**（收集手机号/健康信息需声明用途）
5. 开发者工具 → 上传 → mp 平台设为**体验版**（体验成员真机验收）
6. 验收通过 → 提交审核 → 发布

## 7. 上线前安全清单（必做）

- [ ] `JWT_SECRET` 使用全新随机值（仓库 dev 配置里的旧密钥已随代码公开，严禁复用）
- [ ] 三个种子账号初始密码已通过环境变量注入强密码；**首次登录后再次修改**并妥善保管
- [ ] 安全组仅放行 22/80/443；MySQL 绑定 127.0.0.1
- [ ] 生产确认 mock 全关：启动日志应出现 `微信登录模式：真实 code2session`（配置了 WX 凭据）或 `不可用`（未配置，登录被拒属预期）
- [ ] 演示数据已清理（第 2 步 SQL）
- [ ] `thrombosis.env` 权限 600、不进 git

## 8. 已知上线缺口（需要产品/资质决策，非部署可解）

1. **真实微信支付未实现**：当前仅 mock。正式版用户无法支付，需微信支付商户号 + 后端开发（下单签名/回调验签/对账）。未接入前建议审核版本隐藏支付入口或以线下收款过渡。
2. **真实短信未接入**：生产注册验证码 fail-closed（接口返回"短信服务未接入"），需接入腾讯云 SMS。
3. **医疗类目资质**：小程序"医疗健康"类目审核要求医疗机构资质，请先在 mp 平台确认。
