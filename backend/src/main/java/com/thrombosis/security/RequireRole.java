package com.thrombosis.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 接口角色守卫：标注在 Controller 方法上，要求当前 token 的 role 命中指定角色。
 * 未标注的接口仅要求登录（除公开白名单外）。
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
public @interface RequireRole {
    String[] value();
}
