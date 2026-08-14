package com.thrombosis.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 用户信息响应
 */
@Data
public class UserVO {
    private Long id;
    private String phone;
    private String nickname;
    private String avatar;
    private Integer gender;
    private Integer age;
    private Integer height;
    private BigDecimal weight;
    private String role;
    private Long hospitalId;
}
