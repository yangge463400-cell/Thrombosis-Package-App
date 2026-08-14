package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "medication", autoResultMap = true)
public class Medication {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private String drugName;
    private String dosePerTime;
    private Integer timesPerDay;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> timePoints;
    private Integer reminderOn;
    private String status;
    private LocalDate startAt;
    private LocalDate endAt;
    private String doctorAssessed;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
