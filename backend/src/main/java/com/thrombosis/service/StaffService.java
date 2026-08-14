package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.User;
import com.thrombosis.entity.VerifyRecord;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.UserMapper;
import com.thrombosis.mapper.VerifyRecordMapper;
import com.thrombosis.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class StaffService {

    private final UserMapper userMapper;
    private final VerifyRecordMapper verifyRecordMapper;
    private final OrdersMapper ordersMapper;
    private final JwtUtil jwtUtil;

    /** 医护登录（手机号+密码，role=staff） */
    public Map<String, Object> login(String phone, String password) {
        User u = userMapper.selectOne(new LambdaQueryWrapper<User>().eq(User::getPhone, phone));
        if (u == null || !"staff".equals(u.getRole())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        if (u.getPassword() == null || !encoder.matches(password, u.getPassword())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "账号或密码错误");
        }
        if (u.getHospitalId() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "无核销权限，请联系管理员");
        }
        Map<String, Object> r = new HashMap<>();
        r.put("token", jwtUtil.generate(u.getId(), u.getRole(), u.getHospitalId()));
        r.put("staffId", u.getId());
        r.put("staffName", u.getNickname());
        r.put("hospitalId", u.getHospitalId());
        r.put("role", u.getRole());
        return r;
    }

    /** 医护工作台统计：今日核销数 / 待处理（本院已支付未核销） */
    public Map<String, Object> statistics(Long hospitalId) {
        LocalDate today = LocalDate.now();
        Long todayVerified = verifyRecordMapper.selectCount(new LambdaQueryWrapper<VerifyRecord>()
                .eq(VerifyRecord::getHospitalId, hospitalId)
                .ge(VerifyRecord::getVerifyTime, today.atStartOfDay())
                .lt(VerifyRecord::getVerifyTime, today.plusDays(1).atStartOfDay()));
        // 待处理：已支付但未核销的订单
        Long pendingCount = ordersMapper.selectCount(new LambdaQueryWrapper<Orders>()
                .eq(Orders::getStatus, "paid")
                .isNull(Orders::getVerifyTime));
        Map<String, Object> r = new HashMap<>();
        r.put("todayVerified", todayVerified == null ? 0 : todayVerified);
        r.put("pendingCount", pendingCount == null ? 0 : pendingCount);
        return r;
    }
}
