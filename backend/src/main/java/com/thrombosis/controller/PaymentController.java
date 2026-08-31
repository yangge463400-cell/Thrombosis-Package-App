package com.thrombosis.controller;

import com.thrombosis.common.Result;
import com.thrombosis.service.OrderService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 支付相关：dev 模式模拟微信回调
 */
@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final OrderService orderService;

    @Value("${thrombosis.dev.mock.payment:false}")
    private boolean mockPaymentEnabled;

    /**
     * 模拟微信支付回调（仅开发环境，thrombosis.dev.mock.payment=true 时可用）
     */
    @PostMapping("/mock-callback")
    public Result<Map<String, Object>> mockCallback(@org.springframework.web.bind.annotation.RequestBody Map<String, Object> body) {
        if (!mockPaymentEnabled) {
            // 注意：这里不能用 401——小程序请求层把 body code=401 一律视为"登录过期"强制登出，
            // 功能未开放属业务拒绝，用 403 区分（N9 修复）
            return Result.error(403, "模拟支付未开放（生产环境请走微信支付）");
        }
        Object orderIdObj = body.get("orderId");
        if (orderIdObj == null) {
            return Result.error(500, "orderId 不能为空");
        }
        Long orderId = Long.valueOf(String.valueOf(orderIdObj));
        // 归属校验：仅允许为本人订单支付（微信支付回调语义上也是为当前用户自己的订单扣款）
        Long userId = com.thrombosis.security.UserContext.currentUserId();
        var o = orderService.mockPayCallback(orderId, userId);
        return Result.ok(Map.of("orderId", o.getId(), "status", o.getStatus(), "verifyCode", o.getVerifyCode()));
    }
}
