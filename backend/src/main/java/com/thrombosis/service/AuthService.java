package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.UserVO;
import com.thrombosis.dto.WechatLoginResult;
import com.thrombosis.entity.User;
import com.thrombosis.mapper.UserMapper;
import com.thrombosis.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 认证服务（微信登录 / 验证码 / 注册）
 * dev 模式：任意 code 映射测试 openid；验证码固定（thrombosis.dev.mock.verify-code）
 * 生产模式：调用微信 code2session 换 openid（见 TODO）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;

    @Value("${thrombosis.dev.mock.openid-prefix:mock_openid_}")
    private String openidPrefix;
    @Value("${thrombosis.dev.mock.verify-code:123456}")
    private String mockVerifyCode;

    /** 手机号 -> 验证码 */
    private final Map<String, String> codeStore = new ConcurrentHashMap<>();
    /** registerTicket -> openid */
    private final Map<String, String> ticketStore = new ConcurrentHashMap<>();

    public WechatLoginResult wechatLogin(String code) {
        // TODO(prod): 调用微信 jscode2session 接口换取 openid。
        // dev 下 openid 必须稳定（模拟真实微信：同一用户 openid 与 code 无关、永远不变），
        // 否则注册后再 wx.login 拿新 code 会生成新 openid，导致"注册后识别不到已注册"。
        String openid = openidPrefix + "stable";
        User user = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getOpenid, openid));
        if (user != null && Integer.valueOf(1).equals(user.getStatus())) {
            return registeredResult(user);
        }
        // 未注册：签发 registerTicket 关联 openid
        String ticket = "RT_" + UUID.randomUUID().toString().replace("-", "");
        ticketStore.put(ticket, openid);
        WechatLoginResult r = new WechatLoginResult();
        r.setIsRegistered(false);
        r.setRegisterTicket(ticket);
        return r;
    }

    public void sendCode(String phone) {
        // TODO(prod): 调用短信服务商；dev 下固定验证码
        codeStore.put(phone, mockVerifyCode);
        log.info("[mock] 短信验证码 phone={} code={}", phone, mockVerifyCode);
    }

    public UserVO register(String ticket, String phone, String code, String nickname, String avatar) {
        String openid = ticketStore.get(ticket);
        if (openid == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录已过期，请重新授权");
        }
        String expect = codeStore.get(phone);
        if (expect == null || !expect.equals(code)) {
            throw new BusinessException(ErrorCode.SMS_CODE_ERROR, "验证码错误，请重新输入");
        }
        Long cnt = userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (cnt != null && cnt > 0) {
            throw new BusinessException(ErrorCode.PHONE_REGISTERED, "该手机号已注册，请直接登录");
        }
        User u = new User();
        u.setOpenid(openid);
        u.setPhone(phone);
        u.setNickname(nickname == null || nickname.isBlank() ? "微信用户" : nickname);
        u.setAvatar(avatar);
        u.setRole("user");
        u.setStatus(1);
        userMapper.insert(u);
        codeStore.remove(phone);
        ticketStore.remove(ticket);
        return toVO(u);
    }

    private WechatLoginResult registeredResult(User user) {
        WechatLoginResult r = new WechatLoginResult();
        r.setIsRegistered(true);
        r.setToken(jwtUtil.generate(user.getId(), user.getRole(), user.getHospitalId()));
        r.setUser(toVO(user));
        return r;
    }

    public UserVO toVO(User u) {
        if (u == null) return null;
        UserVO vo = new UserVO();
        vo.setId(u.getId());
        vo.setPhone(maskPhone(u.getPhone()));
        vo.setNickname(u.getNickname());
        vo.setAvatar(u.getAvatar());
        vo.setGender(u.getGender());
        vo.setAge(u.getAge());
        vo.setHeight(u.getHeight());
        vo.setWeight(u.getWeight());
        vo.setRole(u.getRole());
        vo.setHospitalId(u.getHospitalId());
        return vo;
    }

    /** 手机号脱敏 138****0001 */
    public static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) return phone;
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }
}
