package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("orders")
public class Orders {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String orderNo;
    private Long userId;
    private Long packageId;
    private String packageName;
    private BigDecimal amount;
    private BigDecimal payAmount;
    private String status;
    private String payChannel;
    private LocalDateTime payTime;
    private String verifyCode;
    private Long hospitalId;
    private LocalDateTime verifyTime;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
