package com.thrombosis.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 订单响应（含核销码）
 */
@Data
public class OrderVO {
    private Long id;
    private String orderNo;
    private Long packageId;
    private String packageName;
    private String cover;
    private BigDecimal amount;
    private BigDecimal payAmount;
    private String status;
    private String payChannel;
    private LocalDateTime payTime;
    private String verifyCode;
    private Long hospitalId;
    private String hospitalName;
    private LocalDateTime verifyTime;
    private LocalDateTime createdAt;
}
