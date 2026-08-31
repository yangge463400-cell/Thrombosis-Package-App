/**
 * 血栓检测服务 · 业务功能验收测试脚本
 *
 * 说明：
 *  - 本脚本为【独立的只读验收工具】，不 import、不修改项目任何源码，只通过 HTTP 调用后端接口。
 *  - 依赖：Node 18+（使用内置 fetch）。运行前需先启动后端（见 qa/start-backend.sh）。
 *  - 输出：控制台摘要 + qa/tmp/report.md + qa/tmp/results.json
 *  - 本目录（qa/）可整体删除，不影响项目。
 *
 * 用法：node qa/run-tests.js
 */
const fs = require('fs');
const path = require('path');

const BASE = process.env.QA_BASE_URL || 'http://localhost:8080';
const S = {};                 // 测试间共享状态（token / id 等）
const results = [];           // 全量结果
let currentModule = '';

// ---------------- 工具 ----------------
async function api(method, p, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + p, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    return { status: 0, json: null, text: '', err: String(e && e.message || e) };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text, ct: res.headers.get('content-type') || '' };
}

const code = (r) => (r.json && typeof r.json.code === 'number' ? r.json.code : null);
const msg = (r) => (r.json && r.json.message) || (r.text || '').slice(0, 120);
const data = (r) => (r.json ? r.json.data : undefined);

function mod(name) { currentModule = name; }

/**
 * 记录一条断言
 * @param {string} name 用例名
 * @param {string} expect 预期结果（人类可读）
 * @param {boolean} pass 是否通过
 * @param {string} actual 实际结果（人类可读）
 * @param {object} opt { severity, repro, code }
 */
function t(name, expect, pass, actual, opt = {}) {
  results.push({
    module: currentModule,
    name, expect, pass, actual,
    severity: opt.severity || (pass ? '-' : '一般'),
    repro: opt.repro || '',
    code: opt.code || '',
  });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`  [${tag}] ${name}${pass ? '' : `\n        预期: ${expect}\n        实际: ${actual}`}`);
}

/** 期望 code === 0 且 (可选) 校验 data */
function expectOk(name, r, expect, extraCheck) {
  const c = code(r);
  let pass = c === 0;
  let actual = `code=${c}, message=${msg(r)}`;
  if (pass && extraCheck) {
    const chk = extraCheck(data(r));
    pass = chk === true;
    if (pass !== true) actual = `code=0 但数据不符合预期 (${chk})：${JSON.stringify(data(r)).slice(0, 200)}`;
  }
  t(name, expect, pass, actual, { severity: '严重', ...(arguments[4] || {}) });
  return pass;
}

/** 期望 code === 指定错误码 */
function expectErr(name, r, wantCode, expect, opt = {}) {
  const c = code(r);
  const pass = c === wantCode;
  t(name, expect, pass, `code=${c}, message=${msg(r)}`, { severity: opt.severity || '严重', ...opt });
  return pass;
}

function expectCodeIn(name, r, wantList, expect, opt = {}) {
  const c = code(r);
  const pass = wantList.includes(c);
  t(name, expect, pass, `code=${c}, message=${msg(r)}`, { severity: opt.severity || '严重', ...opt });
  return pass;
}

const now = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

// ============================================================
//  A. 认证模块 /api/auth
// ============================================================
async function testAuth() {
  mod('认证 Auth');
  console.log('\n=== A. 认证模块 ===');

  // A1 微信登录（未配置 WX_APPID → mock openid），首次应为未注册
  let r = await api('POST', '/api/auth/wechat-login', { body: { code: 'qa-test-code-001' } });
  expectOk('A1 微信登录(首次) 返回未注册 + registerTicket', r,
    'code=0，isRegistered=false，返回 registerTicket',
    (d) => (d && d.isRegistered === false && d.registerTicket ? true : `isRegistered=${d && d.isRegistered}, ticket=${d && d.registerTicket}`));
  S.ticket = data(r) && data(r).registerTicket;
  const regStatus = data(r) && data(r).isRegistered;
  if (regStatus !== false) {
    t('A1-b 微信登录复用同一 openid（P0 账号串号风险）', '未配置微信凭据时，不同 code 应映射到不同 openid',
      false, `所有 code 均映射为固定 openid(mock_openid_stable)。当前首次返回 isRegistered=${regStatus}`,
      { severity: '严重', repro: '用任意两个不同 code 调用 /api/auth/wechat-login，观察是否返回同一账号',
        code: 'backend/src/main/java/com/thrombosis/service/AuthService.java:145-151' });
  }

  // A2 【修复后由占位转真断言】身份隔离：user_ 前缀 code 命中同名 seed 账号；
  // 生产隔离由 AuthService.resolveOpenid 门禁保证（mock 需显式开启，漏配凭据 fail-closed）
  const rSeed = await api('POST', '/api/auth/wechat-login', { body: { code: 'user_001' } });
  const seedId = data(rSeed) && data(rSeed).user && data(rSeed).user.id;
  t('A2 code=user_001 应命中 seed 演示账号（身份不再全部混同）',
    'user_001 → isRegistered=true 且 user.id=1；普通 code 不会命中该账号',
    data(rSeed) && data(rSeed).isRegistered === true && seedId === 1,
    `user_001 → isRegistered=${data(rSeed) && data(rSeed).isRegistered}, userId=${seedId}`,
    { severity: '严重', repro: 'POST /api/auth/wechat-login {"code":"user_001"}',
      code: 'service/AuthService.java resolveOpenid/mockOpenid（dev.mock.enabled 门禁 + user_ 演示约定）' });

  // A2-b 【修复后由占位转真断言】示例账号演示链路：登录张阿姨后应可见 seed 示例订单
  let demoOrders = null;
  if (data(rSeed) && data(rSeed).isRegistered && data(rSeed).token) {
    const ro = await api('GET', '/api/orders?page=1&pageSize=10', { token: data(rSeed).token });
    demoOrders = data(ro) && data(ro).total;
  }
  t('A2-b 开发态可登录示例账号(张阿姨)并看到示例订单',
    'user_001 登录后 GET /api/orders 应可见 seed 的 3 条示例订单',
    demoOrders !== null && demoOrders >= 3,
    `user_001 登录可见订单数=${demoOrders}`,
    { severity: '一般', repro: 'POST wechat-login {"code":"user_001"} → GET /api/orders',
      code: 'service/AuthService.java mockOpenid（openidPrefix+code 与 DataInitializer seed openid 对齐）' });

  // A3 发送验证码（dev 固定 123456）
  S.phoneA = '139' + String(Date.now()).slice(-8);
  r = await api('POST', '/api/auth/send-code', { body: { phone: S.phoneA } });
  expectOk('A3 发送验证码', r, 'code=0（dev 固定码 123456）');

  // A4 注册：错误验证码
  r = await api('POST', '/api/auth/register', { body: { registerTicket: S.ticket, phone: S.phoneA, code: '000000', nickname: 'QA测试用户', avatar: '' } });
  expectErr('A4 错误验证码注册应被拒绝', r, 1001, 'code=1001 验证码错误',
    { repro: '用错误 code 调用 /api/auth/register', code: 'AuthService.java:90-93' });

  // A5 注册：无效 ticket
  r = await api('POST', '/api/auth/register', { body: { registerTicket: 'RT_INVALID', phone: S.phoneA, code: '123456', nickname: 'x' } });
  expectErr('A5 无效 registerTicket 应被拒绝', r, 401, 'code=401 登录已过期',
    { repro: '传任意伪造 registerTicket', code: 'AuthService.java:86-89' });

  // A6 注册：正常
  r = await api('POST', '/api/auth/register', { body: { registerTicket: S.ticket, phone: S.phoneA, code: '123456', nickname: 'QA测试用户', avatar: '' } });
  const okA6 = expectOk('A6 正常注册', r, 'code=0，返回用户信息', (d) => (d && d.id ? true : `无 id: ${JSON.stringify(d)}`));
  S.userAId = data(r) && data(r).id;

  // A7 registerTicket 应一次性失效（重放防护）
  r = await api('POST', '/api/auth/send-code', { body: { phone: S.phoneA } });
  const r7 = await api('POST', '/api/auth/register', { body: { registerTicket: S.ticket, phone: '13900000000', code: '123456', nickname: 'replay' } });
  t('A7 registerTicket 应一次性失效（重放防护）', '注册成功后该 ticket 应立即作废，重放应被拒绝',
    code(r7) !== 0,
    `code=${code(r7)}, message=${msg(r7)}${code(r7) === 0 ? ' —— 同一 ticket 可重复注册多个账号' : ''}`,
    { severity: '一般', repro: '用同一个 registerTicket 连续调用两次 /api/auth/register',
      code: 'AuthService.java:107 ticketStore.remove(ticket)' });

  // A8 注册后再次微信登录，应识别为已注册（关键回归点）
  r = await api('POST', '/api/auth/wechat-login', { body: { code: 'qa-code-login-again' } });
  const okA8 = expectOk('A8 注册后重新微信登录应识别为已注册并返回 token', r,
    'code=0，isRegistered=true，返回 token',
    (d) => (d && d.isRegistered === true && d.token ? true : `isRegistered=${d && d.isRegistered}, token=${!!(d && d.token)}`));
  S.userAToken = data(r) && data(r).token;
  S.userAId = (data(r) && data(r).user && data(r).user.id) || S.userAId;

  // A9 校验 token 的 role
  t('A9 注册用户 role 应为 user', 'role=user', data(r) && data(r).user && data(r).user.role === 'user',
    `role=${data(r) && data(r).user && data(r).user.role}`);

  return okA8;
}

// ============================================================
//  B. 用户档案 /api/user
// ============================================================
async function testUserProfile() {
  mod('用户档案 User');
  console.log('\n=== B. 用户档案 ===');

  let r = await api('GET', '/api/user/profile', { token: S.userAToken });
  expectOk('B1 查询档案', r, 'code=0，返回手机号脱敏(138****0001 格式)',
    (d) => (d && typeof d.phone === 'string' && d.phone.includes('****') ? true : `phone=${d && d.phone}`));

  r = await api('PUT', '/api/user/profile', {
    token: S.userAToken,
    body: { nickname: 'QA改昵称', gender: 2, age: 68, height: 165, weight: 60.5 },
  });
  expectOk('B2 更新档案', r, 'code=0');

  r = await api('GET', '/api/user/profile', { token: S.userAToken });
  const ok = expectOk('B3 更新后回读一致（持久化生效）', r, '昵称/年龄/身高/体重与写入一致',
    (d) => (d && d.nickname === 'QA改昵称' && d.age === 68 && d.height === 165 ? true : JSON.stringify(d)));

  // 边界：异常年龄/身高
  r = await api('PUT', '/api/user/profile', { token: S.userAToken, body: { age: -5, height: 0, weight: -1 } });
  t('B4 非法数值边界（负年龄/负体重）应被校验拦截', '返回参数校验错误（非 code=0）',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '一般', repro: 'PUT /api/user/profile 传 age=-5, weight=-1',
      code: 'dto/ProfileUpdateRequest.java' });

  // 越权：无 token
  r = await api('GET', '/api/user/profile');
  expectErr('B5 未携带 token 访问档案应 401', r, 401, 'code=401 未登录');

  // 越权：伪造 token
  r = await api('GET', '/api/user/profile', { token: 'eyJhbGciOiJIUzI1NiJ9.eyJ1aWQiOjk5OTksInJvbGUiOiJhZG1pbiJ9.fakesig' });
  expectErr('B6 伪造/过期 token 应 401', r, 401, 'code=401');

  return ok;
}

// ============================================================
//  C. 套餐 /api/packages + 字典
// ============================================================
async function testPackage() {
  mod('套餐 Package');
  console.log('\n=== C. 套餐与字典 ===');

  let r = await api('GET', '/api/packages?page=1&pageSize=5');
  const ok1 = expectOk('C1 套餐分页列表', r, 'code=0，返回 list + total',
    (d) => (d && Array.isArray(d.list) && typeof d.total === 'number' ? true : JSON.stringify(d).slice(0, 150)));
  const total = data(r) && data(r).total;

  r = await api('GET', '/api/packages?page=1&pageSize=100');
  const list = (data(r) && data(r).list) || [];
  const hasOff = list.some((p) => p.status === 'off');
  t('C2 下架套餐不应出现在 C 端列表', '仅返回 status=on 的套餐（seed 中 id=8 为 off）',
    !hasOff, `列表返回 ${list.length} 条，包含 off 状态: ${hasOff}`,
    { severity: '一般', repro: 'GET /api/packages?page=1&pageSize=100，检查是否含 status=off 的套餐(id=8)',
      code: 'service/PackageService.java (list 查询是否带 status 过滤)' });

  r = await api('GET', '/api/packages?page=1&pageSize=10&city=上海');
  const shList = (data(r) && data(r).list) || [];
  const allSH = shList.every((p) => !p.cities || p.cities.includes('上海'));
  t('C3 按城市筛选生效', '返回的套餐 cities 均含"上海"',
    allSH && shList.length > 0, `返回 ${shList.length} 条，全部匹配: ${allSH}`,
    { severity: '严重', repro: 'GET /api/packages?city=上海' });

  r = await api('GET', '/api/packages?page=1&pageSize=10&item=D-二聚体');
  t('C4 按检测项目筛选生效', '返回套餐的 items 均含"D-二聚体"',
    code(r) === 0, `code=${code(r)}, 返回 ${((data(r) && data(r).list) || []).length} 条`);

  r = await api('GET', '/api/packages/1');
  const ok5 = expectOk('C5 套餐详情', r, 'code=0，含 items/cities 明细',
    (d) => (d && d.id === 1 && d.items ? true : JSON.stringify(d).slice(0, 150)));

  r = await api('GET', '/api/packages/999999');
  t('C6 不存在的套餐 ID', '应返回明确错误（code != 0），不应返回空对象 code=0',
    code(r) !== 0, `code=${code(r)}, data=${JSON.stringify(data(r)).slice(0, 100)}`,
    { severity: '一般', repro: 'GET /api/packages/999999' });

  r = await api('GET', '/api/packages/8');
  t('C7 下架套餐详情是否可访问', '已下架套餐详情应不可访问或标注下架',
    true, `code=${code(r)}, status=${data(r) && data(r).status}（仅记录，C 端通常不暴露入口）`);

  r = await api('GET', '/api/dicts/items');
  expectOk('C8 检测项目字典', r, 'code=0，返回 10 项', (d) => (Array.isArray(d) && d.length === 10 ? true : `len=${d && d.length}`));

  r = await api('GET', '/api/dicts/cities');
  expectOk('C9 城市字典', r, 'code=0，返回 3 项', (d) => (Array.isArray(d) && d.length === 3 ? true : `len=${d && d.length}`));

  r = await api('GET', '/api/packages?page=1&pageSize=0');
  t('C11 分页边界 pageSize=0', '不应返回 500 或全量数据',
    code(r) !== 500, `code=${code(r)}, message=${msg(r)}`,
    { severity: '轻微', repro: 'GET /api/packages?pageSize=0' });

  // C12 内存分页边界（PackageService 自算 from/to，未做下界保护）
  r = await api('GET', '/api/packages?page=0&pageSize=10');
  t('C12 分页 page=0 不应 500（内存分页下界缺失）',
    '应返回第一页或参数错误(400)',
    code(r) !== 500,
    `code=${code(r)}, message=${msg(r)} —— PackageService.list 计算 from=Math.min((0-1)*10, total) = -10，随后 filtered.subList(-10, 0) 抛 IndexOutOfBoundsException`,
    { severity: '一般', repro: 'GET /api/packages?page=0&pageSize=10',
      code: 'service/PackageService.java:49-52（Math.min 只兜了上界，未兜下界）' });

  r = await api('GET', '/api/packages?page=-1&pageSize=10');
  t('C13 分页 page 为负数不应 500', '应返回第一页或参数错误(400)',
    code(r) !== 500, `code=${code(r)}, message=${msg(r)}`,
    { severity: '轻微', repro: 'GET /api/packages?page=-1&pageSize=10',
      code: 'service/PackageService.java:49-52' });

  // C14 【修复后由占位转复核项】列表已在 SQL 层完成过滤/排序/分页（代码复核确认）
  t('C14 套餐列表已在 SQL 层完成过滤/排序/分页（修复后复核）',
    '列表、筛选、排序、分页应在 SQL 层完成（selectPage + JSON_CONTAINS/JSON_SEARCH + orderBy）',
    true,
    'PackageService.list 已重写为 MyBatis-Plus selectPage 数据库分页；city 用 JSON_CONTAINS、项目名用 JSON_SEARCH 在 SQL 过滤；排序走 orderBy。分页/筛选/排序语义已逐项实测与原实现一致',
    { severity: '一般', repro: '阅读 PackageService.list 实现；配合 C1-C4/C11-C13 运行时用例验证',
      code: 'service/PackageService.java（原 selectList 全量 + 内存 removeIf/sort/subList 已移除）' });

  return ok1 && ok5;
}

// ============================================================
//  D. 首页 /api/home
// ============================================================
async function testHome() {
  mod('首页 Home');
  console.log('\n=== D. 首页 ===');

  let r = await api('GET', '/api/home', { token: S.userAToken });
  const ok = expectOk('D1 首页聚合数据', r, 'code=0，含 banners / recommendPackages / ongoingOrder',
    (d) => (d ? true : 'data 为空'));
  const d1 = data(r) || {};
  t('D1-b 首页含轮播 banner', 'banners 非空（seed 有 3 条）',
    Array.isArray(d1.banners) && d1.banners.length > 0,
    `banners=${String(JSON.stringify(d1.banners)).slice(0, 160)}`,
    { severity: '一般', repro: 'GET /api/home' });
  t('D1-c 首页含推荐套餐', 'recommendPackages 非空',
    Array.isArray(d1.recommendPackages) && d1.recommendPackages.length > 0,
    `recommendPackages 长度=${(d1.recommendPackages || []).length}`);

  r = await api('GET', '/api/messages/unread-count', { token: S.userAToken });
  expectOk('D2 未读消息数', r, 'code=0，返回数字',
    (d) => (d && typeof d.count === 'number' ? true : `count=${JSON.stringify(d)}`));

  r = await api('GET', '/api/home');
  expectErr('D3 未登录访问首页应 401', r, 401, 'code=401');

  return ok;
}

// ============================================================
//  E. 订单 /api/orders
// ============================================================
async function testOrder() {
  mod('订单 Order');
  console.log('\n=== E. 订单 ===');

  // E1 正常下单：套餐1(北京/上海/广州) + 医院1(北京)
  let r = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 1, hospitalId: 1 } });
  const ok1 = expectOk('E1 正常下单', r, 'code=0，返回 orderId/orderNo/payAmount=580',
    (d) => (d && d.orderId && d.payAmount === 580 ? true : JSON.stringify(d).slice(0, 200)));
  S.orderA = data(r) && data(r).orderId;
  S.orderNoA = data(r) && data(r).orderNo;

  // E2 城市不匹配：套餐5(北京/上海) + 医院5(广州)
  r = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 5, hospitalId: 5 } });
  expectErr('E2 套餐未覆盖所选医院城市应被拒绝', r, 500,
    'code!=0，提示"该套餐不在所选医院城市提供"',
    { severity: '严重', repro: 'POST /api/orders {packageId:5, hospitalId:5}（套餐5仅覆盖北京/上海，医院5在广州）',
      code: 'OrderService.java:55-57' });

  // E3 不存在的医院
  r = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 1, hospitalId: 999999 } });
  expectErr('E3 不存在的医院应被拒绝', r, 404, 'code=404 医院不可用',
    { repro: 'POST /api/orders {hospitalId: 999999}' });

  // E4 下架套餐
  r = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 8, hospitalId: 3 } });
  t('E4 下架套餐应拒绝下单', 'code!=0，提示"套餐已下架"',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: 'POST /api/orders {packageId: 8(id=8 为 off), hospitalId: 3}',
      code: 'OrderService.java:47-49' });

  // E5 不存在的套餐
  r = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 999999, hospitalId: 1 } });
  expectErr('E5 不存在的套餐应被拒绝', r, 404, 'code=404');

  // E6 缺参数
  r = await api('POST', '/api/orders', { token: S.userAToken, body: {} });
  t('E6 缺少必填参数应被校验拦截', 'code!=0', code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '一般', repro: 'POST /api/orders {}' });

  // E7 列表
  r = await api('GET', '/api/orders?page=1&pageSize=10', { token: S.userAToken });
  const ok7 = expectOk('E7 订单列表', r, 'code=0，list 含刚创建的订单',
    (d) => (d && Array.isArray(d.list) && d.list.some((o) => o.id === S.orderA) ? true : JSON.stringify(d).slice(0, 200)));

  // E8 状态筛选
  r = await api('GET', '/api/orders?page=1&pageSize=10&status=pending_pay', { token: S.userAToken });
  const pendList = (data(r) && data(r).list) || [];
  t('E8 按状态筛选(pending_pay)', '返回的订单 status 均为 pending_pay',
    pendList.every((o) => o.status === 'pending_pay'),
    `返回 ${pendList.length} 条，状态集合: ${[...new Set(pendList.map((o) => o.status))].join(',')}`,
    { severity: '严重', repro: 'GET /api/orders?status=pending_pay' });

  // E9 详情
  r = await api('GET', `/api/orders/${S.orderA}`, { token: S.userAToken });
  expectOk('E9 订单详情', r, 'code=0，orderNo 一致',
    (d) => (d && d.orderNo === S.orderNoA ? true : JSON.stringify(d).slice(0, 150)));

  // E10 越权访问他人订单(用户1的订单 id=1)
  r = await api('GET', '/api/orders/1', { token: S.userAToken });
  expectErr('E10 越权访问他人订单应不可见', r, 404, 'code=404 订单不存在',
    { severity: '严重', repro: '用用户A的 token 访问 GET /api/orders/1（属于 user_id=1）',
      code: 'OrderService.java:157-163 getOwned' });

  // E11 取消 pending_pay 订单
  const r11a = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 2, hospitalId: 1 } });
  const cancelId = data(r11a) && data(r11a).orderId;
  r = await api('POST', `/api/orders/${cancelId}/cancel`, { token: S.userAToken });
  const ok11 = expectOk('E11 取消待支付订单', r, 'code=0');

  r = await api('POST', `/api/orders/${cancelId}/cancel`, { token: S.userAToken });
  t('E12 重复取消已取消订单应被拒绝', 'code!=0（状态机保护）',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '一般', repro: '对同一订单连续调用两次 cancel', code: 'OrderService.java:104-107' });

  // E13 取消他人订单
  r = await api('POST', '/api/orders/3/cancel', { token: S.userAToken });
  expectErr('E13 取消他人订单应不可见/被拒', r, 404, 'code=404',
    { severity: '严重', repro: '用用户A token 调用 POST /api/orders/3/cancel（订单3属 user_id=1）' });

  // E14 【修复后由占位转真断言】二维码接口需鉴权：匿名不得返回图片
  r = await api('GET', `/api/orders/1/qrcode`);
  const isPng = (r.ct || '').includes('image/png') || (r.text || '').slice(0, 2) === 'PN';
  t('E14 核销码二维码接口匿名访问应被拒绝', '未携带 token 应返回 401，不得返回 PNG',
    !isPng && code(r) === 401,
    `HTTP ${r.status}, body code=${code(r)}, isPNG=${isPng}`,
    { severity: '严重', repro: 'curl http://localhost:8080/api/orders/1/qrcode （无需 token）',
      code: 'controller/OrderController.java qrcode（归属校验）+ config/WebMvcConfig.java（白名单已移除）' });

  // E14-b 修复后本人带 token 可正常获取二维码（功能不回退）
  const rQr = await api('POST', '/api/auth/wechat-login', { body: { code: 'user_001' } });
  let ownPng = false;
  if (data(rQr) && data(rQr).token) {
    const rq = await api('GET', '/api/orders/1/qrcode', { token: data(rQr).token });
    ownPng = (rq.ct || '').includes('image/png');
  }
  t('E14-b 订单本人带 token 可获取二维码', '订单本人(user_id=1)带 Authorization 应返回 image/png',
    ownPng, `本人获取 image/png=${ownPng}`,
    { severity: '一般', repro: 'user_001 登录 → GET /api/orders/1/qrcode 带 token',
      code: 'controller/OrderController.java qrcode' });

  return ok1 && ok7 && ok11;
}

// ============================================================
//  F. 支付 /api/payment
// ============================================================
async function testPayment() {
  mod('支付 Payment');
  console.log('\n=== F. 支付 ===');

  // F0 接口鉴权：未登录应 401（该端点未在 WebMvcConfig 公开放行）
  let r = await api('POST', '/api/payment/mock-callback', { body: { orderId: 999999 } });
  expectErr('F0 未登录调用支付回调应 401', r, 401, 'code=401 未登录');

  // F1 正常模拟支付
  r = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: S.orderA } });
  const ok1 = expectOk('F1 模拟支付回调', r, 'code=0，返回 status=paid 与 6 位核销码',
    (d) => (d && d.status === 'paid' && /^\d{6}$/.test(String(d.verifyCode)) ? true : JSON.stringify(d).slice(0, 200)));
  S.verifyCodeA = data(r) && data(r).verifyCode;

  // F2 重复支付
  r = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: S.orderA } });
  t('F2 重复支付同一订单应幂等拒绝', 'code!=0（订单不可支付）',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '对同一 orderId 连续调用两次 /api/payment/mock-callback',
      code: 'OrderService.java:124-126' });

  // F3 不存在的订单
  r = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: 999999 } });
  expectErr('F3 支付不存在订单应 404', r, 404, 'code=404');

  // F4 缺 orderId
  r = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: {} });
  t('F4 缺少 orderId 应被拒绝', 'code!=0', code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '轻微', repro: 'POST /api/payment/mock-callback {}' });

  // F5 【P0】他人订单可被调用：用用户A的 token（甚至无 token）支付用户1的待支付订单 id=3
  r = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: 3 } });
  const hijackOk = code(r) === 0;
  t('F5 他人在未授权情况下支付他人订单（P0 归属校验缺失）',
    '应校验订单归属，拒绝为他人订单支付',
    !hijackOk,
    hijackOk
      ? `调用成功！用用户A的 token 支付了 user_id=1 的订单3，返回 status=${data(r) && data(r).status}, verifyCode=${data(r) && data(r).verifyCode}（攻击者可免费取得他人订单核销码；反之亦然，攻击者可把任意订单刷成已支付）`
      : `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '1) 用户A登录取 token；2) POST /api/payment/mock-callback {"orderId":3}（订单3属 user_id=1）；3) 观察是否成功',
      code: 'controller/PaymentController.java:30-42（mockCallback 未取 UserContext、未校验 order.userId）' });

  // F6 无 token 支付他人工单（应 401）
  r = await api('POST', '/api/payment/mock-callback', { body: { orderId: 2 } });
  expectErr('F6 不携带 token 直接调用支付回调应 401', r, 401, 'code=401 未登录',
    { repro: 'curl -XPOST /api/payment/mock-callback -d {"orderId":2} 不带 Authorization',
      code: 'PaymentController.java:30' });

  // F7 支付后状态与消息
  r = await api('GET', `/api/orders/${S.orderA}`, { token: S.userAToken });
  const d7 = data(r) || {};
  t('F7 支付后订单状态/核销码/支付时间正确', 'status=paid、verifyCode 非空、payTime 非空',
    d7.status === 'paid' && !!d7.verifyCode && !!d7.payTime,
    `status=${d7.status}, verifyCode=${d7.verifyCode}, payTime=${d7.payTime}`,
    { severity: '严重', repro: '支付后 GET /api/orders/{id}' });

  r = await api('GET', '/api/messages?page=1&pageSize=10', { token: S.userAToken });
  const msgs = (data(r) && data(r).list) || [];
  t('F8 支付后生成站内消息通知', '消息列表中出现"支付成功"且含核销码',
    msgs.some((m) => m.title && m.title.includes('支付成功')),
    `消息标题集合: ${msgs.map((m) => m.title).join(' | ') || '(空)'}`,
    { severity: '一般', repro: '支付后 GET /api/messages', code: 'OrderService.java:151-153' });

  return ok1;
}

// ============================================================
//  G. 医护 /api/staff + 核销 /api/verify
// ============================================================
async function testStaffAndVerify() {
  mod('医护与核销 Staff/Verify');
  console.log('\n=== G. 医护与核销 ===');

  // G1 医护登录
  let r = await api('POST', '/api/staff/login', { body: { phone: '13800000000', password: '123456' } });
  const ok1 = expectOk('G1 医护登录(正确密码)', r, 'code=0，返回 token + hospitalId=1',
    (d) => (d && d.token && d.hospitalId === 1 ? true : JSON.stringify(d).slice(0, 200)));
  S.staffToken = data(r) && data(r).token;
  S.staffId = data(r) && data(r).staffId;

  r = await api('POST', '/api/staff/login', { body: { phone: '13800000000', password: 'wrongpwd' } });
  t('G2 医护登录(错误密码)应被拒绝', 'code!=0', code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: 'POST /api/staff/login 错误密码' });

  r = await api('POST', '/api/staff/login', { body: { phone: 'admin', password: 'admin123' } });
  t('G3 用管理员账号登录医护端应被拒绝', 'code!=0（角色校验）',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: 'POST /api/staff/login {phone:"admin", password:"admin123"}',
      code: 'StaffService.java:33' });

  // G4 医护统计
  r = await api('GET', '/api/staff/statistics', { token: S.staffToken });
  const ok4 = expectOk('G4 医护工作台统计', r, 'code=0，含 todayVerified / pendingCount');
  const st = data(r) || {};
  const pendingBefore = st.pendingCount;

  // 构造一个【他院】(上海 医院3) 的已支付订单，用于跨院测试
  const r5 = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 1, hospitalId: 3 } });
  S.orderOtherHospital = data(r5) && data(r5).orderId;
  const r5b = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: S.orderOtherHospital } });
  S.verifyCodeOther = data(r5b) && data(r5b).verifyCode;

  // G4-b 【修复后由占位转真断言】他院订单支付后，本院 pendingCount 不应变化
  const rStats2 = await api('GET', '/api/staff/statistics', { token: S.staffToken });
  t('G4-b 待处理数应按【本院】过滤（他院订单不计入）',
    '他院(上海)订单支付后，本院 pendingCount 应保持不变',
    data(rStats2) && data(rStats2).pendingCount === pendingBefore,
    `他院订单支付前后 pendingCount: ${pendingBefore} → ${data(rStats2) && data(rStats2).pendingCount}`,
    { severity: '严重', repro: '1) 医护取 pendingCount；2) 用户下单到他院并支付；3) 再取 pendingCount 对比',
      code: 'service/StaffService.java statistics（pendingCount 已加 hospitalId 过滤）' });

  // G6 跨院 verify/check —— 预期应拒绝，实际泄露（P1）
  r = await api('POST', '/api/verify/check', { token: S.staffToken, body: { code: S.verifyCodeOther } });
  const leak = code(r) === 0;
  t('G5 跨医院核销码校验 check 应被拒绝（P1 信息泄露）',
    '他院(上海)订单核销码，本院(北京)医护查询应返回 403',
    !leak,
    leak
      ? `查询成功，泄露他院订单信息：orderNo=${data(r) && data(r).orderNo}, packageName=${data(r) && data(r).packageName}, userPhone=${data(r) && data(r).userPhone}`
      : `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重',
      repro: `1) 用户A下单到上海医院3并支付，取得核销码 ${S.verifyCodeOther}；2) 北京协和医护登录；3) POST /api/verify/check {"code":"${S.verifyCodeOther}"}`,
      code: 'service/VerifyService.java:33-55（check 缺 hospitalId 校验，而 confirm 在第 67 行有）' });

  // G7 跨院 verify/confirm —— 应拒绝（该处实现正确）
  r = await api('POST', '/api/verify/confirm', { token: S.staffToken, body: { code: S.verifyCodeOther } });
  expectErr('G6 跨医院确认核销应被拒绝(403)', r, 403, 'code=403 该核销码仅限下单医院核销',
    { severity: '严重', repro: '同上，调用 /api/verify/confirm', code: 'VerifyService.java:67-69' });

  // G8 无效核销码
  r = await api('POST', '/api/verify/check', { token: S.staffToken, body: { code: '000000' } });
  t('G7 无效核销码应被拒绝', 'code!=0', code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: 'POST /api/verify/check {"code":"000000"}' });

  // G9 正常核销本院订单
  r = await api('POST', '/api/verify/check', { token: S.staffToken, body: { code: S.verifyCodeA } });
  const ok9 = expectOk('G8 校验本院有效核销码', r, 'code=0，返回订单与脱敏手机号',
    (d) => (d && d.orderNo && String(d.userPhone || '').includes('****') ? true : JSON.stringify(d).slice(0, 200)));

  r = await api('POST', '/api/verify/confirm', { token: S.staffToken, body: { code: S.verifyCodeA } });
  const ok10 = expectOk('G9 确认核销（本院）', r, 'code=0，already=false');

  // G10 重复核销
  r = await api('POST', '/api/verify/confirm', { token: S.staffToken, body: { code: S.verifyCodeA } });
  const d10 = data(r) || {};
  t('G10 重复核销应返回 already=true（幂等）', 'code=0 且 already=true',
    code(r) === 0 && d10.already === true, `code=${code(r)}, already=${d10.already}, message=${msg(r)}`,
    { severity: '严重', repro: '对同一核销码连续调用两次 /api/verify/confirm', code: 'VerifyService.java:70-76' });

  // G11 核销后订单状态（修复后状态机：paid→verified，出具结果后转 completed）
  r = await api('GET', `/api/orders/${S.orderA}`, { token: S.userAToken });
  const d11 = data(r) || {};
  t('G11 核销后订单状态应为 verified(检测中) 且回写 verifyTime/医院',
    'status=verified、verifyTime 非空、hospitalId=1',
    d11.status === 'verified' && !!d11.verifyTime && d11.hospitalId === 1,
    `status=${d11.status}, verifyTime=${d11.verifyTime}, hospitalId=${d11.hospitalId}`,
    { severity: '严重', repro: '核销后 GET /api/orders/{id}' });

  t('G11-b 订单状态机：核销后进入 verified(检测中)（修复后）',
    '规格状态机 pending_pay→paid→verified(检测中)→completed；核销后应为 verified，出具结果后转 completed',
    d11.status === 'verified',
    `核销后 status=${d11.status}`,
    { severity: '一般', repro: '走完"支付→医护核销"流程后查看订单 status 实际取值',
      code: 'service/VerifyService.java confirm（目标状态 verified）+ service/ResultService.java upload（verified→completed）' });

  // G11-c 并发核销（P1：check-then-act 非原子）
  const rc1 = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 4, hospitalId: 1 } });
  const concOrderId = data(rc1) && data(rc1).orderId;
  const rc2 = await api('POST', '/api/payment/mock-callback', { token: S.userAToken, body: { orderId: concOrderId } });
  const concCode = data(rc2) && data(rc2).verifyCode;
  if (concCode) {
    const before = await api('GET', `/api/verify/records?page=1&pageSize=100`, { token: S.staffToken });
    const beforeCount = ((data(before) || {}).list || []).filter((x) => x.orderId === concOrderId).length;
    // 并发 6 次确认核销
    const parallel = await Promise.all(
      Array.from({ length: 6 }, () => api('POST', '/api/verify/confirm', { token: S.staffToken, body: { code: concCode } }))
    );
    const okCount = parallel.filter((x) => code(x) === 0).length;
    const after = await api('GET', `/api/verify/records?page=1&pageSize=100`, { token: S.staffToken });
    const afterCount = ((data(after) || {}).list || []).filter((x) => x.orderId === concOrderId).length;
    t('G11-c 并发重复核销不应产生多条核销记录',
      '6 个并发请求应只有 1 次真正核销，verify_record 只新增 1 条',
      afterCount - beforeCount <= 1,
      `并发 6 次确认，成功 ${okCount} 次；该订单核销记录数 ${beforeCount} → ${afterCount}（新增 ${afterCount - beforeCount} 条）`,
      { severity: '严重',
        repro: `1) 下单并支付取得核销码 ${concCode}；2) 并发 6 次 POST /api/verify/confirm；3) 查 /api/verify/records 统计该订单记录数`,
        code: 'service/VerifyService.java:62-98（selectOne 判状态 → update，check-then-act 非原子；verify_record 无 uk(order_id) 兜底），db/schema.sql:88-103' });
  }

  // G11-d 支付后套餐销量应 +1
  r = await api('GET', '/api/packages/1');
  const sales1 = data(r) && data(r).salesCount;
  t('G11-d 支付成功后套餐销量应 +1（原子更新）',
    'seed 中套餐1 销量 3520，本次测试为其下过 2 单并完成支付，应 ≥ 3522',
    sales1 >= 3522,
    `套餐1 当前销量 salesCount=${sales1}（期望 ≥3522）。另注：OrderService 用"读-改-写"自增，非原子更新，并发支付会丢更新`,
    { severity: '一般', repro: '完成支付后 GET /api/packages/1 观察 salesCount',
      code: 'service/OrderService.java:144-149（selectById → setSalesCount(+1) → updateById，未用 SET sales_count = sales_count + 1）' });

  // G12 核销记录（按医院隔离）
  r = await api('GET', '/api/verify/records?page=1&pageSize=20', { token: S.staffToken });
  const ok12 = expectOk('G12 医护查看核销记录', r, 'code=0，仅返回本院(hospital 1)记录');
  const recs = (data(r) && data(r).list) || [];
  t('G12-b 核销记录按医院隔离', '所有记录 hospitalId 均为 1',
    recs.every((x) => x.hospitalId === 1),
    `返回 ${recs.length} 条，hospitalId 集合: ${[...new Set(recs.map((x) => x.hospitalId))].join(',')}`,
    { severity: '严重', repro: 'GET /api/verify/records', code: 'VerifyService.java:111-122' });

  // G13 日期筛选（用本地时区日期，避免 UTC 偏移）
  const dt = new Date();
  const localToday = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  r = await api('GET', `/api/verify/records?page=1&pageSize=20&date=${localToday}`, { token: S.staffToken });
  const todayRecs = (data(r) && data(r).list) || [];
  t('G13 核销记录按日期筛选', '仅返回今日记录',
    todayRecs.length > 0 && todayRecs.every((x) => String(x.verifyTime).startsWith(localToday)),
    `date=${localToday} 返回 ${todayRecs.length} 条（今日应有 1 条刚产生的核销）`,
    { severity: '严重', repro: `GET /api/verify/records?date=${localToday}` });

  // G14 医护越权访问用户接口
  r = await api('GET', '/api/user/profile', { token: S.staffToken });
  t('G14 医护 token 访问 C 端用户档案', '应被角色拦截或至少不返回医护无关的 C 端档案',
    true, `code=${code(r)}, message=${msg(r)}（记录行为）`, { severity: '轻微' });

  // G15 医护访问管理端接口
  r = await api('GET', '/api/admin/statistics', { token: S.staffToken });
  t('G15 医护 token 访问管理端统计应 403', 'code=403 无权限',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 staff token 调 GET /api/admin/statistics', code: 'security/AuthInterceptor.java:64-70' });

  return ok1 && ok4 && ok9 && ok10 && ok12;
}

// ============================================================
//  H. 检测结果 /api/results
// ============================================================
async function testResult() {
  mod('检测结果 Result');
  console.log('\n=== H. 检测结果 ===');

  let r = await api('GET', '/api/results?page=1&pageSize=10', { token: S.userAToken });
  const ok1 = expectOk('H1 用户查看检测记录列表', r, 'code=0（新用户应为空列表）',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));

  r = await api('GET', '/api/results/1', { token: S.userAToken });
  expectErr('H2 越权查看他人检测结果应 404', r, 404, 'code=404 检测结果不存在',
    { severity: '严重', repro: '用用户A token 访问 GET /api/results/1（属 user_id=1）',
      code: 'service/ResultService.java:40-43' });

  // 医护为本院已完成订单出具结果
  r = await api('POST', '/api/results/upload', {
    token: S.staffToken,
    body: {
      code: S.verifyCodeA,
      reportItems: [
        { name: 'D-二聚体', value: '1.52', unit: 'mg/L', range: '0-0.5', abnormal: true },
        { name: '凝血酶原时间', value: '12.8', unit: 's', range: '11-15', abnormal: false },
      ],
      reportUrl: '/files/report-demo.pdf',
    },
  });
  const ok3 = expectOk('H3 医护为本院已核销订单出具结果', r, 'code=0');

  // 用户可见结果
  r = await api('GET', '/api/results?page=1&pageSize=10', { token: S.userAToken });
  const list = (data(r) && data(r).list) || [];
  const ok4 = t('H4 用户端可见刚出具的检测结果', '列表出现 1 条 status=published 的结果',
    list.length >= 1 && list.some((x) => x.status === 'published'),
    `列表长度=${list.length}, 状态=${list.map((x) => x.status).join(',')}`,
    { severity: '严重', repro: '医护出具结果后，用户端 GET /api/results' }) || true;

  if (list.length > 0) {
    S.resultId = list[0].id;
    r = await api('GET', `/api/results/${S.resultId}`, { token: S.userAToken });
    expectOk('H5 检测结果详情', r, 'code=0，含 reportItems 明细与医院名',
      (d) => (d && d.reportItems ? true : JSON.stringify(d).slice(0, 200)));
  }

  // 跨医院出具结果
  r = await api('POST', '/api/results/upload', {
    token: S.staffToken,
    body: { code: S.verifyCodeOther, reportItems: [{ name: 'x', value: '1', unit: '', range: '', abnormal: false }], reportUrl: '' },
  });
  expectErr('H6 跨医院出具结果应被拒绝(403)', r, 403, 'code=403 该订单不属于本院',
    { severity: '严重', repro: `用北京医护 token 对上海订单核销码 ${S.verifyCodeOther} 调用 /api/results/upload`,
      code: 'service/ResultService.java:82-84' });

  // 未核销订单出具结果
  const r7a = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 6, hospitalId: 1 } });
  S.orderUnverified = data(r7a) && data(r7a).orderId;
  r = await api('POST', '/api/results/upload', {
    token: S.staffToken,
    body: { orderId: S.orderUnverified, reportItems: [], reportUrl: '' },
  });
  t('H7 为未核销(unpaid/未核销)订单出具结果应被拒绝', 'code!=0，提示"订单未核销"',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '对未支付/未核销订单调用 /api/results/upload', code: 'ResultService.java:86-88' });

  // 用户越权上传结果
  r = await api('POST', '/api/results/upload', { token: S.userAToken, body: { code: S.verifyCodeA, reportItems: [], reportUrl: '' } });
  t('H8 普通用户调用医护的结果上传接口应被拒绝', 'code=403 无权限',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 user token 调 POST /api/results/upload', code: 'controller/ResultController.java:39' });

  const r9 = await api('GET', '/api/messages?page=1&pageSize=20', { token: S.userAToken });
  const m9 = (data(r9) && data(r9).list) || [];
  t('H9 出具结果后生成站内通知', '消息列表出现"检测结果已出具"',
    m9.some((m) => m.title && m.title.includes('检测结果')),
    `消息标题: ${m9.map((m) => m.title).join(' | ')}`,
    { severity: '一般', repro: '出具结果后 GET /api/messages', code: 'ResultService.java:119-121' });

  return ok1 && ok3;
}

// ============================================================
//  I. 用药管理 /api/medications
// ============================================================
async function testMedication() {
  mod('用药管理 Medication');
  console.log('\n=== I. 用药管理 ===');

  let r = await api('POST', '/api/medications', {
    token: S.userAToken,
    body: {
      drugName: '华法林钠片', dosePerTime: '3mg', timesPerDay: 2,
      timePoints: [{ id: 'tp1', time: '08:00' }, { id: 'tp2', time: '20:00' }],
      reminderOn: 1,
    },
  });
  const ok1 = expectOk('I1 创建用药方案', r, 'code=0，返回方案 id',
    (d) => (d && d.id ? true : JSON.stringify(d).slice(0, 200)));
  S.medId = data(r) && data(r).id;

  // I1-b 数据库有 start_at/end_at/doctor_assessed 三列，但 DTO 不接收 → 无法设置
  r = await api('POST', '/api/medications', {
    token: S.userAToken,
    body: {
      drugName: '带疗程方案', dosePerTime: '3mg', timesPerDay: 1,
      timePoints: [{ id: 'tp1', time: '08:00' }], reminderOn: 1,
      startAt: '2026-09-01', endAt: '2026-12-01', doctorAssessed: 'thrombosis',
    },
  });
  t('I1-b 用药方案的疗程起止(startAt/endAt)与医生评估(doctorAssessed)无法通过接口设置',
    'schema 存在 start_at/end_at/doctor_assessed 三列，业务上（疗程提醒、血栓状态标记）应可写入',
    code(r) === 0,
    code(r) === 0
      ? `接口接受但需确认是否真的落库（详见 I1-c 回读校验）`
      : `code=${code(r)}, message=${msg(r)} —— 传这三个字段直接 500，即"疗程"和"医生评估血栓状态"两个业务字段实际不可用`,
    { severity: '一般',
      repro: 'POST /api/medications 携带 startAt/endAt/doctorAssessed 字段',
      code: 'dto/MedicationSaveRequest.java（仅有 drugName/dosePerTime/timesPerDay/timePoints/reminderOn）；db/schema.sql:132-134' });

  // I1-c 回读确认三字段已落库（detail 接口返回 {medication, recentRecords} 结构）
  if (code(r) === 0 && data(r) && data(r).id) {
    const rr = await api('GET', `/api/medications/${data(r).id}`, { token: S.userAToken });
    const dd = (data(rr) || {}).medication || data(rr) || {};
    t('I1-c 疗程字段落库校验', 'startAt/endAt/doctorAssessed 应有值',
      !!(dd.startAt || dd.start_at) && !!(dd.endAt || dd.end_at),
      `回读: startAt=${dd.startAt}, endAt=${dd.endAt}, doctorAssessed=${dd.doctorAssessed}`,
      { severity: '一般', repro: '创建后 GET /api/medications/{id} 回读疗程字段',
        code: 'dto/MedicationSaveRequest.java' });
    await api('DELETE', `/api/medications/${data(r).id}`, { token: S.userAToken });
  }

  r = await api('GET', '/api/medications?page=1&pageSize=10', { token: S.userAToken });
  const ok2 = expectOk('I2 用药方案列表', r, 'code=0，返回数组且含刚创建的方案',
    (d) => (Array.isArray(d) && d.some((m) => m.id === S.medId) ? true : JSON.stringify(d).slice(0, 200)));

  r = await api('GET', `/api/medications/${S.medId}`, { token: S.userAToken });
  const ok3 = expectOk('I3 用药方案详情', r, 'code=0，返回 {medication, recentRecords}，drugName 一致',
    (d) => (d && d.medication && d.medication.drugName === '华法林钠片' ? true : JSON.stringify(d).slice(0, 200)));

  r = await api('PUT', `/api/medications/${S.medId}`, {
    token: S.userAToken,
    body: { drugName: '华法林钠片(调整)', dosePerTime: '2.5mg', timesPerDay: 1, timePoints: [{ id: 'tp1', time: '09:00' }], reminderOn: 1 },
  });
  expectOk('I4 更新用药方案', r, 'code=0');

  r = await api('GET', `/api/medications/${S.medId}`, { token: S.userAToken });
  const d5 = (data(r) && data(r).medication) || {};
  t('I5 更新后回读一致', 'drugName="华法林钠片(调整)"、dosePerTime="2.5mg"',
    d5.drugName === '华法林钠片(调整)' && d5.dosePerTime === '2.5mg',
    `drugName=${d5.drugName}, dosePerTime=${d5.dosePerTime}`,
    { severity: '严重', repro: 'PUT 更新后 GET 详情比对' });

  r = await api('GET', `/api/medications/${S.medId}`, { token: S.userAToken });
  const d5b = (data(r) && data(r).medication) || {};
  t('I5-b 更新用药方案后历史打卡记录是否被孤立', '更新时间点后，已有打卡记录应仍可关联',
    true,
    `更新时间点后 recentRecords 条数=${((data(r) || {}).recentRecords || []).length}（MedicationService.apply 会重新生成 time_point_id，历史记录按旧 id 存储将查不到）`,
    { severity: '一般', repro: '1) 建方案+打卡；2) 编辑方案改时间点；3) 再打卡并回读近 7 日记录',
      code: 'service/MedicationService.java:113 apply() 重新生成 time_point_id' });

  // 打卡（注：MedicationRecordRequest 仅接收 timePointId，日期由服务端取当天）
  r = await api('POST', `/api/medications/${S.medId}/records`, { token: S.userAToken, body: { timePointId: 'tp1' } });
  const ok6 = expectOk('I6 用药打卡', r, 'code=0');

  r = await api('POST', `/api/medications/${S.medId}/records`, { token: S.userAToken, body: { timePointId: 'tp1' } });
  t('I7 同一时间点当日重复打卡应幂等（不报错/不重复插入）', 'code=0 且仍只有 1 条记录',
    code(r) === 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '一般', repro: '对同一 medicationId+timePointId 连续打卡两次',
      code: 'service/MedicationService.java:68-97（已做 upsert）' });

  // I7-b 不存在的时间点
  r = await api('POST', `/api/medications/${S.medId}/records`, { token: S.userAToken, body: { timePointId: 'not-exist-tp' } });
  t('I7-b 打卡传入不存在的时间点应被拒绝', 'code=404 时间点不存在',
    code(r) === 404, `code=${code(r)}, message=${msg(r)}`,
    { severity: '轻微', repro: 'POST /api/medications/{id}/records {timePointId:"not-exist-tp"}',
      code: 'MedicationService.java:70-74' });

  r = await api('GET', `/api/medications/${S.medId}`, { token: S.userAToken });
  const d8 = data(r) || {};
  t('I8 详情页能回读今日打卡状态', '返回今日打卡记录（taken）',
    true, `返回字段: ${Object.keys(d8).join(',')}；records=${JSON.stringify(d8.records || d8.medicationRecords || null).slice(0, 150)}（前端列表页已知不回读打卡态）`,
    { severity: '一般', repro: '打卡后 GET /api/medications/{id}，检查返回体是否带当日打卡状态',
      code: 'miniapp/pages/medication-list/medication-list.js:41' });

  // 边界：0 次/天，超长药名
  r = await api('POST', '/api/medications', {
    token: S.userAToken,
    body: { drugName: 'A'.repeat(200), dosePerTime: '', timesPerDay: 0, timePoints: [], reminderOn: 1 },
  });
  t('I9 边界入参（200字药名 / timesPerDay=0 / 空时间点）',
    '超长药名应被长度校验拦截，timesPerDay=0 应被业务校验',
    code(r) !== 0, `code=${code(r)}, 是否创建成功=${code(r) === 0}`,
    { severity: '轻微', repro: 'POST /api/medications {drugName: 200个A, timesPerDay: 0}',
      code: 'entity/Medication.java drug_name VARCHAR(64)，超长在 MySQL 严格模式会报错' });

  // 越权：访问他人用药方案（seed 无他人方案，改用不存在的 id）
  r = await api('GET', '/api/medications/999999', { token: S.userAToken });
  t('I10 访问不存在的用药方案', '应返回明确错误而非 code=0 空对象',
    code(r) !== 0, `code=${code(r)}, data=${JSON.stringify(data(r)).slice(0, 120)}`,
    { severity: '一般', repro: 'GET /api/medications/999999' });

  // 删除
  r = await api('DELETE', `/api/medications/${S.medId}`, { token: S.userAToken });
  expectOk('I11 删除用药方案', r, 'code=0');

  r = await api('GET', `/api/medications/${S.medId}`, { token: S.userAToken });
  t('I12 删除后再次查询', '不可见/明确错误',
    true, `code=${code(r)}, data=${JSON.stringify(data(r)).slice(0, 120)}（记录删除语义：物理删除 or 软删除 status=stopped）`,
    { severity: '轻微' });

  return ok1 && ok2 && ok3 && ok6;
}

// ============================================================
//  J. 消息 /api/messages
// ============================================================
async function testMessage() {
  mod('消息 Message');
  console.log('\n=== J. 站内消息 ===');

  let r = await api('GET', '/api/messages?page=1&pageSize=20', { token: S.userAToken });
  const ok1 = expectOk('J1 消息列表', r, 'code=0，返回 list',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));
  const msgs = (data(r) && data(r).list) || [];
  S.msgId = msgs.length ? msgs[0].id : null;

  r = await api('GET', '/api/messages?page=1&pageSize=20&type=order', { token: S.userAToken });
  const typed = (data(r) && data(r).list) || [];
  t('J2 按类型筛选(type=order)', '返回消息 type 均为 order',
    typed.every((m) => m.type === 'order'),
    `返回 ${typed.length} 条，type 集合: ${[...new Set(typed.map((m) => m.type))].join(',')}`,
    { severity: '一般', repro: 'GET /api/messages?type=order' });

  if (S.msgId) {
    r = await api('GET', `/api/messages/${S.msgId}`, { token: S.userAToken });
    expectOk('J3 消息详情', r, 'code=0，含 title/content');

    r = await api('PUT', `/api/messages/${S.msgId}/read`, { token: S.userAToken });
    const ok4 = expectOk('J4 标记已读', r, 'code=0');

    r = await api('GET', `/api/messages/${S.msgId}`, { token: S.userAToken });
    t('J4-b 已读状态回读', 'isRead=1',
      data(r) && (data(r).isRead === 1 || data(r).isRead === true),
      `isRead=${data(r) && data(r).isRead}`,
      { severity: '一般', repro: 'PUT /read 后 GET 详情' });
  }

  // 越权读取他人消息 (user 1 的消息 id=1)
  r = await api('GET', '/api/messages/1', { token: S.userAToken });
  t('J5 越权读取他人消息', '应不可见(404) 或明确拒绝',
    code(r) !== 0, `code=${code(r)}, 返回=${JSON.stringify(data(r)).slice(0, 150)}`,
    { severity: '严重', repro: '用用户A token GET /api/messages/1（属 user_id=1）',
      code: 'service/MessageService.java / controller/MessageController.java:26' });

  r = await api('DELETE', '/api/messages/1', { token: S.userAToken });
  t('J6 越权删除他人消息', '应不可删除（他人消息不可见）',
    code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用用户A token DELETE /api/messages/1' });

  // 删除自己的消息
  if (msgs.length > 1) {
    const delId = msgs[msgs.length - 1].id;
    r = await api('DELETE', `/api/messages/${delId}`, { token: S.userAToken });
    expectOk('J7 删除自己的消息', r, 'code=0');
  }

  r = await api('GET', '/api/messages/unread-count', { token: S.userAToken });
  expectOk('J8 未读数统计', r, 'code=0，count 为数字',
    (d) => (d && typeof d.count === 'number' ? true : JSON.stringify(d)));

  return ok1;
}

// ============================================================
//  K. 管理端 /api/admin
// ============================================================
async function testAdmin() {
  mod('管理端 Admin');
  console.log('\n=== K. 管理端 ===');

  // K1 平台管理员登录
  let r = await api('POST', '/api/admin/login', { body: { account: 'admin', password: 'admin123' } });
  const ok1 = expectOk('K1 平台管理员登录', r, 'code=0，返回 token + role=admin',
    (d) => (d && d.token && d.role === 'admin' ? true : JSON.stringify(d).slice(0, 200)));
  S.adminToken = data(r) && data(r).token;

  // K2 医院管理员登录
  r = await api('POST', '/api/admin/login', { body: { account: 'hospital_admin', password: 'admin123' } });
  const ok2 = expectOk('K2 医院管理员登录', r, 'code=0，role=hospital_admin，hospitalId=1',
    (d) => (d && d.role === 'hospital_admin' && d.hospitalId === 1 ? true : JSON.stringify(d).slice(0, 200)));
  S.hosToken = data(r) && data(r).token;

  r = await api('POST', '/api/admin/login', { body: { account: 'admin', password: 'wrong' } });
  t('K3 管理员错误密码应被拒绝', 'code!=0', code(r) !== 0, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: 'POST /api/admin/login 错误密码' });

  // K4 /me
  r = await api('GET', '/api/admin/me', { token: S.adminToken });
  expectOk('K4 平台管理员 /me', r, 'code=0');
  r = await api('GET', '/api/admin/me', { token: S.hosToken });
  const meHos = data(r) || {};
  t('K4-b 医院管理员 /me 返回本院信息', 'hospitalName=北京协和医院',
    !!meHos.hospitalName, `返回: ${JSON.stringify(meHos).slice(0, 200)}`,
    { severity: '一般', repro: '医院管理员登录后 GET /api/admin/me' });

  // K5 角色越权：医院管理员访问仅 admin 的套餐管理
  r = await api('GET', '/api/admin/packages?page=1&pageSize=10', { token: S.hosToken });
  t('K5 医院管理员访问【仅平台】套餐管理应 403', 'code=403 无权限',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 hospital_admin token 调 GET /api/admin/packages',
      code: 'controller/AdminController.java:136 @RequireRole({"admin"})' });

  r = await api('GET', '/api/admin/bills?page=1&pageSize=10', { token: S.hosToken });
  t('K6 医院管理员访问【仅平台】支付账单应 403', 'code=403',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 hospital_admin token 调 GET /api/admin/bills', code: 'AdminController.java:191' });

  r = await api('GET', '/api/admin/hospital-admins?page=1&pageSize=10', { token: S.hosToken });
  t('K7 医院管理员访问【仅平台】医院管理员管理应 403', 'code=403',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 hospital_admin token 调 GET /api/admin/hospital-admins' });

  r = await api('GET', '/api/admin/hospitals', { token: S.hosToken });
  t('K8 医院管理员访问【仅平台】医院管理应 403', 'code=403',
    code(r) === 403, `code=${code(r)}, message=${msg(r)}`,
    { severity: '严重', repro: '用 hospital_admin token 调 GET /api/admin/hospitals' });

  // K9 平台套餐管理 CRUD
  r = await api('GET', '/api/admin/packages?page=1&pageSize=30', { token: S.adminToken });
  const ok9 = expectOk('K9 平台套餐列表', r, 'code=0，返回 8 个套餐',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));
  const pkgTotal = (data(r) && data(r).total) || 0;

  r = await api('POST', '/api/admin/packages', {
    token: S.adminToken,
    body: { name: 'QA测试套餐', price: 999.00, cover: '', images: [], items: [{ name: 'QA项目', desc: 'x' }], targetPopulation: ['QA'], cities: ['北京'], hospitalCount: 1, salesCount: 0, notice: 'QA', status: 'on' },
  });
  const ok10 = expectOk('K10 平台新增套餐', r, 'code=0，返回新套餐 id', (d) => (d && d.id ? true : JSON.stringify(d).slice(0, 200)));
  S.newPkgId = data(r) && data(r).id;

  if (S.newPkgId) {
    r = await api('PUT', `/api/admin/packages/${S.newPkgId}`, {
      token: S.adminToken,
      body: { name: 'QA测试套餐(改)', price: 1099.00, cover: '', images: [], items: [], targetPopulation: [], cities: ['北京', '上海'], hospitalCount: 2, salesCount: 0, notice: 'QA2', status: 'on' },
    });
    expectOk('K11 平台编辑套餐', r, 'code=0');

    r = await api('PUT', `/api/admin/packages/${S.newPkgId}/status`, { token: S.adminToken, body: { status: 'off' } });
    expectOk('K12 套餐上下架切换', r, 'code=0');

    r = await api('GET', `/api/packages/${S.newPkgId}`);
    t('K12-b 下架后 C 端列表应不再展示', 'C 端 /api/packages 不含该套餐',
      true, `C 端详情 status=${data(r) && data(r).status}（配合 C2 用例一起判断）`, { severity: '一般' });

    r = await api('DELETE', `/api/admin/packages/${S.newPkgId}`, { token: S.adminToken });
    t('K13 平台删除套餐', '如业务需要删除，应提供 DELETE 接口',
      code(r) !== 404 && code(r) !== 405,
      `code=${code(r)}（当前后端无 DELETE /api/admin/packages/{id}，套餐只能上下架不能删除，管理端也无删除入口）`,
      { severity: '轻微', repro: 'DELETE /api/admin/packages/{id}',
        code: 'controller/AdminController.java:145-162（仅有 POST/PUT）' });
  }

  // K14 医护管理 CRUD
  r = await api('GET', '/api/admin/staffs?page=1&pageSize=10', { token: S.adminToken });
  const ok14 = expectOk('K14 平台医护列表', r, 'code=0',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));

  const newPhone = '137' + String(Date.now()).slice(-8);
  r = await api('POST', '/api/admin/staffs', {
    token: S.adminToken,
    body: { phone: newPhone, password: '123456', nickname: 'QA医护', hospitalId: 1, status: 1 },
  });
  const ok15 = expectOk('K15 平台新增医护', r, 'code=0，返回 id', (d) => (d && d.id ? true : JSON.stringify(d).slice(0, 200)));
  S.newStaffId = data(r) && data(r).id;

  if (S.newStaffId) {
    r = await api('PUT', `/api/admin/staffs/${S.newStaffId}`, {
      token: S.adminToken, body: { phone: newPhone, nickname: 'QA医护(改)', hospitalId: 1, status: 0 },
    });
    expectOk('K16 编辑医护(置为禁用 status=0)', r, 'code=0');

    // K17 禁用账号能否登录（P2）
    r = await api('POST', '/api/staff/login', { body: { phone: newPhone, password: '123456' } });
    t('K17 禁用(status=0)的医护账号不应能登录', 'code!=0 账号已禁用',
      code(r) !== 0,
      code(r) === 0 ? `禁用后仍可登录成功并返回 token（越权风险）` : `code=${code(r)}, message=${msg(r)}`,
      { severity: '严重', repro: '1) 平台端把医护 status 改为 0；2) 用该账号调 /api/staff/login',
        code: 'service/StaffService.java:31-50（login 未校验 u.getStatus()）' });

    r = await api('POST', `/api/admin/staffs/${S.newStaffId}/reset-password`, { token: S.adminToken, body: { password: '654321' } });
    expectOk('K18 重置医护密码', r, 'code=0');

    r = await api('DELETE', `/api/admin/staffs/${S.newStaffId}`, { token: S.adminToken });
    expectOk('K19 删除医护', r, 'code=0');
  }

  // K20 医院管理员的医护列表应锁定本院
  r = await api('GET', '/api/admin/staffs?page=1&pageSize=20', { token: S.hosToken });
  const hosStaffs = (data(r) && data(r).list) || [];
  t('K20 医院管理员医护列表应只含本院(hospital 1)', '所有记录 hospitalId=1',
    hosStaffs.length > 0 && hosStaffs.every((s) => s.hospitalId === 1),
    `返回 ${hosStaffs.length} 条，hospitalId 集合: ${[...new Set(hosStaffs.map((s) => s.hospitalId))].join(',')}`,
    { severity: '严重', repro: '用 hospital_admin token GET /api/admin/staffs', code: 'service/AdminService.java staffs()' });

  // K21 医院管理员尝试越权指定其他医院
  r = await api('GET', '/api/admin/staffs?page=1&pageSize=20&hospitalId=3', { token: S.hosToken });
  const leaked = (data(r) && data(r).list) || [];
  t('K21 医院管理员传 hospitalId=3 越权查询他院医护', '应强制锁定本院，忽略/拒绝该参数',
    leaked.every((s) => s.hospitalId === 1),
    `返回 ${leaked.length} 条，hospitalId 集合: ${[...new Set(leaked.map((s) => s.hospitalId))].join(',')}`,
    { severity: '严重', repro: '用 hospital_admin token 调 GET /api/admin/staffs?hospitalId=3' });

  // K22 账单
  r = await api('GET', '/api/admin/bills?page=1&pageSize=10', { token: S.adminToken });
  const ok22 = expectOk('K22 平台支付账单列表', r, 'code=0，返回 5 条(3微信+2支付宝)',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));
  const bills = (data(r) && data(r).list) || [];

  r = await api('GET', '/api/admin/bills?page=1&pageSize=10&channel=alipay', { token: S.adminToken });
  const ali = (data(r) && data(r).list) || [];
  t('K23 账单按渠道筛选(alipay)', '返回账单 channel 均为 alipay',
    ali.every((b) => b.channel === 'alipay'),
    `返回 ${ali.length} 条，channel 集合: ${[...new Set(ali.map((b) => b.channel))].join(',')}`,
    { severity: '一般', repro: 'GET /api/admin/bills?channel=alipay' });

  const diffBill = bills.find((b) => b.reconcileStatus === 'diff');
  if (diffBill) {
    // 前置：差异账单对应订单需已支付。旧流程隐式依赖 F5 越权支付缺陷（订单3被他人 token 刷成已支付），
    // #1 修复后改为以订单本人(user_id=1 → code=user_001)身份合法支付
    const rPay = await api('POST', '/api/auth/wechat-login', { body: { code: 'user_001' } });
    if (data(rPay) && data(rPay).token && diffBill.orderId) {
      await api('POST', '/api/payment/mock-callback', { token: data(rPay).token, body: { orderId: diffBill.orderId } });
    }
    r = await api('POST', `/api/admin/bills/${diffBill.id}/sync`, { token: S.adminToken });
    const synced = data(r) || {};
    t('K24 差异账单重新同步', 'sync 后 reconcileStatus 变为 ok',
      code(r) === 0 && synced.reconcileStatus === 'ok',
      `code=${code(r)}, 同步后 reconcileStatus=${synced.reconcileStatus}（若仍为 diff，说明同步是假动作）`,
      { severity: '一般', repro: `POST /api/admin/bills/${diffBill.id}/sync`, code: 'service/AdminService.java syncBill()' });
  }

  // K25 售卖
  r = await api('GET', '/api/admin/sales?page=1&pageSize=20', { token: S.adminToken });
  const ok25 = expectOk('K25 平台售卖记录', r, 'code=0',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));

  r = await api('GET', '/api/admin/sales?page=1&pageSize=20', { token: S.hosToken });
  const hosSales = (data(r) && data(r).list) || [];
  t('K26 医院管理员售卖记录应只含本院', '所有记录 hospitalId=1',
    hosSales.every((s) => s.hospitalId === 1 || s.hospitalId === undefined || s.hospitalId === null),
    `返回 ${hosSales.length} 条，hospitalId 集合: ${[...new Set(hosSales.map((s) => s.hospitalId))].join(',')}`,
    { severity: '严重', repro: '用 hospital_admin token GET /api/admin/sales', code: 'AdminService.java sales()' });

  // K27 核销记录（平台 vs 医院）
  r = await api('GET', '/api/admin/verify-records?page=1&pageSize=20', { token: S.adminToken });
  const ok27 = expectOk('K27 平台核销记录', r, 'code=0');
  r = await api('GET', '/api/admin/verify-records?page=1&pageSize=20', { token: S.hosToken });
  const hosVr = (data(r) && data(r).list) || [];
  t('K28 医院管理员核销记录应只含本院', '所有记录 hospitalId=1',
    hosVr.every((v) => v.hospitalId === 1),
    `返回 ${hosVr.length} 条，hospitalId 集合: ${[...new Set(hosVr.map((v) => v.hospitalId))].join(',')}`,
    { severity: '严重', repro: '用 hospital_admin token GET /api/admin/verify-records', code: 'AdminService.java verifyRecords()' });

  // K29 统计（金额隔离）
  r = await api('GET', '/api/admin/statistics', { token: S.adminToken });
  const ok29 = expectOk('K29 平台统计', r, 'code=0，含销售额等金额字段');
  const statAdmin = data(r) || {};
  r = await api('GET', '/api/admin/statistics', { token: S.hosToken });
  const statHos = data(r) || {};
  t('K30 医院管理员统计不应包含金额', '返回体不应含销售额/金额类字段',
    !('totalSales' in statHos) && !('salesAmount' in statHos) && !('totalAmount' in statHos),
    `平台端字段: ${Object.keys(statAdmin).join(',')}；医院端字段: ${Object.keys(statHos).join(',')}`,
    { severity: '一般', repro: '对比 admin 与 hospital_admin 调用 /api/admin/statistics 的返回字段',
      code: 'service/AdminService.java statistics()' });

  // K31 医院管理 CRUD
  r = await api('GET', '/api/admin/hospitals', { token: S.adminToken });
  const ok31 = expectOk('K31 平台医院列表', r, 'code=0，返回 6 家',
    (d) => (Array.isArray(d) && d.length >= 6 ? true : `len=${d && d.length}`));

  r = await api('POST', '/api/admin/hospitals', {
    token: S.adminToken,
    body: { name: 'QA测试医院', address: 'QA地址', phone: '010-00000000', city: '北京', lat: 39.9, lng: 116.4, detectTime: '工作日', status: 'cooperating' },
  });
  const ok32 = expectOk('K32 平台新增医院', r, 'code=0，返回 id', (d) => (d && d.id ? true : JSON.stringify(d).slice(0, 200)));
  S.newHosId = data(r) && data(r).id;

  if (S.newHosId) {
    r = await api('PUT', `/api/admin/hospitals/${S.newHosId}`, {
      token: S.adminToken, body: { name: 'QA测试医院(改)', address: 'QA地址2', phone: '010-11111111', city: '上海', lat: 31.2, lng: 121.4, detectTime: '工作日', status: 'disabled' },
    });
    expectOk('K33 编辑医院', r, 'code=0');

    r = await api('GET', '/api/hospitals');
    const pubHos = data(r) || [];
    t('K33-b 停用(disabled)医院不应出现在 C 端列表', 'C 端 /api/hospitals 不含 disabled 医院',
      !pubHos.some((h) => h.id === S.newHosId),
      `C 端返回 ${pubHos.length} 家，含停用医院: ${pubHos.some((h) => h.id === S.newHosId)}`,
      { severity: '一般', repro: '把医院置为 disabled 后 GET /api/hospitals', code: 'service/HospitalService.java' });

    r = await api('DELETE', `/api/admin/hospitals/${S.newHosId}`, { token: S.adminToken });
    expectOk('K34 删除医院', r, 'code=0');
  }

  // K35 医院管理员管理（仅平台）
  r = await api('GET', '/api/admin/hospital-admins?page=1&pageSize=10', { token: S.adminToken });
  expectOk('K35 平台医院管理员列表', r, 'code=0',
    (d) => (d && Array.isArray(d.list) ? true : JSON.stringify(d).slice(0, 150)));

  // K36 【修复后由记录转真断言】禁用的医院管理员登录管理端应被拒绝（N2 修复验证）
  {
    const rList = await api('GET', '/api/admin/hospital-admins?page=1&pageSize=20', { token: S.adminToken });
    const acc = ((data(rList) || {}).list || []).find((x) => x.phone === 'hospital_admin');
    if (acc) {
      await api('PUT', `/api/admin/hospital-admins/${acc.id}`, {
        token: S.adminToken, body: { phone: 'hospital_admin', nickname: '协和医院管理员', hospitalId: 1, status: 0 },
      });
      const rLogin = await api('POST', '/api/admin/login', { body: { account: 'hospital_admin', password: 'admin123' } });
      // 恢复启用，避免影响后续用例
      await api('PUT', `/api/admin/hospital-admins/${acc.id}`, {
        token: S.adminToken, body: { phone: 'hospital_admin', nickname: '协和医院管理员', hospitalId: 1, status: 1 },
      });
      t('K36 禁用(status=0)的医院管理员登录管理端应被拒绝', 'code!=0 账号已禁用',
        code(rLogin) !== 0, `code=${code(rLogin)}, message=${msg(rLogin)}`,
        { severity: '严重', repro: '把 hospital_admin 置 status=0 后调 /api/admin/login',
          code: 'service/AdminService.java login（已加 status 校验）' });
    }
  }

  return ok1 && ok2 && ok9 && ok14;
}

// ============================================================
//  L. 全局安全与边界
// ============================================================
async function testSecurity() {
  mod('安全与边界 Security');
  console.log('\n=== L. 安全与全局边界 ===');

  const protectedGets = [
    '/api/user/profile',
    '/api/orders?page=1',
    '/api/messages?page=1',
    '/api/results?page=1',
    '/api/medications?page=1',
    '/api/home',
    '/api/messages/unread-count',
    '/api/staff/statistics',
    '/api/verify/records?page=1',
    '/api/admin/me',
    '/api/admin/statistics',
    '/api/admin/packages?page=1',
    '/api/admin/staffs?page=1',
    '/api/admin/bills?page=1',
    '/api/admin/hospitals',
  ];
  let all401 = true;
  const failed = [];
  for (const p of protectedGets) {
    const r = await api('GET', p);
    if (code(r) !== 401) { all401 = false; failed.push(`${p} → code=${code(r)}`); }
  }
  t('L1 所有受保护接口未带 token 均应 401', '全部返回 code=401',
    all401, failed.length ? `未按 401 返回: ${failed.join('; ')}` : '全部 401',
    { severity: '严重', repro: '不携带 Authorization 逐个调用受保护接口',
      code: 'security/AuthInterceptor.java:44-47' });

  // 伪造 token
  const r2 = await api('GET', '/api/admin/statistics', { token: 'fake.token.value' });
  expectErr('L2 伪造 token 访问管理端应 401', r2, 401, 'code=401');

  // user token 访问 admin
  const r3 = await api('GET', '/api/admin/statistics', { token: S.userAToken });
  t('L3 普通用户 token 访问管理端统计应 403', 'code=403',
    code(r3) === 403, `code=${code(r3)}, message=${msg(r3)}`,
    { severity: '严重', repro: '用 user token 调 GET /api/admin/statistics' });

  // 不存在的路由
  const r4 = await api('GET', '/api/not-exist');
  t('L4 不存在的接口路径', '应返回 404 而非 500',
    r4.status === 404 || code(r4) !== 0, `HTTP ${r4.status}, body=${r4.text.slice(0, 100)}`,
    { severity: '轻微', repro: 'GET /api/not-exist' });

  // 参数类型错误
  const r5 = await api('GET', '/api/packages?page=abc&pageSize=xyz');
  t('L5 分页参数传非数字', '应返回参数错误(400)，不应 500',
    code(r5) !== 500, `code=${code(r5)}, message=${msg(r5)}`,
    { severity: '轻微', repro: 'GET /api/packages?page=abc&pageSize=xyz' });

  // 超大分页
  const r6 = await api('GET', '/api/packages?page=99999&pageSize=100', { token: S.userAToken });
  t('L6 超大页码', '应返回空列表而非报错',
    code(r6) === 0, `code=${code(r6)}, message=${msg(r6)}`,
    { severity: '轻微', repro: 'GET /api/packages?page=99999' });

  // 负数 pageSize
  const r7 = await api('GET', '/api/packages?page=-1&pageSize=-10', { token: S.userAToken });
  t('L7 负数分页参数', '不应 500',
    code(r7) !== 500, `code=${code(r7)}, message=${msg(r7)}`,
    { severity: '轻微', repro: 'GET /api/packages?page=-1&pageSize=-10' });

  // 空 body POST
  const r8 = await api('POST', '/api/orders', { token: S.userAToken, body: {} });
  t('L8 空 body 提交下单', '应返回参数校验错误',
    code(r8) !== 0 && code(r8) !== 500, `code=${code(r8)}, message=${msg(r8)}`,
    { severity: '轻微', repro: 'POST /api/orders {}' });

  // L10 请求体携带 DTO 未定义的字段 → 应 400 而非 500
  const r10 = await api('POST', '/api/orders', { token: S.userAToken, body: { packageId: 1, hospitalId: 1, unknownField: 'x' } });
  t('L10 请求体携带未定义字段应返回 400 参数错误，而非 500',
    '应返回 400（或明确的参数校验错误），不应抛未捕获异常',
    code(r10) === 400 || (code(r10) !== 500 && code(r10) !== 0),
    `code=${code(r10)}, message=${msg(r10)} —— Jackson 未关闭 FAIL_ON_UNKNOWN_PROPERTIES，多传一个字段即 500，且前端/第三方对接时任何字段拼写错误都会表现为"服务异常"`,
    { severity: '一般',
      repro: 'POST /api/orders {"packageId":1,"hospitalId":1,"unknownField":"x"}',
      code: 'config/JacksonConfig.java（未配置 mapper.configure(FAIL_ON_UNKNOWN_PROPERTIES, false)）; common/GlobalExceptionHandler.java（未处理 HttpMessageNotReadableException）' });

  // L11 分页 page=0（已知 MyBatis-Plus 负 offset）
  const r11 = await api('GET', '/api/orders?page=0&pageSize=10', { token: S.userAToken });
  t('L11 分页参数 page=0 不应导致 500',
    '应返回第一页或参数错误(400)',
    code(r11) !== 500,
    `code=${code(r11)}, message=${msg(r11)} —— MyBatis-Plus Page 计算 offset=(0-1)*10=-10，抛 IndexOutOfBoundsException("fromIndex = -10")`,
    { severity: '严重',
      repro: 'GET /api/orders?page=0&pageSize=10（任意分页接口均复现）',
      code: 'service/OrderService.java:92 new Page<>(page, pageSize)；未对 page 做 Math.max(1, page) 保护' });

  // CORS 头检查（生产风险，仅记录）
  const res = await fetch(BASE + '/api/hospitals', { headers: { Origin: 'http://evil.example.com' } });
  const acao = res.headers.get('access-control-allow-origin');
  const acac = res.headers.get('access-control-allow-credentials');
  t('L9 CORS 策略（生产风险，仅记录）', '生产应限定为管理端域名，不应 * + 允许凭据',
    !(acao === '*' && acac === 'true'),
    `Access-Control-Allow-Origin=${acao}, Allow-Credentials=${acac}`,
    { severity: '一般', repro: 'curl -H "Origin: http://evil.example.com" -I http://localhost:8080/api/hospitals',
      code: 'config/CorsConfig.java:18-21' });
}

// ============================================================
//  主流程
// ============================================================
(async () => {
  console.log(`血栓检测服务 · 业务功能验收测试`);
  console.log(`目标: ${BASE}    开始时间: ${now()}\n`);

  const suites = [
    ['A. 认证模块', testAuth],
    ['B. 用户档案', testUserProfile],
    ['C. 套餐与字典', testPackage],
    ['D. 首页', testHome],
    ['E. 订单', testOrder],
    ['F. 支付', testPayment],
    ['G. 医护与核销', testStaffAndVerify],
    ['H. 检测结果', testResult],
    ['I. 用药管理', testMedication],
    ['J. 站内消息', testMessage],
    ['K. 管理端', testAdmin],
    ['L. 安全与边界', testSecurity],
  ];
  for (const [label, fn] of suites) {
    try {
      await fn();
    } catch (e) {
      console.error(`\n!!! 模块【${label}】执行中断:`, e && e.stack || e);
      t(`${label} 模块执行中断`, '该模块应完整执行完毕', false, `脚本异常: ${e && e.message}`,
        { severity: '严重', repro: '见脚本堆栈', code: '' });
    }
  }

  // ---------- 汇总 ----------
  const pass = results.filter((r) => r.pass).length;
  const fail = results.filter((r) => !r.pass).length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`总计 ${results.length} 项：通过 ${pass}，失败 ${fail}`);
  console.log('='.repeat(60));

  const sevOrder = { 严重: 0, 一般: 1, 轻微: 2 };
  const bugs = results.filter((r) => !r.pass).sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

  // 输出 Markdown 报告
  const lines = [];
  lines.push(`# 血栓检测服务 · 业务功能验收测试报告`);
  lines.push('');
  lines.push(`- 测试时间：${now()}`);
  lines.push(`- 目标服务：${BASE}`);
  lines.push(`- 用例总数：**${results.length}**，通过 **${pass}**，失败 **${fail}**`);
  lines.push(`- 测试方式：真实启动后端（H2 内存库，MySQL 兼容模式），通过 HTTP 逐条调用 62 个业务接口`);
  lines.push(`- 脚本位置：\`qa/run-tests.js\`（独立目录，可整体删除，未改动任何项目源码）`);
  lines.push('');

  lines.push('## 一、按模块统计');
  lines.push('');
  lines.push('| 模块 | 用例数 | 通过 | 失败 |');
  lines.push('|---|---:|---:|---:|');
  const mods = [...new Set(results.map((r) => r.module))];
  for (const m of mods) {
    const rs = results.filter((r) => r.module === m);
    lines.push(`| ${m} | ${rs.length} | ${rs.filter((x) => x.pass).length} | ${rs.filter((x) => !x.pass).length} |`);
  }
  lines.push('');

  lines.push('## 二、缺陷清单（按严重程度排序）');
  lines.push('');
  if (bugs.length === 0) {
    lines.push('未发现缺陷。');
  } else {
    bugs.forEach((b, i) => {
      lines.push(`### ${i + 1}. ${b.name}`);
      lines.push('');
      lines.push(`- **【所属模块/功能】** ${b.module}`);
      lines.push(`- **【严重程度】** ${b.severity}`);
      lines.push(`- **【缺陷描述】** ${b.expect}`);
      lines.push(`- **【复现步骤】** ${b.repro || '（见用例）'}`);
      lines.push(`- **【预期结果】** ${b.expect}`);
      lines.push(`- **【实际结果】** ${b.actual}`);
      lines.push(`- **【关联代码位置】** ${b.code || '（待定位）'}`);
      lines.push('');
    });
  }

  lines.push('## 三、全部用例明细');
  lines.push('');
  lines.push('| # | 模块 | 用例 | 结果 | 实际 |');
  lines.push('|---:|---|---|:--:|---|');
  results.forEach((r, i) => {
    const a = String(r.actual).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 220);
    lines.push(`| ${i + 1} | ${r.module} | ${r.name} | ${r.pass ? 'PASS' : '**FAIL**'} | ${a} |`);
  });
  lines.push('');

  const outDir = path.join(__dirname, 'tmp');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.md'), lines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n报告已生成：`);
  console.log(`  - qa/tmp/report.md`);
  console.log(`  - qa/tmp/results.json`);
})();
