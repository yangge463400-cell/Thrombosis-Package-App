package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pay_bill")
public class PayBill {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long orderId;
    private String channel;
    private String tradeNo;
    private BigDecimal amount;
    private String status;
    private LocalDateTime paidAt;
    private LocalDateTime syncAt;
    private String reconcileStatus;
}
