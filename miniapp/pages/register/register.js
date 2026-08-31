const authApi = require('../../services/auth');
const auth = require('../../utils/auth');

Page({
  data: {
    ticket: '',
    phone: '',
    code: '',
    nickname: '',
    avatar: '',
    agreed: true,
    loading: false
  },

  onLoad(options) {
    this.setData({ ticket: options.ticket || '' });
  },

  onChooseAvatar(e) {
    this.setData({ avatar: e.detail.avatarUrl });
  },
  onNickname(e) { this.setData({ nickname: e.detail.value }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onCode(e) { this.setData({ code: e.detail.value }); },
  toggleAgree() { this.setData({ agreed: !this.data.agreed }); },

  async onSendCode() {
    const phone = this.data.phone;
    if (!/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }
    try {
      await authApi.sendCode(phone);
      wx.showToast({ title: '验证码已发送（开发环境固定 123456）', icon: 'none', duration: 2500 });
      const cd = this.selectComponent('#cd');
      if (cd) cd.begin(); // 发送成功才启动倒计时
    } catch (e) { /* toast 已由 request 处理 */ }
  },

  async onSubmit() {
    const { phone, code, ticket, agreed } = this.data;
    if (!ticket) { wx.showToast({ title: '请先微信授权登录', icon: 'none' }); return; }
    if (!/^1\d{10}$/.test(phone)) { wx.showToast({ title: '请输入正确的手机号', icon: 'none' }); return; }
    if (!code) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return; }
    if (!agreed) { wx.showToast({ title: '请先勾选同意协议', icon: 'none' }); return; }

    this.setData({ loading: true });
    try {
      // 注册成功接口返回用户信息（开发环境后端未返回 token，此处重新登录）
      const user = await authApi.register({
        registerTicket: ticket,
        phone,
        code,
        nickname: this.data.nickname,
        avatar: this.data.avatar
      });
      // 重新走微信登录换取 token
      const loginData = await new Promise((resolve, reject) => {
        wx.login({
          success: (res) => authApi.wechatLogin(res.code || 'dev_code').then(resolve).catch(reject),
          fail: reject
        });
      });
      if (loginData.isRegistered) {
        auth.setLogin(loginData.token, loginData.user.role, loginData.user);
        // 页面即将销毁，无需 setData 恢复 loading，直接跳转
        wx.switchTab({ url: '/pages/index/index' });
      } else {
        this.setData({ loading: false });
        wx.showToast({ title: '注册成功，请重新登录', icon: 'none' });
        wx.navigateBack();
      }
    } catch (err) {
      this.setData({ loading: false });
    }
  }
});
