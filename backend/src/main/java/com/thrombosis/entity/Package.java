package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
@TableName(value = "package", autoResultMap = true)
public class Package {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private BigDecimal price;
    private String cover;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> images;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<Map<String, Object>> items;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> targetPopulation;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> cities;
    private Integer hospitalCount;
    private Integer salesCount;
    private String notice;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
