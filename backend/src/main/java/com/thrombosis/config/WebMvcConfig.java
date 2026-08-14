package com.thrombosis.config;

import com.thrombosis.security.AuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final AuthInterceptor authInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/**",          // 登录注册
                        "/api/packages/**",      // 套餐浏览（公开）
                        "/api/dicts/**",         // 字典
                        "/api/hospitals",        // 医院列表（公开）
                        "/api/admin/login",      // 管理端登录
                        "/api/staff/login",      // 医护登录
                        "/api/orders/*/qrcode"   // 核销二维码（小程序 image 标签加载，不可带 Authorization 头）
                );
    }
}
