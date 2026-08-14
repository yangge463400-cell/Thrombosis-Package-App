package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "test_result", autoResultMap = true)
public class TestResult {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long orderId;
    private Long userId;
    private Long packageId;
    private Long hospitalId;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> reportItems;
    private String reportUrl;
    private String status;
    private LocalDateTime uploadedAt;
    private LocalDateTime publishedAt;
    private LocalDateTime createdAt;
}
