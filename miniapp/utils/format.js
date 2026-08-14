/**
 * 格式化工具：金额 / 时间 / 手机号脱敏
 */
function price(v) {
  const n = Number(v || 0);
  return n.toFixed(2);
}

function maskPhone(phone) {
  if (!phone) return '';
  const s = String(phone);
  if (s.length < 7) return s;
  return s.substring(0, 3) + '****' + s.substring(s.length - 4);
}

/**
 * 时间格式化
 * @param {string|Date} t 后端返回 "2026-08-11 10:00:00" 或 Date
 * @param {string} fmt yyyy-MM-dd HH:mm:ss / MM-dd / HH:mm 等
 */
function formatTime(t, fmt = 'yyyy-MM-dd HH:mm') {
  if (!t) return '';
  const d = (t instanceof Date) ? t : new Date(String(t).replace(/-/g, '/'));
  if (isNaN(d.getTime())) return String(t);
  const map = {
    yyyy: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    dd: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0')
  };
  return fmt.replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => map[k]);
}

/** 今日日期 yyyy-MM-dd */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = { price, maskPhone, formatTime, today };
