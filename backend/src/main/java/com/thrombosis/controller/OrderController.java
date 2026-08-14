package com.thrombosis.controller;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.thrombosis.common.BusinessException;
import com.thrombosis.common.ErrorCode;
import com.thrombosis.common.Result;
import com.thrombosis.dto.CreateOrderRequest;
import com.thrombosis.dto.OrderVO;
import com.thrombosis.dto.PageResult;
import com.thrombosis.entity.Orders;
import com.thrombosis.mapper.OrdersMapper;
import com.thrombosis.security.UserContext;
import com.thrombosis.service.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrdersMapper ordersMapper;

    @PostMapping
    public Result<Map<String, Object>> create(@Valid @RequestBody CreateOrderRequest req) {
        return Result.ok(orderService.create(UserContext.currentUserId(), req));
    }

    @GetMapping
    public Result<PageResult<OrderVO>> list(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.ok(orderService.list(UserContext.currentUserId(), status, page, pageSize));
    }

    @GetMapping("/{id}")
    public Result<OrderVO> detail(@PathVariable Long id) {
        return Result.ok(orderService.detail(UserContext.currentUserId(), id));
    }

    @PostMapping("/{id}/cancel")
    public Result<Void> cancel(@PathVariable Long id) {
        orderService.cancel(UserContext.currentUserId(), id);
        return Result.ok();
    }

    /**
     * 核销二维码（PNG）：内容为核销码数字，供微信小程序 <image> 直接加载展示；
     * 公开访问（核销码本身随机不可猜测，安全性由 verify/check 校验保障）。
     */
    @GetMapping(value = "/{id}/qrcode", produces = MediaType.IMAGE_PNG_VALUE)
    public byte[] qrcode(@PathVariable Long id) throws Exception {
        Orders o = ordersMapper.selectById(id);
        if (o == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "订单不存在");
        }
        if (o.getVerifyCode() == null) {
            throw new BusinessException(ErrorCode.SERVER_ERROR, "订单尚未生成核销码");
        }
        Map<EncodeHintType, Object> hints = new HashMap<>();
        hints.put(EncodeHintType.CHARACTER_SET, "UTF-8");
        hints.put(EncodeHintType.MARGIN, 1);
        BitMatrix matrix = new MultiFormatWriter().encode(
                o.getVerifyCode(), BarcodeFormat.QR_CODE, 360, 360, hints);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        MatrixToImageWriter.writeToStream(matrix, "PNG", baos);
        return baos.toByteArray();
    }
}
