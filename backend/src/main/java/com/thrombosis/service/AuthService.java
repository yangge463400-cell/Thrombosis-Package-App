package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.UserVO;
import com.thrombosis.dto.WechatLoginResult;
import com.thrombosis.entity.User;
import com.thrombosis.mapper.UserMapper;
import com.thrombosis.security.JwtUtil;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 认证服务（微信登录 / 验证码 / 注册）
 *
 * 微信登录两种模式（自动切换）：
 *  - 配置了 thrombosis.wechat.appid + secret（环境变量 WX_APPID / WX_SECRET）→ 真实调用微信 code2session 换 openid
 *  - 未配置 → mock：任意 code 映射固定测试 openid（thrombosis.dev.mock.openid-prefix）
 *
 * 验证码：dev 下固定（thrombosis.dev.mock.verify-code），生产需接短信服务商（TODO）
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private static final String WX_CODE2SESSION_URL =
            "https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code";
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final UserMapper userMapper;
    private final JwtUtil jwtUtil;

    @Value("${thrombosis.wechat.appid:}")
    private String wxAppId;
    @Value("${thrombosis.wechat.secret:}")
    private String wxSecret;
    /** mock 登录开关：仅 dev 显式开启；生产环境漏配微信凭据时 fail-closed，绝不回退为共用账号 */
    @Value("${thrombosis.dev.mock.enabled:false}")
    private boolean devMockEnabled;
    @Value("${thrombosis.dev.mock.openid-prefix:mock_openid_}")
    private String openidPrefix;
    @Value("${thrombosis.dev.mock.verify-code:123456}")
    private String mockVerifyCode;

    /** 手机号 -> 验证码（5 分钟 TTL） */
    private record StoredCode(String code, long createdAt) {}
    private static final long CODE_TTL_MILLIS = 5 * 60 * 1000L;
    private final Map<String, StoredCode> codeStore = new ConcurrentHashMap<>();
    /** registerTicket -> openid */
    private final Map<String, String> ticketStore = new ConcurrentHashMap<>();

    /**
     * 启动即校验微信登录配置（fail-fast）：
     *  - appid/secret 只配置了一半 → 配置事故，直接拒绝启动（避免运行时静默降级为共用 mock 账号）；
     *  - 全未配置 → 允许启动（dev mock / 纯后台场景），并在启动日志中明确当前登录模式。
     */
    @PostConstruct
    void validateWechatConfig() {
        boolean hasAppId = wxAppId != null && !wxAppId.isBlank();
        boolean hasSecret = wxSecret != null && !wxSecret.isBlank();
        if (hasAppId ^ hasSecret) {
            throw new IllegalStateException("微信凭据只配置了一半（appid=" + (hasAppId ? "已配置" : "缺失")
                    + ", secret=" + (hasSecret ? "已配置" : "缺失")
                    + "）：请补全或同时清空 thrombosis.wechat.appid / thrombosis.wechat.secret，否则微信登录将不可用");
        }
        if (hasAppId) {
            log.info("[wechat] 微信登录模式：真实 code2session");
        } else if (devMockEnabled) {
            log.info("[wechat] 微信登录模式：dev mock（thrombosis.dev.mock.enabled=true，仅限开发环境）");
        } else {
            log.warn("[wechat] 微信登录模式：不可用（未配置凭据且 mock 未开启），微信登录将在运行时被拒绝");
        }
    }

    public WechatLoginResult wechatLogin(String code) {
        String openid = resolveOpenid(code);
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
        codeStore.put(phone, new StoredCode(mockVerifyCode, System.currentTimeMillis()));
        log.info("[mock] 短信验证码 phone={} code={}", phone, mockVerifyCode);
    }

    public UserVO register(String ticket, String phone, String code, String nickname, String avatar) {
        String openid = ticketStore.get(ticket);
        if (openid == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "登录已过期，请重新授权");
        }
        StoredCode sc = codeStore.get(phone);
        if (sc == null || !sc.code().equals(code) || System.currentTimeMillis() - sc.createdAt() > CODE_TTL_MILLIS) {
            throw new BusinessException(ErrorCode.SMS_CODE_ERROR, "验证码错误或已过期，请重新输入");
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

    // ------------------------------------------------------------
    // 微信 code2session：配置了 appid/secret 走真实接口，否则走 mock
    // ------------------------------------------------------------

    private String resolveOpenid(String code) {
        boolean hasAppId = wxAppId != null && !wxAppId.isBlank();
        boolean hasSecret = wxSecret != null && !wxSecret.isBlank();
        if (hasAppId && hasSecret) {
            log.info("[wechat] 已配置 appid/secret，微信登录走真实 code2session");
            return code2session(code);
        }
        if (hasAppId || hasSecret) {
            // 凭据只配置了一半：视同未配置，明确告警（生产会在下一步直接拒绝）
            log.warn("[wechat] 微信凭据只配置了一半（appid={}，secret 是否配置={}），无法走真实登录",
                    hasAppId ? "已配置" : "缺失", hasSecret);
        }
        if (!devMockEnabled) {
            // fail-closed：生产漏配凭据时拒绝服务，绝不回退为"所有用户共用一个 mock 账号"
            log.error("[wechat] 微信凭据未配置且 mock 登录未开启（thrombosis.dev.mock.enabled=false），拒绝微信登录");
            throw new BusinessException(ErrorCode.SERVER_ERROR, "微信登录未配置，请联系管理员");
        }
        log.info("[mock] 微信凭据未配置，使用 dev mock 登录（thrombosis.dev.mock.enabled=true）");
        return mockOpenid(code);
    }

    /**
     * dev mock openid 规则：
     *  - 普通 code → 固定稳定 openid（模拟"同一微信用户身份恒定"，保证注册后换 code 重登仍可识别）
     *  - user_ 前缀 code（如 user_001）→ 命中同名 seed 演示账号（mock_openid_user_001 = 张阿姨），便于本地演示
     */
    private String mockOpenid(String code) {
        if (code != null && code.startsWith("user_")) {
            return openidPrefix + code;
        }
        return openidPrefix + "stable";
    }

    private String code2session(String code) {
        String url = String.format(WX_CODE2SESSION_URL,
                enc(wxAppId), enc(wxSecret), enc(code));
        try {
            HttpClient client = HttpClient.newBuilder()
                    .connectTimeout(Duration.ofSeconds(5))
                    .build();
            HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            JsonNode json = MAPPER.readTree(resp.body());
            if (json.hasNonNull("errcode") && json.get("errcode").asInt() != 0) {
                int errcode = json.get("errcode").asInt();
                String errmsg = json.path("errmsg").asText("");
                log.warn("[wechat] code2session 失败 errcode={} errmsg={}", errcode, errmsg);
                // 40029: code 无效 / 40163: code 已被使用（code 一次性，5 分钟内有效）
                if (errcode == 40029 || errcode == 40163) {
                    throw new BusinessException(ErrorCode.SERVER_ERROR, "微信登录凭证已失效，请重新授权");
                }
                throw new BusinessException(ErrorCode.SERVER_ERROR, "微信登录失败，请稍后重试");
            }
            String openid = json.path("openid").asText(null);
            if (openid == null || openid.isBlank()) {
                throw new BusinessException(ErrorCode.SERVER_ERROR, "微信登录失败：未获取到用户标识");
            }
            return openid;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            log.error("[wechat] code2session 调用异常", e);
            throw new BusinessException(ErrorCode.SERVER_ERROR, "微信登录失败，请稍后重试");
        }
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
