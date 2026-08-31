/**
 * 补充验证脚本（本次复测专用，可随 qa/ 目录整体删除）
 *
 * A) K36 真实实测：禁用(status=0)的医院管理员账号能否调 /api/admin/login
 *    （run-tests.js 中 K36 是硬编码 pass 的占位用例，此处补真实调用）
 *
 * 用法：node qa/tmp/extra-verify.js [baseUrl]   // 默认 http://localhost:8080
 */
const BASE = process.argv[2] || 'http://localhost:8080';

async function api(method, p, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  } catch (e) { return { status: 0, json: null, text: '', err: String(e) }; }
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text: text.slice(0, 300) };
}
const code = (r) => (r.json && typeof r.json.code === 'number' ? r.json.code : null);

(async () => {
  console.log(`== 目标实例: ${BASE} ==`);

  // A. K36 真实实测
  let r = await api('POST', '/api/admin/login', { body: { account: 'admin', password: 'admin123' } });
  if (code(r) !== 0) { console.log('[A-准备] 平台管理员登录失败，无法继续:', r.text); return; }
  const adminToken = r.json.data.token;

  r = await api('GET', '/api/admin/hospital-admins?page=1&pageSize=20', { token: adminToken });
  const acc = (r.json && r.json.data && (r.json.data.list || r.json.data.records) || []).find((x) => x.phone === 'hospital_admin');
  if (!acc) { console.log('[A-准备] 未找到 hospital_admin 账号:', r.text); return; }

  r = await api('PUT', `/api/admin/hospital-admins/${acc.id}`, {
    token: adminToken,
    body: { phone: 'hospital_admin', nickname: '协和医院管理员', hospitalId: 1, status: 0 },
  });
  console.log(`[A-步骤1] 置 hospital_admin(status=${acc.status}) → status=0 : code=${code(r)}`);

  r = await api('POST', '/api/admin/login', { body: { account: 'hospital_admin', password: 'admin123' } });
  const loginOk = code(r) === 0;
  console.log(`[A-结果] 禁用后的医院管理员调 /api/admin/login : code=${code(r)} → ${loginOk ? '!! 登录成功(缺陷实锤, 与医护侧 K17 同款)' : '被拒绝: ' + (r.json && r.json.message)}`);

  r = await api('PUT', `/api/admin/hospital-admins/${acc.id}`, {
    token: adminToken,
    body: { phone: 'hospital_admin', nickname: '协和医院管理员', hospitalId: 1, status: 1 },
  });
  console.log(`[A-恢复] status 回置 1 : code=${code(r)}`);
})();
