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

    /** 医护校验核销码（与 confirm 一致的跨医院拦截，防止 check 阶段泄露他院订单信息） */
    public Map<String, Object> check(String code, Long staffHospitalId) {
        Orders o = ordersMapper.selectOne(new LambdaQueryWrapper<Orders>().eq(Orders::getVerifyCode, code));
        if (o == null) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "核销码无效");
        }
        // 跨医院拦截：与 confirm 同款校验，他院核销码一律拒绝，不返回任何订单信息
        if (o.getHospitalId() == null || !o.getHospitalId().equals(staffHospitalId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "该核销码仅限下单医院核销，本院无权核销");
        }
        if ("completed".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "该核销码已使用完毕");
        }
        if (!"paid".equals(o.getStatus()) && !"verified".equals(o.getStatus())) {
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
        // 原子核销：带 status='paid' 条件的条件更新（compare-and-set），
        // 并发请求只有一个能更新成功，杜绝 check-then-act 竞态产生重复核销记录
        // 状态机：paid →(核销)→ verified(检测中)；出具检测结果后转 completed（见 ResultService.upload）
        o.setStatus("verified");
        LocalDateTime verifyTime = LocalDateTime.now();
        int updated = ordersMapper.update(null,
                new com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper<Orders>()
                        .eq(Orders::getId, o.getId())
                        .eq(Orders::getStatus, "paid")
                        .set(Orders::getStatus, o.getStatus())
                        .set(Orders::getHospitalId, staffHospitalId)
                        .set(Orders::getVerifyTime, verifyTime));
        if (updated == 0) {
            // 未更新到行：并发中已被其他请求核销，按幂等处理
            Map<String, Object> r = new HashMap<>();
            r.put("already", true);
            r.put("message", "该核销码已核销");
            return r;
        }

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
        vr.setVerifyTime(verifyTime);
        vr.setStatus("verified");
        verifyRecordMapper.insert(vr);

        messageService.send(o.getUserId(), "order", "核销成功",
                "您订单「" + o.getPackageName() + "」已完成核销，检测进行中，报告出具后可在检测结果中查看。", "order", String.valueOf(o.getId()));

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
