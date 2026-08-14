import { useAuthStore } from '../stores/auth';

/**
 * v-permission 指令：元素按角色显示
 * 用法：v-permission="['admin']"
 */
export default {
  mounted(el, binding) {
    const auth = useAuthStore();
    const roles = binding.value || [];
    if (roles.length && !roles.includes(auth.role)) {
      el.parentNode && el.parentNode.removeChild(el);
    }
  }
};
