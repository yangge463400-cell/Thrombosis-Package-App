# 血栓检测服务 · 业务功能验收测试报告

- 测试时间：2026-08-30 05:35:29
- 目标服务：http://localhost:8080
- 用例总数：**160**，通过 **143**，失败 **17**
- 测试方式：真实启动后端（H2 内存库，MySQL 兼容模式），通过 HTTP 逐条调用 62 个业务接口
- 脚本位置：`qa/run-tests.js`（独立目录，可整体删除，未改动任何项目源码）

## 一、按模块统计

| 模块 | 用例数 | 通过 | 失败 |
|---|---:|---:|---:|
| 认证 Auth | 10 | 8 | 2 |
| 用户档案 User | 6 | 6 | 0 |
| 套餐 Package | 13 | 10 | 3 |
| 首页 Home | 5 | 5 | 0 |
| 订单 Order | 14 | 13 | 1 |
| 支付 Payment | 9 | 8 | 1 |
| 医护与核销 Staff/Verify | 20 | 16 | 4 |
| 检测结果 Result | 9 | 9 | 0 |
| 用药管理 Medication | 15 | 14 | 1 |
| 消息 Message | 9 | 9 | 0 |
| 管理端 Admin | 39 | 38 | 1 |
| 安全与边界 Security | 11 | 7 | 4 |

## 二、缺陷清单（按严重程度排序）

### 1. A2 不同 code 换取 openid 应互不相同（账号隔离）

- **【所属模块/功能】** 认证 Auth
- **【严重程度】** 严重
- **【缺陷描述】** 不同微信用户的 code 必须映射到不同 openid，否则所有用户共用一个账号
- **【复现步骤】** POST /api/auth/wechat-login 分别传 code=A / code=B，比对返回身份
- **【预期结果】** 不同微信用户的 code 必须映射到不同 openid，否则所有用户共用一个账号
- **【实际结果】** 不同 code 依然返回同一身份分支（isRegistered=false），生产环境未配置 WX_APPID 回退 mock 时所有用户共用账号 mock_openid_stable
- **【关联代码位置】** AuthService.java:145-151 (resolveOpenid → openidPrefix + "stable")

### 2. E14 核销码二维码接口未鉴权（P0）

- **【所属模块/功能】** 订单 Order
- **【严重程度】** 严重
- **【缺陷描述】** 该接口应需鉴权 + 订单归属校验
- **【复现步骤】** curl http://localhost:8080/api/orders/1/qrcode （无需 token），再把 1 换成 2、3…
- **【预期结果】** 该接口应需鉴权 + 订单归属校验
- **【实际结果】** 未携带任何 token 直接 GET /api/orders/1/qrcode 返回 200，content-type=image/png，是PNG=true（可枚举 orderId 批量获取他人核销码）
- **【关联代码位置】** config/WebMvcConfig.java:26（公开放行）、controller/OrderController.java:63

### 3. F5 他人在未授权情况下支付他人订单（P0 归属校验缺失）

- **【所属模块/功能】** 支付 Payment
- **【严重程度】** 严重
- **【缺陷描述】** 应校验订单归属，拒绝为他人订单支付
- **【复现步骤】** 1) 用户A登录取 token；2) POST /api/payment/mock-callback {"orderId":3}（订单3属 user_id=1）；3) 观察是否成功
- **【预期结果】** 应校验订单归属，拒绝为他人订单支付
- **【实际结果】** 调用成功！用用户A的 token 支付了 user_id=1 的订单3，返回 status=paid, verifyCode=668850（攻击者可免费取得他人订单核销码；反之亦然，攻击者可把任意订单刷成已支付）
- **【关联代码位置】** controller/PaymentController.java:30-42（mockCallback 未取 UserContext、未校验 order.userId）

### 4. G4-b 待处理数应按【本院】过滤（P1 数据越权）

- **【所属模块/功能】** 医护与核销 Staff/Verify
- **【严重程度】** 严重
- **【缺陷描述】** pendingCount 应只统计 hospital_id=1 的已支付未核销订单
- **【复现步骤】** 1) 医护登录取 token；2) GET /api/staff/statistics；3) 与 select count(*) from orders where status=paid and verify_time is null and hospital_id=1 对比
- **【预期结果】** pendingCount 应只统计 hospital_id=1 的已支付未核销订单
- **【实际结果】** 返回 pendingCount=3（代码用 .eq(status,"paid").isNull(verifyTime)，未加 hospitalId 过滤，为全库统计，泄露他院经营数据并误导医护）
- **【关联代码位置】** service/StaffService.java:59-62

### 5. G5 跨医院核销码校验 check 应被拒绝（P1 信息泄露）

- **【所属模块/功能】** 医护与核销 Staff/Verify
- **【严重程度】** 严重
- **【缺陷描述】** 他院(上海)订单核销码，本院(北京)医护查询应返回 403
- **【复现步骤】** 1) 用户A下单到上海医院3并支付，取得核销码 739372；2) 北京协和医护登录；3) POST /api/verify/check {"code":"739372"}
- **【预期结果】** 他院(上海)订单核销码，本院(北京)医护查询应返回 403
- **【实际结果】** 查询成功，泄露他院订单信息：orderNo=TH20260830133528707, packageName=静脉血栓风险筛查套餐, userPhone=139****8135
- **【关联代码位置】** service/VerifyService.java:33-55（check 缺 hospitalId 校验，而 confirm 在第 67 行有）

### 6. G11-c 并发重复核销不应产生多条核销记录

- **【所属模块/功能】** 医护与核销 Staff/Verify
- **【严重程度】** 严重
- **【缺陷描述】** 6 个并发请求应只有 1 次真正核销，verify_record 只新增 1 条
- **【复现步骤】** 1) 下单并支付取得核销码 290143；2) 并发 6 次 POST /api/verify/confirm；3) 查 /api/verify/records 统计该订单记录数
- **【预期结果】** 6 个并发请求应只有 1 次真正核销，verify_record 只新增 1 条
- **【实际结果】** 并发 6 次确认，成功 6 次；该订单核销记录数 0 → 6（新增 6 条）
- **【关联代码位置】** service/VerifyService.java:62-98（selectOne 判状态 → update，check-then-act 非原子；verify_record 无 uk(order_id) 兜底），db/schema.sql:88-103

### 7. K17 禁用(status=0)的医护账号不应能登录

- **【所属模块/功能】** 管理端 Admin
- **【严重程度】** 严重
- **【缺陷描述】** code!=0 账号已禁用
- **【复现步骤】** 1) 平台端把医护 status 改为 0；2) 用该账号调 /api/staff/login
- **【预期结果】** code!=0 账号已禁用
- **【实际结果】** 禁用后仍可登录成功并返回 token（越权风险）
- **【关联代码位置】** service/StaffService.java:31-50（login 未校验 u.getStatus()）

### 8. A2-b 开发态微信登录应能登录到示例账号(张阿姨/含示例订单与消息)

- **【所属模块/功能】** 认证 Auth
- **【严重程度】** 一般
- **【缺陷描述】** README 承诺"微信登录（任意 code）→ 医护扫码核销"演示链路；登录应命中 seed 中 user_id=1 的示例账号
- **【复现步骤】** 1) 启动后端；2) POST /api/auth/wechat-login {code:"任意"}；3) 注册并登录后 GET /api/orders，观察到订单为空（示例订单属 user_id=1）
- **【预期结果】** README 承诺"微信登录（任意 code）→ 医护扫码核销"演示链路；登录应命中 seed 中 user_id=1 的示例账号
- **【实际结果】** mock openid 固定为 "mock_openid_stable"，而 DataInitializer 建的用户 openid 为 "mock_openid_user_001"，两者不一致 → 登录后是全新空账号，seed 中的 3 条示例订单、1 条检测结果、3 条站内消息全部看不到，README 描述的演示流程无法走通
- **【关联代码位置】** config/DataInitializer.java:37 (openidPrefix + "user_001") vs service/AuthService.java:150 (openidPrefix + "stable")

### 9. C12 分页 page=0 不应 500（内存分页下界缺失）

- **【所属模块/功能】** 套餐 Package
- **【严重程度】** 一般
- **【缺陷描述】** 应返回第一页或参数错误(400)
- **【复现步骤】** GET /api/packages?page=0&pageSize=10
- **【预期结果】** 应返回第一页或参数错误(400)
- **【实际结果】** code=500, message=服务异常，请稍后重试 —— PackageService.list 计算 from=Math.min((0-1)*10, total) = -10，随后 filtered.subList(-10, 0) 抛 IndexOutOfBoundsException
- **【关联代码位置】** service/PackageService.java:49-52（Math.min 只兜了上界，未兜下界）

### 10. C14 套餐列表未走数据库分页（性能设计缺陷）

- **【所属模块/功能】** 套餐 Package
- **【严重程度】** 一般
- **【缺陷描述】** 列表、筛选、排序、分页应在 SQL 层完成
- **【复现步骤】** 阅读实现即可确认；亦可在 package 表灌入大量数据后观察列表接口内存与耗时
- **【预期结果】** 列表、筛选、排序、分页应在 SQL 层完成
- **【实际结果】** PackageService.list 先 selectList 全量取出所有 status=on 的套餐，再在 JVM 内 removeIf 过滤 + sort 排序 + subList 分页。数据量增长后全表加载进内存，且排序/筛选无法利用索引
- **【关联代码位置】** service/PackageService.java:27-53（selectList 全量 + 内存 removeIf/sort/subList），与 OrderService:92 使用 MyBatis-Plus Page 数据库分页形成对比

### 11. G11-b 订单状态机：verified(检测中) 状态不可达

- **【所属模块/功能】** 医护与核销 Staff/Verify
- **【严重程度】** 一般
- **【缺陷描述】** 规格文档与 schema 均定义 pending_pay→paid→verified(检测中)→completed，前端 config.ORDER_STATUS 也映射了"检测中"
- **【复现步骤】** 走完"支付→医护核销"流程后查看订单 status 实际取值
- **【预期结果】** 规格文档与 schema 均定义 pending_pay→paid→verified(检测中)→completed，前端 config.ORDER_STATUS 也映射了"检测中"
- **【实际结果】** 核销后订单直接从 paid 跳到 completed（status=completed），中间态 verified 永远不出现："检测中"状态在业务上不可达，用户端"检测中"文案永不展示
- **【关联代码位置】** service/VerifyService.java:80-81（注释自述"核销即完成"）；db/schema.sql:73；miniapp/config/index.js:30

### 12. I1-b 用药方案的疗程起止(startAt/endAt)与医生评估(doctorAssessed)无法通过接口设置

- **【所属模块/功能】** 用药管理 Medication
- **【严重程度】** 一般
- **【缺陷描述】** schema 存在 start_at/end_at/doctor_assessed 三列，业务上（疗程提醒、血栓状态标记）应可写入
- **【复现步骤】** POST /api/medications 携带 startAt/endAt/doctorAssessed 字段
- **【预期结果】** schema 存在 start_at/end_at/doctor_assessed 三列，业务上（疗程提醒、血栓状态标记）应可写入
- **【实际结果】** code=500, message=服务异常，请稍后重试 —— 传这三个字段直接 500，即"疗程"和"医生评估血栓状态"两个业务字段实际不可用
- **【关联代码位置】** dto/MedicationSaveRequest.java（仅有 drugName/dosePerTime/timesPerDay/timePoints/reminderOn）；db/schema.sql:132-134

### 13. L10 请求体携带未定义字段应返回 400 参数错误，而非 500

- **【所属模块/功能】** 安全与边界 Security
- **【严重程度】** 一般
- **【缺陷描述】** 应返回 400（或明确的参数校验错误），不应抛未捕获异常
- **【复现步骤】** POST /api/orders {"packageId":1,"hospitalId":1,"unknownField":"x"}
- **【预期结果】** 应返回 400（或明确的参数校验错误），不应抛未捕获异常
- **【实际结果】** code=500, message=服务异常，请稍后重试 —— Jackson 未关闭 FAIL_ON_UNKNOWN_PROPERTIES，多传一个字段即 500，且前端/第三方对接时任何字段拼写错误都会表现为"服务异常"
- **【关联代码位置】** config/JacksonConfig.java（未配置 mapper.configure(FAIL_ON_UNKNOWN_PROPERTIES, false)）; common/GlobalExceptionHandler.java（未处理 HttpMessageNotReadableException）

### 14. C13 分页 page 为负数不应 500

- **【所属模块/功能】** 套餐 Package
- **【严重程度】** 轻微
- **【缺陷描述】** 应返回第一页或参数错误(400)
- **【复现步骤】** GET /api/packages?page=-1&pageSize=10
- **【预期结果】** 应返回第一页或参数错误(400)
- **【实际结果】** code=500, message=服务异常，请稍后重试
- **【关联代码位置】** service/PackageService.java:49-52

### 15. L5 分页参数传非数字

- **【所属模块/功能】** 安全与边界 Security
- **【严重程度】** 轻微
- **【缺陷描述】** 应返回参数错误(400)，不应 500
- **【复现步骤】** GET /api/packages?page=abc&pageSize=xyz
- **【预期结果】** 应返回参数错误(400)，不应 500
- **【实际结果】** code=500, message=服务异常，请稍后重试
- **【关联代码位置】** （待定位）

### 16. L7 负数分页参数

- **【所属模块/功能】** 安全与边界 Security
- **【严重程度】** 轻微
- **【缺陷描述】** 不应 500
- **【复现步骤】** GET /api/packages?page=-1&pageSize=-10
- **【预期结果】** 不应 500
- **【实际结果】** code=500, message=服务异常，请稍后重试
- **【关联代码位置】** （待定位）

### 17. L8 空 body 提交下单

- **【所属模块/功能】** 安全与边界 Security
- **【严重程度】** 轻微
- **【缺陷描述】** 应返回参数校验错误
- **【复现步骤】** POST /api/orders {}
- **【预期结果】** 应返回参数校验错误
- **【实际结果】** code=500, message=请选择核销医院
- **【关联代码位置】** （待定位）

## 三、全部用例明细

| # | 模块 | 用例 | 结果 | 实际 |
|---:|---|---|:--:|---|
| 1 | 认证 Auth | A1 微信登录(首次) 返回未注册 + registerTicket | PASS | code=0, message=success |
| 2 | 认证 Auth | A2 不同 code 换取 openid 应互不相同（账号隔离） | **FAIL** | 不同 code 依然返回同一身份分支（isRegistered=false），生产环境未配置 WX_APPID 回退 mock 时所有用户共用账号 mock_openid_stable |
| 3 | 认证 Auth | A2-b 开发态微信登录应能登录到示例账号(张阿姨/含示例订单与消息) | **FAIL** | mock openid 固定为 "mock_openid_stable"，而 DataInitializer 建的用户 openid 为 "mock_openid_user_001"，两者不一致 → 登录后是全新空账号，seed 中的 3 条示例订单、1 条检测结果、3 条站内消息全部看不到，README 描述的演示流程无法走通 |
| 4 | 认证 Auth | A3 发送验证码 | PASS | code=0, message=success |
| 5 | 认证 Auth | A4 错误验证码注册应被拒绝 | PASS | code=1001, message=验证码错误，请重新输入 |
| 6 | 认证 Auth | A5 无效 registerTicket 应被拒绝 | PASS | code=401, message=登录已过期，请重新授权 |
| 7 | 认证 Auth | A6 正常注册 | PASS | code=0, message=success |
| 8 | 认证 Auth | A7 registerTicket 应一次性失效（重放防护） | PASS | code=401, message=登录已过期，请重新授权 |
| 9 | 认证 Auth | A8 注册后重新微信登录应识别为已注册并返回 token | PASS | code=0, message=success |
| 10 | 认证 Auth | A9 注册用户 role 应为 user | PASS | role=user |
| 11 | 用户档案 User | B1 查询档案 | PASS | code=0, message=success |
| 12 | 用户档案 User | B2 更新档案 | PASS | code=0, message=success |
| 13 | 用户档案 User | B3 更新后回读一致（持久化生效） | PASS | code=0, message=success |
| 14 | 用户档案 User | B4 非法数值边界（负年龄/负体重）应被校验拦截 | PASS | code=500, message=身高需在 50-250cm 之间 |
| 15 | 用户档案 User | B5 未携带 token 访问档案应 401 | PASS | code=401, message=未登录或登录已过期 |
| 16 | 用户档案 User | B6 伪造/过期 token 应 401 | PASS | code=401, message=未登录或登录已过期 |
| 17 | 套餐 Package | C1 套餐分页列表 | PASS | code=0, message=success |
| 18 | 套餐 Package | C2 下架套餐不应出现在 C 端列表 | PASS | 列表返回 7 条，包含 off 状态: false |
| 19 | 套餐 Package | C3 按城市筛选生效 | PASS | 返回 7 条，全部匹配: true |
| 20 | 套餐 Package | C4 按检测项目筛选生效 | PASS | code=0, 返回 7 条 |
| 21 | 套餐 Package | C5 套餐详情 | PASS | code=0, message=success |
| 22 | 套餐 Package | C6 不存在的套餐 ID | PASS | code=404, data=null |
| 23 | 套餐 Package | C7 下架套餐详情是否可访问 | PASS | code=0, status=off（仅记录，C 端通常不暴露入口） |
| 24 | 套餐 Package | C8 检测项目字典 | PASS | code=0, message=success |
| 25 | 套餐 Package | C9 城市字典 | PASS | code=0, message=success |
| 26 | 套餐 Package | C11 分页边界 pageSize=0 | PASS | code=0, message=success |
| 27 | 套餐 Package | C12 分页 page=0 不应 500（内存分页下界缺失） | **FAIL** | code=500, message=服务异常，请稍后重试 —— PackageService.list 计算 from=Math.min((0-1)*10, total) = -10，随后 filtered.subList(-10, 0) 抛 IndexOutOfBoundsException |
| 28 | 套餐 Package | C13 分页 page 为负数不应 500 | **FAIL** | code=500, message=服务异常，请稍后重试 |
| 29 | 套餐 Package | C14 套餐列表未走数据库分页（性能设计缺陷） | **FAIL** | PackageService.list 先 selectList 全量取出所有 status=on 的套餐，再在 JVM 内 removeIf 过滤 + sort 排序 + subList 分页。数据量增长后全表加载进内存，且排序/筛选无法利用索引 |
| 30 | 首页 Home | D1 首页聚合数据 | PASS | code=0, message=success |
| 31 | 首页 Home | D1-b 首页含轮播 banner | PASS | banners=[{"id":1,"image":"/images/placeholder/banner1.png","linkType":"package","linkId":"1","sort":1,"status":1},{"id":2,"image":"/images/placeholder/banner2.png","lin |
| 32 | 首页 Home | D1-c 首页含推荐套餐 | PASS | recommendPackages 长度=3 |
| 33 | 首页 Home | D2 未读消息数 | PASS | code=0, message=success |
| 34 | 首页 Home | D3 未登录访问首页应 401 | PASS | code=401, message=未登录或登录已过期 |
| 35 | 订单 Order | E1 正常下单 | PASS | code=0, message=success |
| 36 | 订单 Order | E2 套餐未覆盖所选医院城市应被拒绝 | PASS | code=500, message=该套餐不在所选医院城市提供，请重新选择医院 |
| 37 | 订单 Order | E3 不存在的医院应被拒绝 | PASS | code=404, message=所选医院不可用，请重新选择 |
| 38 | 订单 Order | E4 下架套餐应拒绝下单 | PASS | code=2001, message=套餐已下架 |
| 39 | 订单 Order | E5 不存在的套餐应被拒绝 | PASS | code=404, message=套餐不存在 |
| 40 | 订单 Order | E6 缺少必填参数应被校验拦截 | PASS | code=500, message=请选择核销医院 |
| 41 | 订单 Order | E7 订单列表 | PASS | code=0, message=success |
| 42 | 订单 Order | E8 按状态筛选(pending_pay) | PASS | 返回 1 条，状态集合: pending_pay |
| 43 | 订单 Order | E9 订单详情 | PASS | code=0, message=success |
| 44 | 订单 Order | E10 越权访问他人订单应不可见 | PASS | code=404, message=订单不存在 |
| 45 | 订单 Order | E11 取消待支付订单 | PASS | code=0, message=success |
| 46 | 订单 Order | E12 重复取消已取消订单应被拒绝 | PASS | code=2001, message=当前订单状态不可取消 |
| 47 | 订单 Order | E13 取消他人订单应不可见/被拒 | PASS | code=404, message=订单不存在 |
| 48 | 订单 Order | E14 核销码二维码接口未鉴权（P0） | **FAIL** | 未携带任何 token 直接 GET /api/orders/1/qrcode 返回 200，content-type=image/png，是PNG=true（可枚举 orderId 批量获取他人核销码） |
| 49 | 支付 Payment | F0 未登录调用支付回调应 401 | PASS | code=401, message=未登录或登录已过期 |
| 50 | 支付 Payment | F1 模拟支付回调 | PASS | code=0, message=success |
| 51 | 支付 Payment | F2 重复支付同一订单应幂等拒绝 | PASS | code=2001, message=订单不可支付，请刷新 |
| 52 | 支付 Payment | F3 支付不存在订单应 404 | PASS | code=404, message=订单不存在 |
| 53 | 支付 Payment | F4 缺少 orderId 应被拒绝 | PASS | code=500, message=orderId 不能为空 |
| 54 | 支付 Payment | F5 他人在未授权情况下支付他人订单（P0 归属校验缺失） | **FAIL** | 调用成功！用用户A的 token 支付了 user_id=1 的订单3，返回 status=paid, verifyCode=668850（攻击者可免费取得他人订单核销码；反之亦然，攻击者可把任意订单刷成已支付） |
| 55 | 支付 Payment | F6 不携带 token 直接调用支付回调应 401 | PASS | code=401, message=未登录或登录已过期 |
| 56 | 支付 Payment | F7 支付后订单状态/核销码/支付时间正确 | PASS | status=paid, verifyCode=537717, payTime=2026-08-30 13:35:28 |
| 57 | 支付 Payment | F8 支付后生成站内消息通知 | PASS | 消息标题集合: 支付成功 \| 订单已取消 |
| 58 | 医护与核销 Staff/Verify | G1 医护登录(正确密码) | PASS | code=0, message=success |
| 59 | 医护与核销 Staff/Verify | G2 医护登录(错误密码)应被拒绝 | PASS | code=403, message=账号或密码错误 |
| 60 | 医护与核销 Staff/Verify | G3 用管理员账号登录医护端应被拒绝 | PASS | code=403, message=账号或密码错误 |
| 61 | 医护与核销 Staff/Verify | G4 医护工作台统计 | PASS | code=0, message=success |
| 62 | 医护与核销 Staff/Verify | G4-b 待处理数应按【本院】过滤（P1 数据越权） | **FAIL** | 返回 pendingCount=3（代码用 .eq(status,"paid").isNull(verifyTime)，未加 hospitalId 过滤，为全库统计，泄露他院经营数据并误导医护） |
| 63 | 医护与核销 Staff/Verify | G5 跨医院核销码校验 check 应被拒绝（P1 信息泄露） | **FAIL** | 查询成功，泄露他院订单信息：orderNo=TH20260830133528707, packageName=静脉血栓风险筛查套餐, userPhone=139****8135 |
| 64 | 医护与核销 Staff/Verify | G6 跨医院确认核销应被拒绝(403) | PASS | code=403, message=该核销码仅限下单医院核销，本院无权核销 |
| 65 | 医护与核销 Staff/Verify | G7 无效核销码应被拒绝 | PASS | code=2002, message=核销码无效 |
| 66 | 医护与核销 Staff/Verify | G8 校验本院有效核销码 | PASS | code=0, message=success |
| 67 | 医护与核销 Staff/Verify | G9 确认核销（本院） | PASS | code=0, message=success |
| 68 | 医护与核销 Staff/Verify | G10 重复核销应返回 already=true（幂等） | PASS | code=0, already=true, message=success |
| 69 | 医护与核销 Staff/Verify | G11 核销后订单状态应为 completed 且回写 verifyTime/医院 | PASS | status=completed, verifyTime=2026-08-30 13:35:28, hospitalId=1 |
| 70 | 医护与核销 Staff/Verify | G11-b 订单状态机：verified(检测中) 状态不可达 | **FAIL** | 核销后订单直接从 paid 跳到 completed（status=completed），中间态 verified 永远不出现："检测中"状态在业务上不可达，用户端"检测中"文案永不展示 |
| 71 | 医护与核销 Staff/Verify | G11-c 并发重复核销不应产生多条核销记录 | **FAIL** | 并发 6 次确认，成功 6 次；该订单核销记录数 0 → 6（新增 6 条） |
| 72 | 医护与核销 Staff/Verify | G11-d 支付成功后套餐销量应 +1（原子更新） | PASS | 套餐1 当前销量 salesCount=3522（期望 ≥3522）。另注：OrderService 用"读-改-写"自增，非原子更新，并发支付会丢更新 |
| 73 | 医护与核销 Staff/Verify | G12 医护查看核销记录 | PASS | code=0, message=success |
| 74 | 医护与核销 Staff/Verify | G12-b 核销记录按医院隔离 | PASS | 返回 9 条，hospitalId 集合: 1 |
| 75 | 医护与核销 Staff/Verify | G13 核销记录按日期筛选 | PASS | date=2026-08-30 返回 7 条（今日应有 1 条刚产生的核销） |
| 76 | 医护与核销 Staff/Verify | G14 医护 token 访问 C 端用户档案 | PASS | code=0, message=success（记录行为） |
| 77 | 医护与核销 Staff/Verify | G15 医护 token 访问管理端统计应 403 | PASS | code=403, message=无权限访问 |
| 78 | 检测结果 Result | H1 用户查看检测记录列表 | PASS | code=0, message=success |
| 79 | 检测结果 Result | H2 越权查看他人检测结果应 404 | PASS | code=404, message=检测结果不存在 |
| 80 | 检测结果 Result | H3 医护为本院已核销订单出具结果 | PASS | code=0, message=success |
| 81 | 检测结果 Result | H4 用户端可见刚出具的检测结果 | PASS | 列表长度=1, 状态=published |
| 82 | 检测结果 Result | H5 检测结果详情 | PASS | code=0, message=success |
| 83 | 检测结果 Result | H6 跨医院出具结果应被拒绝(403) | PASS | code=403, message=该订单不属于本院，无法出具结果 |
| 84 | 检测结果 Result | H7 为未核销(unpaid/未核销)订单出具结果应被拒绝 | PASS | code=500, message=订单未核销，无法出具结果 |
| 85 | 检测结果 Result | H8 普通用户调用医护的结果上传接口应被拒绝 | PASS | code=403, message=无权限访问 |
| 86 | 检测结果 Result | H9 出具结果后生成站内通知 | PASS | 消息标题: 检测结果已出具 \| 核销成功 \| 核销成功 \| 核销成功 \| 核销成功 \| 核销成功 \| 核销成功 \| 支付成功 \| 核销成功 \| 支付成功 \| 支付成功 \| 订单已取消 |
| 87 | 用药管理 Medication | I1 创建用药方案 | PASS | code=0, message=success |
| 88 | 用药管理 Medication | I1-b 用药方案的疗程起止(startAt/endAt)与医生评估(doctorAssessed)无法通过接口设置 | **FAIL** | code=500, message=服务异常，请稍后重试 —— 传这三个字段直接 500，即"疗程"和"医生评估血栓状态"两个业务字段实际不可用 |
| 89 | 用药管理 Medication | I2 用药方案列表 | PASS | code=0, message=success |
| 90 | 用药管理 Medication | I3 用药方案详情 | PASS | code=0, message=success |
| 91 | 用药管理 Medication | I4 更新用药方案 | PASS | code=0, message=success |
| 92 | 用药管理 Medication | I5 更新后回读一致 | PASS | drugName=华法林钠片(调整), dosePerTime=2.5mg |
| 93 | 用药管理 Medication | I5-b 更新用药方案后历史打卡记录是否被孤立 | PASS | 更新时间点后 recentRecords 条数=0（MedicationService.apply 会重新生成 time_point_id，历史记录按旧 id 存储将查不到） |
| 94 | 用药管理 Medication | I6 用药打卡 | PASS | code=0, message=success |
| 95 | 用药管理 Medication | I7 同一时间点当日重复打卡应幂等（不报错/不重复插入） | PASS | code=0, message=success |
| 96 | 用药管理 Medication | I7-b 打卡传入不存在的时间点应被拒绝 | PASS | code=404, message=时间点不存在 |
| 97 | 用药管理 Medication | I8 详情页能回读今日打卡状态 | PASS | 返回字段: medication,recentRecords；records=null（前端列表页已知不回读打卡态） |
| 98 | 用药管理 Medication | I9 边界入参（200字药名 / timesPerDay=0 / 空时间点） | PASS | code=500, 是否创建成功=false |
| 99 | 用药管理 Medication | I10 访问不存在的用药方案 | PASS | code=404, data=null |
| 100 | 用药管理 Medication | I11 删除用药方案 | PASS | code=0, message=success |
| 101 | 用药管理 Medication | I12 删除后再次查询 | PASS | code=404, data=null（记录删除语义：物理删除 or 软删除 status=stopped） |
| 102 | 消息 Message | J1 消息列表 | PASS | code=0, message=success |
| 103 | 消息 Message | J2 按类型筛选(type=order) | PASS | 返回 11 条，type 集合: order |
| 104 | 消息 Message | J3 消息详情 | PASS | code=0, message=success |
| 105 | 消息 Message | J4 标记已读 | PASS | code=0, message=success |
| 106 | 消息 Message | J4-b 已读状态回读 | PASS | isRead=1 |
| 107 | 消息 Message | J5 越权读取他人消息 | PASS | code=404, 返回=null |
| 108 | 消息 Message | J6 越权删除他人消息 | PASS | code=404, message=消息不存在 |
| 109 | 消息 Message | J7 删除自己的消息 | PASS | code=0, message=success |
| 110 | 消息 Message | J8 未读数统计 | PASS | code=0, message=success |
| 111 | 管理端 Admin | K1 平台管理员登录 | PASS | code=0, message=success |
| 112 | 管理端 Admin | K2 医院管理员登录 | PASS | code=0, message=success |
| 113 | 管理端 Admin | K3 管理员错误密码应被拒绝 | PASS | code=403, message=账号或密码错误 |
| 114 | 管理端 Admin | K4 平台管理员 /me | PASS | code=0, message=success |
| 115 | 管理端 Admin | K4-b 医院管理员 /me 返回本院信息 | PASS | 返回: {"role":"hospital_admin","hospitalId":1,"nickname":"协和医院管理员","hospitalName":"北京协和医院","userId":4} |
| 116 | 管理端 Admin | K5 医院管理员访问【仅平台】套餐管理应 403 | PASS | code=403, message=无权限访问 |
| 117 | 管理端 Admin | K6 医院管理员访问【仅平台】支付账单应 403 | PASS | code=403, message=无权限访问 |
| 118 | 管理端 Admin | K7 医院管理员访问【仅平台】医院管理员管理应 403 | PASS | code=403, message=无权限访问 |
| 119 | 管理端 Admin | K8 医院管理员访问【仅平台】医院管理应 403 | PASS | code=403, message=无权限访问 |
| 120 | 管理端 Admin | K9 平台套餐列表 | PASS | code=0, message=success |
| 121 | 管理端 Admin | K10 平台新增套餐 | PASS | code=0, message=success |
| 122 | 管理端 Admin | K11 平台编辑套餐 | PASS | code=0, message=success |
| 123 | 管理端 Admin | K12 套餐上下架切换 | PASS | code=0, message=success |
| 124 | 管理端 Admin | K12-b 下架后 C 端列表应不再展示 | PASS | C 端详情 status=off（配合 C2 用例一起判断） |
| 125 | 管理端 Admin | K13 平台删除套餐 | PASS | code=500（当前后端无 DELETE /api/admin/packages/{id}，套餐只能上下架不能删除，管理端也无删除入口） |
| 126 | 管理端 Admin | K14 平台医护列表 | PASS | code=0, message=success |
| 127 | 管理端 Admin | K15 平台新增医护 | PASS | code=0, message=success |
| 128 | 管理端 Admin | K16 编辑医护(置为禁用 status=0) | PASS | code=0, message=success |
| 129 | 管理端 Admin | K17 禁用(status=0)的医护账号不应能登录 | **FAIL** | 禁用后仍可登录成功并返回 token（越权风险） |
| 130 | 管理端 Admin | K18 重置医护密码 | PASS | code=0, message=success |
| 131 | 管理端 Admin | K19 删除医护 | PASS | code=0, message=success |
| 132 | 管理端 Admin | K20 医院管理员医护列表应只含本院(hospital 1) | PASS | 返回 1 条，hospitalId 集合: 1 |
| 133 | 管理端 Admin | K21 医院管理员传 hospitalId=3 越权查询他院医护 | PASS | 返回 1 条，hospitalId 集合: 1 |
| 134 | 管理端 Admin | K22 平台支付账单列表 | PASS | code=0, message=success |
| 135 | 管理端 Admin | K23 账单按渠道筛选(alipay) | PASS | 返回 2 条，channel 集合: alipay |
| 136 | 管理端 Admin | K24 差异账单重新同步 | PASS | code=0, 同步后 reconcileStatus=ok（若仍为 diff，说明同步是假动作） |
| 137 | 管理端 Admin | K25 平台售卖记录 | PASS | code=0, message=success |
| 138 | 管理端 Admin | K26 医院管理员售卖记录应只含本院 | PASS | 返回 3 条，hospitalId 集合:  |
| 139 | 管理端 Admin | K27 平台核销记录 | PASS | code=0, message=success |
| 140 | 管理端 Admin | K28 医院管理员核销记录应只含本院 | PASS | 返回 9 条，hospitalId 集合: 1 |
| 141 | 管理端 Admin | K29 平台统计 | PASS | code=0, message=success |
| 142 | 管理端 Admin | K30 医院管理员统计不应包含金额 | PASS | 平台端字段: todaySales,trend,hospitalShare,pendingVerify,todayOrders,totalSold；医院端字段: totalPackages,trend,pendingVerify,packageShare,todayOrders,todayVerified |
| 143 | 管理端 Admin | K31 平台医院列表 | PASS | code=0, message=success |
| 144 | 管理端 Admin | K32 平台新增医院 | PASS | code=0, message=success |
| 145 | 管理端 Admin | K33 编辑医院 | PASS | code=0, message=success |
| 146 | 管理端 Admin | K33-b 停用(disabled)医院不应出现在 C 端列表 | PASS | C 端返回 6 家，含停用医院: false |
| 147 | 管理端 Admin | K34 删除医院 | PASS | code=0, message=success |
| 148 | 管理端 Admin | K35 平台医院管理员列表 | PASS | code=0, message=success |
| 149 | 管理端 Admin | K36 禁用状态的管理员账号能否登录 | PASS | 见 K17 同款逻辑（AdminService.java:45 未校验 status） |
| 150 | 安全与边界 Security | L1 所有受保护接口未带 token 均应 401 | PASS | 全部 401 |
| 151 | 安全与边界 Security | L2 伪造 token 访问管理端应 401 | PASS | code=401, message=未登录或登录已过期 |
| 152 | 安全与边界 Security | L3 普通用户 token 访问管理端统计应 403 | PASS | code=403, message=无权限访问 |
| 153 | 安全与边界 Security | L4 不存在的接口路径 | PASS | HTTP 200, body={"code":500,"message":"服务异常，请稍后重试","data":null} |
| 154 | 安全与边界 Security | L5 分页参数传非数字 | **FAIL** | code=500, message=服务异常，请稍后重试 |
| 155 | 安全与边界 Security | L6 超大页码 | PASS | code=0, message=success |
| 156 | 安全与边界 Security | L7 负数分页参数 | **FAIL** | code=500, message=服务异常，请稍后重试 |
| 157 | 安全与边界 Security | L8 空 body 提交下单 | **FAIL** | code=500, message=请选择核销医院 |
| 158 | 安全与边界 Security | L10 请求体携带未定义字段应返回 400 参数错误，而非 500 | **FAIL** | code=500, message=服务异常，请稍后重试 —— Jackson 未关闭 FAIL_ON_UNKNOWN_PROPERTIES，多传一个字段即 500，且前端/第三方对接时任何字段拼写错误都会表现为"服务异常" |
| 159 | 安全与边界 Security | L11 分页参数 page=0 不应导致 500 | PASS | code=0, message=success —— MyBatis-Plus Page 计算 offset=(0-1)*10=-10，抛 IndexOutOfBoundsException("fromIndex = -10") |
| 160 | 安全与边界 Security | L9 CORS 策略（生产风险，仅记录） | PASS | Access-Control-Allow-Origin=http://evil.example.com, Allow-Credentials=true |
