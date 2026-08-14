package com.thrombosis.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

import java.math.BigDecimal;

/**
 * 个人档案更新（性别/年龄/身高/体重/昵称/头像）
 */
@Data
public class ProfileUpdateRequest {
    @Min(value = 0, message = "性别参数非法")
    @Max(value = 2, message = "性别参数非法")
    private Integer gender;
    @Min(value = 1, message = "年龄需在 1-120 之间")
    @Max(value = 120, message = "年龄需在 1-120 之间")
    private Integer age;
    @Min(value = 50, message = "身高需在 50-250cm 之间")
    @Max(value = 250, message = "身高需在 50-250cm 之间")
    private Integer height;
    @Min(value = 10, message = "体重需在 10-300kg 之间")
    @Max(value = 300, message = "体重需在 10-300kg 之间")
    private BigDecimal weight;
    private String nickname;
    private String avatar;
}
