import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', name: 'login', component: () => import('../views/login/index.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('../views/Layout.vue'),
    children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', name: 'dashboard', component: () => import('../views/dashboard/index.vue'), meta: { title: '工作台', roles: ['admin', 'hospital_admin'] } },
      { path: 'packages', name: 'packages', component: () => import('../views/packages/index.vue'), meta: { title: '套餐管理', roles: ['admin'] } },
      { path: 'packages/edit/:id?', name: 'package-edit', component: () => import('../views/packages/Edit.vue'), meta: { title: '套餐编辑', roles: ['admin'] } },
      { path: 'verify', name: 'verify', component: () => import('../views/verify/index.vue'), meta: { title: '核销管理', roles: ['admin', 'hospital_admin'] } },
      { path: 'sales', name: 'sales', component: () => import('../views/sales/index.vue'), meta: { title: '售卖管理', roles: ['admin', 'hospital_admin'] } },
      { path: 'bills', name: 'bills', component: () => import('../views/bills/index.vue'), meta: { title: '支付账单', roles: ['admin'] } },
      { path: 'hospitals', name: 'hospitals', component: () => import('../views/hospitals/index.vue'), meta: { title: '医院管理', roles: ['admin'] } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/dashboard' }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    return true;
  }
  if (!auth.token) {
    return '/login';
  }
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) {
    return '/dashboard';
  }
  return true;
});

export default router;
