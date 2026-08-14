# 血栓检测服务小程序 · 全栈工程

> Users can log in to this WeChat mini-program to purchase the corresponding package based on the thrombosis test results provided by the hospital.

面向血栓检测与抗凝用药管理场景的全栈项目，包含三个工程：

| 工程 | 技术栈 | 说明 |
|------|--------|------|
| `backend/` | Java 21 + Spring Boot 3.3 + MyBatis-Plus + MySQL 8 | 后端接口（契约 A~K 全部实现） |
| `miniapp/` | 原生微信小程序（单 AppID） | 用户端 18 页 + 医护端 5 页（登录页合并，共 23 页） |
| `admin/` | Vue 3 + Vite + Pinia + Element Plus + ECharts | 管理端（平台管理员 6 菜单 / 医院管理员 3 菜单） |

规格文档：`血栓检测小程序-前端开发规格文档.md`（唯一规格依据）
设计 Token：`design-tokens.json`、`overview.md`、`接口契约清单.md`

---

## 一、数据库（MySQL）

1. 启动本地 MySQL（本机已装 9.7，root/123456），或 Docker：`docker run -d -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 -e MYSQL_DATABASE=thrombosis mysql:8`
2. 执行初始化脚本（幂等，可重复执行）：
   ```
   mysql -uroot -p123456 < backend/src/main/resources/db/schema.sql
   mysql -uroot -p123456 thrombosis < backend/src/main/resources/db/seed.sql
   ```
3. 连接配置在 `backend/src/main/resources/application-dev.yml`

## 二、后端（Spring Boot）

```bash
cd backend
./mvnw.cmd spring-boot:run        # Windows；macOS/Linux 用 ./mvnw
# 或
java -jar target/thrombosis-backend-1.0.0.jar --server.port=8080
```

启动后自动创建测试账号（BCrypt 加密）：

| 账号 | 密码 | 角色 |
|------|------|------|
| 微信登录（任意 code） | - | 用户 |
| 13800000000 | 123456 | 医护 staff |
| admin | admin123 | 平台管理员 |
| hospital_admin | admin123 | 医院管理员（北京协和） |

**开发态模拟开关**（`application-dev.yml`）：
- 验证码固定 `123456`（短信不真实发送）
- 支付走 `POST /api/payment/mock-callback` 模拟微信回调（无需商户号）
- 微信登录用任意 code 映射测试 openid

## 三、小程序（miniapp）

1. 微信开发者工具 → 导入项目 → 选择 `miniapp/` 目录（appid 留 `touristappid` 或填自己的）
2. **详情 → 本地设置 → 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」**（否则无法访问本地 `http://localhost:8080`）
3. 启动后端后即可完整演示：微信登录（任意 code）→ 注册（验证码 123456）→ 选套餐 → 下单 → 模拟支付 → 查看核销码 → 医护登录（13800000000/123456）扫码核销

单 AppID 分流：登录页含「用户登录 / 医护登录」切换；user 分流到 4 tab 首页，staff 分流到医护工作台（医护页无 tabBar、带角色守卫）。

## 四、管理端（admin）

```bash
cd admin
npm install
npm run dev        # http://localhost:5173，/api 代理到 localhost:8080
```

- 平台管理员：`admin / admin123`（6 菜单、全量金额）
- 医院管理员：`hospital_admin / admin123`（3 菜单、锁定本院、金额隐藏）

## 五、联调切换（生产对接）

1. 后端：`application-prod.yml` 配置真实 MySQL、JWT 密钥、微信 appid/secret/商户号（环境变量注入）
2. 小程序：`miniapp/config/index.js` 修改 `BASE_URL`、订阅模板 ID；`DEV.requestPaymentMock=false` 走真实 `wx.requestPayment`
3. 管理端：`.env.production` 配置 `VITE_BASE_URL`

## 六、适老化硬性规范（全站）

正文 ≥36rpx、辅助 ≥32rpx、全站无 <28rpx 文字；关键数字（核销码/金额/剂量）≥60rpx；按钮 ≥96rpx 高、全圆角；点击热区 ≥88rpx；列表行高 ≥120rpx；底部安全区适配；零 emoji（图标为本地资源）。
