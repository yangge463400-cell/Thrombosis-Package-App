package com.thrombosis.dto;

import lombok.Data;

/**
 * 微信登录结果
 */
@Data
public class WechatLoginResult {
    /** 是否已注册 */
    private Boolean isRegistered;
    /** 已注册时返回 */
    private String token;
    private UserVO user;
    /** 未注册时返回，用于注册接口关联 openid */
    private String registerTicket;
}
