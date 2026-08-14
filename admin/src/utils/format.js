/** 金额/时间/脱敏格式化 */
export function price(v) {
  const n = Number(v || 0);
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTime(t, fmt = 'YYYY-MM-DD HH:mm') {
  if (!t) return '';
  const d = new Date(String(t).replace(/-/g, '/'));
  if (isNaN(d.getTime())) return String(t);
  const map = {
    YYYY: d.getFullYear(),
    MM: String(d.getMonth() + 1).padStart(2, '0'),
    DD: String(d.getDate()).padStart(2, '0'),
    HH: String(d.getHours()).padStart(2, '0'),
    mm: String(d.getMinutes()).padStart(2, '0'),
    ss: String(d.getSeconds()).padStart(2, '0')
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (k) => map[k]);
}

export function maskPhone(phone) {
  if (!phone) return '';
  const s = String(phone);
  if (s.length < 7) return s;
  return s.substring(0, 3) + '****' + s.substring(s.length - 4);
}
