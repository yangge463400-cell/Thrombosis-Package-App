package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.User;
import com.thrombosis.entity.VerifyRecord;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.UserMapper;
import com.thrombosis.mapper.VerifyRecordMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class VerifyService {

    private final OrdersMapper ordersMapper;
    private final VerifyRecordMapper verifyRecordMapper;
    private final UserMapper userMapper;
    private final MessageService messageService;

    /** 医护校验核销码 */
    public Map<String, Object> check(String code) {
        Orders o = ordersMapper.selectOne(new LambdaQueryWrapper<Orders>().eq(Orders::getVerifyCode, code));
        if (o == null) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "核销码无效");
        }
        if ("verified".equals(o.getStatus()) || "completed".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "该核销码已被使用");
        }
        if (!"paid".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "核销码无效或已过期");
        }
        User u = userMapper.selectById(o.getUserId());
        Map<String, Object> r = new HashMap<>();
        r.put("orderId", o.getId());
        r.put("orderNo", o.getOrderNo());
        r.put("packageId", o.getPackageId());
        r.put("packageName", o.getPackageName());
        r.put("verifyCode", code);
        r.put("userPhone", u == null ? "" : AuthService.maskPhone(u.getPhone()));
        r.put("status", o.getStatus());
        r.put("payTime", o.getPayTime());
        return r;
    }

    /** 确认核销（幂等：已核销直接返回成功）
     *  hospitalId 强制使用医护账号所属医院（由调用方传入 UserContext 值，非客户端可控），
     *  并校验与下单时绑定的医院一致，实现跨医院核销拦截。 */
    @Transactional
    public Map<String, Object> confirm(String code, Long staffHospitalId, Long staffId) {
        Orders o = ordersMapper.selectOne(new LambdaQueryWrapper<Orders>().eq(Orders::getVerifyCode, code));
        if (o == null) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "核销码无效");
        }
        // 跨医院拦截：订单绑定的医院 ≠ 医护所属医院 → 拒绝核销（无论是否已核销，防止探测/越权）
        if (o.getHospitalId() == null || !o.getHospitalId().equals(staffHospitalId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "该核销码仅限下单医院核销，本院无权核销");
        }
        boolean already = "verified".equals(o.getStatus()) || "completed".equals(o.getStatus());
        if (already) {
            Map<String, Object> r = new HashMap<>();
            r.put("already", true);
            r.put("message", "该核销码已核销");
            return r;
        }
        if (!"paid".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "核销码无效或已过期");
        }
        // 业务规则：核销即完成（无独立"检测中"状态）
        o.setStatus("completed");
        o.setHospitalId(staffHospitalId);
        o.setVerifyTime(LocalDateTime.now());
        ordersMapper.updateById(o);

        User u = userMapper.selectById(o.getUserId());
        VerifyRecord vr = new VerifyRecord();
        vr.setCode(code);
        vr.setOrderId(o.getId());
        vr.setPackageId(o.getPackageId());
        vr.setPackageName(o.getPackageName());
        vr.setHospitalId(staffHospitalId);
        vr.setStaffId(staffId);
        vr.setUserId(o.getUserId());
        vr.setUserPhone(u == null ? "" : AuthService.maskPhone(u.getPhone()));
        vr.setVerifyTime(LocalDateTime.now());
        vr.setStatus("verified");
        verifyRecordMapper.insert(vr);

        messageService.send(o.getUserId(), "order", "核销成功",
                "您订单「" + o.getPackageName() + "」已完成核销，检测服务已完成。", "order", String.valueOf(o.getId()));

        Map<String, Object> r = new HashMap<>();
        r.put("already", false);
        r.put("verifyCode", code);
        r.put("orderId", o.getId());
        return r;
    }

    /** 核销记录（医护端按日期） */
    public PageResult<VerifyRecord> records(Long hospitalId, LocalDate date, int page, int pageSize) {
        LambdaQueryWrapper<VerifyRecord> qw = new LambdaQueryWrapper<VerifyRecord>()
                .eq(VerifyRecord::getHospitalId, hospitalId)
                .orderByDesc(VerifyRecord::getVerifyTime);
        if (date != null) {
            qw.ge(VerifyRecord::getVerifyTime, date.atStartOfDay())
              .lt(VerifyRecord::getVerifyTime, date.plusDays(1).atStartOfDay());
        }
        Page<VerifyRecord> p = new Page<>(page, pageSize);
        verifyRecordMapper.selectPage(p, qw);
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }
}
