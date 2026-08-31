/**
 * 补充验证脚本 2（本次复测专用，可随 qa/ 目录整体删除）
 *
 * B) 管理端「编辑医护(空密码)」真实实测：
 *    admin 前端编辑弹窗固定携带 password:''，后端 @Size(min=6) 对空串必校验失败。
 *    分别验证：password:'' / 不传 password 两种编辑请求的真实表现。
 */
const BASE = 'http://localhost:8080';

async function api(method, p, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(BASE + p, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch (_) {}
  return { status: res.status, json, text: text.slice(0, 200) };
}
const code = (r) => (r.json && typeof r.json.code === 'number' ? r.json.code : null);

(async () => {
  let r = await api('POST', '/api/admin/login', { body: { account: 'admin', password: 'admin123' } });
  const token = r.json.data.token;
  const phone = '137' + String(Date.now()).slice(-8);

  r = await api('POST', '/api/admin/staffs', { token, body: { phone, password: '123456', nickname: 'QA编辑验证', hospitalId: 1, status: 1 } });
  if (code(r) !== 0) { console.log('[B-准备] 新增医护失败:', r.text); return; }
  const id = r.json.data.id;
  console.log(`[B-步骤1] 新增医护 id=${id} 成功`);

  r = await api('PUT', `/api/admin/staffs/${id}`, { token, body: { phone, nickname: '改名-带空密码', hospitalId: 1, status: 1, password: '' } });
  console.log(`[B-结果1] 编辑(带 password:'') —— 模拟 admin 前端固定行为 : code=${code(r)}, message=${r.json && r.json.message}`);

  r = await api('PUT', `/api/admin/staffs/${id}`, { token, body: { phone, nickname: '改名-不带密码字段', hospitalId: 1, status: 1 } });
  console.log(`[B-结果2] 编辑(完全不传 password 字段) : code=${code(r)}, message=${r.json && r.json.message}`);

  r = await api('DELETE', `/api/admin/staffs/${id}`, { token });
  console.log(`[B-清理] 删除测试医护 : code=${code(r)}`);
})();
