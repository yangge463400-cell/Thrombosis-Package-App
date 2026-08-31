/**
 * 核心业务流程端到端测试（E2E）· 独立脚本，可随 qa/ 目录整体删除
 *
 * 覆盖：
 *   A. 用户主链路：登录注册→首页→套餐→下单→支付→核销码→医护核销→出具结果→消息通知
 *   B. 跨步骤数据流转一致性（各环节产出值逐环核对）
 *   C. 边界与异常路径（非法状态流转/越权/无效输入）
 *   D. 并发与一致性（同单并发支付、并发核销、销量一致性、并发打卡）
 *
 * 运行前置：后端已启动且 thrombosis_qa 为全新种子库
 */
const B = 'http://localhost:8080';
let pass = 0, fail = 0;
const fails = [];
function t(name, cond, detail) {
  if (cond) { pass++; console.log(`  [PASS] ${name}`); }
  else { fail++; fails.push({ name, detail }); console.log(`  [FAIL] ${name}\n         ${detail}`); }
}
async function api(m, p, tk, body) {
  const h = { 'Content-Type': 'application/json' };
  if (tk) h.Authorization = 'Bearer ' + tk;
  const r = await fetch(B + p, { method: m, headers: h, body: body ? JSON.stringify(body) : undefined });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch (e) { j = { raw: txt.slice(0, 120), ct: r.headers.get('content-type') }; }
  return j;
}
const code = (r) => (r && typeof r.code === 'number' ? r.code : null);
async function makeUser(tag) {
  // user_ 前缀 code → 独立 openid（dev mock 约定），否则所有普通 code 共用稳定身份
  let r = await api('POST', '/api/auth/wechat-login', null, { code: 'user_e2e_' + tag });
  if (r.data.isRegistered) {
    // 已存在则直接用
    return { token: r.data.token, userId: r.data.user.id };
  }
  const ticket = r.data.registerTicket;
  const phone = '138' + String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 90) + 10);
  await api('POST', '/api/auth/send-code', null, { phone });
  r = await api('POST', '/api/auth/register', null, { registerTicket: ticket, phone, code: '123456', nickname: 'E2E-' + tag });
  const uid = r.data.id;
  r = await api('POST', '/api/auth/wechat-login', null, { code: 'user_e2e_' + tag });
  return { token: r.data.token, userId: r.data.user.id, uid, phone };
}
async function createPaidOrder(tk, packageId, hospitalId) {
  let r = await api('POST', '/api/orders', tk, { packageId, hospitalId });
  const orderId = r.data.orderId;
  r = await api('POST', '/api/payment/mock-callback', tk, { orderId });
  return { orderId, verifyCode: r.data.verifyCode };
}

(async () => {
  console.log('\n===== A. 用户主链路 =====');
  // A1 注册与身份连续性
  let r = await api('POST', '/api/auth/wechat-login', null, { code: 'e2e-main' });
  const ticket = r.data.registerTicket;
  t('A1 首次登录返回未注册+ticket', r.code === 0 && r.data.isRegistered === false && !!ticket, JSON.stringify(r).slice(0, 120));
  const phoneA = '138' + String(Date.now()).slice(-8);
  await api('POST', '/api/auth/send-code', null, { phone: phoneA });
  r = await api('POST', '/api/auth/register', null, { registerTicket: ticket, phone: phoneA, code: '123456', nickname: 'E2E主链路' });
  t('A1 注册成功返回用户', r.code === 0 && !!r.data.id, JSON.stringify(r).slice(0, 120));
  r = await api('POST', '/api/auth/wechat-login', null, { code: 'e2e-main' });
  const UA = { token: r.data.token, userId: r.data.user.id };
  t('A1 重登识别已注册且 userId 一致', r.data.isRegistered === true && r.data.user.id === UA.userId, `uid=${UA.userId}`);

  // A2 首页聚合（实际键：banners/recommendPackages/unreadCount/ongoingOrder）
  r = await api('GET', '/api/home', UA.token);
  t('A2 首页聚合(banners/推荐套餐/未读数/进行中订单)', r.code === 0 && Array.isArray(r.data.banners) && Array.isArray(r.data.recommendPackages) && r.data.unreadCount !== undefined && 'ongoingOrder' in r.data, Object.keys(r.data || {}).join(','));

  // A3 套餐列表与详情
  r = await api('GET', '/api/packages?city=' + encodeURIComponent('北京') + '&pageSize=20');
  const pkg1inList = (r.data.list || []).some(p => p.id === 1);
  t('A3 城市筛选含套餐1', r.code === 0 && pkg1inList, `total=${r.data.total}`);
  r = await api('GET', '/api/packages/1');
  const pkg1 = r.data;
  t('A3 套餐详情(items/cities/价格)', r.code === 0 && Array.isArray(pkg1.items) && pkg1.price === 580 && (pkg1.cities || []).includes('北京'), JSON.stringify({ price: pkg1.price, cities: pkg1.cities }));

  // A4 医院列表
  r = await api('GET', '/api/hospitals');
  const h1 = (r.data || []).find(h => h.id === 1);
  t('A4 医院列表含北京协和(cooperating)', !!h1 && h1.status === 'cooperating', JSON.stringify(h1 || {}).slice(0, 100));

  // A5 下单
  r = await api('POST', '/api/orders', UA.token, { packageId: 1, hospitalId: 1 });
  const orderId = r.data.orderId, orderNo = r.data.orderNo, payAmount = r.data.payAmount;
  t('A5 下单返回 orderId/orderNo/payAmount=套餐价', r.code === 0 && !!orderId && /^TH\d+$/.test(orderNo) && Number(payAmount) === 580, JSON.stringify(r.data));
  r = await api('GET', '/api/orders/' + orderId, UA.token);
  t('A5 订单详情: pending_pay+医院名', r.data.status === 'pending_pay' && r.data.hospitalName === '北京协和医院', JSON.stringify({ s: r.data.status, h: r.data.hospitalName }));
  r = await api('GET', '/api/orders?page=1&pageSize=5', UA.token);
  t('A5 订单列表可见该单', (r.data.list || []).some(o => o.id === orderId), `total=${r.data.total}`);

  // A6 支付
  const beforeSales = (await api('GET', '/api/packages/1')).data.salesCount;
  const beforeUnread = (await api('GET', '/api/messages/unread-count', UA.token)).data.count ?? (await api('GET', '/api/messages/unread-count', UA.token)).data;
  r = await api('POST', '/api/payment/mock-callback', UA.token, { orderId });
  const verifyCode = r.data.verifyCode;
  t('A6 支付成功: status=paid+6位核销码', r.code === 0 && r.data.status === 'paid' && /^\d{6}$/.test(verifyCode), JSON.stringify(r.data));
  r = await api('GET', '/api/orders/' + orderId, UA.token);
  t('A6 订单回写: paid+payTime+核销码一致', r.data.status === 'paid' && !!r.data.payTime && r.data.verifyCode === verifyCode, JSON.stringify({ s: r.data.status, vc: r.data.verifyCode }));
  const afterSales = (await api('GET', '/api/packages/1')).data.salesCount;
  t('A6 销量+1', afterSales === beforeSales + 1, `${beforeSales}→${afterSales}`);
  r = await api('GET', '/api/messages?type=order&page=1&pageSize=5', UA.token);
  const payMsg = (r.data.list || []).find(m => m.title === '支付成功' && String(m.targetId) === String(orderId));
  t('A6 支付站内消息(含核销码)', !!payMsg && payMsg.content.includes(verifyCode), JSON.stringify(payMsg || {}).slice(0, 150));

  // A7 核销码二维码（本人）
  const qr = await fetch(B + `/api/orders/${orderId}/qrcode`, { headers: { Authorization: 'Bearer ' + UA.token } });
  t('A7 本人获取二维码 PNG', qr.status === 200 && (qr.headers.get('content-type') || '').includes('image/png'), qr.headers.get('content-type'));

  // A8 医护登录与统计
  r = await api('POST', '/api/staff/login', null, { phone: '13800000000', password: '123456' });
  const TS = r.data.token;
  t('A8 医护登录(hospitalId=1)', r.code === 0 && r.data.hospitalId === 1, JSON.stringify(r.data).slice(0, 100));
  const stBefore = (await api('GET', '/api/staff/statistics', TS)).data;

  // A9 核销码校验（check）
  r = await api('POST', '/api/verify/check', TS, { code: verifyCode });
  t('A9 check: 订单号一致+手机号脱敏+status=paid', r.code === 0 && r.data.orderNo === orderNo && /\*\*\*\*/.test(r.data.userPhone) && r.data.status === 'paid', JSON.stringify(r.data).slice(0, 150));

  // A10 确认核销
  r = await api('POST', '/api/verify/confirm', TS, { code: verifyCode });
  t('A10 confirm: already=false', r.code === 0 && r.data.already === false, JSON.stringify(r.data));
  r = await api('GET', '/api/orders/' + orderId, UA.token);
  t('A10 订单转 verified(检测中)+verifyTime', r.data.status === 'verified' && !!r.data.verifyTime, JSON.stringify({ s: r.data.status, vt: r.data.verifyTime }));
  r = await api('GET', '/api/verify/records?page=1&pageSize=50', TS);
  t('A10 核销记录含该单(本院)', (r.data.list || []).some(x => x.orderId === orderId), `total=${r.data.total}`);
  const stAfter = (await api('GET', '/api/staff/statistics', TS)).data;
  t('A10 今日核销数+1', stAfter.todayVerified === stBefore.todayVerified + 1, `${stBefore.todayVerified}→${stAfter.todayVerified}`);
  r = await api('GET', '/api/messages?type=order&page=1&pageSize=5', UA.token);
  t('A10 核销站内消息', (r.data.list || []).some(m => m.title === '核销成功' && String(m.targetId) === String(orderId)), '');

  // A11 医护出具结果 → 用户可见
  const reportItems = [
    { name: 'D-二聚体', value: '0.42', unit: 'mg/L', range: '0-0.5', abnormal: false },
    { name: '血常规', value: '正常', unit: '', range: '', abnormal: false }
  ];
  r = await api('POST', '/api/results/upload', TS, { code: verifyCode, reportItems, reportUrl: '/files/e2e.pdf' });
  t('A11 出具结果(verified单): code=0', r.code === 0, JSON.stringify(r));
  r = await api('GET', '/api/orders/' + orderId, UA.token);
  t('A11 订单转 completed', r.data.status === 'completed', r.data.status);
  r = await api('GET', '/api/results?page=1&pageSize=10', UA.token);
  const myResult = (r.data.list || []).find(x => x.orderId === orderId);
  t('A11 用户结果列表含该单(published)', !!myResult && myResult.status === 'published', JSON.stringify(r.data.list || []).slice(0, 150));
  if (myResult) {
    r = await api('GET', '/api/results/' + myResult.id, UA.token);
    const ri = r.data.reportItems || [];
    t('A11 结果明细透传医护填写内容+医院名', r.code === 0 && ri.some(x => x.name === 'D-二聚体' && x.value === '0.42') && r.data.hospitalName === '北京协和医院', JSON.stringify(r.data).slice(0, 200));
  }
  r = await api('GET', '/api/messages?type=result&page=1&pageSize=5', UA.token);
  t('A11 结果站内消息', (r.data.list || []).some(m => m.title === '检测结果已出具'), JSON.stringify((r.data.list || [])[0] || {}).slice(0, 120));

  // A12 消息已读流
  const u1 = (await api('GET', '/api/messages/unread-count', UA.token)).data;
  const cnt = typeof u1 === 'object' ? (u1.count ?? u1.unread) : u1;
  const firstUnread = (await api('GET', '/api/messages?type=all&page=1&pageSize=10', UA.token)).data.list.find(m => !m.isRead);
  const rd = await api('PUT', `/api/messages/${firstUnread.id}/read`, UA.token);
  const u2 = (await api('GET', '/api/messages/unread-count', UA.token)).data;
  const cnt2 = typeof u2 === 'object' ? (u2.count ?? u2.unread) : u2;
  t('A12 已读后未读数-1', rd.code === 0 && cnt2 === cnt - 1, `read.code=${rd.code}, ${cnt}→${cnt2}`);

  console.log('\n===== B. 医护 orderId 路径 + 幂等 =====');
  const o2 = await createPaidOrder(UA.token, 4, 1);
  await api('POST', '/api/verify/confirm', TS, { code: o2.verifyCode });
  const resBefore = ((await api('GET', '/api/results?page=1&pageSize=50', UA.token)).data.list || []).length;
  r = await api('POST', '/api/results/upload', TS, { orderId: o2.orderId, reportItems: [{ name: '复检', value: 'ok' }] });
  t('B orderId 路径出具: code=0', r.code === 0, JSON.stringify(r));
  r = await api('POST', '/api/results/upload', TS, { orderId: o2.orderId, reportItems: [{ name: '复检v2', value: 'ok' }] });
  const resAfter = ((await api('GET', '/api/results?page=1&pageSize=50', UA.token)).data.list || []).length;
  t('B 重复出具幂等(不新增结果行)', r.code === 0 && resAfter === resBefore + 1, `结果数 ${resBefore}→${resAfter}`);

  console.log('\n===== C. 边界与异常路径 =====');
  // 越权支付
  const UB = await makeUser('ub');
  let rr = await api('POST', '/api/orders', UA.token, { packageId: 6, hospitalId: 1 });
  r = await api('POST', '/api/payment/mock-callback', UB.token, { orderId: rr.data.orderId });
  t('C1 支付他人订单被拒', code(r) === 404, `code=${code(r)}`);
  r = await api('POST', '/api/payment/mock-callback', UA.token, {});
  t('C2 缺 orderId 被拒', code(r) !== 0, `code=${code(r)}`);
  r = await api('POST', '/api/payment/mock-callback', UA.token, { orderId });
  t('C3 重复支付(已支付单)被拒 2001', code(r) === 2001, `code=${code(r)}`);
  // 取消链
  rr = await api('POST', '/api/orders', UA.token, { packageId: 3, hospitalId: 1 });
  const cId = rr.data.orderId;
  r = await api('POST', `/api/orders/${cId}/cancel`, UA.token);
  t('C4 待支付单可取消', code(r) === 0, `code=${code(r)}`);
  r = await api('POST', '/api/payment/mock-callback', UA.token, { orderId: cId });
  t('C5 已取消单不可支付 2001', code(r) === 2001, `code=${code(r)}`);
  r = await api('POST', `/api/orders/${orderId}/cancel`, UA.token);
  t('C6 已支付单不可取消 2001', code(r) === 2001, `code=${code(r)}`);
  r = await api('POST', `/api/orders/${cId}/cancel`, UB.token);
  t('C7 取消他人订单 404', code(r) === 404, `code=${code(r)}`);
  // 下单校验
  r = await api('POST', '/api/orders', UA.token, { packageId: 8, hospitalId: 1 });
  t('C8 下架套餐不可下单', code(r) !== 0, `code=${code(r)},msg=${r.message}`);
  r = await api('POST', '/api/orders', UA.token, { packageId: 1, hospitalId: 999 });
  t('C9 不存在医院不可下单', code(r) !== 0, `code=${code(r)}`);
  // 城市Cover: package5(北京,上海) + 医院3(上海)? 先找广州医院
  const hs = (await api('GET', '/api/hospitals')).data;
  const gz = (hs || []).find(h => h.city === '广州');
  if (gz) {
    r = await api('POST', '/api/orders', UA.token, { packageId: 5, hospitalId: gz.id });
    t('C10 套餐未覆盖城市被拒', code(r) !== 0 && /城市/.test(r.message || ''), `code=${code(r)},msg=${r.message}`);
  }
  // 核销边界
  r = await api('POST', '/api/verify/check', TS, { code: '000000' });
  t('C11 无效核销码 2002', code(r) === 2002, `code=${code(r)}`);
  const shOrder = await createPaidOrder(UA.token, 1, 3); // 上海医院
  r = await api('POST', '/api/verify/check', TS, { code: shOrder.verifyCode });
  t('C12 check 他院码 403', code(r) === 403, `code=${code(r)}`);
  r = await api('POST', '/api/verify/confirm', TS, { code: shOrder.verifyCode });
  t('C13 confirm 他院码 403', code(r) === 403, `code=${code(r)}`);
  const paidOrder = await createPaidOrder(UA.token, 3, 1);
  r = await api('POST', '/api/results/upload', TS, { code: paidOrder.verifyCode, reportItems: [] });
  t('C14 未核销订单不可出结果', code(r) !== 0 && /未核销/.test(r.message || ''), `code=${code(r)},msg=${r.message}`);
  r = await api('POST', '/api/results/upload', UA.token, { code: paidOrder.verifyCode, reportItems: [] });
  t('C15 用户 token 出结果 403', code(r) === 403, `code=${code(r)}`);
  r = await api('POST', '/api/verify/confirm', TS, { code: verifyCode });
  t('C16 已完成单重复 confirm 幂等', code(r) === 0 && r.data.already === true, JSON.stringify(r.data));
  // 注册边界（user_ 前缀 code 获得独立 openid，避免与 A1 的稳定身份冲突）
  r = await api('POST', '/api/auth/wechat-login', null, { code: 'user_e2e_edge' });
  const tk2 = r.data.registerTicket;
  await api('POST', '/api/auth/send-code', null, { phone: '13800000999' });
  r = await api('POST', '/api/auth/register', null, { registerTicket: tk2, phone: '13800000999', code: '000000', nickname: 'x' });
  t('C17 错误验证码 1001', code(r) === 1001, `code=${code(r)}`);
  r = await api('POST', '/api/auth/register', null, { registerTicket: 'RT_FAKE', phone: '13800000999', code: '123456', nickname: 'x' });
  t('C18 无效 ticket 401', code(r) === 401, `code=${code(r)}`);
  await api('POST', '/api/auth/send-code', null, { phone: phoneA });
  r = await api('POST', '/api/auth/register', null, { registerTicket: tk2, phone: phoneA, code: '123456', nickname: 'dup' });
  t('C19 重复手机号 1002', code(r) === 1002, `code=${code(r)}`);
  // 用药边界
  r = await api('POST', '/api/medications', UA.token, { drugName: 'x', timesPerDay: 1, timePoints: [{ id: 't', time: '08:00' }], startAt: '2026-12-01', endAt: '2026-01-01' });
  t('C20 endAt<startAt 被拒', code(r) !== 0, `code=${code(r)},msg=${r.message}`);
  r = await api('POST', '/api/medications', UA.token, { drugName: 'C21方案', timesPerDay: 1, timePoints: [{ id: 'tp1', time: '08:00' }] });
  const midUA = r.data.id;
  r = await api('POST', `/api/medications/${midUA}/records`, UB.token, { timePointId: 'tp1' });
  t('C21 他人用药方案打卡 404', code(r) === 404, `code=${code(r)}`);
  // 消息越权
  const msgA = (await api('GET', '/api/messages?type=all&page=1&pageSize=1', UA.token)).data.list[0];
  r = await api('PUT', `/api/messages/${msgA.id}/read`, UB.token);
  t('C22 他人消息已读 404', code(r) === 404, `code=${code(r)}`);
  // 未登录
  r = await api('GET', '/api/orders');
  t('C23 未登录访问 401', code(r) === 401, `code=${code(r)}`);

  console.log('\n===== D. 并发与一致性 =====');
  // D1 并发核销
  const d1 = await createPaidOrder(UA.token, 4, 1);
  const rb = ((await api('GET', '/api/verify/records?page=1&pageSize=100', TS)).data.list || []).filter(x => x.orderId === d1.orderId).length;
  const cs = await Promise.all(Array.from({ length: 6 }, () => api('POST', '/api/verify/confirm', TS, { code: d1.verifyCode })));
  const ra = ((await api('GET', '/api/verify/records?page=1&pageSize=100', TS)).data.list || []).filter(x => x.orderId === d1.orderId).length;
  t('D1 并发6次核销仅+1条记录', ra - rb <= 1, `记录 ${rb}→${ra}，成功${cs.filter(x => x.code === 0).length}次`);

  // D2 同一订单并发支付
  const d2 = await api('POST', '/api/orders', UA.token, { packageId: 6, hospitalId: 1 });
  const d2id = d2.data.orderId;
  const ps = await Promise.all(Array.from({ length: 8 }, () => api('POST', '/api/payment/mock-callback', UA.token, { orderId: d2id })));
  const payOk = ps.filter(x => x.code === 0).length;
  const bills = (await api('GET', '/api/admin/bills?channel=wx&page=1&pageSize=100', (await api('POST', '/api/admin/login', null, { account: 'admin', password: 'admin123' })).data.token)).data.list || [];
  const billRows = bills.filter(b => b.orderId === d2id).length;
  const msgs = (await api('GET', '/api/messages?type=order&page=1&pageSize=50', UA.token)).data.list.filter(m => m.title === '支付成功' && String(m.targetId) === String(d2id)).length;
  t('D2a 并发8次支付仅1次成功', payOk === 1, `成功${payOk}次`);
  t('D2b 该订单账单行数==1', billRows === 1, `billRows=${billRows}`);
  t('D2c 该订单支付消息==1', msgs === 1, `msgs=${msgs}`);

  // D3 销量一致性：并发支付同套餐不同订单
  const pkg4Before = (await api('GET', '/api/packages/4')).data.salesCount;
  const ids = [];
  for (let i = 0; i < 10; i++) {
    const o = await api('POST', '/api/orders', UA.token, { packageId: 4, hospitalId: 1 });
    ids.push(o.data.orderId);
  }
  const ps10 = await Promise.all(ids.map(id => api('POST', '/api/payment/mock-callback', UA.token, { orderId: id })));
  const ok10 = ps10.filter(x => x.code === 0).length;
  const pkg4After = (await api('GET', '/api/packages/4')).data.salesCount;
  t('D3 销量增量==支付成功数(无丢更新)', pkg4After - pkg4Before === ok10, `支付成功${ok10}次，销量 ${pkg4Before}→${pkg4After}(+${pkg4After - pkg4Before})`);

  // D4 并发打卡
  r = await api('POST', '/api/medications', UA.token, { drugName: '并发打卡', timesPerDay: 1, timePoints: [{ id: 'tpx', time: '08:00' }] });
  const mid = r.data.id;
  const cs4 = await Promise.all(Array.from({ length: 6 }, () => api('POST', `/api/medications/${mid}/records`, UA.token, { timePointId: 'tpx' })));
  const det = (await api('GET', '/api/medications/' + mid, UA.token)).data;
  const recCount = (det.recentRecords || []).length;
  const errN = cs4.filter(x => x.code !== 0).length;
  t('D4 并发6次打卡: 记录数==1', recCount === 1, `记录=${recCount}, 非零响应=${errN}次${errN ? '(撞唯一键未捕获?)' : ''}`);

  console.log(`\n===== E2E 总结: 通过 ${pass}/（${pass + fail}） 失败 ${fail} =====`);
  if (fails.length) { console.log('失败清单:'); fails.forEach((f, i) => console.log(` ${i + 1}. ${f.name} :: ${f.detail}`)); }
})();
