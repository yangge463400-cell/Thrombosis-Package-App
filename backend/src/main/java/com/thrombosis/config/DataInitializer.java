package com.thrombosis.config;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.entity.User;
import com.thrombosis.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 启动时初始化测试账号（seed.sql 不含账号，密码经 BCrypt 编码）
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final UserMapper userMapper;
    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    @Value("${thrombosis.dev.mock.openid-prefix:mock_openid_}")
    private String openidPrefix;

    /** 初始密码支持环境变量注入：生产部署必须覆盖默认弱密码（见 deploy/README.md） */
    @Value("${thrombosis.init.staff-password:123456}")
    private String initStaffPassword;
    @Value("${thrombosis.init.admin-password:admin123}")
    private String initAdminPassword;
    @Value("${thrombosis.init.hospital-admin-password:admin123}")
    private String initHospitalAdminPassword;
    /** 演示用户（张阿姨，openid 与 dev mock 前缀绑定）：生产必须关闭，否则污染真实用户表 */
    @Value("${thrombosis.init.demo-user:true}")
    private boolean initDemoUser;

    @Override
    public void run(String... args) {
        // 存量库幂等补齐核销码唯一索引（并发下防止核销码重复）
        ensureVerifyCodeUniqueIndex();

        // 测试用户（id=1，与 seed.sql 中消息/订单关联）
        if (initDemoUser) {
            ensureUser(new User() {{
                setId(1L);
                setOpenid(openidPrefix + "user_001");
                setPhone("13800000001");
                setNickname("张阿姨");
                setRole("user");
                setStatus(1);
            }}, "openid");
        }

        // 医护（登录账号 13800000000 / 123456）
        ensureUser(new User() {{
            setPhone("13800000000");
            setPassword(encoder.encode(initStaffPassword));
            setNickname("李医生");
            setRole("staff");
            setHospitalId(1L);
            setStatus(1);
        }}, "phone");

        // 平台管理员（admin，密码可用环境变量覆盖）
        ensureUser(new User() {{
            setPhone("admin");
            setPassword(encoder.encode(initAdminPassword));
            setNickname("平台管理员");
            setRole("admin");
            setStatus(1);
        }}, "phone");

        // 医院管理员（hospital_admin，绑定北京协和 id=1，密码可用环境变量覆盖）
        ensureUser(new User() {{
            setPhone("hospital_admin");
            setPassword(encoder.encode(initHospitalAdminPassword));
            setNickname("协和医院管理员");
            setRole("hospital_admin");
            setHospitalId(1L);
            setStatus(1);
        }}, "phone");

        log.info("[init] 测试账号就绪：用户(微信登录) / 医护 13800000000/123456 / 平台 admin/admin123 / 医院 hospital_admin/admin123");
    }

    private void ensureUser(User u, String byField) {
        LambdaQueryWrapper<User> qw = new LambdaQueryWrapper<>();
        if ("openid".equals(byField)) {
            qw.eq(User::getOpenid, u.getOpenid());
        } else {
            qw.eq(User::getPhone, u.getPhone());
        }
        Long cnt = userMapper.selectCount(qw);
        if (cnt != null && cnt > 0) {
            return;
        }
        userMapper.insert(u);
    }

    /** 幂等：为 orders.verify_code 补唯一索引（逻辑查重之外的数据库兜底） */
    private void ensureVerifyCodeUniqueIndex() {
        try {
            jdbcTemplate.execute("ALTER TABLE orders ADD UNIQUE KEY uk_verify_code (verify_code)");
            log.info("[init] orders.verify_code 唯一索引已创建");
        } catch (Exception e) {
            log.info("[init] orders.verify_code 唯一索引已存在，跳过");
        }
    }
}
