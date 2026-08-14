package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("verify_record")
public class VerifyRecord {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String code;
    private Long orderId;
    private Long packageId;
    private String packageName;
    private Long hospitalId;
    private Long staffId;
    private Long userId;
    private String userPhone;
    private LocalDateTime verifyTime;
    private String status;
}
