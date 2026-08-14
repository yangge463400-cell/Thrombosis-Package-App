package com.thrombosis.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.dto.PageResult;
import com.thrombosis.dto.UploadResultRequest;
import com.thrombosis.entity.Hospital;
import com.thrombosis.entity.Orders;
import com.thrombosis.entity.TestResult;
import com.thrombosis.mapper.HospitalMapper;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.mapper.TestResultMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ResultService {

    private final TestResultMapper resultMapper;
    private final HospitalMapper hospitalMapper;
    private final OrdersMapper ordersMapper;
    private final MessageService messageService;

    public PageResult<TestResult> list(Long userId, int page, int pageSize) {
        Page<TestResult> p = new Page<>(page, pageSize);
        resultMapper.selectPage(p, new LambdaQueryWrapper<TestResult>()
                .eq(TestResult::getUserId, userId)
                .orderByDesc(TestResult::getCreatedAt));
        return PageResult.of(p.getRecords(), p.getTotal(), page, pageSize);
    }

    public Map<String, Object> detail(Long userId, Long id) {
        TestResult r = resultMapper.selectById(id);
        if (r == null || !r.getUserId().equals(userId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "检测结果不存在");
        }
        Map<String, Object> vo = new HashMap<>();
        vo.put("id", r.getId());
        vo.put("orderId", r.getOrderId());
        vo.put("packageId", r.getPackageId());
        vo.put("hospitalId", r.getHospitalId());
        vo.put("reportItems", r.getReportItems());
        vo.put("reportUrl", r.getReportUrl());
        vo.put("status", r.getStatus());
        vo.put("uploadedAt", r.getUploadedAt());
        vo.put("publishedAt", r.getPublishedAt());
        if (r.getHospitalId() != null) {
            Hospital h = hospitalMapper.selectById(r.getHospitalId());
            if (h != null) {
                vo.put("hospitalName", h.getName());
            }
        }
        return vo;
    }

    /**
     * 医护出具检测结果（staff 专属，跨医院拦截）：
     * 订单 检测中(verified) → 已完成(completed)，结果写入 test_result 并推送站内消息。
     */
    @Transactional
    public void upload(Long staffHospitalId, Long staffId, UploadResultRequest req) {
        Orders o;
        if (req.getCode() != null && !req.getCode().isBlank()) {
            o = ordersMapper.selectOne(new LambdaQueryWrapper<Orders>().eq(Orders::getVerifyCode, req.getCode()));
        } else if (req.getOrderId() != null) {
            o = ordersMapper.selectById(req.getOrderId());
        } else {
            throw new BusinessException(ErrorCode.VERIFY_CODE_INVALID, "请提供核销码或订单号");
        }
        if (o == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
        }
        // 跨医院拦截：仅下单医院可出具结果
        if (o.getHospitalId() == null || !o.getHospitalId().equals(staffHospitalId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "该订单不属于本院，无法出具结果");
        }
        // 核销即完成，出具结果仅对已完成（已核销）订单开放；幂等更新已有结果
        if (!"completed".equals(o.getStatus())) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "订单未核销，无法出具结果");
        }

        TestResult exist = resultMapper.selectOne(
                new LambdaQueryWrapper<TestResult>().eq(TestResult::getOrderId, o.getId()));
        Long resultId;
        if (exist != null) {
            exist.setReportItems(req.getReportItems());
            exist.setReportUrl(req.getReportUrl());
            exist.setStatus("published");
            exist.setPublishedAt(LocalDateTime.now());
            resultMapper.updateById(exist);
            resultId = exist.getId();
        } else {
            TestResult r = new TestResult();
            r.setOrderId(o.getId());
            r.setUserId(o.getUserId());
            r.setPackageId(o.getPackageId());
            r.setHospitalId(staffHospitalId);
            r.setReportItems(req.getReportItems());
            r.setReportUrl(req.getReportUrl());
            r.setStatus("published");
            r.setUploadedAt(LocalDateTime.now());
            r.setPublishedAt(LocalDateTime.now());
            resultMapper.insert(r);
            resultId = r.getId();
        }

        // 订单完成
        o.setStatus("completed");
        ordersMapper.updateById(o);

        messageService.send(o.getUserId(), "result", "检测结果已出具",
                "您订单「" + o.getPackageName() + "」的检测结果已出具，请前往查看。",
                "result", String.valueOf(resultId));
    }
}
