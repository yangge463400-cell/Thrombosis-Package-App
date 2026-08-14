package com.thrombosis.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("`user`")
public class User {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String openid;
    private String unionid;
    private String phone;
    private String password;
    private String nickname;
    private String avatar;
    private Integer gender;
    private Integer age;
    private Integer height;
    private BigDecimal weight;
    private String role;
    private Long hospitalId;
    private Integer status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
